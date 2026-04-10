import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectTechStack } from '../dist/scanner/tech-detector.js'
import { loadAIPlannerConfig } from '../dist/config/loader.js'
import { getDefaultLLMRuntimeInfo } from '../dist/llm/provider.js'
import { writeAgentHandoffFile } from '../dist/agent/handoff.js'
import { loadLocalSkillsFromDirectories } from '../dist/skills/local-directory.js'
import { installSkills } from '../dist/skills/cli-wrapper.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const fixturePath = resolve(repoRoot, 'fixtures/existing-project')

async function main() {
  const techStack = await detectTechStack(fixturePath)

  assert.ok(techStack.includes('nodejs'), 'expected nodejs to be detected from fixtures/existing-project')
  assert.ok(techStack.includes('typescript'), 'expected typescript to be detected from fixtures/existing-project')
  assert.ok(techStack.includes('drizzle'), 'expected drizzle to be detected from fixtures/existing-project')
  assert.ok(techStack.includes('postgresql'), 'expected postgresql to be detected from fixtures/existing-project')

  const config = await loadAIPlannerConfig(repoRoot)
  assert.ok(config.preferredSkillsDirs?.some((dir) => dir.endsWith('fixtures\\local-skills') || dir.endsWith('fixtures/local-skills')))

  const previousProvider = process.env.LLM_PROVIDER
  const previousOpenAIModel = process.env.OPENAI_MODEL
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_MODEL = 'gpt-4o-mini'
  try {
    const llmRuntime = getDefaultLLMRuntimeInfo()
    assert.equal(llmRuntime.provider, 'openai', 'expected configured provider to be reflected in runtime info')
    assert.equal(llmRuntime.model, 'gpt-4o-mini', 'expected configured OpenAI model to be reflected in runtime info')
  } finally {
    if (previousProvider === undefined) {
      delete process.env.LLM_PROVIDER
    } else {
      process.env.LLM_PROVIDER = previousProvider
    }
    if (previousOpenAIModel === undefined) {
      delete process.env.OPENAI_MODEL
    } else {
      process.env.OPENAI_MODEL = previousOpenAIModel
    }
  }

  const localSkills = await loadLocalSkillsFromDirectories(config.preferredSkillsDirs ?? [])
  assert.ok(localSkills.some((skill) => skill.id === 'backend-development'), 'expected backend-development local skill to be loaded')

  const tempProject = await mkdtemp(resolve(tmpdir(), 'ai-planner-core-test-'))
  try {
    const backendSkill = localSkills.find((skill) => skill.id === 'backend-development')
    assert.ok(backendSkill?.sourcePath, 'expected backend-development local skill to have a source path')

    const installResult = await installSkills([
      {
        repo: backendSkill.repo,
        name: backendSkill.id,
        source: backendSkill.source,
        sourcePath: backendSkill.sourcePath,
      },
    ], 'antigravity', { cwd: tempProject })

    assert.equal(installResult.failed.length, 0, 'expected local skill install to succeed')
    assert.ok(
      existsSync(resolve(tempProject, '.agents/skills/backend-development/SKILL.md')),
      'expected local skill to be copied into the target project .agents/skills folder'
    )

    const handoffPath = await writeAgentHandoffFile({
      projectRoot: tempProject,
      targetAgent: 'antigravity',
      projectType: 'existing',
      techStack: ['nodejs', 'postgresql'],
      installedSkillIds: ['backend-development'],
      implementationPlanPath: resolve(tempProject, 'implementation_plan.md'),
      wikiIndexPath: resolve(tempProject, '.ai-planner/wiki/index.md'),
    })

    assert.ok(existsSync(handoffPath), 'expected AGENTS.md to be created for the project')
  } finally {
    await rm(tempProject, { recursive: true, force: true })
  }

  console.log('core tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
