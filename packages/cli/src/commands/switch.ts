import chalk from 'chalk'
import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import {
  detectInstalledProjectSkills,
  detectTechStack,
  getAllPlanners,
  writeAgentHandoffFile,
} from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'

export const switchCommand = new Command('switch')
  .description('Switch the active planner engine for the current project')
  .requiredOption('-p, --planner <name>', 'The planner engine to switch to (e.g., gsd, gstack, direct-llm)')
  .action(async (opts: { planner: string }) => {
    const newPlanner = opts.planner.toLowerCase()
    const supported = getAllPlanners().map(p => p.id)

    if (!supported.includes(newPlanner)) {
      console.error(chalk.red(`\nError: Unknown planner '${newPlanner}'. Supported planners: ${supported.join(', ')}\n`))
      process.exit(1)
    }

    const cwd = process.cwd()
    const configPath = resolve(cwd, '.aiplanner.json')
    let config: any = {}
    
    if (existsSync(configPath)) {
      try {
        const raw = await readFile(configPath, 'utf8')
        config = JSON.parse(raw)
      } catch (err) {
        console.warn(chalk.yellow(`Warning: Could not parse .aiplanner.json. It will be overwritten.`))
      }
    }

    config.defaultPlanner = newPlanner
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')

    // Regenerate AGENTS.md
    const techStack = await detectTechStack(cwd)
    const installedSkills = await detectInstalledProjectSkills(cwd)
    const agentContext = await resolveTargetAgentContext()
    
    const planPath = resolve(cwd, 'implementation_plan.md')
    const hasPlan = existsSync(planPath)

    const handoffPath = await writeAgentHandoffFile({
      projectRoot: cwd,
      targetAgent: agentContext.agent,
      projectType: hasPlan ? 'new' : 'existing',
      techStack,
      installedSkillIds: installedSkills.map(s => s.id),
      selectedSkills: [],
      implementationPlanPath: hasPlan ? planPath : undefined,
      plannerMode: newPlanner
    })

    console.log(chalk.bold.green(`\nSuccess! Switched active planner to '${newPlanner}'`))
    console.log(chalk.dim(`  - Config updated: .aiplanner.json`))
    console.log(chalk.dim(`  - Agent handoff updated: ${handoffPath}`))
    
    if (newPlanner === 'gsd') {
      console.log(chalk.cyan(`\n👉 Next step: Start your agent and run \`/gsd-new-project --auto\` to begin planning with GSD.`))
    } else if (newPlanner === 'gstack') {
      console.log(chalk.cyan(`\n👉 Next step: Start your agent and run \`/office-hours\` or \`/plan-eng-review\` to begin planning with GStack.`))
    } else {
      console.log(chalk.cyan(`\n👉 Next step: Start your agent and review AGENTS.md.`))
    }
  })
