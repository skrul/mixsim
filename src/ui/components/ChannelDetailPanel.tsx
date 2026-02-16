import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { GAIN_MIN, GAIN_MAX, GAIN_DEFAULT, NUM_DCA_GROUPS, NUM_TONE_SLOTS, type ChannelInputSource } from '@/state/mixer-model'
import { getToneLabel } from '@/audio/source-manager'
import { Knob } from './Knob'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './ChannelDetailPanel.module.css'

function sourceToValue(source: ChannelInputSource): string {
  switch (source.type) {
    case 'stem': return `stem:${source.stemIndex}`
    case 'tone': return `tone:${source.toneIndex}`
    case 'live': return `live:${source.deviceId}`
    case 'none': return 'none'
  }
}

function valueToSource(value: string): ChannelInputSource {
  if (value === 'none') return { type: 'none' }
  const [type, rest] = value.split(':')
  switch (type) {
    case 'stem': return { type: 'stem', stemIndex: parseInt(rest, 10) }
    case 'tone': return { type: 'tone', toneIndex: parseInt(rest, 10) }
    case 'live': return { type: 'live', deviceId: rest }
    default: return { type: 'none' }
  }
}

export function ChannelDetailPanel() {
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const channel = useMixerStore((s) => s.channels[selectedChannel])

  const setGain = useMixerStore((s) => s.setChannelGain)
  const setPan = useMixerStore((s) => s.setChannelPan)
  const setHpfEnabled = useMixerStore((s) => s.setChannelHpfEnabled)
  const setHpfFreq = useMixerStore((s) => s.setChannelHpfFreq)
  const setEqEnabled = useMixerStore((s) => s.setChannelEqEnabled)
  const setEqLowFreq = useMixerStore((s) => s.setChannelEqLowFreq)
  const setEqLowGain = useMixerStore((s) => s.setChannelEqLowGain)
  const setEqMidFreq = useMixerStore((s) => s.setChannelEqMidFreq)
  const setEqMidGain = useMixerStore((s) => s.setChannelEqMidGain)
  const setEqMidQ = useMixerStore((s) => s.setChannelEqMidQ)
  const setEqHighFreq = useMixerStore((s) => s.setChannelEqHighFreq)
  const setEqHighGain = useMixerStore((s) => s.setChannelEqHighGain)
  const dcaGroups = useMixerStore((s) => s.dcaGroups)
  const assignChannelToDca = useMixerStore((s) => s.assignChannelToDca)
  const unassignChannelFromDca = useMixerStore((s) => s.unassignChannelFromDca)
  const setChannelInputSource = useMixerStore((s) => s.setChannelInputSource)
  const availableStems = useMixerStore((s) => s.availableStems)
  const availableLiveDevices = useMixerStore((s) => s.availableLiveDevices)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendsOnFaderMode = useSurfaceStore((s) => s.sendsOnFaderMode)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)
  const toggleSendsOnFaderForSelectedChannel = useSurfaceStore((s) => s.toggleSendsOnFaderForSelectedChannel)

  const isChannelSofActive = sendsOnFader && sendsOnFaderMode === 'channel'
  const isBusSofActive = sendsOnFader && sendsOnFaderMode === 'bus'

  if (!channel) {
    return (
      <div className={styles.panel}>
        <div className={styles.noSelection}>Select a channel to edit</div>
      </div>
    )
  }

  const id = selectedChannel

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.channelNumber}>{String(id + 1).padStart(2, '0')}</span>
        <span className={styles.channelName} style={{ color: channel.color }}>
          {channel.label}
        </span>
      </div>

      {/* Input Source */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>INPUT</div>
        <select
          className={styles.inputSelect}
          value={sourceToValue(channel.inputSource)}
          onChange={(e) => setChannelInputSource(id, valueToSource(e.target.value))}
        >
          <option value="none">None</option>
          {availableStems.length > 0 && (
            <optgroup label="Stems">
              {availableStems.map((s) => (
                <option key={`stem:${s.index}`} value={`stem:${s.index}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Tones">
            {Array.from({ length: NUM_TONE_SLOTS }, (_, i) => (
              <option key={`tone:${i}`} value={`tone:${i}`}>
                {getToneLabel(i)}
              </option>
            ))}
          </optgroup>
          {availableLiveDevices.length > 0 && (
            <optgroup label="Live Input">
              {availableLiveDevices.map((d) => (
                <option key={`live:${d.deviceId}`} value={`live:${d.deviceId}`}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Config / Preamp */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>CONFIG</div>
        <div className={styles.gainRow}>
          <Knob
            value={channel.gain}
            min={GAIN_MIN}
            max={GAIN_MAX}
            defaultValue={GAIN_DEFAULT}
            onChange={(v) => setGain(id, v)}
            label="Gain"
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
            helpText="Adjust the input gain (preamp level). Set this so the pre-fader meter shows a healthy signal without clipping."
          />
          <div className={styles.gainMeter}>
            <Meter channelIndex={id} source="preFader" helpText="Shows the signal level before the fader, after gain and EQ processing." />
          </div>
        </div>
        <div className={styles.knobRow}>
          <ToggleButton
            active={channel.hpfEnabled}
            onClick={() => setHpfEnabled(id, !channel.hpfEnabled)}
            label="HPF"
            variant="hpf"
            helpText="Enable the high pass filter (low cut) to remove unwanted low-frequency rumble."
          />
          <Knob
            value={channel.hpfFreq}
            min={20}
            max={500}
            defaultValue={80}
            onChange={(v) => setHpfFreq(id, v)}
            label="Freq"
            formatValue={(v) => `${Math.round(v)} Hz`}
            helpText="Set the high pass filter cutoff frequency (20–500 Hz)."
          />
        </div>
      </div>

      {/* EQ */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>EQ</span>
          <ToggleButton
            active={channel.eqEnabled}
            onClick={() => setEqEnabled(id, !channel.eqEnabled)}
            label="ON"
            variant="eq"
            helpText="Enable or bypass the equalizer."
          />
        </div>
        <div className={styles.eqBands}>
          <div className={styles.eqBand}>
            <div className={styles.bandLabel}>LOW</div>
            <Knob
              value={channel.eqLowFreq}
              min={40}
              max={500}
              defaultValue={200}
              onChange={(v) => setEqLowFreq(id, v)}
              label="Freq"
              formatValue={(v) => `${Math.round(v)}`}
              helpText="Low EQ frequency (40–500 Hz)."
            />
            <Knob
              value={channel.eqLowGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqLowGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="Low EQ gain (±15 dB). Boost to add warmth, cut to reduce muddiness."
            />
          </div>
          <div className={styles.eqBand}>
            <div className={styles.bandLabel}>MID</div>
            <Knob
              value={channel.eqMidFreq}
              min={200}
              max={8000}
              defaultValue={1000}
              onChange={(v) => setEqMidFreq(id, v)}
              label="Freq"
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
              helpText="Mid EQ frequency (200 Hz–8 kHz)."
            />
            <Knob
              value={channel.eqMidGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqMidGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="Mid EQ gain (±15 dB)."
            />
            <Knob
              value={channel.eqMidQ}
              min={0.1}
              max={10}
              defaultValue={1.0}
              onChange={(v) => setEqMidQ(id, v)}
              label="Q"
              formatValue={(v) => v.toFixed(1)}
              helpText="Mid EQ bandwidth (Q factor). Low Q = broad, high Q = narrow."
            />
          </div>
          <div className={styles.eqBand}>
            <div className={styles.bandLabel}>HIGH</div>
            <Knob
              value={channel.eqHighFreq}
              min={2000}
              max={16000}
              defaultValue={5000}
              onChange={(v) => setEqHighFreq(id, v)}
              label="Freq"
              formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
              helpText="High EQ frequency (2–16 kHz)."
            />
            <Knob
              value={channel.eqHighGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqHighGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="High EQ gain (±15 dB). Boost for brilliance, cut to tame harshness."
            />
          </div>
        </div>
      </div>

      {/* Gate Placeholder */}
      <div className={`${styles.section} ${styles.placeholder}`}>
        <div className={styles.sectionLabel}>GATE</div>
        <div className={styles.placeholderText}>Phase 3</div>
      </div>

      {/* Dynamics Placeholder */}
      <div className={`${styles.section} ${styles.placeholder}`}>
        <div className={styles.sectionLabel}>DYN</div>
        <div className={styles.placeholderText}>Phase 3</div>
      </div>

      {/* Pan */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>PAN</div>
        <Knob
          value={channel.pan}
          min={-1}
          max={1}
          defaultValue={0}
          onChange={(v) => setPan(id, v)}
          label="Pan"
          formatValue={(v) => {
            if (Math.abs(v) < 0.01) return 'C'
            return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`
          }}
          helpText="Set the stereo pan position."
        />
      </div>

      {/* Sends on Fader */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>SENDS ON FADER</div>
        <div className={styles.sofControls}>
          <ToggleButton
            active={isChannelSofActive}
            onClick={toggleSendsOnFaderForSelectedChannel}
            label="CH MODE"
            variant="select"
            helpText="Toggle Sends on Fader in channel-send mode. When active, the bus faders control sends from this selected input channel."
          />
          <div className={styles.sofStatus}>
            {isChannelSofActive && `Bus faders now control sends from ${channel.label}.`}
            {isBusSofActive && `Input faders are controlling sends to Mix ${sendTargetBus + 1}.`}
            {!sendsOnFader && 'Off. Use CH MODE for selected-input sends, or press SELECT on a bus strip for monitor-mix mode.'}
          </div>
        </div>
      </div>

      {/* DCA Assignment */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>DCA</div>
        <div className={styles.dcaGrid}>
          {Array.from({ length: NUM_DCA_GROUPS }, (_, d) => {
            const assigned = channel.dcaGroups.includes(d)
            return (
              <ToggleButton
                key={d}
                active={assigned}
                onClick={() =>
                  assigned
                    ? unassignChannelFromDca(id, d)
                    : assignChannelToDca(id, d)
                }
                label={dcaGroups[d]?.label ?? `DCA ${d + 1}`}
                variant="dca"
                helpText="Assign this channel to a DCA group for grouped level/mute control."
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
