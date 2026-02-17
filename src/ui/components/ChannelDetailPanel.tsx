import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { GAIN_MIN, GAIN_MAX, GAIN_DEFAULT } from '@/state/mixer-model'
import { Knob } from './Knob'
import { Meter } from './Meter'
import styles from './ChannelDetailPanel.module.css'

const EQ_MODES = [
  { key: 'hcut', label: 'HCUT' },
  { key: 'hshv', label: 'HSHV' },
  { key: 'veq', label: 'VEQ' },
  { key: 'peq', label: 'PEQ' },
  { key: 'lshv', label: 'LSHV' },
  { key: 'lcut', label: 'LCUT' },
] as const

interface StripButtonProps {
  label: string
  active?: boolean
  onClick?: () => void
  view?: boolean
  disabled?: boolean
  sideLabel?: boolean
}

function StripButton({ label, active = false, onClick, view = false, disabled = false, sideLabel = false }: StripButtonProps) {
  return (
    <div className={`${styles.stripControl} ${view ? styles.viewControl : ''} ${sideLabel ? styles.sideLabelControl : ''} ${disabled ? styles.stripControlDisabled : ''}`}>
      {view ? <span className={styles.viewLabel}>{label}</span> : null}
      <button
        className={`${styles.stripButton} ${view ? styles.viewButton : ''} ${active && !disabled ? styles.stripButtonActive : ''}`}
        onClick={onClick}
        disabled={disabled}
      />
      {!view ? <span className={styles.stripLabel}>{label}</span> : null}
    </div>
  )
}

