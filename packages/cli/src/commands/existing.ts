import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import {
  checkDeepWikiHealth,
  detectInstalledProjectSkills,
  detectTechStack,
  generateWiki,
  installSkills,
  loadAIPlannerConfig,
  loadLocalSkillsFromDirectories,
  recommendSkills,
} from '@ai-planner/core'
import type { Skill } from '@ai-planner/core'
import { resolveTargetAgentContext } from '../agent.js'
import { promptSkillSelection } from '../prompts.js'

export interface ExistingProjectInspection {
  techStack: string[]
  wikiWasGenerated: boolean
  wikiWasReused: boolean
  installedSkillIds: string[]
  wikiOutputPath?: string
}

export function resolveExistingInstallCwd(repo: string): string | undefined {
  return repo.startsWith('http') ? undefined : resolve(repo)
}

export async function inspectExistingProject(
  repo: string,
  opts: { skipWiki?: boolean } = {}
): Promise<ExistingProjectInspection> {
  let techStack: string[] = []
  let wikiWasGenerated = false
  let wikiWasReused = false
  let installedSkillIds: string[] = []
  let wikiOutputPath: string | undefined

  if (!opts.skipWiki) {
    const existingWikiIndex = findPersistedWikiIndex(repo)
    if (existingWikiIndex) {
      wikiWasReused = true
      wikiOutputPath = existingWikiIndex
    } else {
      const healthy = await checkDeepWikiHealth()
      if (healthy) {
        const isUrl = repo.startsWith('http')
      const wiki = await generateWiki(isUrl ? { repoUrl: repo } : { localPath: repo })
      wikiWasGenerated = true
      techStack = [...new Set(wiki.techStack)]
      wikiOutputPath = await persistWikiArtifacts(repo, wiki)
      }
    }
  }

  if (!repo.startsWith('http')) {
    const localTech = await detectTechStack(repo)
    techStack = [...new Set([...techStack, ...localTech])]

    const installedSkills = await detectInstalledProjectSkills(repo)
    installedSkillIds = installedSkills.map((skill: Skill) => skill.id)
  }

  return { techStack, wikiWasGenerated, wikiWasReused, installedSkillIds, wikiOutputPath }
}

