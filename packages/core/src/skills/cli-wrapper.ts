import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { Skill } from '../types.js'

const execFileAsync = promisify(execFile)

// Repos that use native agent install methods (not npx skills add)
const NATIVE_INSTALL_REPOS = new Set(['addyosmani/agent-skills'])

/**
 * Wrapper around `npx skills` CLI.
 * Provides programmatic access to the Vercel Skills ecosystem.
 */

/**
 * Search skills.sh directory by keyword
 */
export async function searchSkillsDirectory(query: string): Promise<Skill[]> {
  try {
    // npx skills find <query> outputs JSON-compatible text
    const { stdout } = await execFileAsync('npx', ['skills', 'find', query, '--json'], {
      timeout: 15000,
      shell: true,
    })

    return parseSkillsOutput(stdout, query)
  } catch {
    // Fallback: use hardcoded mapping for common tech stacks
    return getFallbackSkills(query)
  }
}

/**
 * Install selected skills into an agent's directory
 */
export async function installSkills(
  skills: Array<{ repo: string; name: string; source?: Skill['source']; sourcePath?: string }>,
  targetAgent: string = 'antigravity',
  options: { cwd?: string } = {}
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = []
  const failed: string[] = []

  const localSkills = skills.filter((skill) => skill.source === 'local' && skill.sourcePath)
  const remoteSkills = skills.filter((skill) => skill.source !== 'local' || !skill.sourcePath)

  for (const skill of localSkills) {
    try {
      await installLocalSkill(skill, options.cwd)
      success.push(`${skill.repo}:${skill.name}`)
    } catch (err) {
      failed.push(`${skill.repo}:${skill.name}`)
      console.error(`Failed to install local skill ${skill.name}: ${formatInstallError(err)}`)
    }
  }

  for (const skill of remoteSkills) {
    try {
      if (NATIVE_INSTALL_REPOS.has(skill.repo)) {
        await installNativeRepoSkill(skill, targetAgent, options.cwd)
      } else {
        await execFileAsync(
          'npx',
          ['skills', 'add', skill.repo, '-a', targetAgent, '-y', '--skill', skill.name],
          { cwd: options.cwd, timeout: 30000, shell: true }
        )
      }
      success.push(`${skill.repo}:${skill.name}`)
    } catch (err) {
      failed.push(`${skill.repo}:${skill.name}`)
      console.error(`Failed to install remote skill ${skill.name} from ${skill.repo}: ${formatInstallError(err)}`)
    }
  }

  return { success, failed }
}

/**
 * List currently installed skills for an agent
 */
