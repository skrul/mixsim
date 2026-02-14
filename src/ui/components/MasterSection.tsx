import { useMixerStore } from '@/state/mixer-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
import styles from './MasterSection.module.css'

export function MasterSection() {
  const master = useMixerStore((s) => s.master)
  const setMasterFader = useMixerStore((s) => s.setMasterFader)

  return (
    <div className={styles.masterSection}>
      <div className={styles.label}>MAIN</div>
      <div className={styles.meterFaderRow}>
        <Meter channelIndex={-1} helpText="Shows the main stereo output level. Keep peaks in the green/yellow range. Red indicates clipping, which causes distortion." />
        <Fader
          value={master.faderPosition}
          onChange={setMasterFader}
          label="Main"
          helpText="The main output fader controls the overall volume of the main stereo mix sent to the front-of-house speakers."
        />
      </div>
    </div>
  )
}
