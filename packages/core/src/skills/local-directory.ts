import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Skill } from '../types.js'

export async function loadLocalSkillsFromDirectories(skillDirs: string[]): Promise<Skill[]> {
  const collected: Skill[] = []

  for (const dir of skillDirs) {
    const resolvedDir = resolve(dir)
    if (!existsSync(resolvedDir)) continue

    let entries
    try {
      entries = await readdir(resolvedDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const entryName = String(entry.name)
      const skillPath = join(resolvedDir, entryName)
      const skillDocPath = join(skillPath, 'SKILL.md')
      if (!existsSync(skillDocPath)) continue

      try {
        const markdown = await readFile(skillDocPath, 'utf8')
        const frontmatter = parseFrontmatter(markdown)
        const description = frontmatter.description || extractFirstBodyParagraph(markdown) || `Local skill ${entryName}`

        collected.push({
          id: sanitizeSkillId(frontmatter.name || entryName),
          name: frontmatter.name || entryName,
          description,
          repo: 'local/user-skills',
          source: 'local',
          sourcePath: skillPath,
        })
      } catch {
        // Skip unreadable local skills.
      }
    }
  }

  const unique = new Map<string, Skill>()
  for (const skill of collected) {
    unique.set(skill.id, skill)
  }

  return Array.from(unique.values())
}

export async function detectInstalledProjectSkills(projectPath: string): Promise<Skill[]> {
  const resolvedProjectPath = resolve(projectPath)
  const skillsRoot = join(resolvedProjectPath, '.agents', 'skills')
  if (!existsSync(skillsRoot)) return []

  const entries = await readdir(skillsRoot, { withFileTypes: true })
  const detected: Skill[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const entryName = String(entry.name)
    const skillDir = join(skillsRoot, entryName)
    const skillDocPath = join(skillDir, 'SKILL.md')
    if (!existsSync(skillDocPath)) continue

    const markdown = await readFile(skillDocPath, 'utf8')
    const frontmatter = parseFrontmatter(markdown)

    detected.push({
      id: sanitizeSkillId(frontmatter.name || entryName),
      name: frontmatter.name || entryName,
      description: frontmatter.description || `Installed project skill ${entryName}`,
      repo: 'project/installed-skills',
      source: 'installed',
      sourcePath: skillDir,
    })
  }

  return detected
}

function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  for (const rawLine of match[1].split(/\r?\n/)) {
    const separator = rawLine.indexOf(':')
    if (separator === -1) continue

    const key = rawLine.slice(0, separator).trim()
    const value = rawLine.slice(separator + 1).trim()
    result[key] = value
  }

  return result
}

function extractFirstBodyParagraph(markdown: string): string | undefined {
  const withoutFrontmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  return withoutFrontmatter
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#'))
}

function sanitizeSkillId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}
