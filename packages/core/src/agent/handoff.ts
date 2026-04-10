import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import type { SkillRecommendation } from '../types.js'

export interface AgentHandoffOptions {
  projectRoot: string
  targetAgent: string
  projectType: 'existing' | 'new'
  techStack: string[]
  installedSkillIds?: string[]
  selectedSkills?: SkillRecommendation[]
  implementationPlanPath?: string
  wikiIndexPath?: string
  plannerMode?: string
}

export async function writeAgentHandoffFile(options: AgentHandoffOptions): Promise<string> {
  const projectRoot = resolve(options.projectRoot)
  const outputPath = resolve(projectRoot, 'AGENTS.md')
  const content = buildAgentHandoffContent(options)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, content, 'utf8')

  return outputPath
}

function buildAgentHandoffContent(options: AgentHandoffOptions): string {
  const projectRoot = resolve(options.projectRoot)
  const techStack = options.techStack.length > 0 ? options.techStack.join(', ') : 'unknown'
  const selectedSkills = options.selectedSkills ?? []
  const installedSkillIds = Array.from(new Set(options.installedSkillIds ?? []))
  const projectLabel = options.projectType === 'existing' ? 'existing project' : 'new project'

  const sections = [
    '# AGENTS',
    '',
    'This project was prepared by AI Planner Local for agent-driven work.',
    '',
    '## Project Context',
    '',
    `- Target agent: ${options.targetAgent}`,
    `- Project type: ${projectLabel}`,
    `- Tech stack: ${techStack}`,
  ]

  if (options.implementationPlanPath) {
    sections.push(`- Implementation plan: ${formatProjectPath(projectRoot, options.implementationPlanPath)}`)
  }
  if (options.wikiIndexPath) {
    sections.push(`- Wiki index: ${formatProjectPath(projectRoot, options.wikiIndexPath)}`)
  }

  sections.push(
    '',
    '## Start Here',
    '',
    '- Read this file first.',
    options.implementationPlanPath
      ? `- Review the implementation plan at ${formatProjectPath(projectRoot, options.implementationPlanPath)}.`
      : '- Review the project code and current requirements before making changes.',
    options.wikiIndexPath
      ? `- Review the project wiki at ${formatProjectPath(projectRoot, options.wikiIndexPath)} for architecture and context.`
      : '- Generate or refresh project wiki context when deeper architecture context is needed.',
  )

  if (options.plannerMode === 'gsd') {
    sections.push(
      '- Your project uses the GSD (Get Shit Done) planning engine.',
      '- Start your local AI agent and execute the following command to begin:',
      '  > `/gsd-new-project --auto`'
    )
  } else if (options.plannerMode === 'gstack') {
    sections.push(
      '- Run `/office-hours` to start planning or review scope.',
      '- Run `/plan-eng-review` for detailed architecture breakdown.'
    )
  } else if (options.plannerMode === 'direct-llm') {
    sections.push(
      '- Your project uses the Direct LLM planner — powered by Google Engineering Culture.',
      '- Follow the SPECIFY → PLAN → BUILD → VERIFY → REVIEW → SHIP lifecycle:',
      '  1. `/spec`  — Write a structured specification BEFORE any code. Surface assumptions first.',
      '  2. `/plan`  — Break spec into vertical slices with dependency-ordered tasks.',
      '  3. `/build` — Implement one task at a time. Each task must have acceptance criteria.',
      '  4. `/test`  — Beyoncé Rule: if you liked it, put a test on it. Unit → Integration → E2E.',
      '  5. `/review`— Apply Hyrum\'s Law (API), Chesterton\'s Fence (simplification), Shift Left (security).',
      '  6. `/ship`  — Verify the ship checklist before deploy. No "seems right" — require evidence.',
      '- Key principles baked in:',
      '  - Hyrum\'s Law: any observable behavior will be depended on — design contracts explicitly',
      '  - Chesterton\'s Fence: never remove code you don\'t understand yet',
      '  - Trunk-based dev: short-lived branches, merge frequently, use feature flags',
      '- Implementation plan is in `implementation_plan.md`. Review it before writing any code.',
    )
  }

  sections.push(
    '- Check `.agents/skills/` before reaching for generic solutions.',
    '- Prefer the installed project skills and local references over starting from scratch.',
  )

  sections.push(
    '',
    '## Installed Skills',
    '',
    ...(installedSkillIds.length > 0
      ? installedSkillIds.map((skillId) => `- ${skillId}`)
      : ['- No project-local skills were detected yet.'])
  )

  if (selectedSkills.length > 0) {
    sections.push(
      '',
      '## Suggested Skills From AI Planner',
      '',
      ...selectedSkills.map((recommendation) => {
        const source = recommendation.skill.source ?? 'remote'
        return `- ${recommendation.skill.id} [${recommendation.category}] (${source})`
      })
    )
  }

  sections.push(
    '',
    '## Common Commands',
    '',
    options.plannerMode === 'gsd'
      ? '- `/gsd-new-project --auto` — Start full SDLC planning and tracking.'
      : options.plannerMode === 'direct-llm'
        ? '- `/spec` → `/plan` → `/build` → `/test` → `/review` → `/ship` — Follow this order. One step at a time.'
        : '- `/office-hours`, `/plan-eng-review`, and `/plan-design-review` (if gstack is installed).',
    '- Use project-local skills from `.agents/skills/` when they fit the task before reaching for unrelated tools.',
    '- Keep work aligned with the saved plan and wiki context.',
    '',
    '## Notes',
    '',
    '- `AI Planner` installs project-specific skills into `.agents/skills/` inside this project.',
    '- `AI Planner` may also rely on agent-level skills such as `gstack` installed for the target agent on this machine.',
    '- If agent behavior looks incomplete, run `aip doctor` and `aip bootstrap --agent <agent>` from the AI Planner workspace.',
    ''
  )

  return sections.join('\n')
}

function formatProjectPath(projectRoot: string, targetPath: string): string {
  const rel = relative(projectRoot, resolve(targetPath))
  return rel && !rel.startsWith('..') ? `./${rel.replace(/\\/g, '/')}` : resolve(targetPath)
}
