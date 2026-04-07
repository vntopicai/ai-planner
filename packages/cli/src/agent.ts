import { loadAIPlannerConfig } from '@ai-planner/core'

export interface ResolvedAgentContext {
  agent: string
  source: 'explicit' | 'config' | 'default'
}

export async function resolveTargetAgent(explicitAgent?: string, cwd = process.cwd()): Promise<string> {
  const context = await resolveTargetAgentContext(explicitAgent, cwd)
  return context.agent
}

export async function resolveTargetAgentContext(
  explicitAgent?: string,
  cwd = process.cwd()
): Promise<ResolvedAgentContext> {
  if (explicitAgent?.trim()) {
    return {
      agent: explicitAgent.trim(),
      source: 'explicit',
    }
  }

  const config = await loadAIPlannerConfig(cwd)
  if (config.defaultAgent?.trim()) {
    return {
      agent: config.defaultAgent.trim(),
      source: 'config',
    }
  }

  return {
    agent: 'antigravity',
    source: 'default',
  }
}
