import { useEffect, useMemo, useState } from 'react'
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

export function DisplayHomeScreen() {
  const channels = useMixerStore((s) => s.channels)
  const mixBuses = useMixerStore((s) => s.mixBuses)
  const dcaGroups = useMixerStore((s) => s.dcaGroups)
  const selectedFocus = useSurfaceStore((s) => s.selectedFocus)
  const outputBankLayer = useSurfaceStore((s) => s.outputBankLayer)
  const selectedOutputIndex = useSurfaceStore((s) => s.selectedOutputIndex)
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const [clockText, setClockText] = useState({ hm: '12:00', sec: '00', ampm: 'AM' })

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
    return {
      kind: 'channel' as const,
      headerId: `CH${target.index + 1}`,
      headerLabel: channel.label || `Channel ${target.index + 1}`,
      channel,
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
              {['IN', 'GATE', 'EQ', 'DYNAMICS', 'INS', 'OUT', 'AUTO', 'BUS SENDS'].map((label) => (
                <div key={label} className={styles.signalCell}>
                  <div className={styles.signalCellHeader}>{label}</div>
                  <div className={styles.signalCellBody} />
                </div>
              ))}
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
