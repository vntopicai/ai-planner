import type { LLMProvider } from '../types.js'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMResponse {
  text: string
  provider: LLMProvider
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
  const provider = opts.provider ?? detectProvider()
  const maxTokens = opts.maxTokens ?? 2048

  switch (provider) {
    case 'gemini':
      return callGemini(messages, maxTokens)
    case 'openai':
      return callOpenAI(messages, maxTokens)
    case 'claude':
      return callClaude(messages, maxTokens)
    case 'openrouter':
      return callOpenRouter(messages, maxTokens)
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

function detectProvider(): LLMProvider {
  const preferred = (process.env.LLM_PROVIDER ?? 'gemini') as LLMProvider
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

async function callGemini(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY!
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

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
  return { text, provider: 'gemini' }
}

async function callOpenAI(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY!

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: maxTokens }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).choices?.[0]?.message?.content ?? ''
  return { text, provider: 'openai' }
}

async function callClaude(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
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
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: chatMessages,
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`)
  const data = await res.json() as Record<string, unknown>
  const text = (data as any).content?.[0]?.text ?? ''
  return { text, provider: 'claude' }
}

async function callOpenRouter(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-exp:free'

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
  return { text, provider: 'openrouter' }
}
