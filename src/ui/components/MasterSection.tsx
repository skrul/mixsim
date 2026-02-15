import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { Fader } from './Fader'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './MasterSection.module.css'

export function MasterSection() {
  const master = useMixerStore((s) => s.master)
  const soloActive = useMixerStore((s) => s.soloActive)
  const setMasterFader = useMixerStore((s) => s.setMasterFader)
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
          className={`${styles.clearSoloButton} ${soloActive ? styles.soloWarning : ''}`}
          onClick={clearAllSolos}
        />
        <span className={styles.clearSoloLabel}>CLEAR SOLO</span>
      </div>
      <div className={styles.meterBox}>
        <Meter channelIndex={-1} helpText="Shows the main stereo output level." />
      </div>
      <ToggleButton
        active={soloActive}
        onClick={() => {}}
        label="SOLO"
        variant="solo"
        square
        helpText="Indicates that one or more channels have solo active."
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
