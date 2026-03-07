import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_MIX_BUSES, type MonitorSource } from '@/state/mixer-model'
import { Knob } from './Knob'
import styles from './MonitorSection.module.css'

const PRIMARY_SOURCES: { source: MonitorSource; label: string }[] = [
  { source: 'main', label: 'Main' },
  { source: 'mono', label: 'M/C' },
  { source: 'solo', label: 'Solo' },
]

const BUS_SOURCES: { source: MonitorSource; label: string }[] =
  Array.from({ length: NUM_MIX_BUSES }, (_, i) => ({
    source: `bus-${i}` as MonitorSource,
    label: `${i + 1}`,
  }))

export function MonitorSection() {
  const monitor = useMixerStore((s) => s.monitor)
  const setMonitorSource = useMixerStore((s) => s.setMonitorSource)
  const setMonitorLevel = useMixerStore((s) => s.setMonitorLevel)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const sourceButton = (source: MonitorSource, label: string) => (
    <button
      key={source}
      className={`${styles.sourceButton} ${
        monitor.source === source ? styles.activeSource : ''
      }`}
      onClick={() => setMonitorSource(source)}
      onMouseEnter={() => setHelpText("Select which source to hear in headphones. 'Main' is LR mix, 'M/C' is center/mono bus, 'Solo' is the solo bus, and '1-16' are mix buses.")}
      onMouseLeave={() => setHelpText('')}
    >
      {label}
    </button>
  )

  return (
    <div className={styles.section}>
      <div className={styles.label}>PHONES</div>
      <Knob
        value={monitor.level}
        min={0}
        max={1}
        defaultValue={0.75}
        onChange={(v) => setMonitorLevel(v)}
        showValue={false}
        helpText="Adjust the headphone monitor volume. This controls only what you hear in the headphones, not the main output or any bus outputs."
      />
      <div className={styles.sourceButtons}>
        {PRIMARY_SOURCES.map(({ source, label }) => sourceButton(source, label))}
      </div>
      <div className={styles.busGrid}>
        {BUS_SOURCES.map(({ source, label }) => sourceButton(source, label))}
      </div>
    </div>
  )
}
