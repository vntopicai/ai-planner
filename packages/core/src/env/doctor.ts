import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { checkDeepWikiHealth } from '../deepwiki/client.js'
import type { BootstrapResult, MachineReadinessReport, ReadinessCheck, ReadinessStatus } from '../types.js'

const execFileAsync = promisify(execFile)

interface CheckOptions {
  cwd?: string
  agent?: string
}

interface BootstrapOptions extends CheckOptions {
  createEnvFile?: boolean
  startDeepWiki?: boolean
}

interface CommandResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: string
}

export async function runMachineReadinessChecks(options: CheckOptions = {}): Promise<MachineReadinessReport> {
  const workspacePath = resolve(options.cwd ?? process.cwd())
  const targetAgent = options.agent ?? 'antigravity'
  const envPath = join(workspacePath, '.env')
  const checks: ReadinessCheck[] = []

  checks.push(checkNodeVersion())
  checks.push(await checkCommandAvailability('npm', ['--version'], {
    id: 'npm',
    label: 'npm',
    successSummary: 'npm is available',
    failSummary: 'npm is not available',
    failFix: 'Install or repair npm before running AI Planner Local.',
  }))
  checks.push(await checkCommandAvailability('docker', ['--version'], {
    id: 'docker-cli',
    label: 'Docker CLI',
    successSummary: 'Docker CLI is available',
    failSummary: 'Docker CLI is not available',
    failFix: 'Install Docker Desktop or Docker Engine.',
  }))
  checks.push(await checkDockerDaemon())
  checks.push(await checkWorkspaceWritable(workspacePath))
  checks.push(await checkEnvFile(envPath))
  checks.push(await checkLlmConfiguration(envPath))
  checks.push(await checkCommandAvailability('npx', ['skills', '--help'], {
    id: 'skills-cli',
    label: 'skills CLI access',
    successSummary: 'npx can invoke the skills CLI',
    failSummary: 'Unable to invoke `npx skills`',
    failFix: 'Repair npm/npx and confirm the machine can run `npx skills --help`.',
  }))
  checks.push(await checkCommandAvailability('npx', ['skills', 'list', '-a', targetAgent], {
    id: 'agent-access',
    label: 'target agent access',
    successSummary: `skills CLI can access the ${targetAgent} agent target`,
    failSummary: `Unable to verify access to the ${targetAgent} agent target`,
    failFix: `Confirm the ${targetAgent} agent is installed and accessible on this machine.`,
    statusOnFailure: 'warn',
  }))
  checks.push(await checkGstackInstallation(targetAgent))
  checks.push(await checkDeepWiki())

  return {
    ok: !checks.some((check) => check.status === 'fail'),
    workspacePath,
    targetAgent,
    generatedAt: new Date().toISOString(),
    checks,
  }
}

export async function bootstrapLocalMachine(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const workspacePath = resolve(options.cwd ?? process.cwd())
  const createEnvFile = options.createEnvFile ?? true
  const startDeepWiki = options.startDeepWiki ?? true
  const targetAgent = options.agent ?? 'antigravity'
  const actions: string[] = []

  if (createEnvFile) {
    const envCreated = await ensureEnvFile(workspacePath)
    if (envCreated) {
      actions.push(`Created .env from .env.example at ${join(workspacePath, '.env')}`)
    }
  }

  if (startDeepWiki) {
    const dockerAvailable = await runCommand('docker', ['--version'], workspacePath)
    if (dockerAvailable.ok) {
      const deepwikiHealthy = await checkDeepWikiHealth()
      if (!deepwikiHealthy) {
        const startResult = await runCommand('docker', ['compose', 'up', '-d'], workspacePath, 60000)
        if (startResult.ok) {
          actions.push('Started DeepWiki with `docker compose up -d`')
        } else {
          actions.push('Tried to start DeepWiki, but docker compose failed')
        }
      }
    }
  }

  const gstackResult = await ensureGstackInstalledForAgent(workspacePath, targetAgent)
  if (gstackResult === 'installed') {
    actions.push(`Installed gstack skills for target agent ${targetAgent}`)
  } else if (gstackResult === 'failed') {
    actions.push(`Tried to install gstack skills for ${targetAgent}, but the install failed`)
  }

  const report = await runMachineReadinessChecks(options)
  return { report, actions }
}