export const existingCommand = new Command('existing')
  .description('Analyze an existing local repo or GitHub repo and prepare the local agent environment')
  .argument('<repo>', 'GitHub URL or local path to the project')
  .option('-a, --agent <agent>', 'Target agent')
  .option('--skip-wiki', 'Skip wiki generation and use local tech detection only')
  .option('-y, --yes', 'Run non-interactively and auto-select recommended skills')
  .option('--skip-install', 'Stop after recommendation and do not install skills')
  .action(async (repo: string, opts: { agent?: string; skipWiki: boolean; yes?: boolean; skipInstall?: boolean }) => {
    const agentContext = await resolveTargetAgentContext(opts.agent)
    const targetAgent = agentContext.agent
    console.log(chalk.bold.cyan('\nAI Planner Local - Existing Project\n'))
    console.log(chalk.dim(`Target agent resolved to ${targetAgent} (${describeAgentSource(agentContext.source)})`))

    if (!repo.startsWith('http')) {
      const validationError = getLocalRepoValidationError(repo)
      if (validationError) {
        console.log(chalk.red(`\n${validationError}\n`))
        process.exitCode = 1
        return
      }
    }

    const previousNonInteractive = process.env.AI_PLANNER_NON_INTERACTIVE

    let techStack: string[] = []
    let wikiWasGenerated = false
    let wikiWasReused = false
    let installedSkillIds: string[] = []
    let wikiOutputPath: string | undefined

    if (!opts.skipWiki) {
      const existingWikiIndex = findPersistedWikiIndex(repo)
      if (existingWikiIndex) {
        const spinner = ora('Checking for an existing wiki...').start()
        try {
          const result = await inspectExistingProject(repo, { skipWiki: false })
          techStack = result.techStack
          wikiWasGenerated = result.wikiWasGenerated
          wikiWasReused = result.wikiWasReused
          installedSkillIds = result.installedSkillIds
          wikiOutputPath = result.wikiOutputPath
          spinner.succeed(chalk.green('Existing wiki found'))
          if (wikiOutputPath) {
            console.log(chalk.dim(`  Reusing wiki at: ${wikiOutputPath}`))
          }
        } catch (err) {
          spinner.fail('Existing wiki check failed')
          console.error(chalk.red(String(err)))
        }
      } else {
        const spinner = ora('Checking DeepWiki service...').start()
        const healthy = await checkDeepWikiHealth()

        if (!healthy) {
          spinner.warn(chalk.yellow('DeepWiki is not running. Start it with: docker compose up -d'))
          spinner.info('Falling back to local tech stack detection...')
        } else {
          spinner.text = 'Generating wiki from the project...'
          try {
            const result = await inspectExistingProject(repo, { skipWiki: false })
            techStack = result.techStack
            wikiWasGenerated = result.wikiWasGenerated
            wikiWasReused = result.wikiWasReused
            installedSkillIds = result.installedSkillIds
            wikiOutputPath = result.wikiOutputPath
            spinner.succeed(chalk.green('Wiki generated'))
            console.log(chalk.dim(`  Tech detected from wiki/local scan: ${techStack.join(', ') || 'none'}`))
            if (wikiOutputPath) {
              console.log(chalk.dim(`  Wiki saved to: ${wikiOutputPath}`))
            }
          } catch (err) {
            spinner.fail('Wiki generation failed')
            console.error(chalk.red(String(err)))
          }
        }
      }
    }

    if (opts.skipWiki || !wikiWasGenerated) {
      const spinner = ora('Scanning local project files...').start()
      try {
        const result = await inspectExistingProject(repo, { skipWiki: true })
        techStack = result.techStack
        installedSkillIds = result.installedSkillIds
        spinner.succeed(chalk.green(`Tech stack detected: ${techStack.join(', ') || 'none'}`))
      } catch {
        spinner.fail('Local scan failed')
      }
    }

    if (techStack.length === 0) {
      console.log(chalk.yellow('\nNo tech stack detected. You can still add skills manually with: aip skills add <repo>'))
    }

    const spinner = ora('Finding relevant skills...').start()
    try {
      const config = await loadAIPlannerConfig(process.cwd())
      const localSkills = await loadLocalSkillsFromDirectories(config.preferredSkillsDirs ?? [])
      const recommendations = await recommendSkills(techStack, '', {
        localSkills,
        excludeSkillIds: installedSkillIds,
      })
      spinner.succeed(chalk.green(`Found ${recommendations.length} skill recommendations`))

      if (recommendations.length === 0) {
        console.log(chalk.yellow('\nNo skills matched. Use: aip skills add <repo> to add manually'))
        return
      }

      if (opts.yes) {
        process.env.AI_PLANNER_NON_INTERACTIVE = '1'
      }

      const selected = await promptSkillSelection(recommendations)
      if (selected.length === 0) {
        console.log(chalk.yellow('\nNo skills selected. Done.'))
        return
      }

      const selectedSkillLines = selected.map((recommendation) => (
        `  - ${recommendation.skill.id} [${recommendation.category}] (${recommendation.skill.source ?? 'remote'})`
      ))
      const selectedSkillBlock = selectedSkillLines.join('\n')
      const installCwd = resolveExistingInstallCwd(repo)

      if (opts.skipInstall) {
        console.log(chalk.bold.green('\nRecommendation flow completed.'))
        console.log(chalk.dim(`  - Target agent: ${targetAgent} (${describeAgentSource(agentContext.source)})`))
        if (installCwd) {
          console.log(chalk.dim(`  - Planned install location: ${installCwd}`))
        } else {
          console.log(chalk.dim('  - Planned install location: current workspace (repo URL mode has no local project path)'))
        }
        console.log(chalk.dim(`  - Wiki status: ${describeWikiStatus(wikiWasGenerated, wikiWasReused)}`))
        if (wikiOutputPath) {
          console.log(chalk.dim(`  - Wiki index: ${wikiOutputPath}`))
        }
        console.log(chalk.dim(`  - Existing project skills detected: ${installedSkillIds.length}`))
        console.log(chalk.dim(`  - Selected skills: ${selected.length}`))
        console.log(chalk.dim(`  - Skill list:\n${selectedSkillBlock}`))
        console.log(chalk.dim('  - Install step was skipped by request\n'))
        return
      }

      const installSpinner = ora(`Installing ${selected.length} skills for ${targetAgent}...`).start()
      const result = await installSkills(
        selected.map((recommendation) => ({
          repo: recommendation.skill.repo,
          name: recommendation.skill.id,
          source: recommendation.skill.source,
          sourcePath: recommendation.skill.sourcePath,
        })),
        targetAgent,
        { cwd: installCwd }
      )

      if (result.success.length > 0) {
        installSpinner.succeed(chalk.green(`Installed: ${result.success.join(', ')}`))
      }
      if (result.failed.length > 0) {
        installSpinner.warn(chalk.yellow(`Failed: ${result.failed.join(', ')}`))
      }

      console.log(chalk.bold.green('\nLocal agent environment is ready.'))
      console.log(chalk.dim(`  - Target agent: ${targetAgent} (${describeAgentSource(agentContext.source)})`))
      if (installCwd) {
        console.log(chalk.dim(`  - Install location: ${installCwd}`))
      } else {
        console.log(chalk.dim('  - Install location: current workspace (repo URL mode has no local project path)'))
      }
      console.log(chalk.dim(`  - Wiki status: ${describeWikiStatus(wikiWasGenerated, wikiWasReused)}`))
      if (wikiOutputPath) {
        console.log(chalk.dim(`  - Wiki index: ${wikiOutputPath}`))
      }
      console.log(chalk.dim(`  - Existing project skills detected: ${installedSkillIds.length}`))
      console.log(chalk.dim(`  - Installed skills: ${result.success.length}`))
      console.log(chalk.dim(`  - Selected skill list:\n${selectedSkillBlock}`))
      console.log(chalk.dim('  - Next step: open DeepWiki to browse/chat the wiki, then start your agent locally\n'))
    } catch (err) {
      spinner.fail('Skill recommendation failed')
      console.error(chalk.red(String(err)))
    } finally {
      if (previousNonInteractive === undefined) {
        delete process.env.AI_PLANNER_NON_INTERACTIVE
      } else {
        process.env.AI_PLANNER_NON_INTERACTIVE = previousNonInteractive
      }
    }
  })

