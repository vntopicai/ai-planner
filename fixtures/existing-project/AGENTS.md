# AGENTS

This project was prepared by AI Planner Local for agent-driven work.

## Project Context

- Target agent: antigravity
- Project type: existing project
- Tech stack: typescript, drizzle, nodejs, postgresql

## Start Here

- Read this file first.
- Review the project code and current requirements before making changes.
- Generate or refresh project wiki context when deeper architecture context is needed.
- Your project uses the Direct LLM planner — powered by Google Engineering Culture.
- Follow the SPECIFY → PLAN → BUILD → VERIFY → REVIEW → SHIP lifecycle:
  1. `/spec`  — Write a structured specification BEFORE any code. Surface assumptions first.
  2. `/plan`  — Break spec into vertical slices with dependency-ordered tasks.
  3. `/build` — Implement one task at a time. Each task must have acceptance criteria.
  4. `/test`  — Beyoncé Rule: if you liked it, put a test on it. Unit → Integration → E2E.
  5. `/review`— Apply Hyrum's Law (API), Chesterton's Fence (simplification), Shift Left (security).
  6. `/ship`  — Verify the ship checklist before deploy. No "seems right" — require evidence.
- Key principles baked in:
  - Hyrum's Law: any observable behavior will be depended on — design contracts explicitly
  - Chesterton's Fence: never remove code you don't understand yet
  - Trunk-based dev: short-lived branches, merge frequently, use feature flags
- Implementation plan is in `implementation_plan.md`. Review it before writing any code.
- Check `.agents/skills/` before reaching for generic solutions.
- Prefer the installed project skills and local references over starting from scratch.

## Installed Skills

- backend-development
- neon-postgres
- nodejs-backend-patterns
- nodejs-best-practices
- supabase-postgres-best-practices

## Common Commands

- `/spec` → `/plan` → `/build` → `/test` → `/review` → `/ship` — Follow this order. One step at a time.
- Use project-local skills from `.agents/skills/` when they fit the task before reaching for unrelated tools.
- Keep work aligned with the saved plan and wiki context.

## Notes

- `AI Planner` installs project-specific skills into `.agents/skills/` inside this project.
- `AI Planner` may also rely on agent-level skills such as `gstack` installed for the target agent on this machine.
- If agent behavior looks incomplete, run `aip doctor` and `aip bootstrap --agent <agent>` from the AI Planner workspace.
