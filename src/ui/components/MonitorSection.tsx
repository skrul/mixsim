import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_MIX_BUSES, type MonitorSource } from '@/state/mixer-model'
import { Knob } from './Knob'
import styles from './MonitorSection.module.css'

const MONITOR_SOURCES: { source: MonitorSource; label: string }[] = [
  { source: 'main', label: 'Main' },
  { source: 'mono', label: 'M/C' },
  ...Array.from({ length: NUM_MIX_BUSES }, (_, i) => ({
    source: `bus-${i}` as MonitorSource,
    label: `Mix ${i + 1}`,
  })),
]

export function MonitorSection() {
  const monitor = useMixerStore((s) => s.monitor)
  const soloActive = useMixerStore((s) => s.soloActive)
  const setMonitorSource = useMixerStore((s) => s.setMonitorSource)
  const setMonitorLevel = useMixerStore((s) => s.setMonitorLevel)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const effectiveSource = soloActive ? 'solo' : monitor.source

  return (
    <div className={styles.section}>
      <div className={styles.label}>PHONES</div>
      <Knob
        value={monitor.level}
        min={0}
        max={1}
        defaultValue={0.75}
        onChange={(v) => setMonitorLevel(v)}
        label="Level"
        formatValue={(v) => `${Math.round(v * 100)}%`}
        helpText="Adjust the headphone monitor volume. This controls only what you hear in the headphones, not the main output or any bus outputs."
      />
      <div className={styles.sourceLabel}>SOURCE</div>
      <div className={styles.sourceButtons}>
        {MONITOR_SOURCES.map(({ source, label }) => (
          <button
            key={source}
            className={`${styles.sourceButton} ${
              effectiveSource === source ? styles.activeSource : ''
            } ${soloActive && source === monitor.source ? styles.overridden : ''}`}
            onClick={() => setMonitorSource(source)}
            onMouseEnter={() => setHelpText("Select which source to hear in headphones. 'Main' is LR mix, 'M/C' is center/mono bus, and 'Mix 1-16' are monitor buses.")}
            onMouseLeave={() => setHelpText('')}
          >
            {label}
          </button>
        ))}
      </div>
      {soloActive && (
        <div
          className={styles.soloIndicator}
          onMouseEnter={() => setHelpText("A channel's solo button is active. The monitor is automatically switched to the solo bus so you can hear the soloed channel(s) in isolation. It will return to your selected source when solo is released.")}
          onMouseLeave={() => setHelpText('')}
        >SOLO</div>
      )}
    </div>
  )
}
