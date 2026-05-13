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
 * obra/superpowers core skills (145k ⭐) — Jesse Vincent @ Prime Radiant
 * https://github.com/obra/superpowers
 * Installed natively as SKILL.md from raw.githubusercontent.com
 */
export const SUPERPOWERS_SKILLS: Skill[] = [
  { id: 'brainstorming', name: 'brainstorming', description: 'Socratic design refinement before coding. Explores alternatives, validates design in sections.', repo: 'obra/superpowers' },
  { id: 'writing-plans', name: 'writing-plans', description: 'Bite-sized tasks (2-5 min each). Exact file paths, complete code, verification steps per task.', repo: 'obra/superpowers' },
  { id: 'test-driven-development', name: 'test-driven-development', description: 'Mandatory RED-GREEN-REFACTOR cycle. Deletes code written before tests.', repo: 'obra/superpowers' },
  { id: 'subagent-driven-development', name: 'subagent-driven-development', description: 'Dispatch fresh subagents per task with two-stage review (spec compliance + code quality).', repo: 'obra/superpowers' },
  { id: 'requesting-code-review', name: 'requesting-code-review', description: 'Pre-review checklist. Reviews against plan, reports issues by severity. Critical issues block progress.', repo: 'obra/superpowers' },
  { id: 'finishing-a-development-branch', name: 'finishing-a-development-branch', description: 'Verifies tests, presents merge/PR/keep/discard options, cleans up worktree.', repo: 'obra/superpowers' },
  { id: 'using-git-worktrees', name: 'using-git-worktrees', description: 'Isolated workspace on a new branch. Runs project setup, verifies clean test baseline.', repo: 'obra/superpowers' },
  { id: 'systematic-debugging', name: 'systematic-debugging', description: '4-phase root cause process. Includes root-cause-tracing and defense-in-depth techniques.', repo: 'obra/superpowers' },
  { id: 'executing-plans', name: 'executing-plans', description: 'Batch execution with human checkpoints every 3-5 tasks.', repo: 'obra/superpowers' },
  { id: 'dispatching-parallel-agents', name: 'dispatching-parallel-agents', description: 'Concurrent subagent workflows for independent tasks.', repo: 'obra/superpowers' },
]

/**
 * mattpocock/skills - "Skills for Real Engineers"
 * https://github.com/mattpocock/skills
 * Installed natively as SKILL.md from raw.githubusercontent.com
 */
export const MATT_POCOCK_SKILLS: Skill[] = [
  { id: 'setup-matt-pocock-skills', name: 'setup-matt-pocock-skills', description: 'Scaffold per-repo config for issue tracker, triage labels, and docs layout used by the engineering skills.', repo: 'mattpocock/skills' },
  { id: 'diagnose', name: 'diagnose', description: 'Disciplined diagnosis loop for hard bugs and performance regressions: reproduce, minimise, hypothesise, instrument, fix, regression-test.', repo: 'mattpocock/skills' },
  { id: 'grill-with-docs', name: 'grill-with-docs', description: 'Challenge a plan against the existing domain model and update CONTEXT.md and ADRs as decisions crystallise.', repo: 'mattpocock/skills' },
  { id: 'triage', name: 'triage', description: 'Triage issues through a state machine driven by roles, labels, and issue tracker workflow.', repo: 'mattpocock/skills' },
  { id: 'improve-codebase-architecture', name: 'improve-codebase-architecture', description: 'Find architecture improvement opportunities using domain language and ADRs to keep code modular and testable.', repo: 'mattpocock/skills' },
  { id: 'tdd', name: 'tdd', description: 'Test-driven development with a red-green-refactor loop for features and bug fixes.', repo: 'mattpocock/skills' },
  { id: 'to-issues', name: 'to-issues', description: 'Break a plan, spec, or PRD into independently-grabbable issues using vertical slices.', repo: 'mattpocock/skills' },
  { id: 'to-prd', name: 'to-prd', description: 'Turn current conversation context into a PRD and publish it to the project issue tracker.', repo: 'mattpocock/skills' },
  { id: 'zoom-out', name: 'zoom-out', description: 'Explain an unfamiliar code area in broader system context before changing it.', repo: 'mattpocock/skills' },
  { id: 'prototype', name: 'prototype', description: 'Build a throwaway prototype to flesh out a design before committing to implementation.', repo: 'mattpocock/skills' },
  { id: 'caveman', name: 'caveman', description: 'Ultra-compressed communication mode that preserves technical accuracy while cutting verbosity.', repo: 'mattpocock/skills' },
  { id: 'grill-me', name: 'grill-me', description: 'Relentlessly interview the user about a plan or design until the decision tree is resolved.', repo: 'mattpocock/skills' },
  { id: 'handoff', name: 'handoff', description: 'Compact the current conversation into a handoff document for another agent.', repo: 'mattpocock/skills' },
  { id: 'write-a-skill', name: 'write-a-skill', description: 'Create new skills with proper structure, progressive disclosure, and bundled resources.', repo: 'mattpocock/skills' },
  { id: 'git-guardrails-claude-code', name: 'git-guardrails-claude-code', description: 'Set up Claude Code hooks to block dangerous git commands before they execute.', repo: 'mattpocock/skills' },
  { id: 'migrate-to-shoehorn', name: 'migrate-to-shoehorn', description: 'Migrate test files from type assertions to @total-typescript/shoehorn.', repo: 'mattpocock/skills' },
  { id: 'scaffold-exercises', name: 'scaffold-exercises', description: 'Create exercise directory structures with sections, problems, solutions, and explainers.', repo: 'mattpocock/skills' },
  { id: 'setup-pre-commit', name: 'setup-pre-commit', description: 'Set up Husky pre-commit hooks with lint-staged, formatting, type checking, and tests.', repo: 'mattpocock/skills' },
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
    ...SUPERPOWERS_SKILLS,
    ...MATT_POCOCK_SKILLS,
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
