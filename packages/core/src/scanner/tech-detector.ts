import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Detects tech stack from a local project directory.
 * Analyzes: package.json, requirements.txt, go.mod, Cargo.toml, etc.
 */
export async function detectTechStack(projectPath: string): Promise<string[]> {
  const tech: Set<string> = new Set()
  const absPath = resolve(projectPath)

  await Promise.allSettled([
    detectFromPackageJson(absPath, tech),
    detectFromRequirementsTxt(absPath, tech),
    detectFromFileExtensions(absPath, tech),
    detectFromConfigFiles(absPath, tech),
  ])

  return Array.from(tech)
}

async function detectFromPackageJson(projectPath: string, tech: Set<string>): Promise<void> {
  const pkgPath = join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) return

  const content = await readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(content) as Record<string, unknown>
  const deps = {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
  }

  const mapping: Record<string, string> = {
    react: 'react',
    'react-dom': 'react',
    next: 'nextjs',
    nuxt: 'nuxt',
    vue: 'vue',
    '@angular/core': 'angular',
    svelte: 'svelte',
    vite: 'vite',
    typescript: 'typescript',
    express: 'express',
    fastify: 'fastify',
    elysia: 'nodejs',
    '@supabase/supabase-js': 'supabase',
    prisma: 'prisma',
    mongoose: 'mongodb',
    'drizzle-orm': 'drizzle',
    drizzle: 'drizzle',
    postgres: 'postgresql',
    pg: 'postgresql',
    tailwindcss: 'tailwind',
    '@shadcn/ui': 'shadcn',
    'shadcn-ui': 'shadcn',
    playwright: 'playwright',
    vitest: 'vitest',
    jest: 'testing',
    '@testing-library/react': 'testing',
    graphql: 'graphql',
    trpc: 'trpc',
    zod: 'typescript',
  }

  for (const [dep, techName] of Object.entries(mapping)) {
    if (dep in deps) tech.add(techName)
  }

  // Always add nodejs if package.json exists
  tech.add('nodejs')
  if ('typescript' in deps || existsSync(join(projectPath, 'tsconfig.json'))) {
    tech.add('typescript')
  }
}

async function detectFromRequirementsTxt(projectPath: string, tech: Set<string>): Promise<void> {
  const paths = [
    join(projectPath, 'requirements.txt'),
    join(projectPath, 'pyproject.toml'),
    join(projectPath, 'setup.py'),
  ]

  for (const p of paths) {
    if (!existsSync(p)) continue
    const content = await readFile(p, 'utf-8')
    tech.add('python')

    if (/fastapi/i.test(content)) tech.add('fastapi')
    if (/django/i.test(content)) tech.add('django')
    if (/flask/i.test(content)) tech.add('flask')
    if (/sqlalchemy/i.test(content)) tech.add('postgresql')
    if (/pytest/i.test(content)) tech.add('testing')
  }
}

async function detectFromFileExtensions(projectPath: string, tech: Set<string>): Promise<void> {
  // Quick check for language indicators
  const checks: Array<[string, string]> = [
    [join(projectPath, 'tsconfig.json'), 'typescript'],
    [join(projectPath, 'drizzle.config.ts'), 'typescript'],
    [join(projectPath, 'go.mod'), 'golang'],
    [join(projectPath, 'Cargo.toml'), 'rust'],
    [join(projectPath, 'pom.xml'), 'java'],
    [join(projectPath, 'build.gradle'), 'java'],
    [join(projectPath, 'Gemfile'), 'ruby'],
  ]

  for (const [file, techName] of checks) {
    if (existsSync(file)) tech.add(techName)
  }
}

async function detectFromConfigFiles(projectPath: string, tech: Set<string>): Promise<void> {
  const checks: Array<[string, string]> = [
    [join(projectPath, 'tailwind.config.js'), 'tailwind'],
    [join(projectPath, 'tailwind.config.ts'), 'tailwind'],
    [join(projectPath, 'drizzle.config.ts'), 'drizzle'],
    [join(projectPath, 'playwright.config.ts'), 'playwright'],
    [join(projectPath, 'playwright.config.js'), 'playwright'],
    [join(projectPath, 'vitest.config.ts'), 'vitest'],
    [join(projectPath, 'jest.config.js'), 'testing'],
    [join(projectPath, 'next.config.js'), 'nextjs'],
    [join(projectPath, 'next.config.ts'), 'nextjs'],
    [join(projectPath, 'nuxt.config.ts'), 'nuxt'],
    [join(projectPath, 'svelte.config.js'), 'svelte'],
    [join(projectPath, 'vite.config.ts'), 'vite'],
  ]

  for (const [file, techName] of checks) {
    if (existsSync(file)) tech.add(techName)
  }
}
