import chalk from 'chalk'
import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  detectInstalledProjectSkills,
  loadAIPlannerConfig,
  detectTechStack,
  getAllPlanners,
} from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'

export const statusCommand = new Command('status')
  .description('View the current AI Planner configuration and project status')
  .argument('[dir]', 'Project directory to check status for (default: current directory)')
  .action(async (dirArg?: string) => {
    await runStatus(dirArg ? resolve(dirArg) : undefined)
  })

export async function runStatus(targetCwd?: string) {
  const cwd = targetCwd || process.cwd()
  const config = await loadAIPlannerConfig(cwd)
  const agentContext = await resolveTargetAgentContext()
  
  console.log(chalk.bold.cyan('\n📋 AI Planner Status\n'))

  const activePlanner = config.defaultPlanner || 'gstack'
  const supportedPlanners = getAllPlanners().map(p => p.id).join(', ')
  const plannerDisplay = config.defaultPlanner
    ? `${config.defaultPlanner} (Supported: ${supportedPlanners})`
    : `Not set (defaults to gstack. Supported: ${supportedPlanners})`

  console.log(`  ${chalk.bold('Planner:')}     ${plannerDisplay}`)
  console.log(`  ${chalk.bold('Agent:')}       ${agentContext.agent} (${agentContext.source})`)

  const isNewProject = existsSync(resolve(cwd, 'implementation_plan.md'))
  const wikiExists = existsSync(resolve(cwd, '.ai-planner/wikis'))
  
  if (wikiExists) {
    console.log(`  ${chalk.bold('Wiki:')}        Generated (check DeepWiki UI)`)
  } else if (isNewProject) {
    console.log(`  ${chalk.bold('Wiki:')}        Pending implementation (New project flow)`)
  } else {
    console.log(`  ${chalk.bold('Wiki:')}        Not generated`)
  }

  const installedSkills = await detectInstalledProjectSkills(cwd)
  console.log(`  ${chalk.bold('Skills:')}      ${installedSkills.length} installed locally`)

  const planPath = resolve(cwd, 'implementation_plan.md')
  if (existsSync(planPath)) {
    console.log(`  ${chalk.bold('Plan:')}        implementation_plan.md (exists)`)
  } else {
    console.log(`  ${chalk.bold('Plan:')}        None`)
  }

  let nextStep = ''
  if (activePlanner === 'direct-llm') {
    nextStep = 'Follow: /spec → /plan → /build → /test → /review → /ship (one at a time)'
  } else if (activePlanner === 'gsd') {
    nextStep = 'Start your agent and run `/gsd-new-project --auto`'
  } else if (activePlanner === 'gstack') {
    nextStep = 'Start your agent and use `/office-hours` or project-local skills'
  } else if (!isNewProject && wikiExists) {
    nextStep = 'Ensure DeepWiki is running and chat with your codebase'
  } else {
    nextStep = 'Start your agent and review AGENTS.md'
  }

  console.log(`  ${chalk.bold('Next step:')}   ${chalk.green(nextStep)}\n`)
}
