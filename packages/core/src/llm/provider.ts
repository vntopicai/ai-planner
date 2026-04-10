import type { LLMProvider } from '../types.js'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMResponse {
  text: string
  provider: LLMProvider
  model: string
}

export interface LLMRuntimeInfo {
  provider: LLMProvider
  model: string
  source: 'env'
}

/**
 * Multi-provider LLM client.
 * Priority: GEMINI → OPENAI → CLAUDE → OPENROUTER
 * Reads API keys from env vars.
 */
export async function callLLM(
  messages: LLMMessage[],
  opts: { provider?: LLMProvider; maxTokens?: number } = {}
): Promise<LLMResponse> {
  const runtime = resolveLLMRuntimeInfo(opts.provider)
  const maxTokens = opts.maxTokens ?? 2048

  switch (runtime.provider) {
    case 'gemini':
      return callGemini(messages, maxTokens, runtime.model)
    case 'openai':
      return callOpenAI(messages, maxTokens, runtime.model)
    case 'claude':
      return callClaude(messages, maxTokens, runtime.model)
    case 'openrouter':
      return callOpenRouter(messages, maxTokens, runtime.model)
    default:
      throw new Error(`Unknown LLM provider: ${runtime.provider}`)
  }
}

export function getDefaultLLMRuntimeInfo(preferredProvider?: LLMProvider): LLMRuntimeInfo {
  const provider = preferredProvider ?? getConfiguredProvider()
  return {
    provider,
    model: resolveModelForProvider(provider),
    source: 'env',
  }
}

function detectProvider(): LLMProvider {
  const preferred = getConfiguredProvider()
  const keyMap: Record<LLMProvider, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  }

  // Try preferred first, then fallback
  const order: LLMProvider[] = [preferred, 'gemini', 'openai', 'claude', 'openrouter']
  for (const p of order) {
    if (process.env[keyMap[p]]) return p
  }

  throw new Error(
    'No LLM API key found. Set GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY in .env'
  )
}

function getConfiguredProvider(): LLMProvider {
  const configured = (process.env.LLM_PROVIDER ?? 'gemini') as LLMProvider
  if (['gemini', 'openai', 'claude', 'openrouter'].includes(configured)) {
    return configured
  }

  return 'gemini'
}

function resolveLLMRuntimeInfo(preferredProvider?: LLMProvider): LLMRuntimeInfo {
  const provider = preferredProvider ?? detectProvider()
  return {
    provider,
    model: resolveModelForProvider(provider),
    source: 'env',
  }
}

function resolveModelForProvider(provider: LLMProvider): string {
  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
    case 'openai':
      return process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
    case 'claude':
      return process.env.ANTHROPIC_MODEL ?? 'claude-3-haiku-20240307'
    case 'openrouter':
      return process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-exp:free'
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

async function callGemini(messages: LLMMessage[], maxTokens: number, model: string): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY!

  // Convert to Gemini format
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))

  const systemInstruction = messages.find((m) => m.role === 'system')?.content

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { text, provider: 'gemini', model }
}

async function callOpenAI(messages: LLMMessage[], maxTokens: number, model: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY!

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).choices?.[0]?.message?.content ?? ''
  return { text, provider: 'openai', model }
}

async function callClaude(messages: LLMMessage[], maxTokens: number, model: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!
  const systemMsg = messages.find((m) => m.role === 'system')?.content
  const chatMessages = messages.filter((m) => m.role !== 'system')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: chatMessages,
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).content?.[0]?.text ?? ''
  return { text, provider: 'claude', model }
}

async function callOpenRouter(messages: LLMMessage[], maxTokens: number, model: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY!

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/ai-planner',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  })

  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).choices?.[0]?.message?.content ?? ''
  return { text, provider: 'openrouter', model }
}
