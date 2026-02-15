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
  const setFader = useMixerStore((s) => s.setMixBusFader)
  const toggleMute = useMixerStore((s) => s.toggleMixBusMute)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)
  const toggleSendsOnFader = useSurfaceStore((s) => s.toggleSendsOnFader)

  if (!bus) return null

  const isSelected = sendsOnFader && sendTargetBus === busIndex

  return (
    <div className={`${styles.strip} ${isSelected ? styles.selected : ''}`}>
      <ToggleButton
        active={isSelected}
        onClick={() => toggleSendsOnFader(busIndex)}
        label="SELECT"
        variant="select"
        square
        helpText="Select this bus to activate Sends on Fader mode. The input faders will then control send levels to this bus."
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
        value={bus.faderPosition}
        onChange={(v) => setFader(busIndex, v)}
        helpText="Adjust the output level of this mix bus."
      />
    </div>
  )
}
