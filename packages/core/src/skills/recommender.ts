import { callLLM } from '../llm/provider.js'
import { fetchSkillsDirectory } from './crawler.js'
import type { Skill, SkillRecommendation } from '../types.js'

interface RecommendSkillsOptions {
  localSkills?: Skill[]
  excludeSkillIds?: string[]
}

/**
 * Core Skill Recommender engine.
 * Uses LLM to auto-match detected tech stack → relevant skills from skills.sh
 */
export async function recommendSkills(
  techStack: string[],
  projectContext: string = '',
  options: RecommendSkillsOptions = {}
): Promise<SkillRecommendation[]> {
  if (techStack.length === 0) return []

  const localSkills = options.localSkills ?? []
  const remoteSkills = await fetchSkillsDirectory()
  const excludeSkillIds = new Set((options.excludeSkillIds ?? []).map((id) => id.toLowerCase()))
  const candidates = mergeSkillCandidates(localSkills, remoteSkills)
    .filter((skill) => !excludeSkillIds.has(skill.id.toLowerCase()))

  // 2. LLM auto-match: rank and categorize from the whole directory
  try {
    const recommendations = await llmMatchSkills(techStack, candidates, projectContext)
    return recommendations
  } catch (error) {
    console.warn('LLM recommendation failed, using fallback ranking:', error)
    return fallbackRecommendations(candidates, techStack)
  }
}

function mergeSkillCandidates(localSkills: Skill[], remoteSkills: Skill[]): Skill[] {
  const merged = new Map<string, Skill>()

  for (const skill of remoteSkills) {
    merged.set(skill.id, {
      ...skill,
      source: skill.source ?? 'remote',
    })
  }

  for (const skill of localSkills) {
    merged.set(skill.id, {
      ...skill,
      source: 'local',
    })
  }

  return Array.from(merged.values())
}

// Removed getCandidateSkills (using fetchSkillsDirectory instead)

/**
 * Use LLM to rank and categorize skills by relevance
 */
async function llmMatchSkills(
  techStack: string[],
  candidates: Skill[],
  projectContext: string
): Promise<SkillRecommendation[]> {
  if (candidates.length === 0) return []

  const prompt = `You are an expert developer helping set up the optimal AI agent environment for a project.

Project tech stack: ${techStack.join(', ')}
${projectContext ? `Additional context: ${projectContext}` : ''}

Available agent skills from skills.sh:
${candidates.map((s) => `- id: "${s.id}", repo: "${s.repo}", description: "${s.description}"`).join('\n')}

Categorize each skill as:
- "essential": Must-have for this tech stack (directly related to core technologies)
- "recommended": Significantly improves workflow for this project type
- "optional": Nice-to-have but not critical

Return ONLY valid JSON array, no markdown:
[
  {
    "id": "skill-id",
    "category": "essential" | "recommended" | "optional",
    "reason": "one sentence reason why this skill is relevant"
  }
]

Only include skills that are genuinely relevant. Skip unrelated skills.`

  const response = await callLLM([{ role: 'user', content: prompt }])

  try {
    // Parse JSON response (handle both raw JSON and markdown-wrapped JSON)
    const jsonMatch = response.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return fallbackRecommendations(candidates, techStack)

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: string
      category: 'essential' | 'recommended' | 'optional'
      reason: string
    }>

    // Map back to full skill objects
    const recommendations: SkillRecommendation[] = []
    for (const item of parsed) {
      const skill = candidates.find((s) => s.id === item.id)
      if (skill) {
        const heuristic = evaluateSkillMatch(skill, techStack)
        const category = conservativeCategory(item.category, heuristic.category)
        recommendations.push({
          skill,
          category,
          reason: `${item.reason} (${heuristic.reason})`,
          selected: category === 'essential',
        })
      }
    }

    // Sort: essential first, then recommended, then optional
    return recommendations.sort((a, b) => {
      const order = { essential: 0, recommended: 1, optional: 2 }
      return order[a.category] - order[b.category]
    })
  } catch {
    console.warn('LLM response parse failed, using fallback ranking')
    return fallbackRecommendations(candidates, techStack)
  }
}

