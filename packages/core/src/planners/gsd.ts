import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import type { PlannerEngine, PlannerInput } from './types.js'
import type { PlanningResult } from '../types.js'

const execFileAsync = promisify(execFile)

function getAgentFlag(agent: string): string {
  const mapping: Record<string, string> = {
    claude: '--claude',
    opencode: '--opencode',
    gemini: '--gemini',
    kilo: '--kilo',
    codex: '--codex',
    copilot: '--copilot',
    cursor: '--cursor',
    windsurf: '--windsurf',
    antigravity: '--antigravity',
    augment: '--augment',
    trae: '--trae',
    cline: '--cline',
  }

  // Find a match or default to all? Actually just let it use --all or skip passing if not known, 
  // but GSD installer might prompt if not passed. Using --all is safe if we don't know the agent precisely, 
  // but we usually know it. We'll default to the target agent if matched, else ask GSD to be quiet by just trying it.
  const flag = mapping[agent.toLowerCase()]
  return flag ?? '--all'
}

export const gsdPlanner: PlannerEngine = {
  id: 'gsd',
  name: 'Get Shit Done (GSD)',

  async isAvailable(agent: string): Promise<boolean> {
    try {
      await execFileAsync('npx', ['--version'], { timeout: 5000, shell: true })
      return true
    } catch {
      return false
    }
  },

  async install(options: { agent: string; scope: 'global' | 'local' }): Promise<void> {
    const flag = getAgentFlag(options.agent)
    const scopeFlag = options.scope === 'local' ? '--local' : '--global'
    try {
      await execFileAsync('npx', ['get-shit-done-cc@latest', flag, scopeFlag], {
        timeout: 120000,
        shell: true,
      })
    } catch (e) {
      console.warn(`GSD install failed for ${options.agent}.`)
      throw e
    }
  },

  async plan(input: PlannerInput): Promise<PlanningResult> {
    const targetAgent = input.agent ?? 'antigravity'
    
    input.onProgress?.({
      currentStep: 'Initializing GSD',
      steps: [{ name: 'Init', status: 'running' }],
      output: 'Installing GSD skills...',
    })

    // 1. Install GSD skills for the agent
    await this.install({ agent: targetAgent, scope: 'local' })
    
    // 2. Prepare .planning/PROJECT.md
    input.onProgress?.({
      currentStep: 'Scaffolding Project',
      steps: [{ name: 'Init', status: 'done' }, { name: 'Scaffold', status: 'running' }],
      output: 'Writing initial project context...',
    })

    const projectDir = input.projectDir || process.cwd()
    const planningDir = join(projectDir, '.planning')
    if (!existsSync(planningDir)) {
      await mkdir(planningDir, { recursive: true })
    }

    const projectMdPath = join(planningDir, 'PROJECT.md')
    if (!existsSync(projectMdPath)) {
      const content = `# Project Vision\n\n${input.description}\n`
      await writeFile(projectMdPath, content, 'utf8')
    }

    // 3. Return a dummy PlanningResult since the actual planning happens inside the agent.
    // We explain this in the designDoc so `aip new` prints it out.
    const instructionMessage = `
GSD (Get Shit Done) integration is initialized!

To continue planning and execution, please start your local AI agent (${targetAgent}) and run:
> /gsd-new-project --auto

This will use the prompt you provided to extract requirements, build a roadmap, and guide you through the execution phases.
    `.trim()

    input.onProgress?.({
      currentStep: 'Ready',
      steps: [{ name: 'Init', status: 'done' }, { name: 'Scaffold', status: 'done' }],
      output: instructionMessage,
    })

    // We don't have techStack yet because GSD hasn't run.
    return {
      designDoc: instructionMessage,
      techStack: [],
      architecture: 'Pending GSD execution.',
      timeline: 'Pending GSD execution.',
      skillSuggestions: [],
      runtime: { mode: 'mixed' }, // Mixed or custom
    }
  },
}
