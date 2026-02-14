import { useSurfaceStore } from '@/state/surface-store'
import styles from './ToggleButton.module.css'

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  variant: 'mute' | 'solo' | 'select' | 'eq' | 'hpf' | 'pre' | 'dca'
  helpText?: string
}

export function ToggleButton({ active, onClick, label, variant, helpText }: ToggleButtonProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

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
