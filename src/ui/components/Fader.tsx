import { useRef, useCallback } from 'react'
import { faderPositionToDb, formatDb } from '@/audio/fader-taper'
import styles from './Fader.module.css'

interface FaderProps {
  value: number // 0..1 normalized position
  onChange: (value: number) => void
  label?: string
  showDb?: boolean
}

export function Fader({ value, onChange, label, showDb = true }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const positionToValue = useCallback(
    (clientY: number): number => {
      const track = trackRef.current
      if (!track) return value
      const rect = track.getBoundingClientRect()
      const normalized = 1 - (clientY - rect.top) / rect.height
      return Math.max(0, Math.min(1, normalized))
    },
    [value]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      onChange(positionToValue(e.clientY))
    },
    [onChange, positionToValue]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      onChange(positionToValue(e.clientY))
    },
    [onChange, positionToValue]
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const db = faderPositionToDb(value)
  const thumbPercent = value * 100

  return (
    <div className={styles.faderContainer}>
      {label && <div className={styles.label}>{label}</div>}
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className={styles.trackFill} style={{ height: `${thumbPercent}%` }} />
        <div className={styles.unityMark} style={{ bottom: '75%' }}>
          <span className={styles.unityLabel}>U</span>
        </div>
        <div className={styles.thumb} style={{ bottom: `${thumbPercent}%` }} />
      </div>
      {showDb && <div className={styles.dbReadout}>{formatDb(db)} dB</div>}
    </div>
  )
}
