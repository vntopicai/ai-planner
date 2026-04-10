import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { generateWiki } from '@ai-planner/core'

export const wikiCommand = new Command('wiki')
  .description('Manage project wiki')

wikiCommand
  .command('regenerate')
  .description('Regenerate the DeepWiki index for the current dictionary')
  .argument('[dir]', 'Directory to generate wiki for', '.')
  .option('--publish', 'Publish the generated wiki to the remote DeepWiki instance via zip upload')
  .action(async (dir: string, opts: { publish?: boolean }) => {
    const spinner = ora('Generating wiki context...').start()
    try {
      const result = await generateWiki({
        localPath: dir,
        publishToDeepWiki: opts.publish,
      })
      spinner.succeed(chalk.green('Wiki regenerated'))
      if (opts.publish) {
        console.log(chalk.cyan(`\n  👉 Wiki published successfully! Open http://localhost:3000 to chat with your codebase.\n`))
      }
      if (result.pages?.length) {
        console.log(chalk.dim(`  ${result.pages.length} wiki pages generated`))
      }
    } catch (err: any) {
      spinner.fail('Wiki generation failed')
      console.error(chalk.red(String(err)))
    }
  })
