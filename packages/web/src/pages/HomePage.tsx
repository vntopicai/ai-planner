import { useNavigate } from 'react-router-dom'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          Setup your <span className={styles.accent}>AI Agent</span> environment
        </h1>
        <p className={styles.subtitle}>
          Analyze your codebase, generate wiki docs, and install the right skills —
          so your AI agent can fix bugs and add features with full context.
        </p>
      </div>

      <div className={styles.flows}>
        {/* Flow A */}
        <button className={styles.flowCard} onClick={() => navigate('/wiki')}>
          <div className={styles.flowIcon}>📂</div>
          <div className={styles.flowContent}>
            <h2 className={styles.flowTitle}>Existing Project</h2>
            <p className={styles.flowDesc}>
              Point to a GitHub repo or local folder. AI generates wiki docs and
              installs the right skills for your tech stack.
            </p>
            <div className={styles.flowSteps}>
              <span>Analyze repo</span>
              <span className={styles.arrow}>→</span>
              <span>Generate wiki</span>
              <span className={styles.arrow}>→</span>
              <span>Install skills</span>
            </div>
          </div>
        </button>

        {/* Flow B */}
        <button className={styles.flowCard} onClick={() => navigate('/plan')}>
          <div className={styles.flowIcon}>✨</div>
          <div className={styles.flowContent}>
            <h2 className={styles.flowTitle}>New Project</h2>
            <p className={styles.flowDesc}>
              Describe your idea. AI runs a full planning pipeline (YC-style) and
              creates an implementation plan with the right skills pre-installed.
            </p>
            <div className={styles.flowSteps}>
              <span>Describe idea</span>
              <span className={styles.arrow}>→</span>
              <span>Generate plan</span>
              <span className={styles.arrow}>→</span>
              <span>Install skills</span>
            </div>
          </div>
        </button>
      </div>

      <div className={styles.poweredBy}>
        <span className={styles.poweredByLabel}>Powered by:</span>
        <a href="https://github.com/AsyncFuncAI/deepwiki-open" target="_blank" rel="noreferrer">DeepWiki</a>
        <span>+</span>
        <a href="https://github.com/garrytan/gstack" target="_blank" rel="noreferrer">gstack</a>
        <span>+</span>
        <a href="https://github.com/vercel-labs/skills" target="_blank" rel="noreferrer">Vercel Skills</a>
      </div>
    </div>
  )
}