async function ensureEnvFile(workspacePath: string): Promise<boolean> {
  const envPath = join(workspacePath, '.env')
  const envExamplePath = join(workspacePath, '.env.example')

  try {
    await access(envPath, constants.F_OK)
    return false
  } catch {
    // Continue and try to create it from the example.
  }

  await access(envExamplePath, constants.F_OK)
  await mkdir(dirname(envPath), { recursive: true })
  await copyFile(envExamplePath, envPath)
  return true
}

function checkNodeVersion(): ReadinessCheck {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  if (major >= 20) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'pass',
      summary: `Node.js ${process.versions.node} is supported`,
    }
  }

  return {
    id: 'node',
    label: 'Node.js',
    status: 'fail',
    summary: `Node.js ${process.versions.node} is too old`,
    fix: 'Install Node.js 20 or newer.',
  }
}

async function checkCommandAvailability(
  command: string,
  args: string[],
  input: {
    id: string
    label: string
    successSummary: string
    failSummary: string
    failFix: string
    statusOnFailure?: ReadinessStatus
  }
): Promise<ReadinessCheck> {
  const result = await runCommand(command, args)
  if (result.ok) {
    return {
      id: input.id,
      label: input.label,
      status: 'pass',
      summary: input.successSummary,
      details: firstNonEmptyLine(result.stdout) ?? undefined,
    }
  }

  return {
    id: input.id,
    label: input.label,
    status: input.statusOnFailure ?? 'fail',
    summary: input.failSummary,
    details: normalizeCommandFailure(result),
    fix: input.failFix,
  }
}

async function checkDockerDaemon(): Promise<ReadinessCheck> {
  const dockerResult = await runCommand('docker', ['--version'])
  if (!dockerResult.ok) {
    return {
      id: 'docker-daemon',
      label: 'Docker daemon',
      status: 'warn',
      summary: 'Docker daemon was not checked because Docker CLI is unavailable',
      fix: 'Install Docker first, then rerun `aip doctor`.',
    }
  }

  const result = await runCommand('docker', ['info'], undefined, 15000)
  if (result.ok) {
    return {
      id: 'docker-daemon',
      label: 'Docker daemon',
      status: 'pass',
      summary: 'Docker daemon is running',
    }
  }

  return {
    id: 'docker-daemon',
    label: 'Docker daemon',
    status: 'fail',
    summary: 'Docker daemon is not reachable',
    details: normalizeCommandFailure(result),
    fix: 'Start Docker Desktop or the Docker daemon, then rerun `aip doctor`.',
  }
}

async function checkWorkspaceWritable(workspacePath: string): Promise<ReadinessCheck> {
  const tempDir = join(workspacePath, '.ai-planner')
  const tempFile = join(tempDir, 'write-check.tmp')

  try {
    await mkdir(tempDir, { recursive: true })
    await writeFile(tempFile, 'ok', 'utf8')
    await rm(tempFile, { force: true })

    return {
      id: 'workspace-write',
      label: 'workspace write access',
      status: 'pass',
      summary: 'AI Planner can write local artifacts in this workspace',
    }
  } catch (error) {
    return {
      id: 'workspace-write',
      label: 'workspace write access',
      status: 'fail',
      summary: 'AI Planner cannot write local artifacts in this workspace',
      details: error instanceof Error ? error.message : String(error),
      fix: 'Choose a writable workspace or adjust filesystem permissions.',
    }
  }
}

async function checkEnvFile(envPath: string): Promise<ReadinessCheck> {
  try {
    await access(envPath, constants.F_OK)
    return {
      id: 'env-file',
      label: '.env file',
      status: 'pass',
      summary: `.env exists at ${envPath}`,
    }
  } catch {
    return {
      id: 'env-file',
      label: '.env file',
      status: 'warn',
      summary: '.env is missing',
      fix: 'Run `aip bootstrap` or copy `.env.example` to `.env`.',
    }
  }
}

