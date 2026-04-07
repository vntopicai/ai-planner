# Contributing

Thanks for helping improve AI Planner Local.

## Project Direction

Please keep contributions aligned with the current product direction:

- local-first
- CLI-first
- DeepWiki as the primary wiki browsing/chat surface
- web as optional companion only

The core mission is:

- help developers get from idea or existing repo to a usable local AI-agent workflow as quickly as possible

That means contributions should usually:

- reduce setup friction
- improve local onboarding
- improve project understanding
- improve planning quality
- improve skill and agent setup without adding unnecessary complexity

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`

3. Build the main packages:

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/cli
```

4. Run readiness checks if needed:

```bash
node packages/cli/dist/index.js doctor
```

## Fixtures

Use these fixtures when changing the CLI-first flows:

- `fixtures/existing-project`
  - existing-project fixture
- `fixtures/local-skills`
  - local recommendation-source fixture

## Tests

Run both test scripts before submitting changes:

```bash
node packages/core/test/run-tests.mjs
node packages/cli/test/run-tests.mjs
```

Useful manual smoke test:

```bash
node packages/cli/dist/index.js existing fixtures/existing-project --skip-wiki --yes --skip-install
```

## What To Focus On

Good contribution areas:

- `aip doctor`
- `aip bootstrap`
- `aip existing`
- recommendation quality
- local skill source handling
- docs and onboarding
- high-leverage integrations that clearly strengthen the main CLI-first local workflow

Future-friendly integrations are welcome, including tools like `vibe-kanban`, `BMAD`, or `OpenSpec`, as long as they serve the core mission instead of expanding the project into a loose tool collection.

## Keep In Mind

- local skill folders are recommendation sources, not the default install target
- skills already installed in the project should be used to avoid duplicates
- avoid expanding the web app into the primary product surface in this phase

## Pull Request Expectations

Before opening a PR:

1. Build `packages/core` and `packages/cli`
2. Run both test scripts
3. Update README or docs if behavior changed
4. Prefer changes that reduce friction for local CLI usage
