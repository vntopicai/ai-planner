# AI Planner - Current State Against CLI-First Plan

## What We Already Have

### Core foundations

- Monorepo structure is in place.
- DeepWiki integration exists.
- Tech stack detection exists.
- LLM-based skill recommendation exists.
- Skills CLI wrapper exists.
- gstack-based planning orchestration exists.

### CLI foundations

- `aip existing` exists.
- `aip new` exists.
- `aip skills list/add/remove/recommend` exists.
- CLI prompts for skill selection already exist.

### Web foundations

- A web app exists.
- It can generate wiki output.
- It can run planning and show skill recommendations.

## What Is Now Misaligned With The Final Direction

The final direction is:

- local-first
- CLI-first
- DeepWiki as the main wiki browsing/chat surface
- web as optional companion only

Against that direction, the current repo still has these mismatches:

### Missing top-priority CLI pieces

- `aip doctor` now exists
- `aip bootstrap` now exists
- No standalone `aip wiki`
- No explicit DeepWiki handoff/open command

### Setup is still too manual

- Fresh-machine readiness is improved with doctor/bootstrap, but still needs more polish.
- Structured dependency and environment checks now exist.
- Validation now covers Docker, `npx skills`, local workspace write access, LLM config, and DeepWiki reachability.

### Existing repo flow needs hardening

- `aip existing` works, but needs stronger next-step UX.
- A local test fixture now exists at `fixtures/existing-project`.
- Basic core and CLI verification scripts now exist for the existing-project flow.
- Success output should tell the user exactly:
  - where the wiki is
  - what was installed
  - how to open DeepWiki
  - what to do next

### Web is overbuilt for the chosen direction

- The web app currently assumes a larger role than the final plan requires.
- It should no longer drive the core setup story.
- It should be treated as optional until CLI-first setup is solid.

## What Phase 1 Means Now

Phase 1 is no longer "complete" in product terms.

From the new CLI-first perspective, Phase 1 should now mean:

1. Product framing is updated.
2. CLI is the primary path.
3. Machine setup is treated as product work.
4. Web is optional.

## New Priority Order

### Priority 1

- harden `aip existing`
- setup diagnostics polish
- DeepWiki handoff/open flow

### Priority 2

- simplify and harden `aip new`
- improve completion output

### Priority 3

- simplify and harden `aip new`

### Priority 4

- decide whether to keep only a thin wiki viewer in web

## Recommended Immediate Build Sequence

1. Add machine-checking core utilities.
2. Improve `existing` command completion output.
3. Add optional `wiki` command and DeepWiki open flow.
4. Simplify `new` flow where possible.
5. Expand tests around the `fixtures/existing-project` fixture.
