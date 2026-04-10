import inquirer from 'inquirer'
import chalk from 'chalk'
import type { SkillRecommendation } from '@ai-planner/core'

/**
 * Interactive skill selection prompt for CLI.
 * Groups by Essential/Recommended/Optional, pre-selects Essential.
 */
export async function promptSkillSelection(
  recommendations: SkillRecommendation[]
): Promise<SkillRecommendation[]> {
  if (process.env.AI_PLANNER_NON_INTERACTIVE === '1') {
    const autoSelected = recommendations.filter((r) => r.category !== 'optional')
    return autoSelected.length > 0 ? autoSelected : recommendations
  }

  const groups = {
    essential: recommendations.filter((r) => r.category === 'essential'),
    recommended: recommendations.filter((r) => r.category === 'recommended'),
    optional: recommendations.filter((r) => r.category === 'optional'),
  }

  console.log(chalk.bold('\n📋 Skill Recommendations:\n'))
  printSkillRecommendationSummary(groups)

  // Build choices with separators
  const choices: Array<{ name: string; value: SkillRecommendation; checked: boolean } | inquirer.Separator> = []

  if (groups.essential.length) {
    choices.push(new inquirer.Separator(chalk.red.bold('─── 🔴 Essential ───')))
    groups.essential.forEach((r) => choices.push({
      name: formatCompactSkillChoice(r),
      value: r,
      checked: true, // Pre-select essential
    }))
  }

  if (groups.recommended.length) {
    choices.push(new inquirer.Separator(chalk.yellow.bold('─── 🟡 Recommended ───')))
    groups.recommended.forEach((r) => choices.push({
      name: formatCompactSkillChoice(r),
      value: r,
      checked: false,
    }))
  }

  if (groups.optional.length) {
    choices.push(new inquirer.Separator(chalk.green.bold('─── 🟢 Optional ───')))
    groups.optional.forEach((r) => choices.push({
      name: formatCompactSkillChoice(r),
      value: r,
      checked: false,
    }))
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select skills to install (Space to toggle, Enter to confirm):',
      choices,
      pageSize: 12,
    },
  ])

  return selected as SkillRecommendation[]
}

function printSkillRecommendationSummary(
  groups: Record<'essential' | 'recommended' | 'optional', SkillRecommendation[]>
): void {
  const sections: Array<{ title: string; entries: SkillRecommendation[] }> = [
    { title: 'Essential', entries: groups.essential },
    { title: 'Recommended', entries: groups.recommended },
    { title: 'Optional', entries: groups.optional },
  ]

  for (const section of sections) {
    if (section.entries.length === 0) continue

    console.log(chalk.bold(`${section.title}:`))
    section.entries.forEach((recommendation, index) => {
      const source = recommendation.skill.source ?? 'remote'
      console.log(
        `${index + 1}. ${recommendation.skill.id} ${chalk.dim(`[${source}]`)}`
      )
      console.log(`   Repo: ${recommendation.skill.repo}`)
      console.log(`   Why: ${recommendation.reason}`)
    })
    console.log('')
  }
}

function formatCompactSkillChoice(recommendation: SkillRecommendation): string {
  const source = recommendation.skill.source ?? 'remote'
  return `${chalk.bold(recommendation.skill.id)} ${chalk.dim(`[${source}]`)}`
}
