import { useMixerStore } from '@/state/mixer-store'
import { Knob } from './Knob'
import { Fader } from './Fader'
import { Meter } from './Meter'
import styles from './ChannelStrip.module.css'

interface ChannelStripProps {
  channelIndex: number
}

export function ChannelStrip({ channelIndex }: ChannelStripProps) {
  const channel = useMixerStore((s) => s.channels[channelIndex])
  const setGain = useMixerStore((s) => s.setChannelGain)
  const setFader = useMixerStore((s) => s.setChannelFader)

  if (!channel) return null

  return (
    <div className={styles.strip}>
      <div className={styles.channelLabel}>{channel.label}</div>
      <Knob
        value={channel.gain}
        min={-20}
        max={20}
        defaultValue={0}
        onChange={(v) => setGain(channelIndex, v)}
        label="Gain"
        formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
      />
      <div className={styles.meterFaderRow}>
        <Meter channelIndex={channelIndex} />
        <Fader
          value={channel.faderPosition}
          onChange={(v) => setFader(channelIndex, v)}
        />
      </div>
    </div>
  )
}
