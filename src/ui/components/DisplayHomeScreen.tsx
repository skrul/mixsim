import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { GAIN_MAX, GAIN_MIN, useMixerStore } from '@/state/mixer-store'
import { meterLevels } from '@/audio/metering'
import { useSurfaceStore, type SelectedFocus } from '@/state/surface-store'
import styles from './DisplayHomeScreen.module.css'

type SelectedTarget =
  | { kind: 'channel'; index: number }
  | { kind: 'bus'; index: number }
  | { kind: 'dca'; index: number }

const IN_METER_THRESHOLDS = [-60, -48, -36, -27, -21, -18, -15, -12, -9, -6, -3, 0]

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
  const inMeterDbRef = useRef(-Infinity)
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
      for (let i = 0; i < IN_METER_THRESHOLDS.length; i++) {
        if (nextDb >= IN_METER_THRESHOLDS[i]) lit++
      }
      setInMeterLit((prev) => (prev === lit ? prev : lit))
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
    return {
      kind: 'channel' as const,
      headerId: `CH${target.index + 1}`,
      headerLabel: channel.label || `Channel ${target.index + 1}`,
      channel,
      gainAngle,
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
                        {IN_METER_THRESHOLDS.map((_, i) => {
                          const rowFromBottom = IN_METER_THRESHOLDS.length - 1 - i
                          const isLit = rowFromBottom < inMeterLit
                          const toneClass =
                            i === 0
                              ? styles.inSegClip
                              : (i < 4 ? styles.inSegWarm : styles.inSegCool)
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
                      <div className={`${styles.inFlagRow} ${styles.inFlagOff}`}>
                        <span className={styles.inFlagGlyph}>⚡</span>
                        <span className={styles.inFlagLabel}>48V</span>
                      </div>
                      <div className={`${styles.inFlagRow} ${styles.inFlagOff}`}>
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
                  <div className={styles.inTileLower}>
                    <div className={`${styles.inBadge} ${styles.inBadgeOff}`}>LINK</div>
                    <div className={styles.inValueBadge}>
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
                    <div className={styles.inKnobLabel}>GAIN</div>
                  </div>
                </div>
              </div>
              {['GATE', 'EQ', 'DYNAMICS', 'INS', 'OUT', 'AUTO', 'BUS SENDS'].map((label) => (
                <div key={label} className={styles.signalCell}>
                  <div className={styles.signalCellHeader}>{label}</div>
                  <div className={styles.signalCellBody} />
                </div>
              ))}
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
