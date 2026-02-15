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
      <ToggleButton
        active={false}
        onClick={() => {}}
        label="SELECT"
        variant="select"
        square
      />
      <div className={styles.spacer} />
      <div className={styles.spacer} />
      <div className={styles.spacer} />
      <ToggleButton
        active={false}
        onClick={() => {}}
        label="SOLO"
        variant="solo"
        square
      />
      <div className={styles.scribbleStrip}>
        <span className={styles.dcaName}>{dca.label}</span>
      </div>
      <ToggleButton
        active={dca.mute}
        onClick={() => toggleMute(dcaIndex)}
        label="MUTE"
        variant="mute"
        square
        helpText="Mute all channels assigned to this DCA group."
      />
      <Fader
        value={dca.faderPosition}
        onChange={(v) => setFader(dcaIndex, v)}
        helpText="Adjust the DCA group level. This proportionally scales the output of all assigned channels."
      />
    </div>
  )
}
