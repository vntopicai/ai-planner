import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: '🏠 Home', exact: true },
  { to: '/wiki', label: '📖 Wiki' },
  { to: '/plan', label: '🎯 Plan' },
  { to: '/skills', label: '🛠️ Skills' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>AI Planner</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.footer}>
          <span className={styles.footerText}>
            Powered by DeepWiki + gstack + Vercel Skills
          </span>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
