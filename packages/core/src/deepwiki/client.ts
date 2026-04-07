import { basename, resolve } from 'node:path'
import type { WikiResult, FlowDiagram, WikiPageResult } from '../types.js'

const DEEPWIKI_URL = process.env.DEEPWIKI_URL ?? 'http://localhost:3000'
const DEEPWIKI_API_URL = process.env.DEEPWIKI_API_URL ?? 'http://localhost:8001'
const DEFAULT_LANGUAGE = 'en'

export interface DeepWikiGenerateOptions {
  repoUrl?: string
  localPath?: string
  provider?: string
}

interface DeepWikiModelConfig {
  defaultProvider: string
  providers: Array<{
    id: string
    models: Array<{ id: string; name: string }>
  }>
}

interface LocalRepoStructure {
  file_tree: string
  readme: string
}

interface LocalRepoInclusionFilters {
  includedDirs?: string
  includedFiles?: string
}

interface ParsedWikiPage {
  id: string
  title: string
  description: string
  importance: 'high' | 'medium' | 'low'
  filePaths: string[]
  relatedPages: string[]
}

interface ParsedWikiStructure {
  title: string
  description: string
  pages: ParsedWikiPage[]
}

/**
 * Call DeepWiki Open to generate wiki from a repo/local project.
 * For local paths, this uses the real backend streaming pipeline on port 8001.
 */
export async function generateWiki(opts: DeepWikiGenerateOptions): Promise<WikiResult> {
  const { repoUrl, localPath } = opts
  const requestedProvider = opts.provider ?? getConfiguredDeepWikiProvider()

  if (!repoUrl && !localPath) {
    throw new Error('Either repoUrl or localPath must be provided')
  }

  if (localPath) {
    return generateLocalWiki(localPath, requestedProvider)
  }

  const provider = normalizeProviderName(requestedProvider) ?? 'google'
  const response = await fetch(`${DEEPWIKI_URL}/api/wiki/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo: repoUrl,
      provider,
      language: DEFAULT_LANGUAGE,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepWiki API error: ${response.status} - ${await response.text()}`)
  }

  const data = await response.json() as Record<string, unknown>
  return parseWikiResponse(data)
}