function describeAgentSource(source: 'explicit' | 'config' | 'default'): string {
  if (source === 'explicit') return 'from --agent'
  if (source === 'config') return 'from .aiplanner.json defaultAgent'
  return 'from built-in default'
}

function describeWikiStatus(wikiWasGenerated: boolean, wikiWasReused: boolean): string {
  if (wikiWasGenerated) return 'generated'
  if (wikiWasReused) return 'reused existing wiki'
  return 'skipped or unavailable'
}

function getLocalRepoValidationError(repo: string): string | null {
  const absoluteRepoPath = resolve(repo)
  if (existsSync(absoluteRepoPath)) {
    return null
  }

  if (repo === 'data/test' || repo === 'data\\test') {
    return 'Local path not found: `data/test`. This fixture moved to `fixtures/existing-project`.'
  }

  return `Local path not found: \`${repo}\``
}

async function persistWikiArtifacts(repo: string, wiki: Awaited<ReturnType<typeof generateWiki>>): Promise<string | undefined> {
  if (repo.startsWith('http')) {
    return undefined
  }

  const wikiDir = resolve(repo, '.ai-planner', 'wiki')
  await mkdir(wikiDir, { recursive: true })

  const pageLinks = (wiki.pages ?? []).map((page) => {
    const fileName = `${toSlug(page.title || page.id)}.md`
    return `- [${page.title}](./${fileName})`
  })

  const indexContent = [
    `# ${wiki.title || 'Project Wiki'}`,
    '',
    wiki.overview || '',
    '',
    ...(pageLinks.length > 0 ? ['## Pages', '', ...pageLinks, ''] : []),
  ].join('\n').trim() + '\n'

  await writeFile(resolve(wikiDir, 'index.md'), indexContent, 'utf8')

  for (const page of wiki.pages ?? []) {
    const fileName = `${toSlug(page.title || page.id)}.md`
    const relatedLinks = page.relatedPages.length > 0
      ? [
        '',
        '## Related Pages',
        '',
        ...page.relatedPages.map((relatedPageId) => {
          const relatedPage = wiki.pages?.find((candidate) => candidate.id === relatedPageId)
          const relatedFileName = `${toSlug(relatedPage?.title || relatedPageId)}.md`
          return `- [${relatedPage?.title || relatedPageId}](./${relatedFileName})`
        }),
        '',
      ]
      : []

    const pageContent = [
      page.content,
      ...relatedLinks,
    ].join('\n').trim() + '\n'

    await writeFile(resolve(wikiDir, fileName), pageContent, 'utf8')
  }

  await writeFile(resolve(wikiDir, 'wiki.md'), wiki.rawMarkdown, 'utf8')

  return resolve(wikiDir, 'index.md')
}

function findPersistedWikiIndex(repo: string): string | undefined {
  if (repo.startsWith('http')) {
    return undefined
  }

  const indexPath = resolve(repo, '.ai-planner', 'wiki', 'index.md')
  return existsSync(indexPath) ? indexPath : undefined
}

function toSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'page'
}
