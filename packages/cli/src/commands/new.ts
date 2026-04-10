import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import {
  ADDYOSMANI_AGENT_SKILLS,
  detectInstalledProjectSkills,
  getDefaultLLMRuntimeInfo,
  installSkills,
  loadAIPlannerConfig,
  saveAIPlannerConfig,
  loadLocalSkillsFromDirectories,
  recommendSkills,
  getPlanner,
  writeAgentHandoffFile,
  extractPlanningTech,
  extractSection,
} from '@ai-planner/core'
import type { PlannerProgress, PlanningResult, PlannerInput, SkillRecommendation } from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'
import { promptSkillSelection } from '../prompts.js'

export interface NewProjectFlowOptions {
  description: string
  output: string
  targetAgent: string
  plannerOption?: string
  planProject?: (description: string, options: PlannerInput) => Promise<PlanningResult>
  recommendProjectSkills?: (techStack: string[], projectContext: string, installCwd: string) => Promise<SkillRecommendation[]>
  selectSkills?: (recommendations: SkillRecommendation[]) => Promise<SkillRecommendation[]>
  installSelectedSkills?: (
    selected: SkillRecommendation[],
    targetAgent: string,
    installCwd: string
  ) => Promise<{ success: string[]; failed: string[] }>
  savePlanFile?: (outputPath: string, content: string) => Promise<void>
  loadExistingPlanFile?: (outputPath: string) => Promise<string | null>
  onPlanningProgress?: (progress: PlannerProgress) => void
}

export interface NewProjectFlowResult {
  outputPath: string
  installCwd: string
  planningResult: PlanningResult
  recommendations: SkillRecommendation[]
  selected: SkillRecommendation[]
  installResult: { success: string[]; failed: string[] } | null
}

/**
 * `aip new`
 * Plan a new project, save the plan locally, recommend skills, and install locally.
 */