export async function checkDeepWikiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${DEEPWIKI_API_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function generateLocalWiki(localPath: string, requestedProvider?: string): Promise<WikiResult> {
  const mappedLocalPath = mapLocalPathToContainer(localPath)
  const repoName = basename(resolve(localPath)) || 'local-repo'
  const repoOwner = 'local'
  const modelConfig = await fetchJson<DeepWikiModelConfig>(`${DEEPWIKI_API_URL}/models/config`)
  const provider = pickProvider(requestedProvider, modelConfig)
  const model = pickModel(provider, modelConfig)
  const structure = await fetchJson<LocalRepoStructure>(
    `${DEEPWIKI_API_URL}/local_repo/structure?path=${encodeURIComponent(mappedLocalPath)}`
  )
  const inclusionFilters = deriveLocalInclusionFilters(structure.file_tree)

  const wikiStructure = await determineWikiStructure({
    fileTree: structure.file_tree,
    readme: structure.readme,
    repoName,
    repoOwner,
    provider,
    model,
    repoPath: mappedLocalPath,
    inclusionFilters,
  })

  const generatedPages: WikiPageResult[] = []
  for (const page of wikiStructure.pages) {
    const content = await generateWikiPage({
      page,
      provider,
      model,
      repoPath: mappedLocalPath,
      language: DEFAULT_LANGUAGE,
      inclusionFilters,
    })
    generatedPages.push({
      id: page.id,
      title: page.title,
      description: page.description,
      importance: page.importance,
      filePaths: page.filePaths,
      relatedPages: page.relatedPages,
      content: content.trim(),
    })
  }

  const rawMarkdown = [
    `# ${wikiStructure.title || repoName}`,
    '',
    wikiStructure.description,
    '',
    ...generatedPages.flatMap((page) => ['---', '', page.content, '']),
  ].join('\n').trim()

  return {
    title: wikiStructure.title || repoName,
    overview: wikiStructure.description,
    architecture: generatedPages.find((page) => /architecture/i.test(page.title) || /architecture/i.test(page.content))?.content ?? '',
    techStack: extractTechFromWiki(rawMarkdown),
    flows: extractFlowDiagrams(rawMarkdown),
    rawMarkdown,
    pages: generatedPages,
  }
}

async function determineWikiStructure(input: {
  fileTree: string
  readme: string
  repoName: string
  repoOwner: string
  provider: string
  model: string
  repoPath: string
  inclusionFilters: LocalRepoInclusionFilters
}): Promise<ParsedWikiStructure> {
  const prompt = [
    `Analyze the local repository ${input.repoOwner}/${input.repoName} and create a concise wiki structure for it.`,
    '',
    '1. Complete file tree:',
    '<file_tree>',
    input.fileTree,
    '</file_tree>',
    '',
    '2. README content:',
    '<readme>',
    input.readme,
    '</readme>',
    '',
    'Return only valid XML in this exact shape:',
    '<wiki_structure>',
    '  <title>[Overall wiki title]</title>',
    '  <description>[Brief repository description]</description>',
    '  <pages>',
    '    <page id="page-1">',
    '      <title>[Page title]</title>',
    '      <description>[What the page covers]</description>',
    '      <importance>high|medium|low</importance>',
    '      <relevant_files>',
    '        <file_path>[Relevant file path]</file_path>',
    '      </relevant_files>',
    '      <related_pages>',
    '        <related>page-2</related>',
    '      </related_pages>',
    '    </page>',
    '  </pages>',
    '</wiki_structure>',
    '',
    'Rules:',
    '- Create 4-6 pages.',
    '- Each page must focus on a distinct subsystem or capability.',
    '- Use actual file paths from the repository.',
    '- Return XML only, with no markdown fences or explanation.',
  ].join('\n')

  const response = await streamChatCompletion({
    repo_url: input.repoPath,
    type: 'local',
    provider: input.provider,
    model: input.model,
    language: DEFAULT_LANGUAGE,
    ...(input.inclusionFilters.includedDirs ? { included_dirs: input.inclusionFilters.includedDirs } : {}),
    ...(input.inclusionFilters.includedFiles ? { included_files: input.inclusionFilters.includedFiles } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  return parseWikiStructureXml(response)
}

async function generateWikiPage(input: {
  page: ParsedWikiPage
  provider: string
  model: string
  repoPath: string
  language: string
  inclusionFilters: LocalRepoInclusionFilters
}): Promise<string> {
  const relevantFiles = input.page.filePaths.length > 0
    ? input.page.filePaths
    : ['README.md']

  const prompt = [
    'You are an expert technical writer and software architect.',
    `Generate a markdown wiki page for "${input.page.title}".`,
    '',
    'Requirements:',
    '- Start with a <details> block listing the relevant source files used.',
    '- Then write a H1 title.',
    '- Explain the architecture, behavior, and key implementation details.',
    '- Use Mermaid diagrams when they help clarify flows or structure.',
    '- Use markdown tables when useful.',
    '- Ground all claims in the repository content accessed through retrieval.',
    '',
    'Relevant source files:',
    ...relevantFiles.map((filePath) => `- ${filePath}`),
    '',
    `Focus area: ${input.page.description}`,
    `Importance: ${input.page.importance}`,
    '',
    'Return markdown only.',
  ].join('\n')

  const response = await streamChatCompletion({
    repo_url: input.repoPath,
    type: 'local',
    provider: input.provider,
    model: input.model,
    language: input.language,
    ...(input.inclusionFilters.includedDirs ? { included_dirs: input.inclusionFilters.includedDirs } : {}),
    ...(input.inclusionFilters.includedFiles ? { included_files: input.inclusionFilters.includedFiles } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  return response
    .replace(/^```markdown\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

async function streamChatCompletion(body: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${DEEPWIKI_API_URL}/chat/completions/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(formatDeepWikiError(errorText, response.status))
  }

  if (!response.body) {
    throw new Error('DeepWiki stream response did not include a body.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }

  result += decoder.decode()
  return result.trim()
}

function parseWikiStructureXml(xmlText: string): ParsedWikiStructure {
  const xml = xmlText
    .replace(/^```(?:xml)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  const providerError = parseProviderError(xml)
  if (providerError) {
    throw new Error(`DeepWiki provider error: ${providerError}`)
  }

  const blockMatch = xml.match(/<wiki_structure>[\s\S]*<\/wiki_structure>/i)
  if (!blockMatch) {
    const snippet = compactSnippet(xml)
    throw new Error(`DeepWiki did not return a valid <wiki_structure> XML block. Response snippet: ${snippet}`)
  }

  const block = blockMatch[0]
  const pages: ParsedWikiPage[] = []
  const pageRegex = /<page\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/page>/gi
  let pageMatch: RegExpExecArray | null

  while ((pageMatch = pageRegex.exec(block)) !== null) {
    const pageBody = pageMatch[2]
    pages.push({
      id: pageMatch[1],
      title: extractXmlTag(pageBody, 'title') || pageMatch[1],
      description: extractXmlTag(pageBody, 'description') || '',
      importance: normalizeImportance(extractXmlTag(pageBody, 'importance')),
      filePaths: extractXmlTags(pageBody, 'file_path'),
      relatedPages: extractXmlTags(pageBody, 'related'),
    })
  }

  if (pages.length === 0) {
    throw new Error('DeepWiki returned wiki structure XML without any pages.')
  }

  return {
    title: extractXmlTag(block, 'title') || 'Project Wiki',
    description: extractXmlTag(block, 'description') || '',
    pages,
  }
}

function extractXmlTag(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  return match?.[1]?.trim()
}

function extractXmlTags(xml: string, tagName: string): string[] {
  const matches = xml.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'gi'))
  return Array.from(matches, (match) => match[1].trim()).filter(Boolean)
}

function normalizeImportance(value?: string): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'low') return value
  return 'medium'
}

function pickProvider(requestedProvider: string | undefined, config: DeepWikiModelConfig): string {
  const normalized = normalizeProviderName(requestedProvider)
  if (normalized && config.providers.some((provider) => provider.id === normalized)) {
    return normalized
  }

  return config.defaultProvider
}

function pickModel(provider: string, config: DeepWikiModelConfig): string {
  const providerConfig = config.providers.find((entry) => entry.id === provider)
  const firstModel = providerConfig?.models?.[0]?.id
  if (!firstModel) {
    throw new Error(`No model is configured for DeepWiki provider "${provider}".`)
  }

  return firstModel
}

function normalizeProviderName(provider?: string): string | undefined {
  if (!provider) return undefined

  if (provider === 'gemini') return 'google'
  if (provider === 'claude') return 'anthropic'
  return provider
}

function getConfiguredDeepWikiProvider(): string | undefined {
  return process.env.LLM_PROVIDER ?? process.env.DEFAULT_PROVIDER
}

function mapLocalPathToContainer(localPath: string): string {
  let mappedLocalPath = localPath.replace(/\\/g, '/')

  if (mappedLocalPath.includes('ai-planner/')) {
    mappedLocalPath = '/workspace/' + mappedLocalPath.split('ai-planner/')[1]
  } else if (!mappedLocalPath.startsWith('/') && !mappedLocalPath.match(/^[a-zA-Z]:\//)) {
    mappedLocalPath = '/workspace/' + mappedLocalPath
  } else if (mappedLocalPath.match(/^[a-zA-Z]:\//)) {
    mappedLocalPath = '/workspace/' + mappedLocalPath.split('/').slice(3).join('/')
  }

  return mappedLocalPath
}

function deriveLocalInclusionFilters(fileTree: string): LocalRepoInclusionFilters {
  const dirs = new Set<string>()
  const files = new Set<string>()

  for (const rawLine of fileTree.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const normalizedLine = line.replace(/\\/g, '/')
    const [firstSegment, ...rest] = normalizedLine.split('/')
    if (!firstSegment) continue

    if (rest.length === 0) {
      files.add(firstSegment)
      continue
    }

    dirs.add(firstSegment)
  }

  return {
    includedDirs: dirs.size > 0 ? Array.from(dirs).join('\n') : undefined,
    includedFiles: files.size > 0 ? Array.from(files).join('\n') : undefined,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`DeepWiki API error: ${response.status} - ${await response.text()}`)
  }

  return await response.json() as T
}

function formatDeepWikiError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { detail?: string; error?: string }
    return parsed.detail ?? parsed.error ?? `DeepWiki API error: ${status}`
  } catch {
    return body || `DeepWiki API error: ${status}`
  }
}

function parseProviderError(responseText: string): string | null {
  const trimmed = responseText.trim()
  if (!trimmed) return null

  if (/^error:/i.test(trimmed)) {
    return trimmed
  }

  if (/quota exceeded|rate limit|429\b/i.test(trimmed)) {
    return trimmed
  }

  return null
}

function compactSnippet(text: string, maxLength = 200): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return '(empty response)'
  }

  if (compact.length <= maxLength) {
    return compact
  }

  return `${compact.slice(0, maxLength - 3)}...`
}

function parseWikiResponse(data: Record<string, unknown>): WikiResult {
  const rawMarkdown = String(data.markdown ?? data.content ?? '')
  const techStack = extractTechFromWiki(rawMarkdown)
  const flows = extractFlowDiagrams(rawMarkdown)

  return {
    title: String(data.title ?? ''),
    overview: String(data.overview ?? ''),
    architecture: String(data.architecture ?? ''),
    techStack,
    flows,
    rawMarkdown,
  }
}

function extractTechFromWiki(markdown: string): string[] {
  const tech: Set<string> = new Set()

  const patterns: Record<string, RegExp> = {
    react: /\breact\b/i,
    nextjs: /\bnext\.?js\b/i,
    vue: /\bvue\b/i,
    nuxt: /\bnuxt\b/i,
    angular: /\bangular\b/i,
    svelte: /\bsvelte\b/i,
    typescript: /\btypescript\b/i,
    nodejs: /\bnode\.?js\b|\bbun\b/i,
    express: /\bexpress\b/i,
    fastapi: /\bfastapi\b/i,
    django: /\bdjango\b/i,
    supabase: /\bsupabase\b/i,
    prisma: /\bprisma\b/i,
    drizzle: /\bdrizzle\b/i,
    tailwind: /\btailwind\b/i,
    vite: /\bvite\b/i,
    playwright: /\bplaywright\b/i,
    vitest: /\bvitest\b/i,
    jest: /\bjest\b/i,
    postgresql: /\bpostgres(?:ql)?\b/i,
    redis: /\bredis\b/i,
  }

  for (const [techName, pattern] of Object.entries(patterns)) {
    if (pattern.test(markdown)) {
      tech.add(techName)
    }
  }

  return Array.from(tech)
}

function extractFlowDiagrams(markdown: string): FlowDiagram[] {
  const flows: FlowDiagram[] = []
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    flows.push({
      title: `Flow ${flows.length + 1}`,
      mermaid: match[1].trim(),
    })
  }

  return flows
}
