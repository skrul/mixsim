import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { GAIN_MAX, GAIN_MIN, useMixerStore, type ChannelState } from '@/state/mixer-store'
import { dynamicsLevels, meterLevels } from '@/audio/metering'
import { useSurfaceStore, type SelectedFocus } from '@/state/surface-store'
import styles from './DisplayHomeScreen.module.css'

type SelectedTarget =
  | { kind: 'channel'; index: number }
  | { kind: 'bus'; index: number }
  | { kind: 'dca'; index: number }

const DISPLAY_TILE_METER_THRESHOLDS = [
  -60, -57, -54, -51, -48, -45, -42, -39, -36, -33, -30,
  -27, -24, -21, -18, -15, -12, -10, -8, -6, -4, 0,
]
const EQ_MIN_FREQ = 20
const EQ_MAX_FREQ = 20000
const EQ_MIN_DB = -20
const EQ_MAX_DB = 20
const EQ_GRID_MAJOR_FREQS = [20, 40, 60, 100, 200, 300, 400, 500, 600, 800, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 20000]
const EQ_GRID_MINOR_FREQS = [30, 50, 70, 150, 250, 700, 1500, 2500, 7000, 12000]

function freqToNorm(freq: number): number {
  const minL = Math.log10(EQ_MIN_FREQ)
  const maxL = Math.log10(EQ_MAX_FREQ)
  return clamp((Math.log10(freq) - minL) / (maxL - minL), 0, 1)
}

function dbToNorm(db: number): number {
  return clamp((db - EQ_MIN_DB) / (EQ_MAX_DB - EQ_MIN_DB), 0, 1)
}

function highPassContributionDb(freq: number, cutoffHz: number): number {
  if (freq >= cutoffHz) return 0
  const ratio = Math.max(freq / cutoffHz, 1e-3)
  return Math.max(-24, 20 * Math.log10(ratio))
}

function shelfContributionDb(freq: number, cutoffHz: number, gainDb: number, highShelf: boolean): number {
  const x = Math.log2(Math.max(freq, 1e-3) / Math.max(cutoffHz, 1e-3))
  const t = 1 / (1 + Math.exp(-x * 3))
  return highShelf ? gainDb * t : gainDb * (1 - t)
}

function bellContributionDb(freq: number, centerHz: number, gainDb: number, q: number): number {
  const x = Math.log2(Math.max(freq, 1e-3) / Math.max(centerHz, 1e-3))
  const sigma = Math.max(0.15, 1 / Math.max(0.3, q))
  const shape = Math.exp(-(x * x) / (2 * sigma * sigma))
  return gainDb * shape
}

function computeEqResponseDb(freq: number, channel: ChannelState): number {
  let db = 0
  if (channel.hpfEnabled) {
    db += highPassContributionDb(freq, channel.hpfFreq)
  }
  if (channel.eqEnabled) {
    db += shelfContributionDb(freq, channel.eqLowFreq, channel.eqLowGain, false)
    db += bellContributionDb(freq, channel.eqLowMidFreq, channel.eqLowMidGain, channel.eqMidQ)
    db += bellContributionDb(freq, channel.eqHighMidFreq, channel.eqHighMidGain, channel.eqMidQ)
    db += shelfContributionDb(freq, channel.eqHighFreq, channel.eqHighGain, true)
  }
  return clamp(db, EQ_MIN_DB, EQ_MAX_DB)
}

