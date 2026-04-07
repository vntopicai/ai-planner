# AI Planner Local

> CLI-first local setup for agent-ready development environments.

AI Planner Local helps a developer prepare their own machine for AI-assisted work:

- analyze an existing local repo
- generate local wiki context with DeepWiki
- plan a new project with gstack-backed workflows
- recommend the right skills for the current project
- install those skills into the local agent environment

The current MVP is intentionally:

- local-first
- CLI-first
- optimized for developers working on their own machines

`AI Planner Cloud` is deferred to a later phase.

## What AI Planner Local Does

AI Planner Local is a thin orchestrator around a few strong tools:

- [DeepWiki Open](https://github.com/AsyncFuncAI/deepwiki-open) for wiki generation and wiki browsing/chat
- [gstack](https://github.com/garrytan/gstack) for planning workflows
- [Vercel Skills](https://github.com/vercel-labs/skills) for local skills management

AI Planner adds:

- local orchestration
- tech detection
- machine readiness checks
- local skill recommendation
- local installation flow

`gstack` is not vendored in this repository. The planner installs it on demand through `npx skills add garrytan/gstack` when the `new` flow needs it, and falls back to direct LLM prompting if that install is unavailable.

## Product Focus

The main goal of AI Planner is simple:

- help developers start and run projects with AI agents as fast as possible
- keep the setup local, practical, and easy to understand
- adopt tools that give developers a real productivity lift right now

In this phase, that means:

- CLI-first over dashboard-first
- local workflow over shared cloud workflow
- fewer steps over more abstraction
- opinionated defaults over too many decisions

When evaluating a new feature or integration, the main question is:

- does this help a developer go from idea or existing repo to an agent-ready local workflow faster, more conveniently, and in a more up-to-date way?

If the answer is yes, it is in scope.

## Current MVP Flows

### Existing Project

```text
Local repo -> DeepWiki wiki -> Tech detection -> Skill recommendations -> Local install
```

### New Project

```text
Idea -> gstack planning -> Implementation plan -> Skill recommendations -> Local install
```

## Requirements

You will get the best results if the local machine has:

- Node.js 20+
- npm / npx
- Docker
- at least one configured LLM API key

DeepWiki is optional for some local smoke tests, but required for the full wiki flow.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local env file

```bash
cp .env.example .env
```

Fill in at least one LLM API key.

### 3. Start DeepWiki

```bash
docker compose up -d
```

### 4. Build the CLI

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/cli
```

### 5. Check machine readiness

```bash
node packages/cli/dist/index.js doctor
```

If you want AI Planner Local to create `.env` when missing and try to start DeepWiki:

```bash
node packages/cli/dist/index.js bootstrap
```

`bootstrap` also tries to install `garrytan/gstack` into the selected target agent so the `new` flow can use the correct local agent setup.

## Step By Step: Existing Project

### Fast path

```bash
node packages/cli/dist/index.js existing ./path/to/local/project
```

### Recommended flow

1. Build the CLI.
2. Run `doctor`.
3. Run `existing` against the local repo.
4. Review the recommended skills.
5. Confirm install.
6. Open the generated wiki in DeepWiki when available.
7. Start your local agent on that project.

### Local repo example

```bash
node packages/cli/dist/index.js existing ./my-project
```

### GitHub repo example

```bash
node packages/cli/dist/index.js existing https://github.com/user/repo
```

### Non-interactive smoke-test example

```bash
node packages/cli/dist/index.js existing fixtures/existing-project --skip-wiki --yes --skip-install
```

Useful flags:

- `--skip-wiki` to skip DeepWiki and use local detection only
- `--yes` to auto-select recommendations in non-interactive mode
- `--skip-install` to stop after recommendation
- `--agent <name>` to override the target agent

## Step By Step: New Project

### Fast path

```bash
node packages/cli/dist/index.js new
```

### Recommended flow

1. Build the CLI.
2. Run `doctor`.
3. Run `new`.
4. Describe the product idea in the opened editor.
5. Wait for the planning pipeline to complete.
6. Review the generated implementation plan.
7. Review and confirm skill installation.
8. Start building with the saved plan and the local agent environment.

### Save the plan to a custom file

```bash
node packages/cli/dist/index.js new --output docs/implementation-plan.md
```

### Example: Start from a single rough idea

If you only have one loose prompt, that is enough to begin:

```text
I want to build a small AI assistant for sales teams that turns meeting transcripts into follow-up emails, CRM notes, and next-step reminders.
```

Recommended flow:

1. Run `node packages/cli/dist/index.js doctor`.
2. Run `node packages/cli/dist/index.js new`.
3. Paste the rough idea into the editor that opens.
4. Let AI Planner expand that prompt through the gstack planning pipeline.
5. Review the saved implementation plan.
6. Confirm the recommended skills for the resolved target agent.

You can make the starting prompt stronger by adding a little structure:

```text
Project idea:
Build an AI assistant for sales teams.

Target users:
Account executives at small B2B SaaS companies.

Core workflow:
After each call, upload or sync the transcript and generate follow-up email drafts, CRM summaries, and action items.

Constraints:
Start as a simple web app. Prefer TypeScript, Node.js, and PostgreSQL.
```

This usually gives better planning output than jumping straight into implementation details.

### Example: Use a team default agent

If your team normally installs skills into one shared local agent name, set it once in `.aiplanner.json`:

```json
{
  "defaultAgent": "team-agent",
  "preferredSkillsDirs": [
    "fixtures/local-skills",
    "C:/team/skills"
  ]
}
```

Then you can run:

```bash
node packages/cli/dist/index.js bootstrap
node packages/cli/dist/index.js new
node packages/cli/dist/index.js existing ./my-project
```

AI Planner Local will explain that the target agent was resolved from `defaultAgent`. If you need a one-off override, use `--agent other-agent`.

## Local Skill Sources

AI Planner Local can use extra local skill directories as recommendation sources.

Important rule:

- local and team skill folders are used as recommendation sources
- they are not used as the install destination in the main flow
- if `--agent` is omitted, AI Planner Local will use `defaultAgent` from `.aiplanner.json` when present

This keeps the main project setup clean while still letting the recommender prefer your own skill library.

### Default local source for this repo

This repository includes:

```text
fixtures/local-skills
```

That folder is automatically used as a local recommendation source.

### Optional project config

You can create `.aiplanner.json` in the repo root, or start from `.aiplanner.json.example`:

```json
{
  "preferredSkillsDirs": [
    "fixtures/local-skills",
    "C:/team/skills",
    "C:/users/me/skills"
  ],
  "defaultAgent": "antigravity"
}
```

Priority order for recommendations:

1. configured local skill dirs
2. remote catalog from `skills.sh`
3. skills already installed in the project are only used to avoid duplicates

## Wiki Browsing

AI Planner Local does not try to build a heavy custom wiki UI in this phase.

Preferred wiki workflow:

1. generate the wiki locally through AI Planner
2. save the markdown artifact locally
3. browse and chat with the wiki through DeepWiki when available

The web app is optional in this phase and should be treated as a lightweight companion only.

## Community Direction

Community contributions are welcome, including new integrations and workflow ideas.

Examples of promising future integrations:

- gstack
- DeepWiki
- vibe-kanban
- BMAD
- OpenSpec
- other tools that materially improve developer speed, planning quality, project understanding, or agent execution

The important rule is:

- new integrations should strengthen the core mission
- they should not turn the project into a generic collection of unrelated AI tools
- they should reduce friction for real developers working locally

Good proposals usually fit one or more of these buckets:

- faster project bootstrap
- better repo understanding
- better planning from a rough prompt
- better agent/workspace setup
- better local execution flow
- better recommendations for what a developer should do next

If you want to propose a new feature, please frame it in terms of:

1. the developer problem it solves
2. how it improves the CLI-first local workflow
3. whether it replaces an existing step, removes friction, or adds too much complexity

The long-term direction is intentionally flexible:

- AI Planner is not limited to only gstack and DeepWiki
- over time, the project may support any strong ecosystem tool that creates clear value for developers
- additions should happen gradually, without breaking the main promise of fast local AI-agent onboarding

## CLI Commands

```bash
aip bootstrap                  # Create local config when possible and run readiness checks
aip doctor                     # Check whether this machine is ready for local flows
aip existing <repo>            # Analyze an existing local repo or GitHub repo
aip new                        # Plan a new project locally
aip skills list                # List installed skills
aip skills add <repo>          # Add skills manually
aip skills recommend <tech...> # Get recommendations
aip ui                         # Start optional local companion API/web flow
```

## Testing

The repo includes:

- `fixtures/existing-project` as the local existing-project fixture
- `fixtures/local-skills` as the local skill-library fixture

### Build before running tests

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/cli
```

### Run core tests

```bash
node packages/core/test/run-tests.mjs
```

This verifies:

- tech detection against `fixtures/existing-project`
- config loading
- local skill directory loading

### Run CLI tests

```bash
node packages/cli/test/run-tests.mjs
```

This verifies:

- existing-project inspection against `fixtures/existing-project`
- recommendation flow with local skills included

### Manual smoke tests

Existing project:

```bash
node packages/cli/dist/index.js existing fixtures/existing-project --skip-wiki --yes --skip-install
```

New project:

```bash
node packages/cli/dist/index.js new
```

Doctor:

```bash
node packages/cli/dist/index.js doctor
```

This now verifies not only the target agent itself, but also whether `gstack` is installed for that agent.

Bootstrap:

```bash
node packages/cli/dist/index.js bootstrap
```

This now tries to initialize the selected target agent by installing `garrytan/gstack` if it is missing.

## Contributing

If you want to improve the project:

1. Build `packages/core` and `packages/cli`
2. Run the test scripts above
3. Use `fixtures/existing-project` for existing-project changes
4. Use `fixtures/local-skills` for local recommendation changes
5. Keep the product CLI-first and local-first

See [CONTRIBUTING.md](./CONTRIBUTING.md) for a shorter contributor checklist.

## Project Structure

```text
packages/
|- core/   # Shared local orchestration logic
|- cli/    # Primary product surface
\- web/    # Optional thin companion

fixtures/
|- existing-project/ # Existing-project fixture
\- local-skills/     # Local recommendation-source fixture
```

## LLM Providers

Supports multiple providers through `.env`:

- Gemini
- OpenAI
- Anthropic
- OpenRouter

You can also override the Gemini model with:

```bash
GEMINI_MODEL=gemini-2.5-flash
```

## License

MIT
