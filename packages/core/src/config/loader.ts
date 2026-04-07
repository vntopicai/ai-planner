import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AIPlannerConfig } from '../types.js'

export async function loadAIPlannerConfig(cwd = process.cwd()): Promise<AIPlannerConfig> {
  const workspacePath = resolve(cwd)
  const configPath = join(workspacePath, '.aiplanner.json')
  const fallbackLocalSkillsDir = join(workspacePath, 'fixtures', 'local-skills')

  let config: AIPlannerConfig = {}

  if (existsSync(configPath)) {
    try {
      const raw = await readFile(configPath, 'utf8')
      config = JSON.parse(raw) as AIPlannerConfig
    } catch {
      config = {}
    }
  }

  const configuredDirs = Array.isArray(config.preferredSkillsDirs)
    ? config.preferredSkillsDirs.map((dir) => resolve(workspacePath, dir))
    : []

  const preferredSkillsDirs = existsSync(fallbackLocalSkillsDir)
    ? dedupePaths([fallbackLocalSkillsDir, ...configuredDirs])
    : dedupePaths(configuredDirs)

  return {
    ...config,
    preferredSkillsDirs,
  }
}

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths))
}