export function ChannelDetailPanel() {
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const channel = useMixerStore((s) => s.channels[selectedChannel])

  const setGain = useMixerStore((s) => s.setChannelGain)
  const setPan = useMixerStore((s) => s.setChannelPan)
  const setGateEnabled = useMixerStore((s) => s.setChannelGateEnabled)
  const setGateThreshold = useMixerStore((s) => s.setChannelGateThreshold)
  const setCompEnabled = useMixerStore((s) => s.setChannelCompEnabled)
  const setCompThreshold = useMixerStore((s) => s.setChannelCompThreshold)
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
  const setEqBand = useMixerStore((s) => s.setChannelEqSelectedBand)
  const cycleEqMode = useMixerStore((s) => s.cycleChannelEqMode)
  const setChannelSendLevel = useMixerStore((s) => s.setChannelSendLevel)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)

  if (!channel) {
    return (
      <div className={styles.panel}>
        <div className={styles.noSelection}>Select a channel to edit</div>
      </div>
    )
  }

  const id = selectedChannel
  const selectedBand = channel.eqSelectedBand
  const selectedBandFreq = selectedBand === 'high'
    ? channel.eqHighFreq
    : selectedBand === 'low'
      ? channel.eqLowFreq
      : channel.eqMidFreq
  const selectedBandGain = selectedBand === 'high'
    ? channel.eqHighGain
    : selectedBand === 'low'
      ? channel.eqLowGain
      : channel.eqMidGain

  const setSelectedBandFreq = (value: number) => {
    if (selectedBand === 'high') {
      setEqHighFreq(id, value)
      return
    }
    if (selectedBand === 'low') {
      setEqLowFreq(id, value)
      return
    }
    setEqMidFreq(id, value)
  }

  const setSelectedBandGain = (value: number) => {
    if (selectedBand === 'high') {
      setEqHighGain(id, value)
      return
    }
    if (selectedBand === 'low') {
      setEqLowGain(id, value)
      return
    }
    setEqMidGain(id, value)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.leftColumn}>
        <section className={`${styles.block} ${styles.preampBlock}`}>
          <h3 className={styles.blockTitle}>CONFIG / PREAMP</h3>
          <div className={styles.preampRow}>
            <Knob
              value={channel.gain}
              min={GAIN_MIN}
              max={GAIN_MAX}
              defaultValue={GAIN_DEFAULT}
              onChange={(v) => setGain(id, v)}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`}
              helpText="Adjust input gain."
              showValue={false}
            />
            <div className={styles.verticalMeterGroup}>
              <Meter channelIndex={id} source="preFader" helpText="Pre-fader level meter." />
              <span className={styles.meterLabel}>LEVEL / dB</span>
            </div>
            <Knob
              value={channel.hpfFreq}
              min={20}
              max={500}
              defaultValue={80}
              onChange={(v) => setHpfFreq(id, v)}
              label="Frequency"
              formatValue={(v) => `${Math.round(v)} Hz`}
              available={channel.hpfEnabled}
              helpText="Low cut frequency."
              showValue={false}
            />
          </div>
          <div className={styles.preampSwitchLayout}>
            <div className={styles.preampGainSwitches}>
              <StripButton label="48V" />
              <StripButton label="Ø" />
            </div>
            <div className={styles.preampFreqSwitches}>
              <StripButton label="LOW CUT" active={channel.hpfEnabled} onClick={() => setHpfEnabled(id, !channel.hpfEnabled)} />
              <div className={styles.preampViewCorner}>
                <StripButton label="VIEW" view />
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.block} ${styles.gateDynBlock}`}>
          <div className={styles.gateDynTopTitles}>
            <h3 className={styles.blockTitle}>GATE</h3>
            <h3 className={styles.blockTitle}>DYNAMICS</h3>
          </div>

          <div className={styles.gateDynRow}>
            <div className={styles.gateDynKnobCol}>
              <Knob
                value={channel.gateThreshold}
                min={-80}
                max={0}
                defaultValue={-80}
                onChange={(v) => setGateThreshold(id, v)}
                label="Threshold"
                formatValue={(v) => `${v.toFixed(1)} dB`}
                available={channel.gateEnabled}
                showValue={false}
              />
            </div>

            <div className={styles.grMeterStack}>
              <div className={styles.grScale}>
                <span>COMP</span>
                <span>2</span>
                <span>4</span>
                <span>6</span>
                <span>10</span>
                <span>18</span>
                <span>30</span>
              </div>
              <div className={styles.verticalMeterGroup}>
                <Meter channelIndex={id} source="preFader" helpText="Gain reduction style indicator." />
                <span className={styles.meterLabel}>GR / dB</span>
              </div>
            </div>

            <div className={styles.gateDynKnobCol}>
              <Knob
                value={channel.compThreshold}
                min={-60}
                max={0}
                defaultValue={-25.5}
                onChange={(v) => setCompThreshold(id, v)}
                label="Threshold"
                formatValue={(v) => `${v.toFixed(1)} dB`}
                available={channel.compEnabled}
                showValue={false}
              />
            </div>
          </div>

          <div className={styles.gateDynSwitches}>
            <div className={styles.knobCornerSwitch}>
              <StripButton label="GATE" active={channel.gateEnabled} onClick={() => setGateEnabled(id, !channel.gateEnabled)} />
              <StripButton label="VIEW" view />
            </div>
            <div className={styles.knobCornerSwitch}>
              <StripButton label="COMPRESSOR" active={channel.compEnabled} onClick={() => setCompEnabled(id, !channel.compEnabled)} />
              <StripButton label="VIEW" view />
            </div>
          </div>
        </section>
      </div>

      <section className={styles.eqBlock}>
        <h3 className={styles.blockTitle}>EQUALIZER</h3>
        <div className={styles.eqCanvas}>
          <div className={styles.eqTypeStrip}>
            {EQ_MODES.map((mode, index) => (
              <div
                key={mode.key}
                className={`${styles.eqTypeRow} ${channel.eqEnabled && channel.eqModeIndex === index ? styles.eqTypeRowActive : ''}`}
              >
                <span className={styles.eqTypeText}>{mode.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.eqTop}>
            <Knob
              value={channel.eqMidQ}
              min={0.1}
              max={10}
              defaultValue={1}
              onChange={(v) => setEqMidQ(id, v)}
              label="Q"
              formatValue={(v) => v.toFixed(2)}
              available={channel.eqEnabled}
              showValue={false}
            />
          </div>

          <div className={styles.eqCenter}>
            <div className={styles.eqCenterWrap}>
              <Knob
                value={selectedBandFreq}
                min={selectedBand === 'high' ? 2000 : selectedBand === 'low' ? 40 : 200}
                max={selectedBand === 'high' ? 16000 : selectedBand === 'low' ? 500 : 8000}
                defaultValue={selectedBand === 'high' ? 5000 : selectedBand === 'low' ? 200 : 1000}
                onChange={setSelectedBandFreq}
                label="Freq"
                formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)}
                available={channel.eqEnabled}
                showValue={false}
              />
              <span className={`${styles.eqFreqMark} ${styles.eqFreq40}`}>40</span>
              <span className={`${styles.eqFreqMark} ${styles.eqFreq120}`}>120</span>
              <span className={`${styles.eqFreqMark} ${styles.eqFreq340}`}>340</span>
              <span className={`${styles.eqFreqMark} ${styles.eqFreq1k}`}>1k</span>
              <span className={`${styles.eqFreqMark} ${styles.eqFreq3k3}`}>3k3</span>
              <span className={`${styles.eqFreqMark} ${styles.eqFreq10k}`}>10k</span>
            </div>
          </div>

          <div className={styles.eqBottom}>
            <Knob
              value={selectedBandGain}
              min={-15}
              max={15}
              defaultValue={0}
              onChange={setSelectedBandGain}
              label="Gain"
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`}
              available={channel.eqEnabled}
              showValue={false}
            />
          </div>

          <div className={styles.eqBandButtons}>
            <StripButton label="HIGH" active={channel.eqEnabled && selectedBand === 'high'} onClick={() => setEqBand(id, 'high')} disabled={!channel.eqEnabled} />
            <StripButton label="HIGH MID" active={channel.eqEnabled && selectedBand === 'highMid'} onClick={() => setEqBand(id, 'highMid')} disabled={!channel.eqEnabled} />
            <StripButton label="LOW MID" active={channel.eqEnabled && selectedBand === 'lowMid'} onClick={() => setEqBand(id, 'lowMid')} disabled={!channel.eqEnabled} />
            <StripButton label="LOW" active={channel.eqEnabled && selectedBand === 'low'} onClick={() => setEqBand(id, 'low')} disabled={!channel.eqEnabled} />
          </div>
        </div>

        <div className={styles.eqBottomControls}>
          <div className={styles.eqCenterButtons}>
            <StripButton label="EQ" active={channel.eqEnabled} onClick={() => setEqEnabled(id, !channel.eqEnabled)} />
            <StripButton label="MODE" onClick={() => cycleEqMode(id)} />
          </div>
          <div className={styles.eqViewCorner}>
            <StripButton label="VIEW" view />
          </div>
        </div>
      </section>

      <section className={styles.busBlock}>
        <h3 className={styles.blockTitle}>BUS MIXES</h3>
        <div className={styles.mixBusHeader}>
          <span>MIX BUS SENDS</span>
          <StripButton label="VIEW" view />
        </div>
        <Knob
          value={channel.sends[sendTargetBus]?.level ?? 0}
          min={0}
          max={1}
          defaultValue={0}
          onChange={(v) => setChannelSendLevel(id, sendTargetBus, v)}
          label="Level"
          formatValue={(v) => `${Math.round(v * 100)}%`}
          showValue={false}
        />
        <div className={styles.monoBusRow}>
          <StripButton label="MONO BUS" sideLabel />
        </div>
        <div className={styles.panBalRow}>
          <Knob
            value={channel.pan}
            min={-1}
            max={1}
            defaultValue={0}
            onChange={(v) => setPan(id, v)}
            label="Pan / Bal"
            formatValue={(v) => {
              if (Math.abs(v) < 0.01) return 'C'
              return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`
            }}
            helpText="Set stereo pan."
            showValue={false}
          />
        </div>
        <div className={styles.switchRow}>
          <StripButton label="MAIN LR BUS" />
          <StripButton label="VIEW" view />
        </div>
      </section>
    </div>
  )
}