function formatDb(value: number): string {
  if (!Number.isFinite(value)) return '0.0 dB'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} dB`
}

function formatPan(value: number): string {
  if (Math.abs(value) < 0.01) return 'C'
  if (value < 0) return `L${Math.round(Math.abs(value) * 100)}`
  return `R${Math.round(value * 100)}`
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pad2(v: number): string {
  return v.toString().padStart(2, '0')
}

function formatTargetTitle(kind: SelectedTarget['kind'], index: number): string {
  if (kind === 'channel') return `CH${index + 1}`
  if (kind === 'bus') return `BUS${index + 1}`
  return `DCA${index + 1}`
}

function getSelectedTarget(
  selectedFocus: SelectedFocus,
  outputBankLayer: 'dcas' | 'buses',
  selectedOutputIndex: number,
  selectedChannel: number
): SelectedTarget {
  if (selectedFocus === 'output' && selectedOutputIndex >= 0) {
    if (outputBankLayer === 'dcas') return { kind: 'dca', index: selectedOutputIndex }
    return { kind: 'bus', index: selectedOutputIndex }
  }
  return { kind: 'channel', index: selectedChannel }
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function DisplayHomeScreen() {
  const channels = useMixerStore((s) => s.channels)
  const mixBuses = useMixerStore((s) => s.mixBuses)
  const dcaGroups = useMixerStore((s) => s.dcaGroups)
  const selectedFocus = useSurfaceStore((s) => s.selectedFocus)
  const outputBankLayer = useSurfaceStore((s) => s.outputBankLayer)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const [clockText, setClockText] = useState({ hm: '12:00', sec: '00', ampm: 'AM' })
  const [inMeterLit, setInMeterLit] = useState(0)
  const [outMeterLit, setOutMeterLit] = useState(0)
  const [gateReductionNorm, setGateReductionNorm] = useState(0)
  const [compReductionNorm, setCompReductionNorm] = useState(0)
  const inMeterDbRef = useRef(-Infinity)
  const outMeterDbRef = useRef(-Infinity)
  const gateReductionRef = useRef(0)
  const compReductionRef = useRef(0)
  const inMeterRafRef = useRef<number | null>(null)

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const hour12 = now.getHours() % 12 || 12
      setClockText({
        hm: `${pad2(hour12)}:${pad2(now.getMinutes())}`,
        sec: pad2(now.getSeconds()),
        ampm: now.getHours() >= 12 ? 'PM' : 'AM',
      })
    }
    updateClock()
    const id = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(id)
  }, [])

  const target = getSelectedTarget(selectedFocus, outputBankLayer, selectedOutputIndex, selectedChannel)

  useEffect(() => {
    const tick = () => {
      const channelIndex = target.kind === 'channel' ? target.index : selectedChannel
      const db = meterLevels.preFaderChannels[channelIndex] ?? -Infinity
      const current = inMeterDbRef.current
      const nextDb = db > current ? db : Math.max(current - 1.4, db)
      inMeterDbRef.current = nextDb
      let lit = 0
      for (let i = 0; i < DISPLAY_TILE_METER_THRESHOLDS.length; i++) {
        if (nextDb >= DISPLAY_TILE_METER_THRESHOLDS[i]) lit++
      }
      setInMeterLit((prev) => (prev === lit ? prev : lit))

      const outDb = meterLevels.channels[channelIndex] ?? -Infinity
      const currentOut = outMeterDbRef.current
      const nextOutDb = outDb > currentOut ? outDb : Math.max(currentOut - 1.4, outDb)
      outMeterDbRef.current = nextOutDb
      let outLit = 0
      for (let i = 0; i < DISPLAY_TILE_METER_THRESHOLDS.length; i++) {
        if (nextOutDb >= DISPLAY_TILE_METER_THRESHOLDS[i]) outLit++
      }
      setOutMeterLit((prev) => (prev === outLit ? prev : outLit))

      const targetGateNorm = clamp((dynamicsLevels.gateReductionDb[channelIndex] ?? 0) / 30, 0, 1)
      const nextGate = targetGateNorm > gateReductionRef.current
        ? targetGateNorm
        : Math.max(gateReductionRef.current - 0.04, targetGateNorm)
      gateReductionRef.current = nextGate
      setGateReductionNorm((prev) => (Math.abs(prev - nextGate) < 0.002 ? prev : nextGate))

      const targetCompNorm = clamp((dynamicsLevels.compReductionDb[channelIndex] ?? 0) / 30, 0, 1)
      const nextComp = targetCompNorm > compReductionRef.current
        ? targetCompNorm
        : Math.max(compReductionRef.current - 0.04, targetCompNorm)
      compReductionRef.current = nextComp
      setCompReductionNorm((prev) => (Math.abs(prev - nextComp) < 0.002 ? prev : nextComp))

      inMeterRafRef.current = requestAnimationFrame(tick)
    }
    inMeterRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (inMeterRafRef.current !== null) cancelAnimationFrame(inMeterRafRef.current)
      inMeterRafRef.current = null
    }
  }, [selectedChannel, target])

  const summary = useMemo(() => {
    if (target.kind === 'bus') {
      const bus = mixBuses[target.index]
      if (!bus) return null

      const feeders = channels
        .map((channel, idx) => ({ idx, label: channel.label || `CH${idx + 1}`, level: channel.sends[target.index]?.level ?? 0 }))
        .filter((item) => item.level > 0.001)
        .sort((a, b) => b.level - a.level)
        .slice(0, 8)

      return {
        kind: 'bus' as const,
        headerId: `BUS${target.index + 1}`,
        headerLabel: bus.label,
        leftRows: [
          { label: 'Fader', value: percent(bus.faderPosition) },
          { label: 'Mute', value: bus.mute ? 'ON' : 'OFF' },
          { label: 'Solo', value: bus.solo ? 'ON' : 'OFF' },
          { label: 'Feeds', value: `${feeders.length} ch` },
        ],
        feeds: feeders.length > 0 ? feeders : [{ idx: -1, label: 'No channels assigned', level: 0 }],
      }
    }

    if (target.kind === 'dca') {
      const dca = dcaGroups[target.index]
      if (!dca) return null
      const members = dca.assignedChannels.slice(0, 8).map((channelId) => {
        const label = channels[channelId]?.label || `CH${channelId + 1}`
        return { idx: channelId, label, level: 1 }
      })
      return {
        kind: 'dca' as const,
        headerId: `DCA${target.index + 1}`,
        headerLabel: dca.label,
        leftRows: [
          { label: 'Fader', value: percent(dca.faderPosition) },
          { label: 'Mute', value: dca.mute ? 'ON' : 'OFF' },
          { label: 'Solo', value: dca.solo ? 'ON' : 'OFF' },
          { label: 'Members', value: `${dca.assignedChannels.length}` },
        ],
        members: members.length > 0 ? members : [{ idx: -1, label: 'No channels assigned', level: 0 }],
      }
    }

    const channel = channels[target.index]
    if (!channel) return null
    const gainNorm = clamp((channel.gain - GAIN_MIN) / (GAIN_MAX - GAIN_MIN), 0, 1)
    const gainAngle = -130 + gainNorm * 260
    const gateAngle = -130 + ((channel.gateThreshold + 80) / 80) * 260
    const compAngle = -130 + ((channel.compThreshold + 60) / 60) * 260
    const gateThresholdNorm = clamp((channel.gateThreshold + 80) / 80, 0, 1)
    const compThresholdNorm = clamp((channel.compThreshold + 60) / 60, 0, 1)
    return {
      kind: 'channel' as const,
      headerId: `CH${target.index + 1}`,
      headerLabel: channel.label || `Channel ${target.index + 1}`,
      channel,
      gainAngle,
      gateAngle,
      compAngle,
      gateThresholdNorm,
      compThresholdNorm,
      encoderValues: [
        formatDb(channel.gain),
        channel.gateEnabled ? channel.gateThreshold.toFixed(1) : 'OFF',
        'POST',
        channel.compEnabled ? 'ON' : 'OFF',
        channel.compEnabled ? channel.compThreshold.toFixed(1) : 'OFF',
        formatPan(channel.pan),
      ],
    }
  }, [channels, dcaGroups, mixBuses, target])

  const eqGraph = useMemo(() => {
    if (!summary || summary.kind !== 'channel') return null
    const showCurve = summary.channel.hpfEnabled || summary.channel.eqEnabled
    const pointCount = 90
    const zeroY = 100 - dbToNorm(0) * 100
    const points = Array.from({ length: pointCount }, (_, i) => {
      const normX = i / (pointCount - 1)
      const freq = EQ_MIN_FREQ * Math.pow(EQ_MAX_FREQ / EQ_MIN_FREQ, normX)
      const db = computeEqResponseDb(freq, summary.channel)
      const y = 100 - dbToNorm(db) * 100
      return {
        x: normX * 100,
        y,
        yPos: Math.min(y, zeroY),
        yNeg: Math.max(y, zeroY),
      }
    })

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ')
    const posAreaPath = [
      `M ${points[0].x.toFixed(3)} ${zeroY.toFixed(3)}`,
      ...points.map((p) => `L ${p.x.toFixed(3)} ${p.yPos.toFixed(3)}`),
      `L ${points[points.length - 1].x.toFixed(3)} ${zeroY.toFixed(3)}`,
      'Z',
    ].join(' ')
    const negAreaPath = [
      `M ${points[0].x.toFixed(3)} ${zeroY.toFixed(3)}`,
      ...points.map((p) => `L ${p.x.toFixed(3)} ${p.yNeg.toFixed(3)}`),
      `L ${points[points.length - 1].x.toFixed(3)} ${zeroY.toFixed(3)}`,
      'Z',
    ].join(' ')

    const majorX = EQ_GRID_MAJOR_FREQS.map((f) => freqToNorm(f) * 100)
    const minorX = EQ_GRID_MINOR_FREQS.map((f) => freqToNorm(f) * 100)
    const majorY = [-20, -10, 0, 10, 20].map((d) => 100 - dbToNorm(d) * 100)
    const minorY = [-15, -5, 5, 15].map((d) => 100 - dbToNorm(d) * 100)

    return {
      showCurve,
      zeroY,
      linePath,
      posAreaPath,
      negAreaPath,
      majorX,
      minorX,
      majorY,
      minorY,
    }
  }, [summary])

  if (!summary) {
    return <div className={styles.empty}>No selection</div>
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topHeader}>
        <div className={styles.statusChannel}>
          <div className={styles.statusChannelIconSlot} />
          <div className={styles.statusChannelId}>{formatTargetTitle(target.kind, target.index)}</div>
          <div className={styles.statusChannelDivider} />
          <div className={styles.statusChannelName}>
            {target.kind === 'channel' ? summary.headerLabel : (target.kind === 'bus' ? `MixBus ${pad2(target.index + 1)}` : summary.headerLabel)}
          </div>
          <div
            className={styles.statusChannelColor}
            style={{
              backgroundColor:
                summary.kind === 'channel'
                  ? summary.channel.color
                  : '#f2d75e',
            }}
          />
        </div>

        <div className={styles.globalStatusBar}>
          <div className={styles.statusMidGrid}>
            <div className={styles.statusMidCell} />
            <div className={styles.statusMidCell} />
            <div className={`${styles.statusMidCell} ${styles.statusUsbCell}`}>No USB drive</div>
            <div className={`${styles.statusMidCell} ${styles.statusSceneTagCell}`}>SCENE</div>
            <div className={`${styles.statusMidCell} ${styles.statusSceneMainCell}`}>00:TEST</div>
            <div className={styles.statusMidCell} />
          </div>
          <div className={styles.statusAesClock}>
            <div className={styles.statusAesRow}>
              <span className={styles.statusKey}>A:</span>
              <span className={styles.statusValue}>S16</span>
              <span className={styles.statusDot} />
              <span className={styles.statusKey}>L:</span>
              <span className={styles.statusValue}>48K</span>
            </div>
            <div className={styles.statusAesRow}>
              <span className={styles.statusKey}>B:</span>
              <span className={styles.statusValue}>-</span>
              <span className={styles.statusDotOff} />
              <span className={styles.statusKey}>C:</span>
              <span className={styles.statusValue}>LIVE</span>
            </div>
          </div>
          <div className={styles.statusClock}>
            <span className={styles.statusClockHm}>{clockText.hm}</span>
            <span className={styles.statusClockRight}>
              <span className={styles.statusClockAmPm}>{clockText.ampm}</span>
              <span className={styles.statusClockSec}>{clockText.sec}</span>
            </span>
          </div>
        </div>

        <div className={styles.topTabs}>
          <div className={`${styles.tab} ${styles.activeTab}`}>HOME</div>
          <div className={styles.tab}>CONFIG</div>
          <div className={styles.tab}>GATE</div>
          <div className={styles.tab}>DYN</div>
          <div className={styles.tab}>EQ</div>
          <div className={styles.tab}>SENDS</div>
          <div className={styles.tab}>MAIN</div>
        </div>
      </div>

      {summary.kind === 'channel' ? (
        <>
          <div className={styles.body}>
            <div className={styles.signalPathRow}>
              <div className={`${styles.signalCell} ${styles.inTile}`}>
                <div className={styles.signalCellHeader}>IN</div>
                <div className={styles.inTileBody}>
                  <div className={styles.inTileUpper}>
                    <div className={styles.inLevelMeter}>
                      <div className={styles.inLevelTrack}>
                        {DISPLAY_TILE_METER_THRESHOLDS.map((_, i) => {
                          const rowFromBottom = DISPLAY_TILE_METER_THRESHOLDS.length - 1 - i
                          const isLit = rowFromBottom < inMeterLit
                          const toneClass =
                            i === 0
                              ? styles.inSegClip
                              : (i <= 10 ? styles.inSegWarm : styles.inSegCool)
                          return (
                            <div
                              key={`in-meter-${i}`}
                              className={`${styles.inLevelSeg} ${toneClass} ${isLit ? '' : styles.inLevelSegOff}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                    <div className={styles.inFlags}>
                      <div className={`${styles.inFlagRow} ${summary.channel.phantom48V ? styles.inFlagOn : styles.inFlagOff}`}>
                        <span className={styles.inFlagGlyph}>⚡</span>
                        <span className={styles.inFlagLabel}>48V</span>
                      </div>
                      <div className={`${styles.inFlagRow} ${summary.channel.phaseInvert ? styles.inFlagOn : styles.inFlagOff}`}>
                        <span className={styles.inFlagGlyph}>Φ</span>
                        <span className={styles.inFlagLabel}>INVERT</span>
                      </div>
                      <div className={`${styles.inFlagRow} ${styles.inFlagOff}`}>
                        <span className={styles.inFlagGlyph}>Δ</span>
                        <span className={styles.inFlagLabel}>DELAY</span>
                      </div>
                      <div className={`${styles.inFlagRow} ${summary.channel.hpfEnabled ? styles.inFlagOn : styles.inFlagOff}`}>
                        <span className={styles.inFlagGlyph}>📈</span>
                        <span className={styles.inFlagLabel}>LOCUT</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.tileLower}>
                    <div className={`${styles.tileBadge} ${styles.tileBadgeOff}`}>LINK</div>
                    <div className={styles.tileValueBadge}>
                      {summary.channel.gain >= 0 ? '+' : ''}{summary.channel.gain.toFixed(1)}
                    </div>
                    <div className={styles.inKnobWrap}>
                      <div
                        className={`${styles.displayReadKnob} ${styles.displayReadKnobSmall}`}
                        style={{ '--knob-angle': `${summary.gainAngle}deg` } as CSSProperties}
                      >
                        <div className={styles.displayReadKnobHighlight} />
                        <div className={styles.displayReadKnobPointer} />
                      </div>
                    </div>
                    <div className={styles.tileKnobLabel}>GAIN</div>
                  </div>
                </div>
              </div>
              <div className={`${styles.signalCell} ${styles.gateTile}`}>
                <div className={styles.signalCellHeader}>GATE</div>
                <div className={styles.gateTileBody}>
                  <div className={styles.gateGraphWrap}>
                    <div className={styles.gateGraphGrid}>
                      <svg className={styles.gateGraphSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, i) => {
                          const p = (i / 8) * 100
                          return <line key={`gx-${i}`} x1={p} y1={0} x2={p} y2={100} className={styles.gateGridLine} />
                        })}
                        {Array.from({ length: 9 }, (_, i) => {
                          const p = (i / 8) * 100
                          return <line key={`gy-${i}`} x1={0} y1={p} x2={100} y2={p} className={styles.gateGridLine} />
                        })}
                        {summary.channel.gateEnabled ? (
                          <>
                            <line
                              x1={summary.gateThresholdNorm * 100}
                              y1={100}
                              x2={summary.gateThresholdNorm * 100}
                              y2={(1 - summary.gateThresholdNorm) * 100}
                              className={styles.gateCurveLine}
                            />
                            <line
                              x1={summary.gateThresholdNorm * 100}
                              y1={(1 - summary.gateThresholdNorm) * 100}
                              x2={100}
                              y2={0}
                              className={styles.gateCurveLine}
                            />
                          </>
                        ) : (
                          <line x1={0} y1={100} x2={100} y2={0} className={styles.gateCurveLine} />
                        )}
                      </svg>
                    </div>
                    <div className={styles.gateGraphMeter}>
                      <div
                        className={styles.gateGraphMeterFill}
                        style={{ height: `${Math.round(gateReductionNorm * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.tileLower}>
                    <div className={`${styles.tileBadge} ${summary.channel.gateEnabled ? styles.tileBadgeActive : ''}`}>GATE</div>
                    <div className={styles.tileValueBadge}>
                      {summary.channel.gateEnabled ? summary.channel.gateThreshold.toFixed(1) : 'OFF'}
                    </div>
                    <div className={styles.inKnobWrap}>
                      <div className={styles.displayReadKnob} style={{ '--knob-angle': `${summary.gateAngle}deg` } as CSSProperties}>
                        <div className={styles.displayReadKnobHighlight} />
                        <div className={styles.displayReadKnobPointer} />
                      </div>
                    </div>
                    <div className={styles.tileKnobLabel}>THRESH</div>
                  </div>
                </div>
              </div>
              <div className={`${styles.signalCell} ${styles.eqTile}`}>
                <div className={styles.signalCellHeader}>EQ</div>
                <div className={styles.eqTileBody}>
                  <div className={styles.eqGraphWrap}>
                    <div className={styles.eqGraphGrid}>
                      <svg className={styles.eqGraphSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {eqGraph?.minorX.map((x, i) => (
                          <line key={`eq-minor-x-${i}`} x1={x} y1={0} x2={x} y2={100} className={styles.eqGridMinor} />
                        ))}
                        {eqGraph?.majorX.map((x, i) => (
                          <line key={`eq-major-x-${i}`} x1={x} y1={0} x2={x} y2={100} className={styles.eqGridMajor} />
                        ))}
                        {eqGraph?.minorY.map((y, i) => (
                          <line key={`eq-minor-y-${i}`} x1={0} y1={y} x2={100} y2={y} className={styles.eqGridMinor} />
                        ))}
                        {eqGraph?.majorY.map((y, i) => (
                          <line
                            key={`eq-major-y-${i}`}
                            x1={0}
                            y1={y}
                            x2={100}
                            y2={y}
                            className={Math.abs(y - (eqGraph?.zeroY ?? y)) < 0.001 ? styles.eqGridZero : styles.eqGridMajor}
                          />
                        ))}
                        {eqGraph?.showCurve ? <path d={eqGraph.negAreaPath} className={styles.eqAreaCut} /> : null}
                        {eqGraph?.showCurve ? <path d={eqGraph.posAreaPath} className={styles.eqAreaBoost} /> : null}
                        {eqGraph?.showCurve ? <path d={eqGraph.linePath} className={styles.eqCurveLine} /> : null}
                      </svg>
                    </div>
                  </div>
                  <div className={styles.tileLower}>
                    <div className={`${styles.tileBadge} ${summary.channel.eqEnabled ? styles.tileBadgeActive : ''}`}>EQ</div>
                  </div>
                </div>
              </div>
              <div className={`${styles.signalCell} ${styles.dynTile}`}>
                <div className={styles.signalCellHeader}>DYNAMICS</div>
                <div className={styles.gateTileBody}>
                  <div className={styles.gateGraphWrap}>
                    <div className={styles.gateGraphGrid}>
                      <svg className={styles.gateGraphSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, i) => {
                          const p = (i / 8) * 100
                          return <line key={`dx-${i}`} x1={p} y1={0} x2={p} y2={100} className={styles.gateGridLine} />
                        })}
                        {Array.from({ length: 9 }, (_, i) => {
                          const p = (i / 8) * 100
                          return <line key={`dy-${i}`} x1={0} y1={p} x2={100} y2={p} className={styles.gateGridLine} />
                        })}
                        {summary.channel.compEnabled ? (
                          <>
                            {(() => {
                              const knee = 1 - summary.compThresholdNorm
                              return (
                                <>
                                  <line
                                    x1={0}
                                    y1={100}
                                    x2={knee * 100}
                                    y2={(1 - knee) * 100}
                                    className={styles.gateCurveLine}
                                  />
                                  <line
                                    x1={knee * 100}
                                    y1={(1 - knee) * 100}
                                    x2={100}
                                    y2={(1 - knee) * 100}
                                    className={styles.gateCurveLine}
                                  />
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <line x1={0} y1={100} x2={100} y2={0} className={styles.gateCurveLine} />
                        )}
                      </svg>
                    </div>
                    <div className={styles.dynGraphMeter}>
                      <div
                        className={styles.dynGraphMeterFill}
                        style={{ height: `${Math.round(compReductionNorm * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.tileLower}>
                    <div className={`${styles.tileBadge} ${summary.channel.compEnabled ? styles.tileBadgeActive : ''}`}>COMP</div>
                    <div className={styles.tileValueBadge}>
                      {summary.channel.compEnabled ? summary.channel.compThreshold.toFixed(1) : 'OFF'}
                    </div>
                    <div className={styles.inKnobWrap}>
                      <div className={styles.displayReadKnob} style={{ '--knob-angle': `${summary.compAngle}deg` } as CSSProperties}>
                        <div className={styles.displayReadKnobHighlight} />
                        <div className={styles.displayReadKnobPointer} />
                      </div>
                    </div>
                    <div className={styles.tileKnobLabel}>THRESH</div>
                  </div>
                </div>
              </div>
              <div className={styles.signalCell}>
                <div className={styles.signalCellHeader}>INS</div>
                <div className={styles.signalCellBody} />
              </div>
              <div className={`${styles.signalCell} ${styles.outAutoTile}`}>
                <div className={styles.outAutoTop}>
                  <div className={styles.outTopCol}>
                    <div className={`${styles.signalCellHeader} ${styles.outAutoHeader}`}>OUT</div>
                    <div className={styles.outMeterWrap}>
                      <div
                        className={styles.outFaderTrack}
                        style={{ '--out-fader-pos': `${summary.channel.faderPosition}` } as CSSProperties}
                      >
                        <div className={styles.outFaderThumb} />
                      </div>
                      <div className={styles.outLevelTrack}>
                        {DISPLAY_TILE_METER_THRESHOLDS.map((_, i) => {
                          const rowFromBottom = DISPLAY_TILE_METER_THRESHOLDS.length - 1 - i
                          const isLit = rowFromBottom < outMeterLit
                          const toneClass =
                            i === 0
                              ? styles.outSegClip
                              : (i <= 10 ? styles.outSegWarm : styles.outSegCool)
                          return (
                            <div
                              key={`out-meter-${i}`}
                              className={`${styles.outLevelSeg} ${toneClass} ${isLit ? '' : styles.inLevelSegOff}`}
                            />
                          )
                        })}
                      </div>
                      <div className={styles.outBaseLine} />
                    </div>
                  </div>
                  <div className={styles.autoTopCol}>
                    <div className={`${styles.signalCellHeader} ${styles.outAutoHeader}`}>AUTO</div>
                    <div className={styles.autoTopBody}>
                      <div className={styles.autoBlueMeters}>
                        <div className={styles.autoBlueBar} />
                        <div className={styles.autoBlueBar} />
                      </div>
                      <div className={styles.autoXYButtons}>
                        <div className={styles.autoKey}>X</div>
                        <div className={styles.autoKey}>Y</div>
                      </div>
                      <div className={styles.autoMonoSub}>
                        <div className={`${styles.autoRouteLabel} ${styles.autoMonoLabel}`}>MONO</div>
                        <div className={`${styles.autoRouteLabel} ${styles.autoSubLabel}`}>SUB</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={styles.outAutoBottom}>
                  <div className={`${styles.tileBadge} ${summary.channel.mainLrBus ? styles.tileBadgeActive : ''}`}>LR</div>
                  <div className={styles.tileValueBadge}>{formatPan(summary.channel.pan)}</div>
                  <div className={styles.inKnobWrap}>
                    <div className={styles.displayReadKnob} style={{ '--knob-angle': `${-130 + ((summary.channel.pan + 1) / 2) * 260}deg` } as CSSProperties}>
                      <div className={styles.displayReadKnobHighlight} />
                      <div className={styles.displayReadKnobPointer} />
                    </div>
                  </div>
                  <div className={styles.tileKnobLabel}>PAN</div>
                </div>
              </div>
              <div className={`${styles.signalCell} ${styles.busSendsTile}`}>
                <div className={styles.signalCellHeader}>BUS SENDS</div>
                <div className={styles.busSendsList}>
                  {Array.from({ length: 16 }, (_, i) => {
                    const send = summary.channel.sends[i]
                    const sendLevel = send ? send.level : 0
                    return (
                      <div key={`bus-send-${i + 1}`} className={styles.busSendRow}>
                        <div className={`${styles.busSendLabelChip} ${i >= 8 ? styles.busSendLabelChipAlt : ''}`}>
                          {i + 1}
                        </div>
                        <div className={styles.busSendTrack}>
                          <div
                            className={styles.busSendFill}
                            style={{ width: `${Math.round(Math.max(0, Math.min(1, sendLevel)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.assignRow}>
            <div className={styles.safeCell}>SAFE</div>
            <div className={styles.groupSection}>
              <div className={styles.groupLabel}>DCAs</div>
              <div className={styles.groupNumbers}>
                {Array.from({ length: 8 }, (_, i) => {
                  const id = i + 1
                  const active = summary.channel.dcaGroups.includes(i)
                  return (
                    <div key={`dca-${id}`} className={`${styles.groupNumber} ${active ? styles.groupNumberActive : ''}`}>
                      {id}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={styles.groupSection}>
              <div className={styles.groupLabel}>MUTE GROUPS</div>
              <div className={styles.groupNumbers}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`mute-${i + 1}`} className={styles.groupNumber}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.encoderStrip}>
            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopKnob}`}>
                <div className={styles.encoderKnobWrap}>
                  <div className={styles.displayReadKnob} style={{ '--knob-angle': `${summary.gainAngle}deg` } as CSSProperties}>
                    <div className={styles.displayReadKnobHighlight} />
                    <div className={styles.displayReadKnobPointer} />
                  </div>
                </div>
                <div className={styles.encoderKnobMeta}>
                  <div className={styles.encoderTopLabel}>Gain</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>{formatSigned(summary.channel.gain)}</div>
                    <div className={styles.encoderUnit}>dB</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>LINK</div>
            </div>

            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopKnob}`}>
                <div className={styles.encoderKnobWrap}>
                  <div className={styles.displayReadKnob} style={{ '--knob-angle': `${-130 + ((summary.channel.gateThreshold + 80) / 80) * 260}deg` } as CSSProperties}>
                    <div className={styles.displayReadKnobHighlight} />
                    <div className={styles.displayReadKnobPointer} />
                  </div>
                </div>
                <div className={styles.encoderKnobMeta}>
                  <div className={styles.encoderTopLabel}>Threshold</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>{summary.channel.gateThreshold.toFixed(1)}</div>
                    <div className={styles.encoderUnit}>dB</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>GATE/EXP/DUCK</div>
            </div>

            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopArrow}`}>
                <div className={styles.encoderArrow}>↔</div>
                <div className={styles.encoderArrowMeta}>
                  <div className={styles.encoderTopLabel}>Insert</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>POST</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>INSERT</div>
            </div>

            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopArrow}`}>
                <div className={styles.encoderArrow}>↔</div>
                <div className={styles.encoderArrowMeta}>
                  <div className={styles.encoderTopLabel}>Dynamics</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>POST</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>EQ</div>
            </div>

            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopKnob}`}>
                <div className={styles.encoderKnobWrap}>
                  <div className={styles.displayReadKnob} style={{ '--knob-angle': `${-130 + ((summary.channel.compThreshold + 60) / 60) * 260}deg` } as CSSProperties}>
                    <div className={styles.displayReadKnobHighlight} />
                    <div className={styles.displayReadKnobPointer} />
                  </div>
                </div>
                <div className={styles.encoderKnobMeta}>
                  <div className={styles.encoderTopLabel}>Threshold</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>{summary.channel.compThreshold.toFixed(1)}</div>
                    <div className={styles.encoderUnit}>dB</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>COMP/EXP</div>
            </div>

            <div className={styles.encoderCell}>
              <div className={`${styles.encoderTop} ${styles.encoderTopKnob}`}>
                <div className={styles.encoderKnobWrap}>
                  <div className={styles.displayReadKnob} style={{ '--knob-angle': `${-130 + ((summary.channel.pan + 1) / 2) * 260}deg` } as CSSProperties}>
                    <div className={styles.displayReadKnobHighlight} />
                    <div className={styles.displayReadKnobPointer} />
                  </div>
                </div>
                <div className={styles.encoderKnobMeta}>
                  <div className={styles.encoderTopLabel}>Pan</div>
                  <div className={styles.encoderValueRow}>
                    <div className={styles.encoderValueBox}>{formatPan(summary.channel.pan)}</div>
                  </div>
                </div>
              </div>
              <div className={styles.encoderBottom}>LR</div>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.nonChannelBody}>
          <div className={styles.nonChannelPanel}>
            <div className={styles.sectionTitle}>{summary.kind === 'bus' ? 'BUS CONFIG' : 'DCA CONFIG'}</div>
            <div className={styles.valueList}>
              {summary.leftRows.map((row) => (
                <div key={row.label} className={styles.valueRow}>
                  <span className={styles.valueLabel}>{row.label}</span>
                  <span className={styles.valueValue}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.nonChannelPanel}>
            <div className={styles.sectionTitle}>{summary.kind === 'bus' ? 'CHANNEL FEEDS' : 'ASSIGNED CHANNELS'}</div>
            <div className={styles.sendsList}>
              {(summary.kind === 'bus' ? summary.feeds : summary.members).map((row) => (
                <div key={`${row.label}-${row.idx}`} className={styles.sendRow}>
                  <span className={styles.sendLabel}>{row.label}</span>
                  <div className={styles.sendBar}>
                    <div className={styles.sendFill} style={{ width: `${Math.max(0, Math.min(100, row.level * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
