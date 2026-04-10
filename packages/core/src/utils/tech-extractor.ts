export function extractPlanningTech(text: string, options: { trustGenericFrameworkMentions: boolean }): string[] {
  const normalizedText = text.toLowerCase()
  const techPatterns: Record<string, RegExp> = {
    react: /\breact\b/gi,
    nextjs: /\bnext\.?js\b/gi,
    typescript: /\btypescript\b/gi,
    nodejs: /\bnode\.?js\b|\bnodejs\b/gi,
    express: /\bexpress\b/gi,
    supabase: /\bsupabase\b/gi,
    drizzle: /\bdrizzle\b/gi,
    postgresql: /\bpostgres(?:ql)?\b/gi,
    tailwind: /\btailwind\b/gi,
    vite: /\bvite\b/gi,
    vue: /\bvue\b/gi,
    python: /\bpython\b/gi,
    fastapi: /\bfastapi\b/gi,
  }

  const genericFrameworks = new Set(['react', 'nextjs', 'express', 'supabase', 'tailwind', 'vite', 'vue', 'fastapi'])
  const detected: string[] = []

  for (const [techName, pattern] of Object.entries(techPatterns)) {
    const matchCount = (normalizedText.match(pattern)?.length || 0)
    if (matchCount === 0) continue

    if (!options.trustGenericFrameworkMentions && genericFrameworks.has(techName) && matchCount < 2) {
      continue
    }

    detected.push(techName)
  }

  if (/\bbackend-first\b/.test(normalizedText) || /\bprefer practical backend patterns\b/.test(normalizedText)) {
    return detected.filter((techName) => !['react', 'nextjs', 'tailwind', 'vite', 'vue'].includes(techName))
  }

  return detected
}

export function extractSection(text: string, section: string): string {
  const regex = new RegExp(`##\\s*${section}[\\s\\S]*?(?=##|$)`, 'i')
  return text.match(regex)?.[0]?.trim() ?? ''
}
