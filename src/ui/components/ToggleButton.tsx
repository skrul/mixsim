import { useSurfaceStore } from '@/state/surface-store'
import styles from './ToggleButton.module.css'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  variant: 'mute' | 'solo' | 'select' | 'eq' | 'hpf' | 'pre' | 'dca'
  square?: boolean
  ring?: boolean
  helpText?: string
  onMouseDown?: () => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
  onTouchStart?: () => void
  onTouchEnd?: () => void
}

export function ToggleButton({
  active,
  onClick,
  label,
  variant,
  square,
  ring,
  helpText,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}: ToggleButtonProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  if (square) {
    return (
      <div
        className={styles.squareWrapper}
        onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
        onMouseLeave={helpText ? () => setHelpText('') : undefined}
      >
        <button
          className={`${styles.squareButton} ${styles[variant]} ${active ? styles.active : ''} ${ring ? styles.ring : ''}`}
          onClick={onClick}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
        <span className={styles.squareLabel}>{label}</span>
      </div>
    )
  }

  return (
    <button
      className={`${styles.toggleButton} ${styles[variant]} ${active ? styles.active : ''}`}
      onClick={onClick}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      {label}
    </button>
  )
}