export const newCommand = new Command('new')
  .description('Plan a new project locally with gstack-backed workflows and prepare the local agent environment')
  .argument('[dir]', 'Project directory (optional — can contain a prompt.md or project-idea.md)')
  .option('-a, --agent <agent>', 'Target agent')
  .option('-p, --planner <planner>', 'Planner engine (e.g. gstack, gsd, direct-llm)')
  .option('--output <file>', 'Save implementation plan to file', 'implementation_plan.md')
  .option('--project-dir <dir>', 'Target local project folder (alias for positional argument)')
  .option('--prompt-file <file>', 'Markdown file containing the project idea')
  .action(async (dirArg: string | undefined, opts: { agent?: string; planner?: string; output: string; projectDir?: string; promptFile?: string }) => {
    const config = await loadAIPlannerConfig(process.cwd())
    const agentContext = await resolveTargetAgentContext(opts.agent)
    const targetAgent = agentContext.agent

    // Positional arg [dir] takes precedence over --project-dir flag
    const effectiveProjectDir = dirArg ?? opts.projectDir

    let plannerOption = opts.planner ?? config.defaultPlanner
    if (!plannerOption) {
    const { planner } = await inquirer.prompt([{
        type: 'list',
        name: 'planner',
        message: 'Select a planning engine:',
        choices: [
          { name: '⭐  direct-llm  — Google Engineering Culture (no extra tools)', value: 'direct-llm' },
          { name: '⭐⭐  gsd        — Get Shit Done full SDLC lifecycle', value: 'gsd' },
          { name: '⭐⭐⭐  gstack    — YC-style office hours + CEO/Eng/Design review', value: 'gstack' },
        ]
      }])
      plannerOption = planner
    }

    console.log(chalk.bold.cyan('\nAI Planner Local - New Project\n'))
    console.log(chalk.dim(`Target agent resolved to ${targetAgent} (${describeAgentSource(agentContext.source)})`))
    const projectDir = effectiveProjectDir ? resolve(effectiveProjectDir) : undefined
    const outputPath = resolveNewProjectOutputPath(opts.output, projectDir)
    const descriptionResult = await resolveNewProjectDescription({
      projectDir,
      promptFile: opts.promptFile,
    })
    const description = descriptionResult.description

    if (!description?.trim()) {
      console.log(chalk.yellow('No description provided. Exiting.'))
      return
    }

    if (projectDir) {
      console.log(chalk.dim(`Project directory: ${projectDir}`))
    }
    if (descriptionResult.sourcePath) {
      console.log(chalk.dim(`Loaded idea from: ${descriptionResult.sourcePath}`))
    }
    const planningRuntime = getDefaultLLMRuntimeInfo()
    console.log(chalk.dim(`Planning fallback model: ${planningRuntime.provider}/${planningRuntime.model}`))
    if (existsSync(outputPath)) {
      console.log(chalk.dim(`Existing plan detected: ${outputPath}`))
      console.log(chalk.dim('Planning will be skipped and AI Planner will continue with skill recommendation/install.'))
    }

    console.log(chalk.bold('\nRunning local planning pipeline...\n'))
    const planSpinner = ora({ text: 'Starting planner...', prefixText: '[1/4]' }).start()

    try {
      const result = await runNewProjectFlow({
        description,
        output: outputPath,
        targetAgent,
        plannerOption,
        onPlanningProgress: (progress) => {
          const steps = progress.steps.map(s => s.name)
          const stepIndex = steps.indexOf(progress.currentStep) + 1
          const total = steps.length
          const stepLabels: Record<string, string> = {
            // gstack labels
            'office-hours': 'Running /office-hours — product reframe',
            'ceo-review': 'Running /plan-ceo-review — scope review',
            'eng-review': 'Running /plan-eng-review — architecture review',
            'design-review': 'Running /plan-design-review — UX review',
            // direct-llm (Google engineering culture) labels
            'spec':          'Writing spec — surface assumptions before coding',
            'plan':          'Planning — vertical slices + dependency graph',
            'ship-guidance': 'Ship checklist — pre/build/review/deploy gates',
            // gsd labels
            'Initializing GSD': 'Installing GSD skills...',
            'Scaffolding Project': 'Writing initial project context...',
          }
          planSpinner.prefixText = `[${stepIndex}/${total}]`
          planSpinner.text = stepLabels[progress.currentStep] ?? progress.currentStep
        },
      })

      planSpinner.succeed(chalk.green('Planning complete'))
      console.log(chalk.dim(`\nPlan saved to: ${result.outputPath}`))
      console.log(chalk.dim(`Install location: ${result.installCwd}`))

      if (result.planningResult.techStack.length > 0) {
        console.log(chalk.bold(`\nTech stack from plan: ${result.planningResult.techStack.join(', ')}`))
      }
      console.log(chalk.dim(`Planning mode: ${describePlanningRuntime(result.planningResult)}`))

      if (result.recommendations.length === 0) {
        console.log(chalk.yellow('\nNo skills matched for automatic installation.'))
      } else if (result.selected.length === 0) {
        console.log(chalk.yellow('\nNo skills selected.'))
      }

      const finalInstalledSkills = await detectInstalledProjectSkills(result.installCwd)
      const handoffPath = await writeAgentHandoffFile({
        projectRoot: result.installCwd,
        targetAgent,
        projectType: 'new',
        techStack: result.planningResult.techStack,
        installedSkillIds: finalInstalledSkills.map((skill) => skill.id),
        selectedSkills: result.selected,
        implementationPlanPath: result.outputPath,
        plannerMode: result.planningResult.runtime?.mode || plannerOption,
      })

      const selectedSkillLines = result.selected.map((recommendation) => (
        `  - ${recommendation.skill.id} [${recommendation.category}] (${recommendation.skill.source ?? 'remote'})`
      ))
      const selectedSkillBlock = selectedSkillLines.join('\n')

      console.log(chalk.bold.green('\nLocal project planning is ready.'))
      console.log(chalk.dim(`  - Plan file: ${result.outputPath}`))
      console.log(chalk.dim(`  - Target agent: ${targetAgent} (${describeAgentSource(agentContext.source)})`))
      console.log(chalk.dim(`  - Install location: ${result.installCwd}`))
      console.log(chalk.dim(`  - Agent handoff: ${handoffPath}`))
      
      if (result.selected.length > 0) {
        console.log(chalk.dim(`  - Selected skills: ${result.selected.length}`))
        console.log(chalk.dim(`  - Selected skill list:\n${selectedSkillBlock}`))
      }
      
      if (result.installResult && result.installResult.success.length > 0) {
        console.log(chalk.dim(`  - Installed skills: ${result.installResult.success.length}`))
        console.log(chalk.dim(`  - Installed list:\n${result.installResult.success.map((skill) => `  - ${skill}`).join('\n')}`))
      }
      if (result.installResult && result.installResult.failed.length > 0) {
        console.log(chalk.dim(`  - Failed installs: ${result.installResult.failed.length}`))
        console.log(chalk.dim(`  - Failed list:\n${result.installResult.failed.map((skill) => `  - ${skill}`).join('\n')}`))
      }
      
      console.log(chalk.dim('  - Next step: review the saved plan and start building with your local agent\n'))
      
      const { nextAction } = await inquirer.prompt([{
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: 'View project status', value: 'status' },
          { name: 'Exit and start building', value: 'exit' },
        ]
      }])

      if (nextAction === 'status') {
        const { runStatus } = await import('./status.js')
        await runStatus(result.installCwd)
      } else {
        console.log(chalk.green('\nHappy building!'))
      }
    } catch (err) {
      planSpinner.fail('Planning failed')
      console.error(chalk.red(String(err)))
    }
  })

