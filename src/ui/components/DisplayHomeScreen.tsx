import { useMemo } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore, type SelectedFocus } from '@/state/surface-store'
import styles from './DisplayHomeScreen.module.css'

type SelectedTarget =
  | { kind: 'channel'; index: number }
  | { kind: 'bus'; index: number }
  | { kind: 'dca'; index: number }

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

function sourceLabel(source: { type: string }): string {
  switch (source.type) {
    case 'stem':
      return 'STEM'
    case 'tone':
      return 'TONE'
    case 'live':
      return 'LIVE'
    default:
      return 'OFF'
  }
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

export function DisplayHomeScreen() {
  const channels = useMixerStore((s) => s.channels)
  const mixBuses = useMixerStore((s) => s.mixBuses)
  const dcaGroups = useMixerStore((s) => s.dcaGroups)
  const selectedFocus = useSurfaceStore((s) => s.selectedFocus)
  const outputBankLayer = useSurfaceStore((s) => s.outputBankLayer)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)

  const target = getSelectedTarget(selectedFocus, outputBankLayer, selectedOutputIndex, selectedChannel)

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
    const busSends = channel.sends.map((send, idx) => ({ idx, label: `${idx + 1}`, level: send.level }))
    return {
      kind: 'channel' as const,
      headerId: `CH${target.index + 1}`,
      headerLabel: channel.label || `Channel ${target.index + 1}`,
      channel,
      busSends,
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
      <div className={styles.statusBar}>
        <div className={styles.leftStatus}>
          <span className={styles.headerId}>{summary.headerId}</span>
          <span className={styles.headerLabel}>{summary.headerLabel}</span>
        </div>
        <div className={styles.centerStatus}>HOME</div>
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

      {summary.kind === 'channel' ? (
        <>
          <div className={styles.body}>
            <div className={styles.channelGrid}>
              <div className={`${styles.tile} ${styles.tileIn}`}>
                <div className={styles.tileTitle}>IN</div>
                <div className={styles.inRows}>
                  <div className={styles.inRow}><span>SOURCE</span><span>{sourceLabel(summary.channel.inputSource)}</span></div>
                  <div className={styles.inRow}><span>+48V</span><span>{summary.channel.inputType === 'mic' ? 'ON' : 'OFF'}</span></div>
                  <div className={styles.inRow}><span>INVERT</span><span>OFF</span></div>
                  <div className={styles.inRow}><span>DELAY</span><span>0.3 ms</span></div>
                  <div className={styles.inRow}><span>LOCUT</span><span>{summary.channel.hpfEnabled ? `${Math.round(summary.channel.hpfFreq)} Hz` : 'OFF'}</span></div>
                </div>
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>LINK</div>
                  <div className={styles.value}>{formatDb(summary.channel.gain)}</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tile}>
                <div className={styles.tileTitle}>GATE</div>
                <div className={`${styles.graph} ${styles.graphGate}`} />
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>GATE</div>
                  <div className={styles.value}>{summary.channel.gateEnabled ? summary.channel.gateThreshold.toFixed(1) : 'OFF'}</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tileNarrow}>
                <div className={styles.tileTitle}>INS</div>
                <div className={styles.insertFlow}>
                  <div className={styles.flowNode}>PRE</div>
                  <div className={styles.flowNode}>INS</div>
                  <div className={`${styles.flowNode} ${styles.activeNode}`}>POST</div>
                </div>
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>INS</div>
                  <div className={styles.value}>POST</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tile}>
                <div className={styles.tileTitle}>EQ</div>
                <div className={`${styles.graph} ${styles.graphEq}`} />
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>EQ</div>
                  <div className={styles.value}>{summary.channel.eqEnabled ? 'ON' : 'OFF'}</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tile}>
                <div className={styles.tileTitle}>DYNAMICS</div>
                <div className={`${styles.graph} ${styles.graphDyn}`} />
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>COMP</div>
                  <div className={styles.value}>{summary.channel.compEnabled ? summary.channel.compThreshold.toFixed(1) : 'OFF'}</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tileOut}>
                <div className={styles.tileTitle}>OUT</div>
                <div className={styles.outRows}>
                  <div className={styles.outRow}><span>MONO</span><span>OFF</span></div>
                  <div className={styles.outRow}><span>MUTE</span><span>{summary.channel.mute ? 'ON' : 'OFF'}</span></div>
                </div>
                <div className={styles.tileFooter}>
                  <div className={styles.badge}>LR</div>
                  <div className={styles.value}>{formatPan(summary.channel.pan)}</div>
                  <div className={styles.knob} />
                </div>
              </div>

              <div className={styles.tileAuto}>
                <div className={styles.tileTitle}>AUTO</div>
                <div className={styles.autoRows}>
                  <div className={styles.autoKey}>X</div>
                  <div className={styles.autoKey}>Y</div>
                  <div className={styles.autoKey}>MONO</div>
                  <div className={styles.autoKey}>SUB</div>
                </div>
              </div>
            </div>

            <div className={styles.busSendsTile}>
              <div className={styles.tileTitle}>BUS SENDS</div>
              <div className={styles.busSendsList}>
                {summary.busSends.map((row) => (
                  <div key={row.idx} className={styles.busSendRow}>
                    <span className={styles.busSendLabel}>{row.label}</span>
                    <div className={styles.sendBar}>
                      <div className={styles.sendFill} style={{ width: `${Math.max(0, Math.min(100, row.level * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.encoderStrip}>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[0]}</div><div className={styles.encoderLabel}>Gain</div><div className={styles.encoderSub}>LINK</div></div>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[1]}</div><div className={styles.encoderLabel}>Threshold</div><div className={styles.encoderSub}>GATE/EXP/DUCK</div></div>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[2]}</div><div className={styles.encoderLabel}>Insert</div><div className={styles.encoderSub}>INSERT</div></div>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[3]}</div><div className={styles.encoderLabel}>Dynamics</div><div className={styles.encoderSub}>EQ</div></div>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[4]}</div><div className={styles.encoderLabel}>Threshold</div><div className={styles.encoderSub}>COMP/EXP</div></div>
            <div className={styles.encoderCell}><div className={styles.encoderValue}>{summary.encoderValues[5]}</div><div className={styles.encoderLabel}>Pan</div><div className={styles.encoderSub}>LR</div></div>
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
