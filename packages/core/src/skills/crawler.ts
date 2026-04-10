import type { Skill } from '../types.js'

let cachedSkills: Skill[] | null = null
let lastFetchTime = 0
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const BLOCKED_REMOTE_REPOS = new Set([
  'microsoft/github-copilot-for-azure',
  'supercent-io/skills-template',
])

export const ADDYOSMANI_AGENT_SKILLS: Skill[] = [
  { id: 'spec-driven-development', name: 'spec-driven-development', description: 'Write spec before code. Surface assumptions. /spec command.', repo: 'addyosmani/agent-skills' },
  { id: 'planning-and-task-breakdown', name: 'planning-and-task-breakdown', description: 'Vertical slicing, dependency-ordered tasks. /plan command.', repo: 'addyosmani/agent-skills' },
  { id: 'incremental-implementation', name: 'incremental-implementation', description: 'Build one task at a time with acceptance criteria. /build command.', repo: 'addyosmani/agent-skills' },
  { id: 'test-driven-development', name: 'test-driven-development', description: 'Beyonce Rule and test pyramid. /test command.', repo: 'addyosmani/agent-skills' },
  { id: 'code-review-and-quality', name: 'code-review-and-quality', description: 'Hyrum\'s Law and change size norms. /review command.', repo: 'addyosmani/agent-skills' },
  { id: 'security-and-hardening', name: 'security-and-hardening', description: 'Shift Left security and OWASP gates.', repo: 'addyosmani/agent-skills' },
  { id: 'performance-optimization', name: 'performance-optimization', description: 'Benchmark before and after. Avoid N+1 queries.', repo: 'addyosmani/agent-skills' },
  { id: 'git-workflow-and-versioning', name: 'git-workflow-and-versioning', description: 'Trunk-based development, feature flags, and small PRs.', repo: 'addyosmani/agent-skills' },
  { id: 'shipping-and-launch', name: 'shipping-and-launch', description: 'Ship checklist and release discipline. /ship command.', repo: 'addyosmani/agent-skills' },
  { id: 'api-and-interface-design', name: 'api-and-interface-design', description: 'Explicit API contracts, versioning, and interface discipline.', repo: 'addyosmani/agent-skills' },
  { id: 'frontend-ui-engineering', name: 'frontend-ui-engineering', description: 'Accessibility, CLS, LCP, and Core Web Vitals.', repo: 'addyosmani/agent-skills' },
  { id: 'debugging-and-error-recovery', name: 'debugging-and-error-recovery', description: 'Systematic debugging and recovery from failures.', repo: 'addyosmani/agent-skills' },
  { id: 'context-engineering', name: 'context-engineering', description: 'Load only the context the agent needs, when it needs it.', repo: 'addyosmani/agent-skills' },
  { id: 'documentation-and-adrs', name: 'documentation-and-adrs', description: 'Architecture Decision Records and durable docs.', repo: 'addyosmani/agent-skills' },
  { id: 'ci-cd-and-automation', name: 'ci-cd-and-automation', description: 'Shift Left CI, automated gates, and release automation.', repo: 'addyosmani/agent-skills' },
]

/**
 * Crawls skills.sh to retrieve a comprehensive list of available agent skills.
 * Falls back to a curated offline set if the network fails.
 */
export async function fetchSkillsDirectory(): Promise<Skill[]> {
  const now = Date.now()
  if (cachedSkills && now - lastFetchTime < CACHE_TTL) {
    return cachedSkills
  }

  try {
    const res = await fetch('https://skills.sh', {
      headers: {
        'User-Agent': 'AI-Planner-Crawler/1.0',
      },
    })

    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const html = await res.text()

    const skills: Skill[] = []
    const linkRegex = /<a[^>]+href=["']\/([^/]+)\/([^/]+)\/([^/"']+)["'][^>]*>([\s\S]*?)<\/a>/g
    let match: RegExpExecArray | null

    while ((match = linkRegex.exec(html)) !== null) {
      const owner = match[1]
      const repoName = match[2]
      const skillName = match[3]
      const content = match[4]

      if (['official', 'docs', 'audits', 'trending', 'hot'].includes(owner)) continue

      let description = `Skill ${skillName} from ${owner}/${repoName}`
      const pMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      if (pMatch && !pMatch[1].includes(owner)) {
        description = pMatch[1].replace(/<[^>]+>/g, '').trim() || description
      }

      const repo = `${owner}/${repoName}`
      if (!isSupportedRemoteRepo(repo)) continue

      skills.push({
        id: skillName,
        name: skillName,
        repo,
        description,
      })
    }

    const unique = new Map<string, Skill>()
    for (const skill of skills) {
      unique.set(`${skill.repo}:${skill.id}`, skill)
    }

    cachedSkills = Array.from(unique.values())
    lastFetchTime = now
    return cachedSkills
  } catch (err) {
    console.warn('Failed to crawl skills.sh:', err)
    return getOfflineFallbackSkills()
  }
}

function isSupportedRemoteRepo(repo: string): boolean {
  const normalizedRepo = repo.toLowerCase()
  if (BLOCKED_REMOTE_REPOS.has(normalizedRepo)) {
    return false
  }

  if (normalizedRepo.includes('template')) {
    return false
  }

  return true
}

function getOfflineFallbackSkills(): Skill[] {
  return [
    ...ADDYOSMANI_AGENT_SKILLS,
    { id: 'vercel-react-best-practices', name: 'vercel-react-best-practices', description: 'React best practices', repo: 'vercel-labs/agent-skills' },
    { id: 'next-best-practices', name: 'next-best-practices', description: 'Next.js App Router', repo: 'vercel-labs/next-skills' },
    { id: 'supabase-postgres-best-practices', name: 'supabase-postgres-best-practices', description: 'Supabase + Postgres', repo: 'supabase/agent-skills' },
    { id: 'frontend-design', name: 'frontend-design', description: 'Frontend UI/UX', repo: 'anthropics/skills' },
    { id: 'webapp-testing', name: 'webapp-testing', description: 'Web app testing patterns', repo: 'anthropics/skills' },
    { id: 'systematic-debugging', name: 'systematic-debugging', description: 'Debugging methodology', repo: 'obra/superpowers' },
    { id: 'deploy-to-vercel', name: 'deploy-to-vercel', description: 'Vercel deploy', repo: 'vercel-labs/agent-skills' },
    { id: 'shadcn', name: 'shadcn', description: 'shadcn/ui use', repo: 'shadcn/ui' },
    { id: 'playwright-best-practices', name: 'playwright-best-practices', description: 'Playwright testing', repo: 'currents-dev/playwright-best-practices-skill' },
  ]
}
