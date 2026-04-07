import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import SkillCard from '../components/SkillCard'
import type { SkillRecommendation } from '@ai-planner/core'
import styles from './SkillsPage.module.css'

export default function SkillsPage() {
  const location = useLocation()
  
  const initialTechStack = (location.state as any)?.techStack?.join(' ') || ''
  
  const [installed, setInstalled] = useState<string[]>([])
  const [recs, setRecs] = useState<SkillRecommendation[]>([])
  const [techInput, setTechInput] = useState(initialTechStack)
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Load installed skills on mount
  useEffect(() => {
    fetchInstalled()
  }, [])

  // Auto-run recommendation if coming from PlanPage with techStack
  useEffect(() => {
    if (initialTechStack && recs.length === 0) {
      handleRecommend()
    }
  }, [initialTechStack])

  const fetchInstalled = async () => {
    try {
      const res = await fetch('/api/skills/installed')
      if (res.ok) {
        const data = await res.json()
        setInstalled(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleRecommend = async () => {
    if (!techInput.trim()) return
    setLoading(true)
    try {
      const techStack = techInput.split(' ').map((s: string) => s.trim()).filter((s: string) => Boolean(s))
      const res = await fetch('/api/skills/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techStack })
      })
      if (res.ok) {
        const data = await res.json()
        setRecs(data)
        // Pre-select essential
        const newSelected = new Set(selectedIds)
        data.forEach((r: SkillRecommendation) => {
          if (r.category === 'essential') newSelected.add(r.skill.id)
        })
        setSelectedIds(newSelected)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedIds(next)
  }

  const handleInstall = async () => {
    if (selectedIds.size === 0) return
    setInstalling(true)
    
    // Convert selected IDs to {repo, name}
    const toInstall = Array.from(selectedIds).map(id => {
      const rec = recs.find(r => r.skill.id === id)
      return { repo: rec?.skill.repo || '', name: id }
    }).filter((s: { repo: string; name: string }) => s.repo)

    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: toInstall, agent: 'antigravity' })
      })
      if (res.ok) {
        alert('Skills installed successfully!')
        setSelectedIds(new Set())
        fetchInstalled()
      } else {
        const err = await res.json()
        alert('Install failed: ' + err.error)
      }
    } catch (e) {
      console.error(e)
      alert('Install failed')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>🛠️ Agent Skills</h1>
        <p className={styles.desc}>Manage your AI Agent's capabilities</p>
      </header>

      {installed.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Installed Skills</h2>
          <div className={styles.installedGrid}>
            {installed.map(skillId => (
              <div key={skillId} className={styles.installedBadge}>
                {skillId} <span className={styles.check}>✓</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Get Recommendations</h2>
        <div className={styles.searchRow}>
          <input
            className={styles.input}
            placeholder="Enter tech stack (e.g. react nextjs supabase)"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRecommend()}
          />
          <button className={styles.btn} onClick={handleRecommend} disabled={loading}>
            {loading ? 'Analyzing...' : 'Recommend'}
          </button>
        </div>

        {recs.length > 0 && (
          <div className={styles.grid}>
            {recs.map(rec => (
              <SkillCard
                key={rec.skill.id}
                id={rec.skill.id}
                name={rec.skill.name}
                repo={rec.skill.repo}
                description={rec.skill.description}
                reason={rec.reason}
                category={rec.category}
                selected={selectedIds.has(rec.skill.id)}
                installed={installed.includes(rec.skill.id) || installed.some(i => i.includes(rec.skill.id))}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </section>

      {selectedIds.size > 0 && (
        <div className={styles.floatingBar}>
          <div className={styles.floatingContent}>
            <span>{selectedIds.size} skills selected</span>
            <button 
              className={styles.primaryBtn} 
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? 'Installing...' : 'Install Selected'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
