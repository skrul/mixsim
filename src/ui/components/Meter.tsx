import { useRef, useEffect } from 'react'
import { meterLevels } from '@/audio/metering'
import styles from './Meter.module.css'

interface MeterProps {
  channelIndex: number // Index into meterLevels.channels, or -1 for master
}

const MIN_DB = -60
const MAX_DB = 6

export function Meter({ channelIndex }: MeterProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const displayLevelRef = useRef(-Infinity)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const currentDb =
        channelIndex === -1
          ? meterLevels.masterL
          : (meterLevels.channels[channelIndex] ?? -Infinity)

      let display = displayLevelRef.current
      if (currentDb > display) {
        display = currentDb
      } else {
        display = display - 1.5
        display = Math.max(display, currentDb)
      }
      displayLevelRef.current = display

      const clamped = Math.max(MIN_DB, Math.min(MAX_DB, display))
      const percent = ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * 100

      if (barRef.current) {
        barRef.current.style.height = `${percent}%`

        if (clamped > 0) {
          barRef.current.style.backgroundColor = '#ff3333'
        } else if (clamped > -12) {
          barRef.current.style.backgroundColor = '#ffcc00'
        } else {
          barRef.current.style.backgroundColor = '#33cc33'
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [channelIndex])

  return (
    <div className={styles.meterContainer}>
      <div className={styles.meterTrack}>
        <div ref={barRef} className={styles.meterBar} />
      </div>
    </div>
  )
}
