import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { GAIN_MIN, GAIN_MAX, GAIN_DEFAULT, NUM_MIX_BUSES, NUM_DCA_GROUPS } from '@/state/mixer-model'
import { Knob } from './Knob'
import { Meter } from './Meter'
import { ToggleButton } from './ToggleButton'
import styles from './SelectedChannelStrip.module.css'

export function SelectedChannelStrip() {
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
  const setSendLevel = useMixerStore((s) => s.setChannelSendLevel)
  const setSendPreFader = useMixerStore((s) => s.setChannelSendPreFader)
  const mixBuses = useMixerStore((s) => s.mixBuses)
  const dcaGroups = useMixerStore((s) => s.dcaGroups)
  const assignChannelToDca = useMixerStore((s) => s.assignChannelToDca)
  const unassignChannelFromDca = useMixerStore((s) => s.unassignChannelFromDca)

  if (!channel) return null

  const id = selectedChannel

  return (
    <div className={styles.strip}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.channelNumber}>{String(selectedChannel + 1).padStart(2, '0')}</span>
        <span className={styles.channelName} style={{ color: channel.color }}>
          {channel.label}
        </span>
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
            helpText="Adjust the input gain (preamp level). This is the first stage of amplification. Set this so the pre-fader meter shows a healthy signal without clipping."
          />
          <div className={styles.gainMeter}>
            <Meter channelIndex={id} source="preFader" helpText="Shows the signal level before the fader, after gain and EQ processing. Use this to set proper gain staging — aim for peaks in the green/yellow range." />
          </div>
        </div>
        <div className={styles.knobRow}>
          <ToggleButton
            active={channel.hpfEnabled}
            onClick={() => setHpfEnabled(id, !channel.hpfEnabled)}
            label="HPF"
            variant="hpf"
            helpText="Click to enable the high pass filter (also called low cut). Use the frequency knob to select the cutoff frequency and remove unwanted low-frequency rumble, handling noise, and stage vibrations."
          />
          <Knob
            value={channel.hpfFreq}
            min={20}
            max={500}
            defaultValue={80}
            onChange={(v) => setHpfFreq(id, v)}
            label="Freq"
            formatValue={(v) => `${Math.round(v)} Hz`}
            helpText="Set the high pass filter cutoff frequency (20–500 Hz). Frequencies below this value will be attenuated. Common settings: 80 Hz for vocals, 100 Hz for guitars, 40 Hz for bass."
          />
        </div>
      </div>

      {/* Pan */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>PAN</div>
        <div className={styles.knobRow}>
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
            helpText="Set the stereo pan position. Center (C) sends equal signal to left and right. Turn left to send more signal to the left speaker, right for the right speaker."
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
            helpText="Enable or bypass the equalizer. When disabled, the EQ section is bypassed and the signal passes through unprocessed."
          />
        </div>
        <div className={styles.eqBand}>
          <div className={styles.bandLabel}>LOW</div>
          <div className={styles.knobRow}>
            <Knob
              value={channel.eqLowFreq}
              min={40}
              max={500}
              defaultValue={200}
              onChange={(v) => setEqLowFreq(id, v)}
              label="Freq"
              formatValue={(v) => `${Math.round(v)}`}
              helpText="Low EQ frequency (40–500 Hz). Sets which bass frequencies are boosted or cut by the low band gain control."
            />
            <Knob
              value={channel.eqLowGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqLowGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="Low EQ gain (±15 dB). Boost to add warmth and body, or cut to reduce muddiness and low-frequency buildup."
            />
          </div>
        </div>
        <div className={styles.eqBand}>
          <div className={styles.bandLabel}>MID</div>
          <div className={styles.knobRow}>
            <Knob
              value={channel.eqMidFreq}
              min={200}
              max={8000}
              defaultValue={1000}
              onChange={(v) => setEqMidFreq(id, v)}
              label="Freq"
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
              helpText="Mid EQ frequency (200 Hz–8 kHz). The midrange is where most instruments and vocals have their fundamental character."
            />
            <Knob
              value={channel.eqMidGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqMidGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="Mid EQ gain (±15 dB). Be careful with large boosts — subtractive EQ (cutting) generally sounds more natural than boosting."
            />
            <Knob
              value={channel.eqMidQ}
              min={0.1}
              max={10}
              defaultValue={1.0}
              onChange={(v) => setEqMidQ(id, v)}
              label="Q"
              formatValue={(v) => v.toFixed(1)}
              helpText="Mid EQ bandwidth (Q factor). Low Q values affect a broad range of frequencies. High Q values target a narrow band — useful for removing specific resonances or feedback frequencies."
            />
          </div>
        </div>
        <div className={styles.eqBand}>
          <div className={styles.bandLabel}>HIGH</div>
          <div className={styles.knobRow}>
            <Knob
              value={channel.eqHighFreq}
              min={2000}
              max={16000}
              defaultValue={5000}
              onChange={(v) => setEqHighFreq(id, v)}
              label="Freq"
              formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
              helpText="High EQ frequency (2–16 kHz). High frequencies add brightness, air, and presence to a sound."
            />
            <Knob
              value={channel.eqHighGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={(v) => setEqHighGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              helpText="High EQ gain (±15 dB). A gentle boost adds brilliance and sparkle. Cut to tame harshness or sibilance in vocals."
            />
          </div>
        </div>
      </div>

      {/* Bus Sends */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>BUS SENDS</div>
        {Array.from({ length: NUM_MIX_BUSES }, (_, b) => (
          <div key={b} className={styles.sendRow}>
            <span className={styles.sendLabel}>{mixBuses[b]?.label ?? `Mix ${b + 1}`}</span>
            <ToggleButton
              active={channel.sends[b]?.preFader ?? false}
              onClick={() => setSendPreFader(id, b, !channel.sends[b]?.preFader)}
              label="PRE"
              variant="pre"
              helpText="Toggle pre-fader/post-fader send. Pre-fader sends are independent of the channel fader — used for monitor mixes so musicians hear a consistent level. Post-fader sends follow the channel fader, typically used for effects like reverb."
            />
            <Knob
              value={channel.sends[b]?.level ?? 0}
              min={0}
              max={1}
              defaultValue={0}
              onChange={(v) => setSendLevel(id, b, v)}
              label=""
              formatValue={(v) => `${Math.round(v * 100)}%`}
              helpText={`Adjust how much of this channel's signal is sent to ${mixBuses[b]?.label ?? `Mix ${b + 1}`}. Each bus typically feeds a different monitor mix for musicians on stage.`}
            />
          </div>
        ))}
      </div>

      {/* DCA Assignment */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>DCA GROUPS</div>
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
                helpText="Assign this channel to a DCA (Digitally Controlled Amplifier) group. DCA groups let you control the level and mute of multiple channels simultaneously — useful for grouping drums, vocals, or other instrument families."
              />
            )
          })}
        </div>
      </div>

      {/* Placeholder sections */}
      <div className={`${styles.section} ${styles.placeholder}`}>
        <div className={styles.sectionLabel}>GATE</div>
        <div className={styles.placeholderText}>Phase 3</div>
      </div>
      <div className={`${styles.section} ${styles.placeholder}`}>
        <div className={styles.sectionLabel}>DYNAMICS</div>
        <div className={styles.placeholderText}>Phase 3</div>
      </div>
    </div>
  )
}
