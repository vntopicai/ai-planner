// Shared types for AI Planner

export interface ProjectConfig {
  path: string
  name: string
  techStack: string[]
  projectType: 'existing' | 'new'
}

export interface WikiResult {
  title?: string
  overview: string
  architecture: string
  techStack: string[]
  flows: FlowDiagram[]
  rawMarkdown: string
  pages?: WikiPageResult[]
}

export interface WikiPageResult {
  id: string
  title: string
  description: string
  importance: 'high' | 'medium' | 'low'
  filePaths: string[]
  relatedPages: string[]
  content: string
}

export interface FlowDiagram {
  title: string
  mermaid: string
}

/** A skill discovered from skills.sh */
export interface Skill {
  id: string           // e.g. "vercel-react-best-practices"
  name: string
  description: string
  repo: string         // e.g. "vercel-labs/agent-skills"
  source?: 'local' | 'remote' | 'installed'
  sourcePath?: string
  installsCount?: number
  tags?: string[]
}

/** Recommended skill with category and reason */
export interface SkillRecommendation {
  skill: Skill
  category: 'essential' | 'recommended' | 'optional'
  reason: string
  selected: boolean
}

export interface PlanningResult {
  designDoc: string
  techStack: string[]
  architecture: string
  timeline: string
  skillSuggestions: string[]
  runtime?: PlanningRuntimeInfo
}

export interface PlanningRuntimeInfo {
  mode: 'gstack' | 'direct-llm' | 'mixed'
  provider?: LLMProvider
  model?: string
}

export type LLMProvider = 'gemini' | 'openai' | 'claude' | 'openrouter'

export type ReadinessStatus = 'pass' | 'warn' | 'fail'

export interface ReadinessCheck {
  id: string
  label: string
  status: ReadinessStatus
  summary: string
  details?: string
  fix?: string
}

export interface MachineReadinessReport {
  ok: boolean
  workspacePath: string
  targetAgent: string
  generatedAt: string
  checks: ReadinessCheck[]
}

export interface BootstrapResult {
  report: MachineReadinessReport
  actions: string[]
}

export interface AIPlannerConfig {
  preferredSkillsDirs?: string[]
  defaultAgent?: string
  defaultPlanner?: string
  gsd?: Record<string, unknown>
}
