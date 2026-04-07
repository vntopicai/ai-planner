import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectExistingProject, resolveExistingInstallCwd } from '../dist/commands/existing.js'
import { resolveTargetAgent } from '../dist/agent.js'
import { loadAIPlannerConfig } from '../../core/dist/config/loader.js'
import { loadLocalSkillsFromDirectories } from '../../core/dist/skills/local-directory.js'
import { recommendSkills } from '../../core/dist/skills/recommender.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const fixturePath = resolve(repoRoot, 'fixtures/existing-project')

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

  console.log('cli tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