async function checkLlmConfiguration(envPath: string): Promise<ReadinessCheck> {
  let content = ''
  try {
    content = await readFile(envPath, 'utf8')
  } catch {
    return {
      id: 'llm-config',
      label: 'LLM configuration',
      status: 'fail',
      summary: 'No usable LLM provider is configured yet',
      fix: 'Add at least one API key to `.env` before running planning or recommendations.',
    }
  }

  const keys = parseSimpleEnv(content)
  const configured = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']
    .filter((key) => keys[key]?.trim())

  if (configured.length > 0) {
    return {
      id: 'llm-config',
      label: 'LLM configuration',
      status: 'pass',
      summary: `Configured providers: ${configured.join(', ')}`,
    }
  }

  return {
    id: 'llm-config',
    label: 'LLM configuration',
    status: 'fail',
    summary: 'No usable LLM provider is configured yet',
    fix: 'Add at least one API key to `.env` before running planning or recommendations.',
  }
}

async function checkGstackInstallation(targetAgent: string): Promise<ReadinessCheck> {
  const result = await runCommand('npx', ['skills', 'list', '-a', targetAgent])
  if (!result.ok) {
    return {
      id: 'gstack-agent',
      label: 'gstack skills',
      status: 'warn',
      summary: `Unable to verify whether gstack is installed for ${targetAgent}`,
      details: normalizeCommandFailure(result),
      fix: `Run \`aip bootstrap --agent ${targetAgent}\` to install gstack skills for that agent.`,
    }
  }

  if (hasGstackSkillsInstalled(result.stdout)) {
    return {
      id: 'gstack-agent',
      label: 'gstack skills',
      status: 'pass',
      summary: `gstack is installed for ${targetAgent}`,
    }
  }

  return {
    id: 'gstack-agent',
    label: 'gstack skills',
    status: 'warn',
    summary: `gstack is not installed for ${targetAgent}`,
    fix: `Run \`aip bootstrap --agent ${targetAgent}\` before using \`aip new\` on this machine.`,
  }
}

async function checkDeepWiki(): Promise<ReadinessCheck> {
  const healthy = await checkDeepWikiHealth()
  if (healthy) {
    return {
      id: 'deepwiki',
      label: 'DeepWiki',
      status: 'pass',
      summary: 'DeepWiki is reachable',
    }
  }

  return {
    id: 'deepwiki',
    label: 'DeepWiki',
    status: 'warn',
    summary: 'DeepWiki is not reachable right now',
    fix: 'Run `docker compose up -d` or use `aip bootstrap` to start DeepWiki.',
  }
}

async function ensureGstackInstalledForAgent(
  workspacePath: string,
  targetAgent: string
): Promise<'already-installed' | 'installed' | 'failed'> {
  const check = await runCommand('npx', ['skills', 'list', '-a', targetAgent], workspacePath)
  if (check.ok && hasGstackSkillsInstalled(check.stdout)) {
    return 'already-installed'
  }

  const install = await runCommand(
    'npx',
    ['skills', 'add', 'garrytan/gstack', '-a', targetAgent, '-y'],
    workspacePath,
    60000
  )

  return install.ok ? 'installed' : 'failed'
}

async function runCommand(command: string, args: string[], cwd?: string, timeout = 15000): Promise<CommandResult> {
  const executable = normalizeExecutable(command)
  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      cwd,
      timeout,
      env: process.env,
    })
    return {
      ok: true,
      stdout: String(stdout ?? ''),
      stderr: String(stderr ?? ''),
    }
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      stdout: String(execError.stdout ?? ''),
      stderr: String(execError.stderr ?? ''),
      error: execError.message ?? String(error),
    }
  }
}

function normalizeExecutable(command: string): string {
  if (process.platform !== 'win32') {
    return command
  }

  if (command === 'npm' || command === 'npx') {
    return `${command}.cmd`
  }

  return command
}

function hasGstackSkillsInstalled(output: string): boolean {
  const normalized = output.toLowerCase()
  return [
    'garrytan/gstack',
    'office-hours',
    'plan-ceo-review',
    'plan-eng-review',
    'plan-design-review',
  ].some((token) => normalized.includes(token))
}

function parseSimpleEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    result[key] = value
  }

  return result
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function normalizeCommandFailure(result: CommandResult): string {
  return firstNonEmptyLine(result.stderr) ?? firstNonEmptyLine(result.stdout) ?? result.error ?? 'Unknown command failure'
}
