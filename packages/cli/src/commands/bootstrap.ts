import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { bootstrapLocalMachine } from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'
import { printBootstrapResult } from '../readiness-output.js'

export const bootstrapCommand = new Command('bootstrap')
  .description('Prepare this machine for AI Planner Local by creating local config and checking readiness')
  .option('-a, --agent <agent>', 'Target agent to verify and initialize')
  .option('--no-create-env', 'Do not create `.env` from `.env.example` if it is missing')
  .option('--no-start-deepwiki', 'Do not try to start DeepWiki with docker compose')
  .action(async (opts: { agent?: string; createEnv: boolean; startDeepwiki: boolean }) => {
    const agentContext = await resolveTargetAgentContext(opts.agent)
    const targetAgent = agentContext.agent

    console.log(chalk.bold.cyan('\nAI Planner Local - Bootstrap\n'))
    console.log(chalk.dim(`Target agent resolved to ${targetAgent} (${describeAgentSource(agentContext.source)})`))

    const spinner = ora(`Bootstrapping local setup for ${targetAgent}...`).start()
    const result = await bootstrapLocalMachine({
      cwd: process.cwd(),
      agent: targetAgent,
      createEnvFile: opts.createEnv,
      startDeepWiki: opts.startDeepwiki,
    })
    spinner.stop()

    printBootstrapResult(result)

    if (!result.report.ok) {
      process.exitCode = 1
    }
  })

function describeAgentSource(source: 'explicit' | 'config' | 'default'): string {
  if (source === 'explicit') return 'from --agent'
  if (source === 'config') return 'from .aiplanner.json defaultAgent'
  return 'from built-in default'
}
