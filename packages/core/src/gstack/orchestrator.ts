import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { PlanningResult } from '../types.js'

const execFileAsync = promisify(execFile)

export type PlanningStep = 'office-hours' | 'ceo-review' | 'eng-review' | 'design-review' | 'complete'

export interface PlanningProgress {
  currentStep: PlanningStep
  steps: Array<{ name: PlanningStep; status: 'pending' | 'running' | 'done' | 'error' }>
  output: string
}

export interface PlanningRunOptions {
  agent?: string
  onProgress?: (progress: PlanningProgress) => void
}

/**
 * Orchestrates the gstack planning pipeline for new projects.
 * Runs: /office-hours -> /plan-ceo-review -> /plan-eng-review -> /plan-design-review
 *
 * gstack is installed into the target local agent via `npx skills add garrytan/gstack -a <agent>`.
 */
export async function runPlanningPipeline(
  projectDescription: string,
  options: PlanningRunOptions | ((progress: PlanningProgress) => void) = {}
): Promise<PlanningResult> {
  const resolvedOptions = normalizePlanningOptions(options)
  const targetAgent = resolvedOptions.agent ?? 'antigravity'

  await ensureGstackInstalled(targetAgent)

  const steps: PlanningProgress['steps'] = [
    { name: 'office-hours', status: 'pending' },
    { name: 'ceo-review', status: 'pending' },
    { name: 'eng-review', status: 'pending' },
    { name: 'design-review', status: 'pending' },
  ]

  let accumulatedOutput = ''

  const updateProgress = (step: PlanningStep, status: 'running' | 'done' | 'error', output = '') => {
    const currentStep = steps.find((entry) => entry.name === step)
    if (currentStep) currentStep.status = status
    if (output) accumulatedOutput += output
    resolvedOptions.onProgress?.({
      currentStep: step,
      steps: [...steps],
      output: accumulatedOutput,
    })
  }

  updateProgress('office-hours', 'running')
  let officeHoursOutput = ''
  try {
    officeHoursOutput = await runGstackSkill('office-hours', projectDescription)
    updateProgress('office-hours', 'done', officeHoursOutput)
  } catch {
    updateProgress('office-hours', 'error')
    officeHoursOutput = `# Design Doc\n\n## Project Description\n${projectDescription}\n`
  }

  updateProgress('ceo-review', 'running')
  let ceoOutput = ''
  try {
    ceoOutput = await runGstackSkill('plan-ceo-review', officeHoursOutput)
    updateProgress('ceo-review', 'done', ceoOutput)
  } catch {
    updateProgress('ceo-review', 'error')
  }

  updateProgress('eng-review', 'running')
  let engOutput = ''
  try {
    engOutput = await runGstackSkill('plan-eng-review', `${officeHoursOutput}\n${ceoOutput}`)
    updateProgress('eng-review', 'done', engOutput)
  } catch {
    updateProgress('eng-review', 'error')
  }

  updateProgress('design-review', 'running')
  let designOutput = ''
  try {
    designOutput = await runGstackSkill('plan-design-review', engOutput)
    updateProgress('design-review', 'done', designOutput)
  } catch {
    updateProgress('design-review', 'error')
  }

  const fullOutput = [officeHoursOutput, ceoOutput, engOutput, designOutput].join('\n\n---\n\n')
  return parsePlanningOutput(fullOutput)
}

async function runGstackSkill(skillName: string, input: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'npx',
      ['skills', 'run', `garrytan/gstack:${skillName}`, '--input', input],
      { timeout: 60000, shell: true }
    )
    return stdout
  } catch {
    return runSkillViaLLM(skillName, input)
  }
}

async function runSkillViaLLM(skillName: string, input: string): Promise<string> {
  const { callLLM } = await import('../llm/provider.js')

  const skillInstructions: Record<string, string> = {
    'office-hours': `You are running a YC-style office hours session.
Ask 6 forcing questions that reframe the product. Challenge premises.
Generate 3 implementation approaches with effort estimates.
Output a design doc with: problem statement, capabilities, approaches, recommendation.`,
    'plan-ceo-review': `You are a CEO reviewing a product plan.
Find the 10-star product hiding inside this request.
Review: scope clarity, user value, competitive positioning, execution risk.
Output a structured review with recommendations.`,
    'plan-eng-review': `You are an experienced engineering manager.
Lock in architecture with ASCII diagrams for data flow and state machines.
Identify: tech stack, component architecture, API design, database schema, error paths, test plan.
Output a detailed technical specification.`,
    'plan-design-review': `You are a senior product designer.
Rate each design dimension 0-10 and explain what a 10 looks like.
Review: information architecture, user flows, visual hierarchy, accessibility, mobile responsiveness.
Output a design review with specific improvements.`,
  }

  const instructions = skillInstructions[skillName] ?? `Run the ${skillName} skill on the provided input.`
  const response = await callLLM(
    [
      { role: 'system', content: instructions },
      { role: 'user', content: input },
    ],
    { maxTokens: 3000 }
  )

  return response.text
}

async function ensureGstackInstalled(targetAgent: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync('npx', ['skills', 'list', '-a', targetAgent], {
      timeout: 5000,
      shell: true,
    })

    if (hasGstackSkillsInstalled(stdout)) {
      return
    }

    throw new Error(`gstack skills are not installed for ${targetAgent}`)
  } catch {
    try {
      await execFileAsync('npx', ['skills', 'add', 'garrytan/gstack', '-a', targetAgent, '-y'], {
        timeout: 60000,
        shell: true,
      })
    } catch {
      console.warn(`gstack install failed for ${targetAgent} - will use LLM fallback for planning skills`)
    }
  }
}

function normalizePlanningOptions(
  options: PlanningRunOptions | ((progress: PlanningProgress) => void)
): PlanningRunOptions {
  if (typeof options === 'function') {
    return { onProgress: options }
  }

  return options
}

function hasGstackSkillsInstalled(output: string): boolean {
  const normalized = output.toLowerCase()
  return [
    'garrytan/gstack',
    'office-hours',
    'plan-ceo-review',
    'plan-eng-review',
    'plan-design-review',
  ].some((token) => normalized.includes(token))
}

function parsePlanningOutput(output: string): PlanningResult {
  const techPatterns: Record<string, RegExp> = {
    react: /\breact\b/i,
    nextjs: /\bnext\.?js\b/i,
    typescript: /\btypescript\b/i,
    nodejs: /\bnode\.?js\b/i,
    express: /\bexpress\b/i,
    supabase: /\bsupabase\b/i,
    postgresql: /\bpostgres(ql)?\b/i,
    tailwind: /\btailwind\b/i,
    vite: /\bvite\b/i,
    vue: /\bvue\b/i,
    python: /\bpython\b/i,
    fastapi: /\bfastapi\b/i,
  }

  const techStack = Object.entries(techPatterns)
    .filter(([, pattern]) => pattern.test(output))
    .map(([name]) => name)

  return {
    designDoc: output,
    techStack,
    architecture: extractSection(output, 'architecture'),
    timeline: extractSection(output, 'timeline'),
    skillSuggestions: techStack,
  }
}

function extractSection(text: string, section: string): string {
  const regex = new RegExp(`##\\s*${section}[\\s\\S]*?(?=##|$)`, 'i')
  return text.match(regex)?.[0]?.trim() ?? ''
}
