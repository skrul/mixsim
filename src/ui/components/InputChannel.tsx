import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './InputChannel.module.css'

interface InputChannelProps {
  channelIndex: number
  scribbleLabel?: string
  stripType?: 'input' | 'fxReturn'
}

export function InputChannel({ channelIndex, scribbleLabel, stripType = 'input' }: InputChannelProps) {
  const channel = useMixerStore((s) => s.channels[channelIndex])
  const setFader = useMixerStore((s) => s.setChannelFader)
  const setSendLevel = useMixerStore((s) => s.setChannelSendLevel)
  const toggleMute = useMixerStore((s) => s.toggleChannelMute)
  const toggleSolo = useMixerStore((s) => s.toggleChannelSolo)
  const assignChannelToDca = useMixerStore((s) => s.assignChannelToDca)
  const unassignChannelFromDca = useMixerStore((s) => s.unassignChannelFromDca)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const selectedFocus = useSurfaceStore((s) => s.selectedFocus)
  const setSelectedChannel = useSurfaceStore((s) => s.setSelectedChannel)
  const dcaAssignArmedId = useSurfaceStore((s) => s.dcaAssignArmedId)
  const busAssignArmedId = useSurfaceStore((s) => s.busAssignArmedId)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendsOnFaderMode = useSurfaceStore((s) => s.sendsOnFaderMode)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)

  if (!channel) return null
  const isFxReturn = stripType === 'fxReturn'

  const isSelected = dcaAssignArmedId !== null
    ? channel.dcaGroups.includes(dcaAssignArmedId)
      : busAssignArmedId !== null
      ? (channel.sends[busAssignArmedId]?.level ?? 0) > 0.0001
      : selectedFocus === 'input' && selectedChannel === channelIndex

  const faderInBusMode = sendsOnFader && sendsOnFaderMode === 'bus'

  const faderValue = faderInBusMode
    ? (channel.sends[sendTargetBus]?.level ?? 0)
    : channel.faderPosition

  const handleFaderChange = faderInBusMode
    ? (v: number) => setSendLevel(channelIndex, sendTargetBus, v)
    : (v: number) => setFader(channelIndex, v)

  const faderHelpText = faderInBusMode
    ? `Adjust the send level from this ${isFxReturn ? 'effects return' : 'channel'} to Mix ${sendTargetBus + 1}.`
    : isFxReturn
      ? 'Adjust this FX return level in the main mix. This controls how much processed (wet) signal you hear.'
      : 'Drag to adjust the channel volume level. Unity gain (0 dB) is marked with \'U\'. This controls how loud this channel is in the main mix.'

  const handleSelectClick = () => {
    if (dcaAssignArmedId !== null) {
      if (channel.dcaGroups.includes(dcaAssignArmedId)) {
        unassignChannelFromDca(channelIndex, dcaAssignArmedId)
      } else {
        assignChannelToDca(channelIndex, dcaAssignArmedId)
      }
      return
    }
    if (busAssignArmedId !== null) {
      const current = channel.sends[busAssignArmedId]?.level ?? 0
      setSendLevel(channelIndex, busAssignArmedId, current > 0.0001 ? 0 : 0.5)
      return
    }
    setSelectedChannel(channelIndex)
  }

  const selectHelpText = dcaAssignArmedId !== null
    ? `DCA assign mode active. Click to ${channel.dcaGroups.includes(dcaAssignArmedId) ? 'remove this channel from' : 'assign this channel to'} DCA ${dcaAssignArmedId + 1}.`
    : busAssignArmedId !== null
      ? `Bus send assign mode active. Click to ${(channel.sends[busAssignArmedId]?.level ?? 0) > 0.0001 ? 'remove from' : 'send to'} ${`Mix ${busAssignArmedId + 1}`}.`
      : isFxReturn
        ? 'Select this FX return to view and edit its settings in the detail panel above.'
        : 'Select this channel to view and edit its full settings in the detail panel above.'

  return (
    <div className={`${styles.channel} ${isSelected ? styles.selected : ''}`}>
      <ToggleButton
        active={isSelected}
        onClick={handleSelectClick}
        label="SELECT"
        variant="select"
        square
        helpText={selectHelpText}
      />
      <div className={styles.ledWrapper}>
        <div className={`${styles.led} ${channel.compEnabled ? styles.compLedActive : ''}`} />
        <span className={`${styles.ledLabel} ${channel.compEnabled ? styles.ledLabelActive : ''}`}>COMP</span>
      </div>
      <div className={styles.meterBox}>
        <Meter
          channelIndex={channelIndex}
          source="preFader"
          helpText={
            isFxReturn
              ? 'Shows the pre-fader level of this FX return signal.'
              : 'Shows the pre-fader signal level for gain staging. Green is healthy, yellow is approaching the limit, red means clipping.'
          }
        />
      </div>
      <div className={styles.ledWrapper}>
        <div className={`${styles.led} ${channel.gateEnabled ? styles.gateLedActive : ''}`} />
        <span className={`${styles.ledLabel} ${channel.gateEnabled ? styles.ledLabelActive : ''}`}>GATE</span>
      </div>
      <ToggleButton
        active={channel.solo}
        onClick={() => toggleSolo(channelIndex)}
        label="SOLO"
        variant="solo"
        square
        helpText={isFxReturn
          ? 'Solo this FX return to hear only the processed effect return.'
          : 'Solo this channel to hear it in isolation through the monitor headphones.'}
      />
      <div className={styles.scribbleStrip} style={{ borderColor: channel.color }}>
        <span className={styles.channelName}>{scribbleLabel ?? channel.label}</span>
      </div>
      <ToggleButton
        active={channel.mute}
        onClick={() => toggleMute(channelIndex)}
        label="MUTE"
        variant="mute"
        square
        helpText={isFxReturn
          ? 'Mute this FX return to remove that effect from the mix.'
          : 'Mute this channel to silence it in the main mix.'}
      />
      <Fader
        value={faderValue}
        onChange={handleFaderChange}
        helpText={faderHelpText}
      />
    </div>
  )
}