export async function listInstalledSkills(agentId?: string): Promise<string[]> {
  const args = ['skills', 'list']
  if (agentId) args.push('-a', agentId)

  try {
    const { stdout } = await execFileAsync('npx', args, { shell: true })
    // Strip ANSI color codes
    const stripped = stdout.replace(/\u001b\[\d+(;\d+)*m/g, '')
    return stripped.split('\n').filter((l: string) => l.trim().length > 0)
  } catch (error: any) {
    if (error.stdout?.includes('No skills installed')) return []
    throw error
  }
}

/**
 * Remove skills from an agent
 */
export async function removeSkills(
  skillNames: string[],
  agent: string = 'antigravity'
): Promise<void> {
  const skillArgs = skillNames.flatMap((name) => ['--skill', name])
  await execFileAsync(
    'npx',
    ['skills', 'remove', '-a', agent, '-y', ...skillArgs],
    { timeout: 15000, shell: true }
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseSkillsOutput(stdout: string, query: string): Skill[] {
  // Try JSON parse first
  try {
    const parsed = JSON.parse(stdout) as Array<Record<string, unknown>>
    return parsed.map((s) => ({
      id: String(s.id ?? s.name ?? ''),
      name: String(s.name ?? ''),
      description: String(s.description ?? ''),
      repo: String(s.repo ?? ''),
    }))
  } catch {
    // Parse text output line by line
    return stdout
      .split('\n')
      .filter((l) => l.includes(query))
      .slice(0, 10)
      .map((line) => ({
        id: line.trim(),
        name: line.trim(),
        description: `Skill related to ${query}`,
        repo: 'unknown',
      }))
  }
}

/**
 * Hardcoded fallback mapping for most common tech stacks.
 * Used when `npx skills find` is unavailable or fails.
 */
function getFallbackSkills(query: string): Skill[] {
  const mapping: Record<string, Skill[]> = {
    react: [
      { id: 'vercel-react-best-practices', name: 'vercel-react-best-practices', description: 'React best practices, patterns, and conventions', repo: 'vercel-labs/agent-skills' },
      { id: 'frontend-design', name: 'frontend-design', description: 'Frontend design best practices and UI patterns', repo: 'anthropics/skills' },
    ],
    nextjs: [
      { id: 'next-best-practices', name: 'next-best-practices', description: 'Next.js App Router, caching, and deployment best practices', repo: 'vercel-labs/next-skills' },
      { id: 'next-cache-components', name: 'next-cache-components', description: 'Next.js caching and component patterns', repo: 'vercel-labs/next-skills' },
    ],
    supabase: [
      { id: 'supabase-postgres-best-practices', name: 'supabase-postgres-best-practices', description: 'Supabase + PostgreSQL patterns, RLS, and queries', repo: 'supabase/agent-skills' },
    ],
    typescript: [
      { id: 'typescript-advanced-types', name: 'typescript-advanced-types', description: 'Advanced TypeScript patterns and type utilities', repo: 'wshobson/agents' },
    ],
    nodejs: [
      { id: 'nodejs-backend-patterns', name: 'nodejs-backend-patterns', description: 'Node.js backend patterns and best practices', repo: 'wshobson/agents' },
    ],
    tailwind: [
      { id: 'tailwind-design-system', name: 'tailwind-design-system', description: 'Tailwind CSS design system patterns', repo: 'wshobson/agents' },
    ],
    shadcn: [
      { id: 'shadcn', name: 'shadcn', description: 'shadcn/ui component library best practices', repo: 'shadcn/ui' },
    ],
    testing: [
      { id: 'webapp-testing', name: 'webapp-testing', description: 'Web app testing strategies and patterns', repo: 'anthropics/skills' },
      { id: 'test-driven-development', name: 'test-driven-development', description: 'TDD methodology and practices', repo: 'obra/superpowers' },
    ],
    playwright: [
      { id: 'playwright-best-practices', name: 'playwright-best-practices', description: 'Playwright E2E testing best practices', repo: 'currents-dev/playwright-best-practices-skill' },
    ],
    debugging: [
      { id: 'systematic-debugging', name: 'systematic-debugging', description: 'Systematic debugging methodology', repo: 'obra/superpowers' },
    ],
    vercel: [
      { id: 'deploy-to-vercel', name: 'deploy-to-vercel', description: 'Deploy applications to Vercel platform', repo: 'vercel-labs/agent-skills' },
    ],
  }

  const key = query.toLowerCase().replace(/[.\-_]/g, '')
  return mapping[key] ?? mapping[query.toLowerCase()] ?? []
}

async function installLocalSkill(
  skill: { name: string; sourcePath?: string },
  cwd?: string
): Promise<void> {
  if (!cwd) {
    throw new Error('A local project path is required to install local skills')
  }

  if (!skill.sourcePath) {
    throw new Error(`Local skill ${skill.name} is missing sourcePath`)
  }

  const sourcePath = resolve(skill.sourcePath)
  if (!existsSync(sourcePath)) {
    throw new Error(`Local skill path does not exist: ${sourcePath}`)
  }

  const targetDir = join(resolve(cwd), '.agents', 'skills', skill.name)
  await mkdir(join(resolve(cwd), '.agents', 'skills'), { recursive: true })
  await cp(sourcePath, targetDir, { recursive: true, force: true })
}

/**
 * Install skills from repos that use native agent install methods.
 * For addyosmani/agent-skills: downloads SKILL.md via GitHub raw URL and
 * places it in .agents/skills/<name>/SKILL.md for local agent discovery.
 * Instructs the user to run the native install command for full integration.
 */
async function installNativeRepoSkill(
  skill: { repo: string; name: string },
  _targetAgent: string,
  cwd?: string
): Promise<void> {
  const targetBase = cwd ? resolve(cwd, '.agents', 'skills') : resolve('.agents', 'skills')
  const targetDir = join(targetBase, skill.name)
  await mkdir(targetDir, { recursive: true })

  // Download SKILL.md from GitHub raw URL
  const rawUrl = `https://raw.githubusercontent.com/${skill.repo}/main/skills/${skill.name}/SKILL.md`
  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const content = await res.text()
      await writeFile(join(targetDir, 'SKILL.md'), content, 'utf8')
      return
    }
  } catch {
    // Network unavailable — create a pointer file instead
  }

  // Fallback: write a pointer file with install instructions
  const pointer = [
    `# ${skill.name}`,
    ``,
    `Source: https://github.com/${skill.repo}`,
    ``,
    `## Install natively for full slash command support:`,
    ``,
    `**Gemini CLI:**`,
    `\`\`\``,
    `gemini skills install https://github.com/${skill.repo}.git --path skills`,
    `\`\`\``,
    ``,
    `**Claude Code:**`,
    `\`\`\``,
    `/plugin marketplace add ${skill.repo}`,
    `\`\`\``,
    ``,
    `**Cursor / Windsurf:**`,
    `Copy the SKILL.md from skills/${skill.name}/ into .cursor/rules/ or .windsurf/rules/`,
  ].join('\n')

  await writeFile(join(targetDir, 'SKILL.md'), pointer, 'utf8')
}

function formatInstallError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error)
  }

  const execError = error as { stderr?: string; stdout?: string; message?: string }
  const details = [execError.stderr, execError.stdout, execError.message]
    .map((value) => value?.trim())
    .find(Boolean)

  return details ?? 'Unknown install failure'
}
