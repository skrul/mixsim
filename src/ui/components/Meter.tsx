import { useRef, useEffect } from 'react'
import { meterLevels } from '@/audio/metering'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './Meter.module.css'

interface MeterProps {
  channelIndex: number // Index into meterLevels.channels, or -1 for master
  source?: 'postFader' | 'preFader' | 'mixBus' // Default: postFader
  helpText?: string
}

const MIN_DB = -60
const MAX_DB = 6
const GREEN_MAX_DB = -21
const CLIP_DB = 0

export function Meter({ channelIndex, source = 'postFader', helpText }: MeterProps) {
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const barRef = useRef<HTMLDivElement>(null)
  const displayLevelRef = useRef(-Infinity)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      let currentDb: number
      if (channelIndex === -1) {
        currentDb = meterLevels.masterL
      } else if (source === 'mixBus') {
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
        display = display - 1.5
        display = Math.max(display, currentDb)
      }
      displayLevelRef.current = display

      const clamped = Math.max(MIN_DB, Math.min(MAX_DB, display))
      const percent = ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * 100

      if (barRef.current) {
        barRef.current.style.height = `${percent}%`

        if (clamped >= CLIP_DB) {
          barRef.current.style.backgroundColor = '#ff4747'
        } else if (clamped > GREEN_MAX_DB) {
          barRef.current.style.backgroundColor = '#ffb03a'
        } else {
          barRef.current.style.backgroundColor = '#45ff70'
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
  }, [channelIndex, source])

  return (
    <div
      className={styles.meterContainer}
      onMouseEnter={helpText ? () => setHelpText(helpText) : undefined}
      onMouseLeave={helpText ? () => setHelpText('') : undefined}
    >
      <div className={styles.meterTrack}>
        <div ref={barRef} className={styles.meterBar} />
      </div>
    </div>
  )
}
