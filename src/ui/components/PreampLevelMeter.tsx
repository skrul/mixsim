import { useEffect, useRef, useState } from 'react'
import { meterLevels } from '@/audio/metering'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './PreampLevelMeter.module.css'

interface PreampLevelMeterProps {
  channelIndex: number
  helpText?: string
}

const METER_ROWS = [
  { label: 'CLIP', db: 0 },
  { label: '-3', db: -3 },
  { label: '-6', db: -6 },
  { label: '-9', db: -9 },
  { label: '-12', db: -12 },
  { label: '-18', db: -18 },
  { label: '-30', db: -30 },
  { label: 'SIG', db: -60 },
] as const

function toneClassForDb(db: number): string {
  if (db >= 0) return styles.red
  if (db > -21) return styles.warm
  return styles.cool
}

export function PreampLevelMeter({ channelIndex, helpText }: PreampLevelMeterProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const displayLevelRef = useRef(-Infinity)
  const rafIdRef = useRef<number | null>(null)
  const [litRows, setLitRows] = useState<boolean[]>(() => METER_ROWS.map(() => false))

  useEffect(() => {
    const tick = () => {
      const currentDb = meterLevels.preFaderChannels[channelIndex] ?? -Infinity

      let display = displayLevelRef.current
      if (currentDb > display) {
        display = currentDb
      } else {
        display = Math.max(display - 1.5, currentDb)
      }
      displayLevelRef.current = display

      const nextRows = METER_ROWS.map((row) => Number.isFinite(display) && display >= row.db)
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
  }, [channelIndex])

  return (
    <div
      className={styles.container}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      <div className={styles.labels}>
        {METER_ROWS.map((row) => (
          <span key={row.label} className={styles.label}>{row.label}</span>
        ))}
      </div>
      <div className={styles.rail}>
        {METER_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`${styles.led} ${toneClassForDb(row.db)} ${litRows[i] ? '' : styles.off}`}
          />
        ))}
      </div>
    </div>
  )
}
