import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { ToggleButton } from './ToggleButton'
import styles from './MasterSection.module.css'

export function MasterSection() {
  const master = useMixerStore((s) => s.master)
  const setMasterFader = useMixerStore((s) => s.setMasterFader)
  const toggleMasterSolo = useMixerStore((s) => s.toggleMasterSolo)
  const clearAllSolos = useMixerStore((s) => s.clearAllSolos)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  return (
    <div className={styles.masterSection}>
      <ToggleButton
        active={false}
        onClick={() => {}}
        label="SELECT"
        variant="select"
        square
      />
      <div
        className={styles.clearSoloWrapper}
        onMouseEnter={() => setHelpText('Clear all active solos. Returns monitor to normal listening.')}
        onMouseLeave={() => setHelpText('')}
      >
        <button
          className={styles.clearSoloButton}
          onClick={clearAllSolos}
        />
        <span className={styles.clearSoloLabel}>CLEAR SOLO</span>
      </div>
      <div className={styles.meterBox} />
      <ToggleButton
        active={master.solo}
        onClick={toggleMasterSolo}
        label="SOLO"
        variant="solo"
        square
        helpText="Solo the Main LR bus to the monitor solo bus."
      />
      <div className={styles.scribbleStrip}>
        <span className={styles.label}>Main LR</span>
      </div>
      <ToggleButton
        active={false}
        onClick={() => {}}
        label="MUTE"
        variant="mute"
        square
      />
      <Fader
        value={master.faderPosition}
        onChange={setMasterFader}
        helpText="The main output fader controls the overall volume of the main stereo mix."
      />
    </div>
  )
}
