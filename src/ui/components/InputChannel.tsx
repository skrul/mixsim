import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './InputChannel.module.css'

interface InputChannelProps {
  channelIndex: number
}

export function InputChannel({ channelIndex }: InputChannelProps) {
  const channel = useMixerStore((s) => s.channels[channelIndex])
  const setFader = useMixerStore((s) => s.setChannelFader)
  const setSendLevel = useMixerStore((s) => s.setChannelSendLevel)
  const toggleMute = useMixerStore((s) => s.toggleChannelMute)
  const toggleSolo = useMixerStore((s) => s.toggleChannelSolo)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const setSelectedChannel = useSurfaceStore((s) => s.setSelectedChannel)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)

  if (!channel) return null

  const isSelected = selectedChannel === channelIndex

  const faderValue = sendsOnFader
    ? (channel.sends[sendTargetBus]?.level ?? 0)
    : channel.faderPosition

  const handleFaderChange = sendsOnFader
    ? (v: number) => setSendLevel(channelIndex, sendTargetBus, v)
    : (v: number) => setFader(channelIndex, v)

  const faderHelpText = sendsOnFader
    ? `Adjust the send level from this channel to Mix ${sendTargetBus + 1}. This controls how much of this channel is sent to that bus.`
    : 'Drag to adjust the channel volume level. Unity gain (0 dB) is marked with \'U\'. This controls how loud this channel is in the main mix.'

  return (
    <div className={`${styles.channel} ${isSelected ? styles.selected : ''}`}>
      <ToggleButton
        active={isSelected}
        onClick={() => setSelectedChannel(channelIndex)}
        label="SELECT"
        variant="select"
        square
        helpText="Select this channel to view and edit its full settings in the detail panel above."
      />
      <div className={styles.ledWrapper}>
        <div className={styles.led} />
        <span className={styles.ledLabel}>COMP</span>
      </div>
      <div className={styles.meterBox}>
        <Meter
          channelIndex={channelIndex}
          helpText="Shows the post-fader signal level. Green is healthy, yellow is approaching the limit, red means clipping."
        />
      </div>
      <div className={styles.ledWrapper}>
        <div className={styles.led} />
        <span className={styles.ledLabel}>GATE</span>
      </div>
      <ToggleButton
        active={channel.solo}
        onClick={() => toggleSolo(channelIndex)}
        label="SOLO"
        variant="solo"
        square
        helpText="Solo this channel to hear it in isolation through the monitor headphones."
      />
      <div className={styles.scribbleStrip} style={{ borderColor: channel.color }}>
        <span className={styles.channelName}>{channel.label}</span>
      </div>
      <ToggleButton
        active={channel.mute}
        onClick={() => toggleMute(channelIndex)}
        label="MUTE"
        variant="mute"
        square
        helpText="Mute this channel to silence it in the main mix."
      />
      <Fader
        value={faderValue}
        onChange={handleFaderChange}
        helpText={faderHelpText}
      />
    </div>
  )
}
