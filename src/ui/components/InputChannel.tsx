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
  const toggleMute = useMixerStore((s) => s.toggleChannelMute)
  const toggleSolo = useMixerStore((s) => s.toggleChannelSolo)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const setSelectedChannel = useSurfaceStore((s) => s.setSelectedChannel)

  if (!channel) return null

  const isSelected = selectedChannel === channelIndex

  return (
    <div className={`${styles.channel} ${isSelected ? styles.selected : ''}`}>
      <div className={styles.channelNumber}>{String(channelIndex + 1).padStart(2, '0')}</div>
      <ToggleButton
        active={isSelected}
        onClick={() => setSelectedChannel(channelIndex)}
        label="SEL"
        variant="select"
        helpText="Select this channel to view and edit its full settings in the selected channel strip on the left."
      />
      <div className={styles.scribbleStrip} style={{ borderColor: channel.color }}>
        <span className={styles.channelName}>{channel.label}</span>
      </div>
      <div className={styles.meterFaderRow}>
        <Meter
          channelIndex={channelIndex}
          helpText="Shows the post-fader signal level. Green is healthy, yellow is approaching the limit, red means clipping."
        />
        <Fader
          value={channel.faderPosition}
          onChange={(v) => setFader(channelIndex, v)}
          helpText="Drag to adjust the channel volume level. Unity gain (0 dB) is marked with 'U'. This controls how loud this channel is in the main mix."
        />
      </div>
      <div className={styles.buttons}>
        <ToggleButton
          active={channel.solo}
          onClick={() => toggleSolo(channelIndex)}
          label="S"
          variant="solo"
          helpText="Solo this channel to hear it in isolation through the monitor headphones. Other non-soloed channels are muted in the monitor. Solo does not affect the main mix output."
        />
        <ToggleButton
          active={channel.mute}
          onClick={() => toggleMute(channelIndex)}
          label="M"
          variant="mute"
          helpText="Mute this channel to silence it in the main mix. Muting does not affect pre-fader monitor sends, so musicians can still hear the channel in their monitors."
        />
      </div>
    </div>
  )
}
