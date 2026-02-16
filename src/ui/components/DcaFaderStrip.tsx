import { useEffect, useRef } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { ToggleButton } from './ToggleButton'
import styles from './DcaFaderStrip.module.css'

interface DcaFaderStripProps {
  dcaIndex: number
}

export function DcaFaderStrip({ dcaIndex }: DcaFaderStripProps) {
  const dca = useMixerStore((s) => s.dcaGroups[dcaIndex])
  const setFader = useMixerStore((s) => s.setDcaFader)
  const toggleMute = useMixerStore((s) => s.toggleDcaMute)
  const dcaAssignArmedId = useSurfaceStore((s) => s.dcaAssignArmedId)
  const setDcaAssignArmedId = useSurfaceStore((s) => s.setDcaAssignArmedId)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const setSelectedOutputIndex = useSurfaceStore((s) => s.setSelectedOutputIndex)

  const holdTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  if (!dca) return null

  const isArmed = dcaAssignArmedId === dcaIndex
  const isSelected = selectedOutputIndex === dcaIndex

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const handlePressStart = () => {
    if (isArmed) return
    longPressTriggeredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setSelectedOutputIndex(dcaIndex)
      setDcaAssignArmedId(dcaIndex)
    }, 500)
  }

  const handlePressEnd = () => {
    clearHoldTimer()
  }

  const handleSelectClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    if (isArmed) {
      setDcaAssignArmedId(null)
      return
    }
    setSelectedOutputIndex(isSelected ? -1 : dcaIndex)
  }

  useEffect(() => clearHoldTimer, [])

  return (
    <div className={styles.strip}>
      <ToggleButton
        active={isArmed || isSelected}
        ring={isArmed}
        onClick={handleSelectClick}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        label="SELECT"
        variant="select"
        square
        helpText={
          isArmed
            ? 'DCA assign mode active. Click channel SELECT buttons to add/remove membership. Click this DCA SELECT again to exit.'
            : 'Click to select this DCA. Press and hold for 0.5s to arm DCA assignment mode.'
        }
      />
      <div className={styles.ledWrapper}>
        <div className={styles.led} />
        <span className={styles.ledLabel}>COMP</span>
      </div>
      <div className={styles.meterBox}>
        <div className={styles.meterPlaceholder} />
      </div>
      <div className={styles.ledWrapper}>
        <div className={styles.led} />
        <span className={styles.ledLabel}>PRE</span>
      </div>
      <ToggleButton
        active={false}
        onClick={() => {}}
        label="SOLO"
        variant="solo"
        square
      />
      <div className={styles.scribbleStrip}>
        <span className={styles.dcaName}>{dca.label}</span>
      </div>
      <ToggleButton
        active={dca.mute}
        onClick={() => toggleMute(dcaIndex)}
        label="MUTE"
        variant="mute"
        square
        helpText="Mute all channels assigned to this DCA group."
      />
      <Fader
        value={dca.faderPosition}
        onChange={(v) => setFader(dcaIndex, v)}
        helpText="Adjust the DCA group level. This proportionally scales the output of all assigned channels."
      />
    </div>
  )
}
