import { useState } from 'react'
import { getRuntimeConfig } from '../config/runtime'
import styles from './WikiPage.module.css'

interface WikiState {
  status: 'idle' | 'loading' | 'done' | 'error'
  techStack: string[]
  markdown: string
  deepwikiUrl?: string
  normalizedLocalPath?: string
  savedWikiPath?: string
  error?: string
}

function looksLikeHtmlDocument(value: string): boolean {
  return /<!doctype html>|<html[\s>]/i.test(value)
}

function getWikiTroubleshootingHint(error: string): string {
  if (/GOOGLE_API_KEY/i.test(error)) {
    return 'DeepWiki backend is missing the Gemini key in its container environment. Restart the DeepWiki Docker service after reloading the updated docker-compose config.'
  }

  if (/No valid document embeddings found/i.test(error)) {
    return 'DeepWiki backend could not build or reuse embeddings for this repo. Try refreshing the DeepWiki container and regenerating after confirming a working LLM provider is configured.'
  }

  if (looksLikeHtmlDocument(error)) {
    return 'The request reached an HTML page instead of the local JSON API. Make sure the web app is talking to AI Planner API on 5174.'
  }

  return 'Make sure AI Planner API is on 5174, DeepWiki app is on 3000, and DeepWiki backend docs are reachable at 8001.'
}

async function requestWiki(body: { repoUrl?: string; localPath?: string }): Promise<Response> {
  const runtime = getRuntimeConfig()
  const apiOrigin = runtime.api.origin
  const preferredWebPort = runtime.web.port
  const endpoints = typeof window !== 'undefined' && window.location.port === preferredWebPort
    ? [
        `${apiOrigin}/api/deepwiki/generate`,
        '/api/deepwiki/generate',
      ]
    : [
        '/api/deepwiki/generate',
        `${apiOrigin}/api/deepwiki/generate`,
      ]

  let lastResponse: Response | undefined
  let lastError: unknown

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        lastResponse = response
        continue
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        return response
      }

      const cloned = response.clone()
      const text = await cloned.text()
      if (!looksLikeHtmlDocument(text)) {
        return response
      }

      lastResponse = response
    } catch (error) {
      lastError = error
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error('Failed to reach the wiki API server.')
}

async function getErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const data = await res.json() as { error?: string }
      if (data.error) return data.error
    } catch {
      // Fall through to a text-based fallback.
    }
  }

  const text = await res.text()
  if (looksLikeHtmlDocument(text)) {
    return 'The wiki request returned an HTML page instead of JSON. This usually means the app hit an old route or a DeepWiki page directly.'
  }

  return text || `Request failed with status ${res.status}`
}

export default function WikiPage() {
  const [input, setInput] = useState('')
  const [state, setState] = useState<WikiState>({ status: 'idle', techStack: [], markdown: '' })

  const handleGenerate = async () => {
    if (!input.trim()) return
    setState({ status: 'loading', techStack: [], markdown: '' })

    try {
      const body = {
        repoUrl: input.startsWith('http') || input.startsWith('git@') ? input : undefined,
        localPath: !(input.startsWith('http') || input.startsWith('git@')) ? input : undefined,
      }
      const res = await requestWiki(body)

      if (!res.ok) throw new Error(await getErrorMessage(res))

      const data = await res.json()
      setState({
        status: 'done',
        techStack: data.techStack ?? [],
        markdown: data.rawMarkdown ?? '',
        deepwikiUrl: data.deepwikiUrl,
        normalizedLocalPath: data.normalizedLocalPath,
        savedWikiPath: data.savedWikiPath,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', techStack: [], markdown: '', error })
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Existing Project Wiki</h1>
      <p className={styles.desc}>Enter a GitHub URL or local path to generate wiki documentation.</p>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="text"
          placeholder="https://github.com/user/repo or /path/to/project"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button className={styles.btn} onClick={handleGenerate} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Analyzing...' : 'Generate Wiki'}
        </button>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>DeepWiki is analyzing your codebase...</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.error}>
          <strong>Error:</strong> {state.error}
          <br />
          <small>{getWikiTroubleshootingHint(state.error ?? '')}</small>
        </div>
      )}

      {state.status === 'done' && (
        <div className={styles.result}>
          {state.normalizedLocalPath && (
            <div className={styles.infoBox}>
              Resolved local path: <code>{state.normalizedLocalPath}</code>
              {state.savedWikiPath && (
                <>
                  <br />
                  Saved wiki file: <code>{state.savedWikiPath}</code>
                </>
              )}
            </div>
          )}

          {state.techStack.length > 0 && (
            <div className={styles.techStack}>
              <span className={styles.techLabel}>Detected:</span>
              {state.techStack.map((tech) => (
                <span key={tech} className={styles.techBadge}>{tech}</span>
              ))}
              {state.deepwikiUrl && (
                <a
                  className={styles.deepwikiLink}
                  href={state.deepwikiUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open DeepWiki
                </a>
              )}
              <button className={styles.skillsBtn} onClick={() => { window.location.href = '/skills' }}>
                Get skill recommendations
              </button>
            </div>
          )}

          <div className={styles.wikiContent}>
            <pre className={styles.markdown}>{state.markdown}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
