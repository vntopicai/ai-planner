import type { PlannerEngine } from './types.js'
import { directLlmPlanner } from './direct-llm.js'
import { gstackPlanner } from './gstack.js'
import { gsdPlanner } from './gsd.js'

// Registered in order of complexity: simplest → most complex
// This order drives how they appear in `aip status` and recommendation lists
const registry = new Map<string, PlannerEngine>()
registry.set(directLlmPlanner.id, directLlmPlanner)  // ⭐ no external deps
registry.set(gsdPlanner.id, gsdPlanner)               // ⭐⭐ requires npx
registry.set(gstackPlanner.id, gstackPlanner)         // ⭐⭐⭐ full pipeline

export function getPlanner(id: string): PlannerEngine {
  const planner = registry.get(id)
  if (!planner) {
    console.warn(`Planner '${id}' not found, falling back to gstack`)
    return gstackPlanner
  }
  return planner
}

export function getAllPlanners(): PlannerEngine[] {
  return Array.from(registry.values())
}
