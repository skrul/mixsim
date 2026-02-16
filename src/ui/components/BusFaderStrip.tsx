import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
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
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendsOnFaderMode = useSurfaceStore((s) => s.sendsOnFaderMode)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const selectBusForSendsOnFader = useSurfaceStore((s) => s.selectBusForSendsOnFader)

  if (!bus) return null

  const isBusTargetSelected = selectedOutputIndex === busIndex

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

  return (
    <div className={`${styles.strip} ${isBusTargetSelected ? styles.selected : ''}`}>
      <ToggleButton
        active={isBusTargetSelected}
        onClick={() => selectBusForSendsOnFader(busIndex)}
        label="SELECT"
        variant="select"
        square
        helpText="Select this bus as the Sends on Fader target. Then press the Sends on Fader button to control this bus from the input faders."
      />
      <div className={styles.ledWrapper}>
        <div className={styles.led} />
        <span className={styles.ledLabel}>COMP</span>
      </div>
      <div className={styles.meterBox}>
        <Meter channelIndex={busIndex} source="mixBus" helpText="Shows the output level of this mix bus." />
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