export async function runNewProjectFlow(options: NewProjectFlowOptions): Promise<NewProjectFlowResult> {
  const outputPath = resolveNewProjectOutputPath(options.output)
  const installCwd = resolveNewProjectInstallCwd(outputPath)
  const projectContext = `New project: ${options.description.substring(0, 200)}`
  const planProject = options.planProject ?? (async (description, plannerInput) => {
    const plannerName = options.plannerOption ?? 'gstack'
    const planner = getPlanner(plannerName)
    return planner.plan({ ...plannerInput, description })
  })
  const recommendProjectSkills = options.recommendProjectSkills ??
    ((techStack: string[], ctx: string, cwd: string) =>
      defaultRecommendProjectSkills(techStack, ctx, cwd, options.plannerOption))
  const selectSkills = options.selectSkills ?? promptSkillSelection
  const installSelectedSkills = options.installSelectedSkills ?? defaultInstallSelectedSkills
  const savePlanFile = options.savePlanFile ?? defaultSavePlanFile
  const loadExistingPlanFile = options.loadExistingPlanFile ?? defaultLoadExistingPlanFile

  const existingPlanContent = await loadExistingPlanFile(outputPath)
  const planningResult = existingPlanContent
    ? parseExistingPlanFile(existingPlanContent)
    : await planProject(options.description, {
      description: options.description,
      agent: options.targetAgent,
      onProgress: options.onPlanningProgress,
    })

  if (!existingPlanContent) {
    const planContent = `# Implementation Plan\n\n_Generated by AI Planner on ${new Date().toLocaleDateString()}_\n\n${planningResult.designDoc}`
    await savePlanFile(outputPath, planContent)

    // Persist the chosen planner so `aip status` can read it back
    if (options.plannerOption) {
      await saveAIPlannerConfig({ defaultPlanner: options.plannerOption }, installCwd)
    }
  }

  const recommendations = await recommendProjectSkills(planningResult.techStack, projectContext, installCwd)
  if (recommendations.length === 0) {
    return {
      outputPath,
      installCwd,
      planningResult,
      recommendations,
      selected: [],
      installResult: null,
    }
  }

  const selected = await selectSkills(recommendations)
  if (selected.length === 0) {
    return {
      outputPath,
      installCwd,
      planningResult,
      recommendations,
      selected,
      installResult: null,
    }
  }

  const installResult = await installSelectedSkills(selected, options.targetAgent, installCwd)
  return {
    outputPath,
    installCwd,
    planningResult,
    recommendations,
    selected,
    installResult,
  }
}

function resolveNewProjectInstallCwd(outputPath: string): string {
  return dirname(outputPath)
}

function resolveNewProjectOutputPath(output: string, projectDir?: string): string {
  if (!projectDir) {
    return resolve(output)
  }

  const resolvedOutput = resolve(output)
  const defaultOutput = resolve('implementation_plan.md')
  if (resolvedOutput !== defaultOutput) {
    return resolvedOutput
  }

  return resolve(projectDir, 'implementation_plan.md')
}

interface NewProjectDescriptionOptions {
  projectDir?: string
  promptFile?: string
}

interface ResolvedNewProjectDescription {
  description: string
  sourcePath?: string
}

export async function resolveNewProjectDescription(
  options: NewProjectDescriptionOptions
): Promise<ResolvedNewProjectDescription> {
  const explicitPromptFile = options.promptFile ? resolve(options.promptFile) : undefined
  if (explicitPromptFile) {
    return {
      description: await readFile(explicitPromptFile, 'utf8'),
      sourcePath: explicitPromptFile,
    }
  }

  const discoveredPromptFile = options.projectDir
    ? await findPreferredPromptFile(options.projectDir)
    : undefined
  if (discoveredPromptFile) {
    return {
      description: await readFile(discoveredPromptFile, 'utf8'),
      sourcePath: discoveredPromptFile,
    }
  }

  // No prompt file found — ask inline (no external editor)
  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Briefly describe your project idea:',
      validate: (val: string) => val.trim().length > 10 || 'Please enter at least a short description',
    },
  ])

  return { description }
}

