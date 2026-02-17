import { useRef, useCallback } from 'react'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './Knob.module.css'

interface KnobProps {
  value: number
  min: number
  max: number
  defaultValue: number
  onChange: (value: number) => void
  label?: string
  formatValue?: (v: number) => string
  helpText?: string
  available?: boolean
  showValue?: boolean
}

// Knob sweep: 270 degrees (-135 to +135)
const MIN_ANGLE = -135
const MAX_ANGLE = 135
const SEGMENT_COUNT = 21

export function Knob({
  value,
  min,
  max,
  defaultValue,
  onChange,
  label,
  formatValue,
  helpText,
  available = true,
  showValue = true,
}: KnobProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const lastYRef = useRef(0)
  const isDragging = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!available) return
      isDragging.current = true
      lastYRef.current = e.clientY
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [available]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      const deltaY = lastYRef.current - e.clientY
      lastYRef.current = e.clientY
      // Sensitivity: 1 unit per 4 pixels of vertical movement
      const sensitivity = (max - min) / 160
      const newValue = clamp(valueRef.current + deltaY * sensitivity)
      onChange(newValue)
    },
    [onChange, clamp, min, max]
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    if (!available) return
    onChange(defaultValue)
  }, [available, onChange, defaultValue])

  // Map value to rotation angle
  const normalized = (value - min) / (max - min)
  const clampedNormalized = Math.max(0, Math.min(1, normalized))
  const litSegments = available ? Math.round(clampedNormalized * (SEGMENT_COUNT - 1)) + 1 : 0
  const displayValue = available ? (formatValue ? formatValue(value) : value.toFixed(1)) : '--'

  return (
    <div
      className={`${styles.knobContainer} ${available ? '' : styles.unavailable}`}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      <div
        className={styles.knobBody}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div className={styles.collar}>
          {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
            const segmentAngle = MIN_ANGLE + (i / (SEGMENT_COUNT - 1)) * (MAX_ANGLE - MIN_ANGLE)
            return (
              <span
                key={i}
                className={`${styles.segment} ${i < litSegments ? styles.segmentLit : ''}`}
                style={{ transform: `translate(-50%, -50%) rotate(${segmentAngle}deg) translateY(-20px)` }}
              />
            )
          })}
        </div>
        <div className={styles.knobFace}>
          <div className={styles.innerPips}>
            {Array.from({ length: 8 }, (_, i) => {
              const pipAngle = -150 + i * (300 / 7)
              return (
                <span
                  key={i}
                  className={styles.pip}
                  style={{ transform: `translate(-50%, -50%) rotate(${pipAngle}deg) translateY(-9px)` }}
                />
              )
            })}
          </div>
        </div>
      </div>
      {label && <div className={styles.label}>{label}</div>}
      {showValue && <div className={styles.valueReadout}>{displayValue}</div>}
    </div>
  )
}
