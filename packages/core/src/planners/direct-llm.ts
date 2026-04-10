import type { PlannerEngine, PlannerInput, PlannerProgress } from './types.js'
import type { PlanningResult } from '../types.js'
import { extractPlanningTech, extractSection } from '../utils/tech-extractor.js'

/**
 * Direct LLM Planner — powered by Google Engineering Culture
 *
 * Pipeline inspired by addyosmani/agent-skills (9.8k ⭐):
 * SPECIFY → PLAN → BUILD GUIDANCE → REVIEW → SHIP CHECKLIST
 *
 * Bakes in battle-tested Google SWE principles:
 * - Hyrum's Law (API design)
 * - Beyoncé Rule + test pyramid (testing)
 * - Chesterton's Fence (simplification)
 * - Trunk-based development (git workflow)
 * - Shift Left + feature flags (CI/CD)
 * - Structured spec-before-code discipline
 */
export const directLlmPlanner: PlannerEngine = {
  id: 'direct-llm',
  name: 'Direct LLM (Google Engineering Culture)',

  async isAvailable(): Promise<boolean> {
    return true
  },

  async install(): Promise<void> {
    // Nothing to install — works with any configured LLM API key
  },

  async plan(input: PlannerInput): Promise<PlanningResult> {
    const { callLLM } = await import('../llm/provider.js')

    const steps: PlannerProgress['steps'] = [
      { name: 'spec',          status: 'pending' },
      { name: 'plan',          status: 'pending' },
      { name: 'eng-review',    status: 'pending' },
      { name: 'ship-guidance', status: 'pending' },
    ]

    let accumulatedOutput = ''

    const updateProgress = (stepName: string, status: 'running' | 'done' | 'error', output = '') => {
      const step = steps.find((s: any) => s.name === stepName)
      if (step) step.status = status
      if (output) accumulatedOutput += output
      input.onProgress?.({
        currentStep: stepName,
        steps: [...steps],
        output: accumulatedOutput,
      })
    }

    const runSkill = async (skillName: string, inputData: string): Promise<string> => {
      const skillInstructions: Record<string, string> = {

        // Phase 1: SPECIFY — surface assumptions before writing any code
        'spec': `You are a senior Google engineer running a spec-driven development session.
Your job: write a structured specification BEFORE any code gets written.
Code without a spec is guessing — the spec is the shared source of truth.

FIRST, list your assumptions explicitly:
  ASSUMPTIONS I'M MAKING:
  1. [tech/infra assumption]
  2. [user/scope assumption]
  → Correct me now or I'll proceed with these.

THEN write a spec document covering these six areas:

1. **Objective** — What are we building and why? Who is the user? What does success look like?
2. **Commands** — Full executable commands (build, test, lint, dev — with full flags, not just tool names)
3. **Project Structure** — Where source lives, where tests go, where docs belong
4. **Code Style** — One real code snippet beats three paragraphs. Include naming conventions.
5. **Testing Strategy** — Framework, test locations, coverage expectations, test levels (unit/integration/e2e)
6. **Boundaries** — Three-tier system:
   - Always do: run tests before commits, follow naming conventions, validate inputs
   - Ask first: schema changes, adding dependencies, changing CI config
   - Never do: commit secrets, edit vendor directories, remove failing tests without approval

REFRAME vague requirements into concrete success criteria:
  REQUIREMENT: "Make it faster"
  → REFRAMED: Dashboard LCP < 2.5s, initial load < 500ms, CLS < 0.1
  → Are these the right targets?

Anti-rationalization rules (these excuses are NOT acceptable):
- "This is simple, I don't need a spec" → Even simple tasks need acceptance criteria
- "I'll write the spec after" → That's documentation, not specification
- "The spec will slow us down" → 15 minutes of spec prevents hours of rework

Output a complete Spec document in Markdown format.`,

        // Phase 2: PLAN — dependency-ordered vertical slicing
        'plan': `You are a production engineering lead applying Google's planning discipline.
Given the spec above, create an implementation plan using VERTICAL SLICING.

STEP 1: Map the dependency graph (what must be built before what):
  Database schema → API models → Endpoints → Frontend client → UI

STEP 2: Slice vertically (each slice = working, testable feature path):
  BAD:  Task 1: All DB schema → Task 2: All API → Task 3: All UI → Task 4: Connect
  GOOD: Task 1: User can register (schema + API + UI) → Task 2: User can login → ...

STEP 3: Write tasks in this format:
  ## Task N: [Short descriptive title]
  Description: [One paragraph — what this accomplishes]
  Acceptance criteria:
  - [ ] [Specific, testable condition]
  Verification: npm test -- --grep "feature", npm run build, manual check
  Dependencies: [Task numbers or "None"]
  Files likely touched: [src/path/to/file.ts]
  Estimated scope: [XS=1file | S=1-2 | M=3-5 | L=5-8 | XL=too large, break down]

STEP 4: Add checkpoints every 2-3 tasks:
  ## Checkpoint: After Tasks 1-3
  - [ ] All tests pass
  - [ ] Application builds without errors
  - [ ] Core user flow works end-to-end
  - [ ] Review with human before proceeding

TASK SIZING RULE: If a task is L+ in scope, it MUST be broken down further.
An agent performs best on S and M tasks.

Anti-rationalization rules:
- "I'll figure it out as I go" → That's how tangled messes happen
- "The tasks are obvious" → Write them down anyway — it surfaces hidden dependencies
- "Planning is overhead" → Planning IS the task. Typing without a plan is just noise

Output a complete Implementation Plan in Markdown with phases, tasks, and checkpoints.`,

        // Phase 3: ENG REVIEW — Google engineering principles baked in
        'eng-review': `You are a Staff Engineer at Google conducting a production-readiness review.
Apply these Google engineering principles to the plan above:

**HYRUM'S LAW (API Design)**
"With a sufficient number of users, ALL observable behaviors of your system will be depended on."
→ Any API you expose, someone will depend on. Make contracts explicit. Version carefully.
→ Flag: Are any implementation details leaking through the interface?

**BEYONCÉ RULE + TEST PYRAMID (Testing)**
"If you liked it then you shoulda put a test on it."
→ Test pyramid: many unit tests (fast, isolated) → fewer integration → minimal e2e
→ Flag: Are there untestable components? Missing test levels? Flaky test risks?

**CHESTERTON'S FENCE (Simplification)**
"Do not remove a fence until you understand why it was put up."
→ Before deleting/simplifying any existing code: understand WHY it exists first
→ Flag: Are we removing complexity we don't understand?

**TRUNK-BASED DEVELOPMENT (Git)**
→ Short-lived feature branches, merge frequently, feature flags over long branches
→ Flag: Any work that would require a multi-week branch?

**SHIFT LEFT (Security & Quality)**
→ Catch defects earlier in the lifecycle, not at the end
→ Security review → Code review → Test → Deploy (not the reverse)
→ Flag: Where in the pipeline are quality gates? Can they move earlier?

**CHANGE SIZE NORMS**
→ Small, reviewable PRs beat large ones. A 300-line PR gets reviewed; a 3000-line PR gets rubber-stamped.
→ Flag: Any tasks that would produce PRs too large to review meaningfully?

**DEPRECATION AS FIRST-CLASS CITIZEN**
"Code is a liability, not an asset."
→ Plan for how this code will eventually be deprecated or replaced
→ Flag: Is there an exit path if this approach doesn't work?

Output a structured Engineering Review with: Architecture Decisions, Risk Assessment (High/Med/Low), 
Missing Quality Gates, Specific Action Items for the team to address before starting implementation.`,

        // Phase 4: SHIP GUIDANCE — launch checklist
        'ship-guidance': `You are a Release Engineer preparing a production-grade ship checklist.
Given the spec, plan and engineering review above, produce a SHIP READINESS checklist.

Structure the output as:

## Pre-Implementation Gate
- [ ] Spec reviewed and approved
- [ ] Architecture decisions documented
- [ ] Security review completed
- [ ] Tech stack finalized with version pins

## Build Gates (verify after each phase)
- [ ] All unit tests pass (target: >80% coverage on new code)
- [ ] Integration tests pass
- [ ] Build succeeds in CI with no warnings
- [ ] Zero new linting errors
- [ ] Database migrations tested on a copy of production data shape

## Review Gates (before merge)
- [ ] Code review by at least one engineer not on the task
- [ ] Security checklist reviewed (OWASP Top 10 relevant items)
- [ ] Performance: no N+1 queries, no unbounded loops, response times benchmarked
- [ ] Accessibility: semantic HTML, keyboard nav tested, contrast checked
- [ ] Error paths tested: what happens when dependencies fail?

## Deploy Gates
- [ ] Feature flag in place (if applicable) for gradual rollout
- [ ] Rollback plan documented
- [ ] Monitoring/alerts configured for new endpoints
- [ ] Documentation updated (README, API docs, ADR if architectural decision made)

## Post-Deploy
- [ ] Smoke tests passed in production
- [ ] Metrics baseline established
- [ ] On-call briefed on new behavior
- [ ] Stakeholders notified

ALSO PROVIDE: the 3 most likely things to go wrong with this specific project
and the 3 slash commands the dev should run first in their agent:
/spec, /plan, /build — in that order, one at a time.`,
      }

      const instructions = skillInstructions[skillName] ?? `Apply engineering best practices to: ${skillName}`
      const response = await callLLM(
        [
          { role: 'system', content: instructions },
          { role: 'user', content: inputData },
        ],
        { maxTokens: 4000 }
      )

      return `<!-- [${skillName.toUpperCase()}] Generated via Direct LLM (${response.provider}/${response.model}) -->\n${response.text}`
    }

    // Step 1: SPECIFY
    updateProgress('spec', 'running')
    let specOutput = ''
    try {
      specOutput = await runSkill('spec', input.description)
      updateProgress('spec', 'done', specOutput)
    } catch {
      updateProgress('spec', 'error')
      specOutput = `# Spec\n\n## Objective\n${input.description}\n\n## Tech Stack\nPending discovery\n\n## Success Criteria\n- [ ] Project requirements met\n`
    }

    // Step 2: PLAN
    updateProgress('plan', 'running')
    let planOutput = ''
    try {
      planOutput = await runSkill('plan', `${input.description}\n\n---\n\n${specOutput}`)
      updateProgress('plan', 'done', planOutput)
    } catch {
      updateProgress('plan', 'error')
    }

    // Step 3: ENG REVIEW
    updateProgress('eng-review', 'running')
    let engOutput = ''
    try {
      engOutput = await runSkill('eng-review', `${specOutput}\n\n---\n\n${planOutput}`)
      updateProgress('eng-review', 'done', engOutput)
    } catch {
      updateProgress('eng-review', 'error')
    }

    // Step 4: SHIP GUIDANCE
    updateProgress('ship-guidance', 'running')
    let shipOutput = ''
    try {
      shipOutput = await runSkill('ship-guidance', `${specOutput}\n\n---\n\n${planOutput}\n\n---\n\n${engOutput}`)
      updateProgress('ship-guidance', 'done', shipOutput)
    } catch {
      updateProgress('ship-guidance', 'error')
    }

    const fullOutput = [specOutput, planOutput, engOutput, shipOutput].join('\n\n---\n\n')

    const promptSignals = extractPlanningTech(input.description, { trustGenericFrameworkMentions: true })
    const outputSignals = extractPlanningTech(fullOutput, { trustGenericFrameworkMentions: false })
    const techStack = Array.from(new Set([...promptSignals, ...outputSignals]))

    return {
      designDoc: fullOutput,
      techStack,
      architecture: extractSection(fullOutput, 'architecture'),
      timeline: extractSection(fullOutput, 'timeline'),
      skillSuggestions: techStack,
      runtime: { mode: 'direct-llm' },
    }
  },
}
