import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { runMachineReadinessChecks } from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'
import { printReadinessReport } from '../readiness-output.js'

export const doctorCommand = new Command('doctor')
  .description('Check whether this machine is ready to run AI Planner Local flows')
  .option('-a, --agent <agent>', 'Target agent to verify')
  .action(async (opts: { agent?: string }) => {
    const agentContext = await resolveTargetAgentContext(opts.agent)
    const targetAgent = agentContext.agent

    console.log(chalk.bold.cyan('\nAI Planner Local - Doctor\n'))
    console.log(chalk.dim(`Target agent resolved to ${targetAgent} (${describeAgentSource(agentContext.source)})`))

    const spinner = ora(`Running machine readiness checks for ${targetAgent}...`).start()
    const report = await runMachineReadinessChecks({
      cwd: process.cwd(),
      agent: targetAgent,
    })
    spinner.stop()

    printReadinessReport(report)

    if (!report.ok) {
      process.exitCode = 1
    }
  })

function describeAgentSource(source: 'explicit' | 'config' | 'default'): string {
  if (source === 'explicit') return 'from --agent'
  if (source === 'config') return 'from .aiplanner.json defaultAgent'
  return 'from built-in default'
}
