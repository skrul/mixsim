import { useEffect, useRef, useState } from 'react'
import { meterLevels } from '@/audio/metering'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './StripLevelMeter.module.css'

type MeterSource = 'postFader' | 'preFader' | 'mixBus'
type BottomTone = 'green' | 'red'

interface StripLevelMeterProps {
  channelIndex: number
  source: MeterSource
  topLabel?: string
  topActive?: boolean
  bottomLabel: string
  bottomActive: boolean
  bottomTone?: BottomTone
  helpText?: string
}

const SCALE_ROWS = [
  { label: 'CLIP', db: 0 },
  { label: '-6', db: -6 },
  { label: '-12', db: -12 },
  { label: '-18', db: -18 },
  { label: '-30', db: -30 },
  { label: '-60', db: -60 },
] as const

function toneClassForDb(db: number): string {
  if (db >= 0) return styles.red
  if (db > -21) return styles.warm
  return styles.cool
}

export function StripLevelMeter({
  channelIndex,
  source,
  topLabel = 'COMP',
  topActive = false,
  bottomLabel,
  bottomActive,
  bottomTone = 'green',
  helpText,
}: StripLevelMeterProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const displayLevelRef = useRef(-Infinity)
  const rafIdRef = useRef<number | null>(null)
  const [litRows, setLitRows] = useState<boolean[]>(() => SCALE_ROWS.map(() => false))

  useEffect(() => {
    const tick = () => {
      let currentDb: number
      if (source === 'mixBus') {
        currentDb = meterLevels.mixBuses[channelIndex] ?? -Infinity
      } else if (source === 'preFader') {
        currentDb = meterLevels.preFaderChannels[channelIndex] ?? -Infinity
      } else {
        currentDb = meterLevels.channels[channelIndex] ?? -Infinity
      }

      let display = displayLevelRef.current
      if (currentDb > display) {
        display = currentDb
      } else {
        display = Math.max(display - 1.5, currentDb)
      }
      displayLevelRef.current = display

      const nextRows = SCALE_ROWS.map((row) => Number.isFinite(display) && display >= row.db)
      setLitRows((prev) => {
        if (prev.length === nextRows.length && prev.every((v, i) => v === nextRows[i])) return prev
        return nextRows
      })

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [channelIndex, source])

  return (
    <div
      className={styles.container}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      <div className={styles.rail}>
        <div className={`${styles.led} ${styles.warm} ${topActive ? '' : styles.off}`} />
        <div className={styles.ledSpacer} />
        {SCALE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`${styles.led} ${toneClassForDb(row.db)} ${litRows[i] ? '' : styles.off}`}
          />
        ))}
        <div className={styles.ledSpacer} />
        <div
          className={`${styles.led} ${bottomTone === 'red' ? styles.red : styles.cool} ${bottomActive ? '' : styles.off}`}
        />
      </div>
      <div className={styles.labels}>
        <span className={styles.topLabel}>{topLabel}</span>
        <span className={styles.labelSpacer} />
        {SCALE_ROWS.map((row) => (
          <span key={row.label} className={styles.scaleLabel}>{row.label}</span>
        ))}
        <span className={styles.labelSpacer} />
        <span className={styles.bottomLabel}>{bottomLabel}</span>
      </div>
    </div>
  )
}
