import chalk from 'chalk'
import type { BootstrapResult, MachineReadinessReport, ReadinessCheck, ReadinessStatus } from '@ai-planner/core'

export function printReadinessReport(report: MachineReadinessReport): void {
  console.log(chalk.bold(`\nMachine readiness for ${report.workspacePath}\n`))

  for (const check of report.checks) {
    console.log(formatCheckLine(check))
    if (check.details) {
      console.log(chalk.dim(`  details: ${check.details}`))
    }
    if (check.fix) {
      console.log(chalk.dim(`  fix: ${check.fix}`))
    }
  }

  const counts = summarizeStatuses(report)
  console.log(chalk.bold(`\nSummary: ${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed`))

  if (report.ok) {
    console.log(chalk.green('Status: machine is ready for the next CLI flow.\n'))
  } else {
    console.log(chalk.red('Status: fix the failing checks before relying on AI Planner Local.\n'))
  }
}

export function printBootstrapResult(result: BootstrapResult): void {
  console.log(chalk.bold('\nBootstrap actions\n'))
  console.log(chalk.dim(`  Target agent: ${result.report.targetAgent}`))

  if (result.actions.length === 0) {
    console.log(chalk.dim('  No bootstrap actions were needed before running the checks.'))
  } else {
    for (const action of result.actions) {
      console.log(chalk.dim(`  - ${action}`))
    }
  }

  printReadinessReport(result.report)
}

function formatCheckLine(check: ReadinessCheck): string {
  const symbol = check.status === 'pass'
    ? chalk.green('PASS')
    : check.status === 'warn'
      ? chalk.yellow('WARN')
      : chalk.red('FAIL')

  return `${symbol} ${chalk.bold(check.label)}: ${check.summary}`
}

function summarizeStatuses(report: MachineReadinessReport): Record<'pass' | 'warn' | 'fail', number> {
  return report.checks.reduce(
    (acc: Record<ReadinessStatus, number>, check: ReadinessCheck) => {
      acc[check.status] += 1
      return acc
    },
    { pass: 0, warn: 0, fail: 0 }
  )
}
