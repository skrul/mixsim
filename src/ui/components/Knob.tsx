import { useRef, useCallback } from 'react'
import styles from './Knob.module.css'

interface KnobProps {
  value: number
  min: number
  max: number
  defaultValue: number
  onChange: (value: number) => void
  label?: string
  formatValue?: (v: number) => string
}

// Knob sweep: 270 degrees (-135 to +135)
const MIN_ANGLE = -135
const MAX_ANGLE = 135

export function Knob({
  value,
  min,
  max,
  defaultValue,
  onChange,
  label,
  formatValue,
}: KnobProps) {
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
      isDragging.current = true
      lastYRef.current = e.clientY
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
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
    onChange(defaultValue)
  }, [onChange, defaultValue])

  // Map value to rotation angle
  const normalized = (value - min) / (max - min)
  const angle = MIN_ANGLE + normalized * (MAX_ANGLE - MIN_ANGLE)
  const displayValue = formatValue ? formatValue(value) : value.toFixed(1)

  return (
    <div className={styles.knobContainer}>
      {label && <div className={styles.label}>{label}</div>}
      <div
        className={styles.knobBody}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={styles.indicator}
          style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
        />
      </div>
      <div className={styles.valueReadout}>{displayValue}</div>
    </div>
  )
}
