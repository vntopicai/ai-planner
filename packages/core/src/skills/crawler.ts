import type { Skill } from '../types.js'

let cachedSkills: Skill[] | null = null
let lastFetchTime = 0
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const BLOCKED_REMOTE_REPOS = new Set([
  'microsoft/github-copilot-for-azure',
])

/**
 * Crawls skills.sh to retrieve a comprehensive list of available agent skills.
 * Falls back to an empty list or basic known skills if the network fails.
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
    
    // Parse HTML to extract skills
    // We look for links pointing to skill detail pages: /owner/repo/skill-name
    // Format on skills.sh is typically:
    // <a href="/owner/repo/skill-name" ...>
    //   ...
    //   <h3>skill-name</h3>
    //   <p>owner/repo</p>
    // </a>
    
    const skills: Skill[] = []
    const linkRegex = /<a[^>]+href=["']\/([^/]+)\/([^/]+)\/([^/"']+)["'][^>]*>([\s\S]*?)<\/a>/g
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const owner = match[1]
      const repoName = match[2]
      const skillName = match[3]
      const content = match[4]

      // Filter out meta links like /docs, /official
      if (['official', 'docs', 'audits', 'trending', 'hot'].includes(owner)) continue

      // Try to extract description if present (very roughly)
      let description = `Skill ${skillName} from ${owner}/${repoName}`
      const pMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      if (pMatch && !pMatch[1].includes(owner)) {
         description = pMatch[1].replace(/<[^>]+>/g, '').trim() || description
      }

      const repo = `${owner}/${repoName}`
      if (BLOCKED_REMOTE_REPOS.has(repo)) continue

      skills.push({
        id: skillName,
        name: skillName,
        repo,
        description,
      })
    }

    // Deduplicate by repo:name
    const unique = new Map<string, Skill>()
    for (const s of skills) {
      unique.set(`${s.repo}:${s.id}`, s)
    }

    cachedSkills = Array.from(unique.values())
    lastFetchTime = now
    
    return cachedSkills
  } catch (err) {
    console.warn('Failed to crawl skills.sh:', err)
    return getOfflineFallbackSkills()
  }
}

function getOfflineFallbackSkills(): Skill[] {
  return [
    { id: 'vercel-react-best-practices', name: 'vercel-react-best-practices', description: 'React best practices', repo: 'vercel-labs/agent-skills' },
    { id: 'next-best-practices', name: 'next-best-practices', description: 'Next.js App Router', repo: 'vercel-labs/next-skills' },
    { id: 'supabase-postgres-best-practices', name: 'supabase-postgres-best-practices', description: 'Supabase + Postgres', repo: 'supabase/agent-skills' },
    { id: 'frontend-design', name: 'frontend-design', description: 'Frontend UI/UX', repo: 'anthropics/skills' },
    { id: 'webapp-testing', name: 'webapp-testing', description: 'Web app testing patterns', repo: 'anthropics/skills' },
    { id: 'systematic-debugging', name: 'systematic-debugging', description: 'Debugging methodology', repo: 'obra/superpowers' },
    { id: 'test-driven-development', name: 'test-driven-development', description: 'TDD flow', repo: 'obra/superpowers' },
    { id: 'deploy-to-vercel', name: 'deploy-to-vercel', description: 'Vercel deploy', repo: 'vercel-labs/agent-skills' },
    { id: 'shadcn', name: 'shadcn', description: 'shadcn/ui use', repo: 'shadcn/ui' },
    { id: 'playwright-best-practices', name: 'playwright-best-practices', description: 'Playwright testing', repo: 'currents-dev/playwright-best-practices-skill' }
  ]
}
