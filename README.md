# AI Planner Local

> CLI-first local setup for agent-ready development environments.

AI Planner Local helps a developer prepare their own machine for AI-assisted work:

- analyze an existing local repo
- generate local wiki context with DeepWiki
- plan a new project with customizable planners (direct-llm, gsd, gstack)
- recommend the right skills for the current project
- install those skills into the local agent environment natively

The current MVP is intentionally:

- local-first
- CLI-first
- optimized for developers working on their own machines

`AI Planner Cloud` is deferred to a later phase.

## What AI Planner Local Does

AI Planner Local is a thin orchestrator around a few strong tools and concepts:

- **Google Engineering Culture**: Baked directly into our default `direct-llm` planner (Spec → Plan → Review → Ship).
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills): A curated collection of excellent agent skills that we seamlessly inject as foundation skills to empower the local agent.
- [DeepWiki Open](https://github.com/AsyncFuncAI/deepwiki-open) for wiki generation and wiki browsing/chat.
- [gstack](https://github.com/garrytan/gstack) and [GSD] for alternative, more complex planning workflows.
- [Vercel Skills](https://github.com/vercel-labs/skills) for standard local skills management.

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
Idea -> direct-llm planner (Google Culture) -> Implementation plan -> Foundation skills injected -> Local install
```

*Note: You can easily switch to `gsd` or `gstack` if you need a different SDLC approach.*

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

AI Planner will also print the direct fallback planning/recommendation model it is configured to use, for example:

```text
Planning fallback model: openai/gpt-4o-mini
```

This is separate from your IDE agent model. Right now, changing the model inside an IDE agent like `antigravity` does not change AI Planner's direct API fallback model.

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
aip new
```

### Folder-first flow

If you already have a new project folder and a markdown idea file inside it, use the positional argument:

```bash
aip new ./my-new-project
```

AI Planner will:

- use `./my-new-project` as the install location
- save the plan to `./my-new-project/implementation_plan.md` by default
- reuse `./my-new-project/implementation_plan.md` if it already exists, so you can retry skill recommendation/install without running planning again
- automatically load one of these files when present:
  - `prompt.md`
  - `project-idea.md`
  - `idea.md`
  - `brief.md`
- fall back to the editor only when no suitable markdown prompt file is found

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

You can combine both:

```bash
node packages/cli/dist/index.js new --project-dir ./my-new-project --output ./my-new-project/docs/implementation-plan.md
```

If planning already succeeded earlier but skill installation failed, simply rerun:

```bash
node packages/cli/dist/index.js new --project-dir ./my-new-project
```

AI Planner will detect the existing `implementation_plan.md`, skip planning, and continue with recommendation/install.

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

> **Credits:** We strongly believe in the simplicity and utility of [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). To give developers the best out-of-the-box experience while respecting the author's work, we automatically recommend a curated list of these skills when you use the `direct-llm` planner. They are downloaded natively as `SKILL.md` files straight from the source.

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
- `fixtures/new-project-idea` as the new-project prompt fixture

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
- new-project flow against `fixtures/new-project-idea/prompt.md`
- implementation plan save for a new project run
- local skill install into the generated project workspace

### Manual smoke tests

Existing project:

```bash
node packages/cli/dist/index.js existing fixtures/existing-project --skip-wiki --yes --skip-install
```

New project:

```bash
node packages/cli/dist/index.js new
```

New project with the fixture prompt:

1. Open [prompt.md](/E:/2026/Planning/ai-planner/fixtures/new-project-idea/prompt.md)
2. Run:

```bash
node packages/cli/dist/index.js new --project-dir fixtures/new-project-idea
```

3. AI Planner will automatically load `fixtures/new-project-idea/prompt.md`
4. Confirm the recommended skills
5. Verify the output:
   - `fixtures/new-project-idea/implementation_plan.md`
   - `fixtures/new-project-idea/.agents/skills/`

If you do this manual smoke test, remove generated artifacts before committing. The automated CLI test already covers this flow without requiring interactive editor input.

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
5. Use `fixtures/new-project-idea` when changing the new-project planning flow
6. Keep the product CLI-first and local-first

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

Or set provider-specific model overrides explicitly:

```bash
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
```

```bash
LLM_PROVIDER=claude
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

```bash
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Important:

- these settings control AI Planner's direct API calls
- they do not yet change the model configured inside your IDE agent
- the `new` planning flow may run in `gstack`, `direct LLM fallback`, or `mixed` mode, and the CLI now prints which one was used

## License

MIT
