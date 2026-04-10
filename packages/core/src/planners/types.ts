import type { PlanningResult } from '../types.js'

export interface PlannerProgress {
  currentStep: string
  steps: Array<{ name: string; status: 'pending' | 'running' | 'done' | 'error' }>
  output: string
}

export interface PlannerInput {
  description: string
  projectDir?: string
  promptFile?: string
  agent?: string
  onProgress?: (progress: PlannerProgress) => void
}

export interface PlannerEngine {
  id: string
  name: string

  /** Check if the engine is installed and available */
  isAvailable(agent: string): Promise<boolean>

  /** Install the engine if missing */
  install(options: { agent: string; scope: 'global' | 'local' }): Promise<void>

  /** Run project planning pipeline */
  plan(input: PlannerInput): Promise<PlanningResult>
}
