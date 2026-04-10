import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectExistingProject, resolveExistingInstallCwd } from '../dist/commands/existing.js'
import { resolveNewProjectDescription, runNewProjectFlow } from '../dist/commands/new.js'
import { resolveTargetAgent } from '../dist/agent.js'
import { loadAIPlannerConfig } from '../../core/dist/config/loader.js'
import { loadLocalSkillsFromDirectories } from '../../core/dist/skills/local-directory.js'
import { installSkills } from '../../core/dist/skills/cli-wrapper.js'
import { recommendSkills } from '../../core/dist/skills/recommender.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const fixturePath = resolve(repoRoot, 'fixtures/existing-project')
const newProjectPrompt = [
  'Build a backend market data API for Vietnamese stocks.',
  'Prefer TypeScript, Node.js, Drizzle ORM, and PostgreSQL.',
  'Include API endpoints, migration scripts, and seed/import tools.',
].join('\n')

async function main() {
  const result = await inspectExistingProject(fixturePath, { skipWiki: true })

  assert.equal(result.wikiWasGenerated, false, 'skipWiki fixture test should not generate a wiki')
  assert.ok(result.techStack.includes('nodejs'), 'expected nodejs in existing-project inspection result')
  assert.ok(result.techStack.includes('typescript'), 'expected typescript in existing-project inspection result')
  assert.ok(result.techStack.includes('drizzle'), 'expected drizzle in existing-project inspection result')

  const config = await loadAIPlannerConfig(repoRoot)
  const localSkills = await loadLocalSkillsFromDirectories(config.preferredSkillsDirs ?? [])
  const recommendations = await recommendSkills(result.techStack, '', {
    localSkills,
    excludeSkillIds: result.installedSkillIds,
  })

  assert.ok(recommendations.length > 0, 'expected recommendations for the fixture project')
  assert.ok(recommendations.some((recommendation) => recommendation.skill.source === 'local'), 'expected at least one local skill in recommendations')

  const configDir = await mkdtemp(resolve(tmpdir(), 'ai-planner-cli-test-'))
  try {
    await writeFile(resolve(configDir, '.aiplanner.json'), JSON.stringify({ defaultAgent: 'team-agent' }), 'utf8')
    assert.equal(await resolveTargetAgent(undefined, configDir), 'team-agent', 'expected defaultAgent to be used when no explicit agent is passed')
    assert.equal(await resolveTargetAgent('override-agent', configDir), 'override-agent', 'expected explicit agent to override config')
  } finally {
    await rm(configDir, { recursive: true, force: true })
  }

  assert.equal(resolveExistingInstallCwd(fixturePath), fixturePath, 'expected local existing-project installs to target the project path')
  assert.equal(resolveExistingInstallCwd('https://github.com/example/repo'), undefined, 'expected repo URL installs to avoid pretending there is a local project path')

  const promptFixtureDir = await mkdtemp(resolve(tmpdir(), 'ai-planner-new-prompt-'))
  try {
    const promptPath = resolve(promptFixtureDir, 'prompt.md')
    await writeFile(promptPath, newProjectPrompt, 'utf8')
    const resolvedPrompt = await resolveNewProjectDescription({
      projectDir: promptFixtureDir,
    })
    assert.equal(resolvedPrompt.sourcePath, promptPath, 'expected new-project flow to auto-load prompt.md from the project directory')
    assert.ok(resolvedPrompt.description.includes('market data API'), 'expected the auto-loaded new-project prompt to come from prompt.md')
  } finally {
    await rm(promptFixtureDir, { recursive: true, force: true })
  }

  const tempProject = await mkdtemp(resolve(tmpdir(), 'ai-planner-new-flow-'))
  try {
    const outputPath = resolve(tempProject, 'implementation_plan.md')
    const newFlowResult = await runNewProjectFlow({
      description: newProjectPrompt,
      output: outputPath,
      targetAgent: 'antigravity',
      planProject: async () => ({
        designDoc: [
          '## Problem',
          'Build a backend market data API.',
          '',
          '## Architecture',
          'TypeScript Node.js service with Drizzle and PostgreSQL.',
          '',
          '## Timeline',
          'Week 1: schema and API bootstrap.',
        ].join('\n'),
        techStack: ['typescript', 'nodejs', 'drizzle', 'postgresql'],
        architecture: 'TypeScript Node.js service with Drizzle and PostgreSQL.',
        timeline: 'Week 1: schema and API bootstrap.',
        skillSuggestions: ['typescript', 'nodejs', 'drizzle', 'postgresql'],
      }),
      recommendProjectSkills: async (techStack, projectContext) => {
        return recommendSkills(techStack, projectContext, { localSkills })
      },
      selectSkills: async (recommendations) => recommendations.filter((recommendation) => recommendation.skill.source === 'local').slice(0, 3),
      installSelectedSkills: async (selected, targetAgent, installCwd) => {
        return installSkills(selected.map((recommendation) => ({
          repo: recommendation.skill.repo,
          name: recommendation.skill.id,
          source: recommendation.skill.source,
          sourcePath: recommendation.skill.sourcePath,
        })), targetAgent, { cwd: installCwd })
      },
    })

    assert.ok(existsSync(outputPath), 'expected the new project flow to save an implementation plan file')
    assert.ok(newFlowResult.recommendations.length > 0, 'expected the new project flow to produce recommendations')
    assert.ok(newFlowResult.selected.length > 0, 'expected the new project flow to select at least one skill')
    assert.ok(newFlowResult.installResult, 'expected the new project flow to install selected skills')
    assert.equal(newFlowResult.installResult.failed.length, 0, 'expected selected local skills to install successfully')
    assert.ok(
      existsSync(resolve(tempProject, '.agents', 'skills', newFlowResult.selected[0].skill.id, 'SKILL.md')),
      'expected selected local skills to be installed into the new project workspace'
    )
  } finally {
    await rm(tempProject, { recursive: true, force: true })
  }

  const reusePlanProject = await mkdtemp(resolve(tmpdir(), 'ai-planner-new-reuse-'))
  try {
    const outputPath = resolve(reusePlanProject, 'implementation_plan.md')
    await writeFile(outputPath, [
      '# Implementation Plan',
      '',
      '## Architecture',
      'TypeScript Node.js service with Drizzle and PostgreSQL.',
      '',
      '## Timeline',
      'Week 1: schema and API bootstrap.',
    ].join('\n'), 'utf8')

    let planProjectCalled = false
    const reusedPlanResult = await runNewProjectFlow({
      description: newProjectPrompt,
      output: outputPath,
      targetAgent: 'antigravity',
      planProject: async () => {
        planProjectCalled = true
        throw new Error('planProject should not be called when implementation_plan.md already exists')
      },
      recommendProjectSkills: async (techStack, projectContext) => {
        return recommendSkills(techStack, projectContext, { localSkills })
      },
      selectSkills: async (recommendations) => recommendations.filter((recommendation) => recommendation.skill.source === 'local').slice(0, 1),
      installSelectedSkills: async (selected, targetAgent, installCwd) => {
        return installSkills(selected.map((recommendation) => ({
          repo: recommendation.skill.repo,
          name: recommendation.skill.id,
          source: recommendation.skill.source,
          sourcePath: recommendation.skill.sourcePath,
        })), targetAgent, { cwd: installCwd })
      },
    })

    assert.equal(planProjectCalled, false, 'expected existing implementation plan to skip re-planning')
    assert.ok(reusedPlanResult.planningResult.techStack.includes('typescript'), 'expected reused plan to recover tech stack from saved implementation plan')
    assert.ok(reusedPlanResult.installResult, 'expected reused-plan flow to continue through skill installation')
  } finally {
    await rm(reusePlanProject, { recursive: true, force: true })
  }

  console.log('cli tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
