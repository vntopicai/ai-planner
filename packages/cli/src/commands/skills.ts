import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { installSkills, listInstalledSkills, recommendSkills, removeSkills } from '@ai-planner/core'
import { resolveTargetAgent } from '../agent.js'

export const skillsCommand = new Command('skills')
  .description('Manage agent skills')

skillsCommand
  .command('list')
  .description('List installed skills')
  .option('-a, --agent <agent>', 'Target agent')
  .action(async (opts: { agent?: string }) => {
    const targetAgent = await resolveTargetAgent(opts.agent)
    const spinner = ora('Loading installed skills...').start()
    const skills = await listInstalledSkills(targetAgent)
    spinner.stop()

    if (skills.length === 0) {
      console.log(chalk.yellow(`\nNo skills installed for ${targetAgent}`))
      console.log(chalk.dim('  Run: aip existing <repo> to get recommendations'))
      return
    }

    console.log(chalk.bold(`\nInstalled skills for ${targetAgent}:\n`))
    skills.forEach((skill) => console.log(chalk.dim(`  - ${skill}`)))
  })

skillsCommand
  .command('add <repo>')
  .description('Add skills from a GitHub repo (e.g. vercel-labs/agent-skills)')
  .option('-s, --skill <name>', 'Specific skill name')
  .option('-a, --agent <agent>', 'Target agent')
  .action(async (repo: string, opts: { skill?: string; agent?: string }) => {
    const targetAgent = await resolveTargetAgent(opts.agent)
    const spinner = ora(`Installing from ${repo}...`).start()
    const skills = opts.skill ? [{ repo, name: opts.skill }] : [{ repo, name: '*' }]

    const result = await installSkills(skills, targetAgent)
    if (result.success.length > 0) {
      spinner.succeed(chalk.green(`Installed: ${result.success.join(', ')}`))
    } else {
      spinner.fail(chalk.red(`Failed: ${result.failed.join(', ')}`))
    }
  })

skillsCommand
  .command('remove <name>')
  .description('Remove an installed skill')
  .option('-a, --agent <agent>', 'Target agent')
  .action(async (name: string, opts: { agent?: string }) => {
    const targetAgent = await resolveTargetAgent(opts.agent)
    const spinner = ora(`Removing ${name}...`).start()
    try {
      await removeSkills([name], targetAgent)
      spinner.succeed(chalk.green(`Removed: ${name}`))
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${String(err)}`))
    }
  })

skillsCommand
  .command('recommend')
  .description('Get skill recommendations for a tech stack')
  .argument('<tech...>', 'Tech stack (e.g. react nextjs supabase)')
  .action(async (tech: string[]) => {
    const spinner = ora('Analyzing tech stack...').start()
    const recommendations = await recommendSkills(tech)
    spinner.stop()

    const groups = {
      essential: recommendations.filter((recommendation) => recommendation.category === 'essential'),
      recommended: recommendations.filter((recommendation) => recommendation.category === 'recommended'),
      optional: recommendations.filter((recommendation) => recommendation.category === 'optional'),
    }

    console.log(chalk.bold('\nSkill Recommendations:\n'))
    if (groups.essential.length) {
      console.log(chalk.red.bold('Essential:'))
      groups.essential.forEach((recommendation) => console.log(`  ${chalk.bold(recommendation.skill.id)} - ${recommendation.reason}`))
    }
    if (groups.recommended.length) {
      console.log(chalk.yellow.bold('\nRecommended:'))
      groups.recommended.forEach((recommendation) => console.log(`  ${chalk.bold(recommendation.skill.id)} - ${recommendation.reason}`))
    }
    if (groups.optional.length) {
      console.log(chalk.green.bold('\nOptional:'))
      groups.optional.forEach((recommendation) => console.log(`  ${chalk.bold(recommendation.skill.id)} - ${recommendation.reason}`))
    }
  })
