import { useMixerStore } from '@/state/mixer-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './BusFaderStrip.module.css'

interface BusFaderStripProps {
  busIndex: number
}

export function BusFaderStrip({ busIndex }: BusFaderStripProps) {
  const bus = useMixerStore((s) => s.mixBuses[busIndex])
  const setFader = useMixerStore((s) => s.setMixBusFader)
  const toggleMute = useMixerStore((s) => s.toggleMixBusMute)

  if (!bus) return null

  return (
    <div className={styles.strip}>
      <div className={styles.busNumber}>{bus.label}</div>
      <div className={styles.meterFaderRow}>
        <Meter channelIndex={busIndex} source="mixBus" helpText="Shows the output level of this mix bus after all channel sends are summed and the bus fader is applied." />
        <Fader
          value={bus.faderPosition}
          onChange={(v) => setFader(busIndex, v)}
          helpText="Adjust the output level of this mix bus. Each bus is typically routed to a different monitor mix for musicians on stage."
        />
      </div>
      <div className={styles.buttons}>
        <ToggleButton
          active={bus.mute}
          onClick={() => toggleMute(busIndex)}
          label="M"
          variant="mute"
          helpText="Mute this mix bus output. This silences the entire bus without affecting individual channel send levels."
        />
      </div>
    </div>
  )
}
