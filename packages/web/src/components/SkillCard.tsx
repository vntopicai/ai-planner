import styles from './SkillCard.module.css'

export interface SkillCardProps {
  id: string
  name: string
  repo: string
  description?: string
  reason?: string
  category?: 'essential' | 'recommended' | 'optional'
  installed?: boolean
  selected?: boolean
  onToggle?: (id: string, selected: boolean) => void
}

export default function SkillCard({
  id,
  name,
  repo,
  description,
  reason,
  category,
  installed,
  selected,
  onToggle,
}: SkillCardProps) {
  const isSelectable = onToggle && !installed

  return (
    <div
      className={[
        styles.card,
        isSelectable && styles.selectable,
        selected && styles.selected,
        installed && styles.installed,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => isSelectable && onToggle(id, !selected)}
    >
      <div className={styles.header}>
        {isSelectable && (
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={selected}
            onChange={(e) => onToggle(id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{name}</h3>
          <span className={styles.repo}>{repo}</span>
        </div>
        {installed && <span className={styles.badgeInstalled}>Installed ✅</span>}
        {!installed && category && (
          <span className={[styles.badgeCategory, styles[category]].join(' ')}>
            {category}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {description && <p className={styles.desc}>{description}</p>}
        {reason && (
          <div className={styles.reasonBox}>
            <span className={styles.reasonIcon}>💡</span>
            <p className={styles.reason}>{reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}