/**
 * Fallback: simple keyword-based matching if LLM fails
 */
function fallbackRecommendations(candidates: Skill[], techStack: string[]): SkillRecommendation[] {
  const recommendations: SkillRecommendation[] = []

  for (const skill of candidates) {
      const heuristic = evaluateSkillMatch(skill, techStack)
      if (heuristic.category === 'optional') continue

      recommendations.push({
        skill,
        category: heuristic.category,
        reason: heuristic.reason,
        selected: heuristic.category === 'essential',
      })
  }

  return recommendations
    .sort((a, b) => {
      const order = { essential: 0, recommended: 1, optional: 2 }
      const categoryDelta = order[a.category] - order[b.category]
      if (categoryDelta !== 0) return categoryDelta
      if ((a.skill.source ?? 'remote') !== (b.skill.source ?? 'remote')) {
        return (a.skill.source === 'local' ? -1 : 1)
      }
      return a.skill.id.localeCompare(b.skill.id)
    })
    .slice(0, 12)
}

function buildFallbackReason(exactMatches: Set<string>, contextualMatches: Set<string>): string {
  if (exactMatches.size > 0) {
    return `Fallback exact match on ${Array.from(exactMatches).slice(0, 3).join(', ')}`
  }

  return `Fallback contextual match on ${Array.from(contextualMatches).slice(0, 3).join(', ')}`
}

function evaluateSkillMatch(
  skill: Skill,
  techStack: string[]
): { category: SkillRecommendation['category']; reason: string } {
  const strictAliases: Record<string, string[]> = {
    nodejs: ['node.js', 'nodejs', 'express', 'nestjs', 'fastify', 'elysia'],
    typescript: ['typescript'],
    postgresql: ['postgres', 'postgresql'],
    drizzle: ['drizzle'],
    react: ['react'],
    nextjs: ['next', 'nextjs'],
    tailwind: ['tailwind'],
    playwright: ['playwright'],
    testing: ['vitest', 'jest', 'playwright', 'testing'],
  }

  const contextualAliases: Record<string, string[]> = {
    nodejs: ['backend', 'server', 'api', 'javascript'],
    typescript: ['types'],
    postgresql: ['database', 'sql', 'schema', 'query'],
    drizzle: ['orm', 'schema', 'query'],
    testing: ['test', 'qa'],
  }

  const strictTerms = techStack.flatMap((tech) => strictAliases[tech.toLowerCase()] ?? [tech.toLowerCase()])
  const contextualTerms = techStack.flatMap((tech) => contextualAliases[tech.toLowerCase()] ?? [])
  const haystack = [
    skill.description.toLowerCase(),
    skill.id.toLowerCase(),
    skill.repo.toLowerCase(),
  ].join(' ')

  const exactMatches = new Set(strictTerms.filter((term) => haystack.includes(term)))
  const contextualMatches = new Set(contextualTerms.filter((term) => haystack.includes(term)))

  const exactMatchCount = exactMatches.size
  const contextualMatchCount = contextualMatches.size

  const category: SkillRecommendation['category'] =
    exactMatchCount >= 2 ? 'essential'
    : exactMatchCount >= 1 ? 'recommended'
    : contextualMatchCount >= 1 ? 'optional'
    : 'optional'

  return {
    category,
    reason: buildFallbackReason(exactMatches, contextualMatches),
  }
}

function conservativeCategory(
  llmCategory: SkillRecommendation['category'],
  heuristicCategory: SkillRecommendation['category']
): SkillRecommendation['category'] {
  const order = { essential: 0, recommended: 1, optional: 2 }
  return order[llmCategory] > order[heuristicCategory] ? llmCategory : heuristicCategory
}
