import { Command } from 'commander'
import chalk from 'chalk'
import { startServer } from '../server.js'

export const uiCommand = new Command('ui')
  .description('Start the optional local companion API server for wiki/artifact viewing')
  .option('-p, --port <port>', 'Port to run the API server on', process.env.AI_PLANNER_API_PORT || '5174')
  .action((opts: { port: string }) => {
    const port = parseInt(opts.port, 10)

    console.log(chalk.bold.cyan('\nStarting AI Planner Local companion API...\n'))

    startServer(port)

    console.log(chalk.dim("\nCLI remains the primary product surface in this phase. Start the React app only if you want the optional local companion.\n"))
  })
