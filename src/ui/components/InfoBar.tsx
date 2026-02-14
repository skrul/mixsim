import { useSurfaceStore } from '@/state/surface-store'
import styles from './InfoBar.module.css'

export function InfoBar() {
  const helpText = useSurfaceStore((s) => s.helpText)

  return (
    <div className={styles.infoBar}>
      {helpText ? (
        helpText
      ) : (
        <span className={styles.placeholder}>
          Hover over a control to see what it does
        </span>
      )}
    </div>
  )
}
