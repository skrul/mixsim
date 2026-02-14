import { useMixerStore } from '@/state/mixer-store'
import { Fader } from './Fader'
import { ToggleButton } from './ToggleButton'
import styles from './DcaFaderStrip.module.css'

interface DcaFaderStripProps {
  dcaIndex: number
}

export function DcaFaderStrip({ dcaIndex }: DcaFaderStripProps) {
  const dca = useMixerStore((s) => s.dcaGroups[dcaIndex])
  const setFader = useMixerStore((s) => s.setDcaFader)
  const toggleMute = useMixerStore((s) => s.toggleDcaMute)

  if (!dca) return null

  return (
    <div className={styles.strip}>
      <div className={styles.dcaLabel}>{dca.label}</div>
      <div className={styles.faderRow}>
        <Fader
          value={dca.faderPosition}
          onChange={(v) => setFader(dcaIndex, v)}
          helpText="Adjust the DCA group level. This proportionally scales the output of all assigned channels. At unity (0 dB), assigned channels play at their individual fader levels."
        />
      </div>
      <div className={styles.buttons}>
        <ToggleButton
          active={dca.mute}
          onClick={() => toggleMute(dcaIndex)}
          label="M"
          variant="mute"
          helpText="Mute all channels assigned to this DCA group. Individual channel mute states are preserved — when the DCA is unmuted, channels return to their previous mute states."
        />
      </div>
    </div>
  )
}
