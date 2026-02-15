import styles from './ControlPanel.module.css'

export function ControlPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.sectionBox}>
        <div className={styles.sectionLabel}>SCENES</div>
        <div className={styles.buttonGrid}>
          <button className={styles.placeholderButton} disabled>UNDO</button>
          <button className={styles.placeholderButton} disabled>GO</button>
          <button className={styles.placeholderButton} disabled>PREV</button>
          <button className={styles.placeholderButton} disabled>NEXT</button>
          <button className={`${styles.placeholderButton} ${styles.wideButton}`} disabled>VIEW</button>
        </div>
      </div>
      <div className={styles.sectionBox}>
        <div className={styles.sectionLabel}>ASSIGN</div>
        <div className={styles.buttonGrid}>
          <button className={styles.placeholderButton} disabled>1</button>
          <button className={styles.placeholderButton} disabled>2</button>
          <button className={styles.placeholderButton} disabled>3</button>
          <button className={styles.placeholderButton} disabled>4</button>
          <button className={styles.placeholderButton} disabled>5</button>
          <button className={styles.placeholderButton} disabled>6</button>
          <button className={styles.placeholderButton} disabled>7</button>
          <button className={styles.placeholderButton} disabled>8</button>
          <button className={`${styles.placeholderButton} ${styles.wideButton}`} disabled>VIEW</button>
        </div>
      </div>
      <div className={styles.sectionBox}>
        <div className={styles.sectionLabel}>MUTE GROUPS</div>
        <div className={styles.buttonGrid}>
          <button className={styles.placeholderButton} disabled>1</button>
          <button className={styles.placeholderButton} disabled>2</button>
          <button className={styles.placeholderButton} disabled>3</button>
          <button className={styles.placeholderButton} disabled>4</button>
          <button className={styles.placeholderButton} disabled>5</button>
          <button className={styles.placeholderButton} disabled>6</button>
        </div>
      </div>
    </div>
  )
}
