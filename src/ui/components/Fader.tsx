import { useRef, useCallback, useState } from 'react'
import { faderPositionToDb } from '@/audio/fader-taper'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './Fader.module.css'

interface FaderProps {
  value: number // 0..1 normalized position
  onChange: (value: number) => void
  label?: string
  showDb?: boolean
  helpText?: string
}

export function Fader({ value, onChange, label, showDb = false, helpText }: FaderProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef(0)
  const [dragging, setDragging] = useState(false)

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
      setDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const track = trackRef.current
      if (track) {
        const rect = track.getBoundingClientRect()
        // Current thumb center Y in screen coords
        const thumbCenterY = rect.bottom - value * rect.height
        const distFromThumb = Math.abs(e.clientY - thumbCenterY)

        if (distFromThumb <= 12) {
          // Clicked on/near the thumb — relative drag (no jump)
          dragOffset.current = e.clientY - thumbCenterY
        } else {
          // Clicked on the track away from thumb — jump to position
          dragOffset.current = 0
          onChange(positionToValue(e.clientY))
        }
      }
    },
    [value, onChange, positionToValue]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      onChange(positionToValue(e.clientY - dragOffset.current))
    },
    [onChange, positionToValue]
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    setDragging(false)
  }, [])

  const thumbPercent = value * 100
  const trackClass = `${styles.track} ${dragging ? styles.dragging : ''}`

  return (
    <div
      className={styles.faderContainer}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      {label && <div className={styles.label}>{label}</div>}
      <div
        className={styles.hitArea}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={trackRef}
          className={trackClass}
        >
          <div className={styles.trackFill} style={{ height: `${thumbPercent}%` }} />
          <div className={styles.unityMark} style={{ bottom: '75%' }}>
            <span className={styles.unityLabel}>U</span>
          </div>
          <div className={styles.thumb} style={{ bottom: `${thumbPercent}%` }} />
        </div>
      </div>
      {showDb && <div className={styles.dbReadout}>{faderPositionToDb(value).toFixed(1)} dB</div>}
    </div>
  )
}