async function findPreferredPromptFile(projectDir: string): Promise<string | undefined> {
  const resolvedProjectDir = resolve(projectDir)
  if (!existsSync(resolvedProjectDir)) {
    await mkdir(resolvedProjectDir, { recursive: true })
    return undefined
  }

  const preferredNames = [
    'prompt.md',
    'project-idea.md',
    'idea.md',
    'brief.md',
  ]

  for (const fileName of preferredNames) {
    const candidate = resolve(resolvedProjectDir, fileName)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  const entries = await readdir(resolvedProjectDir, { withFileTypes: true })
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .filter((fileName) => !['implementation_plan.md', 'index.md'].includes(fileName.toLowerCase()))
    .sort()

  if (markdownFiles.length === 1) {
    return resolve(resolvedProjectDir, markdownFiles[0])
  }

  return undefined
}

async function defaultSavePlanFile(outputPath: string, content: string): Promise<void> {
  await writeFile(outputPath, content, 'utf-8')
}

async function defaultLoadExistingPlanFile(outputPath: string): Promise<string | null> {
  if (!existsSync(outputPath)) {
    return null
  }

  return readFile(outputPath, 'utf8')
}

async function defaultInstallSelectedSkills(
  selected: SkillRecommendation[],
  targetAgent: string,
  installCwd: string
): Promise<{ success: string[]; failed: string[] }> {
  const installSpinner = ora(`Installing ${selected.length} skills for ${targetAgent}...`).start()
  const installResult = await installSkills(
    selected.map((recommendation) => ({
      repo: recommendation.skill.repo,
      name: recommendation.skill.id,
      source: recommendation.skill.source,
      sourcePath: recommendation.skill.sourcePath,
    })),
    targetAgent,
    { cwd: installCwd }
  )

  if (installResult.success.length > 0) {
    installSpinner.succeed(chalk.green(`Installed: ${installResult.success.join(', ')}`))
  }
  if (installResult.failed.length > 0) {
    installSpinner.warn(chalk.yellow(`Failed: ${installResult.failed.join(', ')}`))
  }

  return installResult
}

async function defaultRecommendProjectSkills(
  techStack: string[],
  projectContext: string,
  installCwd: string,
  plannerMode?: string
): Promise<SkillRecommendation[]> {
  const config = await loadAIPlannerConfig(process.cwd())
  const localSkills = await loadLocalSkillsFromDirectories(config.preferredSkillsDirs ?? [])
  const installedSkills = await detectInstalledProjectSkills(installCwd)

  const recommendations = await recommendSkills(techStack, projectContext, {
    localSkills,
    excludeSkillIds: installedSkills.map((skill) => skill.id),
  })

  // For direct-llm: show the full addyosmani/agent-skills pack so users can
  // keep the foundation skills preselected while still seeing the broader set.
  if (plannerMode === 'direct-llm') {
    const installedIds = new Set(installedSkills.map((s) => s.id))
    const alreadyRecommendedIds = new Set(recommendations.map((r) => r.skill.id))
    const essentialSkillIds = new Set([
      'spec-driven-development',
      'planning-and-task-breakdown',
      'incremental-implementation',
      'test-driven-development',
      'code-review-and-quality',
    ])
    const adyInjected: SkillRecommendation[] = ADDYOSMANI_AGENT_SKILLS
      .filter((skill) => !installedIds.has(skill.id) && !alreadyRecommendedIds.has(skill.id))
      .map((skill) => ({
        skill: {
          ...skill,
          source: 'remote' as const,
        },
        category: essentialSkillIds.has(skill.id) ? 'essential' as const : 'recommended' as const,
        reason: essentialSkillIds.has(skill.id)
          ? 'Direct LLM foundation skill: preselected for spec, planning, incremental implementation, testing, and review.'
          : 'Direct LLM companion skill from the addyosmani toolkit for broader implementation, quality, and shipping support.',
        selected: essentialSkillIds.has(skill.id),
      }))
    return [...adyInjected, ...recommendations]
  }

  return recommendations
}

function describeAgentSource(source: 'explicit' | 'config' | 'default'): string {
  if (source === 'explicit') return 'from --agent'
  if (source === 'config') return 'from .aiplanner.json defaultAgent'
  return 'from built-in default'
}

function describePlanningRuntime(result: PlanningResult): string {
  if (!result.runtime || result.runtime.mode === 'gstack') {
    return 'gstack skills'
  }

  if (result.runtime.mode === 'direct-llm') {
    return `direct LLM fallback (${result.runtime.provider}/${result.runtime.model})`
  }

  return `mixed (gstack + direct LLM fallback ${result.runtime.provider}/${result.runtime.model})`
}

function parseExistingPlanFile(content: string): PlanningResult {
  const techStack = extractPlanningTech(content, { trustGenericFrameworkMentions: false })

  return {
    designDoc: content,
    techStack,
    architecture: extractSection(content, 'architecture'),
    timeline: extractSection(content, 'timeline'),
    skillSuggestions: techStack,
    runtime: { mode: 'direct-llm' },
  }

}
