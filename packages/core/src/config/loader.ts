import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
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

/**
 * Persist a partial config update to .aiplanner.json
 * Merges with existing config — does not overwrite unrelated fields.
 */
export async function saveAIPlannerConfig(
  updates: Partial<AIPlannerConfig>,
  cwd = process.cwd()
): Promise<void> {
  const configPath = join(resolve(cwd), '.aiplanner.json')
  let existing: AIPlannerConfig = {}
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(await readFile(configPath, 'utf8')) as AIPlannerConfig
    } catch { /* start fresh */ }
  }
  const merged = { ...existing, ...updates }
  await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8')
}
