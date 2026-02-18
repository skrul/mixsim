import { useEffect, useRef } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { StripLevelMeter } from './StripLevelMeter'
import { ToggleButton } from './ToggleButton'
import styles from './BusFaderStrip.module.css'

interface BusFaderStripProps {
  busIndex: number
}

export function BusFaderStrip({ busIndex }: BusFaderStripProps) {
  const bus = useMixerStore((s) => s.mixBuses[busIndex])
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const selectedChannelState = useMixerStore((s) => s.channels[selectedChannel])
  const setFader = useMixerStore((s) => s.setMixBusFader)
  const setChannelSendLevel = useMixerStore((s) => s.setChannelSendLevel)
  const toggleMute = useMixerStore((s) => s.toggleMixBusMute)
  const toggleSolo = useMixerStore((s) => s.toggleMixBusSolo)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendsOnFaderMode = useSurfaceStore((s) => s.sendsOnFaderMode)
  const selectedFocus = useSurfaceStore((s) => s.selectedFocus)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const busAssignArmedId = useSurfaceStore((s) => s.busAssignArmedId)
  const setBusAssignArmedId = useSurfaceStore((s) => s.setBusAssignArmedId)
  const selectBusForSendsOnFader = useSurfaceStore((s) => s.selectBusForSendsOnFader)

  const holdTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  if (!bus) return null

  const isBusAssignArmed = busAssignArmedId === busIndex
  const isBusTargetSelected = selectedFocus === 'output' && selectedOutputIndex === busIndex

  const isChannelMode = sendsOnFader && sendsOnFaderMode === 'channel'
  const faderValue = isChannelMode
    ? (selectedChannelState?.sends[busIndex]?.level ?? 0)
    : bus.faderPosition

  const handleFaderChange = isChannelMode
    ? (v: number) => setChannelSendLevel(selectedChannel, busIndex, v)
    : (v: number) => setFader(busIndex, v)

  const faderHelpText = isChannelMode
    ? `Adjust the send level from ${selectedChannelState?.label || `Ch ${selectedChannel + 1}`} to ${bus.label}.`
    : 'Adjust the output level of this mix bus.'

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const handlePressStart = () => {
    if (isBusAssignArmed) return
    longPressTriggeredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      selectBusForSendsOnFader(busIndex)
      setBusAssignArmedId(busIndex)
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
    if (isBusAssignArmed) {
      setBusAssignArmedId(null)
      return
    }
    selectBusForSendsOnFader(busIndex)
  }

  useEffect(() => clearHoldTimer, [])

  return (
    <div className={`${styles.strip} ${isBusTargetSelected ? styles.selected : ''}`}>
      <ToggleButton
        active={isBusTargetSelected || isBusAssignArmed}
        ring={isBusAssignArmed}
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
          isBusAssignArmed
            ? 'Bus assign mode active. Click input SELECT buttons to toggle sends to this bus. Click this bus SELECT again to exit.'
            : 'Click to select this bus. Press and hold for 0.5s to arm send assignment mode for this bus.'
        }
      />
      <div className={styles.meterBox}>
        <StripLevelMeter
          channelIndex={busIndex}
          source="mixBus"
          topLabel="COMP"
          topActive={false}
          bottomLabel="PRE"
          bottomActive={Boolean(selectedChannelState?.sends[busIndex]?.preFader)}
          bottomTone="red"
          helpText="Shows the output level of this mix bus. PRE light indicates the selected channel's send is pre-fader."
        />
      </div>
      <ToggleButton
        active={bus.solo}
        onClick={() => toggleSolo(busIndex)}
        label="SOLO"
        variant="solo"
        square
        helpText="Solo this bus to hear it in isolation through the monitor headphones."
      />
      <div className={styles.scribbleStrip}>
        <span className={styles.busName}>{bus.label}</span>
      </div>
      <ToggleButton
        active={bus.mute}
        onClick={() => toggleMute(busIndex)}
        label="MUTE"
        variant="mute"
        square
        helpText="Mute this mix bus output."
      />
      <Fader
        value={faderValue}
        onChange={handleFaderChange}
        helpText={faderHelpText}
      />
    </div>
  )
}
