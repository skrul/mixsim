import { useEffect, useRef, useState } from 'react'
import { dynamicsLevels } from '@/audio/metering'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './GrMeter.module.css'

interface GrMeterProps {
  channelIndex: number
  compEnabled: boolean
  gateEnabled: boolean
  helpText?: string
}

const GR_MARKS = [2, 4, 6, 10, 18, 30]

function grToLitSegments(grDb: number): number {
  let lit = 0
  for (let i = 0; i < GR_MARKS.length; i++) {
    if (grDb >= GR_MARKS[i]) lit++
  }
  return lit
}

export function GrMeter({ channelIndex, compEnabled, gateEnabled, helpText }: GrMeterProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const [litSegments, setLitSegments] = useState(0)
  const displayRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const compGr = dynamicsLevels.compReductionDb[channelIndex] ?? 0
      const gateGr = dynamicsLevels.gateReductionDb[channelIndex] ?? 0
      const target = Math.max(0, compGr, gateGr)

      let display = displayRef.current
      if (target > display) {
        display = target
      } else {
        display = Math.max(target, display - 1.0)
      }
      displayRef.current = display

      const nextLit = grToLitSegments(display)
      setLitSegments((prev) => (prev === nextLit ? prev : nextLit))

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [channelIndex])

  return (
    <div
      className={styles.grMeter}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      <div className={styles.scaleLayout}>
        <div className={styles.leftLabels}>
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.rowSpacer} />
          <span className={styles.gateLabel}>GATE</span>
        </div>

        <div className={styles.rail}>
          <div className={`${styles.statusLed} ${compEnabled ? styles.compActive : ''}`} />
          {GR_MARKS.map((mark, i) => {
            const isLit = litSegments > (GR_MARKS.length - 1 - i)
            const isBottom = i === GR_MARKS.length - 1
            return (
              <div key={mark} className={`${styles.grLed} ${isLit ? (isBottom ? styles.grLedLow : styles.grLedHigh) : ''}`} />
            )
          })}
          <div className={`${styles.statusLed} ${gateEnabled ? styles.gateActive : ''}`} />
        </div>

        <div className={styles.rightLabels}>
          <span className={styles.statusLabel}>COMP</span>
          {GR_MARKS.map((mark) => (
            <span key={mark} className={styles.grMark}>{mark}</span>
          ))}
          <span className={styles.rowSpacer} />
        </div>
      </div>

      <div className={styles.bottomLabel}>GR / dB</div>
    </div>
  )
}
