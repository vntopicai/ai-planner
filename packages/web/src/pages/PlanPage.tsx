import { useState } from 'react'
import type { PlanningResult } from '@ai-planner/core'
import { useNavigate } from 'react-router-dom'
import styles from './PlanPage.module.css'

export default function PlanPage() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PlanningResult | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handlePlan = async () => {
    if (!idea.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: idea })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate plan')
      }
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const navigateToSkills = () => {
    // Navigate with state context
    navigate('/skills', { state: { techStack: result?.techStack } })
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>🎯 New Project Planning</h1>
      <p className={styles.desc}>
        Describe your idea. AI will run a YC-style product reframe, architectural review, and design review to generate an Implementation Plan.
      </p>

      {!result && (
        <div className={styles.inputSection}>
          <textarea
            className={styles.textarea}
            placeholder="e.g. I want to build a real-time collaborative code editor with preview. Users can create rooms and invite others..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={loading}
          />
          <button className={styles.submitBtn} onClick={handlePlan} disabled={loading || !idea.trim()}>
            {loading ? 'Running AI Planning Pipeline...' : 'Generate Implementation Plan'}
          </button>
          
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <div className={styles.loadingSteps}>
                <p>1. Office Hours (Product Reframe)</p>
                <p>2. CEO Review (Scope definition)</p>
                <p>3. ENG Review (Architecture & Tech Stack)</p>
                <p>4. Design Review (UX Guidelines)</p>
                <small className={styles.disclaimer}>(This process uses AI and can take up to 60 seconds)</small>
              </div>
            </div>
          )}
          {error && <div className={styles.error}>Error: {error}</div>}
        </div>
      )}

      {result && (
        <div className={styles.resultSection}>
          <div className={styles.successHeader}>
            <h2>✅ Planning Complete!</h2>
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={() => {
                setIdea('')
                setResult(null)
              }}>Start Over</button>
              <button className={styles.primaryBtn} onClick={navigateToSkills}>
                Find Skills for this Stack →
              </button>
            </div>
          </div>

          {result.techStack && result.techStack.length > 0 && (
            <div className={styles.techStackBox}>
              <span className={styles.techLabel}>Detected Tech Stack:</span>
              <div className={styles.techTags}>
                {result.techStack.map(t => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
            </div>
          )}

          <div className={styles.documentViewer}>
            <pre className={styles.markdown}>{result.designDoc}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
