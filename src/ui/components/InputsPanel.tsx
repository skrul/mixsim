import React, { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_INPUT_CHANNELS, NUM_AUX_CHANNELS, NUM_TONE_SLOTS, type ChannelInputSource } from '@/state/mixer-model'
import { getToneLabel } from '@/audio/source-manager'
import { saveSessionSnapshotToLocalStorage } from '@/state/session-persistence'
import styles from './InputsPanel.module.css'

const NUM_ROWS = 16
const AUX_ROW_LABELS = ['Aux 1', 'Aux 2', 'Aux 3', 'Aux 4', 'Aux 5', 'Aux 6', 'USB L', 'USB R']

interface PopupRect {
  x: number
  y: number
  width: number
  height: number
}

interface PopupInteraction {
  type: 'drag' | 'resize'
  startX: number
  startY: number
  startRect: PopupRect
}

function sourceToValue(source: ChannelInputSource): string {
  switch (source.type) {
    case 'track': return source.channel ? `track:${source.trackIndex}:${source.channel}` : `track:${source.trackIndex}`
    case 'tone': return `tone:${source.toneIndex}`
    case 'live': return `live:${source.deviceId}`
    case 'device': return `device:${source.channel}`
    case 'none': return 'none'
  }
}

function valueToSource(value: string): ChannelInputSource {
  if (value === 'none') return { type: 'none' }
  const [type, indexStr, chan] = value.split(':')
  switch (type) {
    case 'track': return { type: 'track', trackIndex: parseInt(indexStr, 10), ...(chan ? { channel: chan as 'left' | 'right' } : {}) }
    case 'tone': return { type: 'tone', toneIndex: parseInt(indexStr, 10) }
    case 'live': return { type: 'live', deviceId: value.slice(5) }
    case 'device': return { type: 'device', channel: indexStr as 'left' | 'right' }
    default: return { type: 'none' }
  }
}

function truncateLabel(label: string, max = 30): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

interface InputsPanelProps {
  compact?: boolean
}

export function InputsPanel({ compact: _compact }: InputsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [popupRect, setPopupRect] = useState<PopupRect>({
    x: 72,
    y: 72,
    width: 360,
    height: 520,
  })
  const interactionRef = useRef<PopupInteraction | null>(null)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const channels = useMixerStore((s) => s.channels)
  const availableTracks = useMixerStore((s) => s.availableTracks)
  const availableLiveDevices = useMixerStore((s) => s.availableLiveDevices)
  const setChannelInputSource = useMixerStore((s) => s.setChannelInputSource)

  // Drag/resize handling
  useEffect(() => {
    if (!isOpen) return

    const onMouseMove = (e: MouseEvent) => {
      const interaction = interactionRef.current
      if (!interaction) return
      e.preventDefault()

      const dx = e.clientX - interaction.startX
      const dy = e.clientY - interaction.startY

      if (interaction.type === 'drag') {
        const nextX = Math.max(8, Math.min(window.innerWidth - interaction.startRect.width - 8, interaction.startRect.x + dx))
        const nextY = Math.max(8, Math.min(window.innerHeight - interaction.startRect.height - 8, interaction.startRect.y + dy))
        setPopupRect((prev) =>
          prev.x === nextX && prev.y === nextY ? prev : { ...prev, x: nextX, y: nextY }
        )
      } else {
        const nextWidth = Math.max(280, Math.min(window.innerWidth - interaction.startRect.x - 8, interaction.startRect.width + dx))
        const nextHeight = Math.max(200, Math.min(window.innerHeight - interaction.startRect.y - 8, interaction.startRect.height + dy))
        setPopupRect((prev) =>
          prev.width === nextWidth && prev.height === nextHeight ? prev : { ...prev, width: nextWidth, height: nextHeight }
        )
      }
    }

    const onMouseUp = () => {
      interactionRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isOpen])

  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    interactionRef.current = {
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      startRect: popupRect,
    }
  }

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    interactionRef.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startRect: popupRect,
    }
  }

  const handleSourceChange = (channelId: number, value: string) => {
    setChannelInputSource(channelId, valueToSource(value))
    saveSessionSnapshotToLocalStorage()
  }

  const handleResetAll = () => {
    for (let i = 0; i < NUM_ROWS; i++) {
      const ch = channels[i]
      if (ch && ch.inputSource.type !== 'none') {
        setChannelInputSource(ch.id, { type: 'none' })
      }
    }
    for (let i = 0; i < NUM_AUX_CHANNELS; i++) {
      const ch = channels[NUM_INPUT_CHANNELS + i]
      if (ch && ch.inputSource.type !== 'none') {
        setChannelInputSource(ch.id, { type: 'none' })
      }
    }
    saveSessionSnapshotToLocalStorage()
  }

  const renderSourceRow = (key: string, label: string, ch: typeof channels[number]) => (
    <div key={key} className={styles.inputRow}>
      <span className={styles.channelLabel}>{label}</span>
      <select
        className={styles.inputSelect}
        value={sourceToValue(ch.inputSource)}
        onChange={(e) => handleSourceChange(ch.id, e.target.value)}
      >
        <option value="none">None</option>
        {availableTracks.length > 0 && (() => {
          const songGroups: { title: string; tracks: typeof availableTracks }[] = []
          for (const t of availableTracks) {
            const last = songGroups[songGroups.length - 1]
            if (last && last.title === t.songTitle) {
              last.tracks.push(t)
            } else {
              songGroups.push({ title: t.songTitle, tracks: [t] })
            }
          }
          return (
            <optgroup label="Tracks">
              {songGroups.map((group) => (
                <>
                  <option key={`song-header:${group.title}`} disabled>
                    {'— ' + group.title}
                  </option>
                  {group.tracks.map((t) =>
                    t.stereo ? (
                      <React.Fragment key={`track:${t.index}`}>
                        <option value={`track:${t.index}:left`}>
                          {'  ' + truncateLabel(t.label) + ' L'}
                        </option>
                        <option value={`track:${t.index}:right`}>
                          {'  ' + truncateLabel(t.label) + ' R'}
                        </option>
                      </React.Fragment>
                    ) : (
                      <option key={`track:${t.index}`} value={`track:${t.index}`}>
                        {'  ' + truncateLabel(t.label)}
                      </option>
                    )
                  )}
                </>
              ))}
            </optgroup>
          )
        })()}
        <optgroup label="Player">
          <option value="device:left">Player L</option>
          <option value="device:right">Player R</option>
        </optgroup>
        <optgroup label="Tones">
          {Array.from({ length: NUM_TONE_SLOTS }, (_, j) => (
            <option key={`tone:${j}`} value={`tone:${j}`}>
              {getToneLabel(j)}
            </option>
          ))}
        </optgroup>
        {availableLiveDevices.length > 0 && (
          <optgroup label="Hardware">
            {availableLiveDevices.map((d) => (
              <option key={`live:${d.deviceId}`} value={`live:${d.deviceId}`}>
                {truncateLabel(d.label)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )

  return (
    <>
      <button
        className={`${styles.inputsButton} ${isOpen ? styles.inputsButtonActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setHelpText('Open the input assignment panel to route tracks, tones, or hardware inputs to channels.')}
        onMouseLeave={() => setHelpText('')}
      >
        Inputs
      </button>

      {isOpen && (
        <div
          className={styles.popupWindow}
          style={{
            left: `${popupRect.x}px`,
            top: `${popupRect.y}px`,
            width: `${popupRect.width}px`,
            height: `${popupRect.height}px`,
          }}
        >
          <div className={styles.popupHeader} onMouseDown={startDrag}>
            <div className={styles.popupTitle}>Inputs</div>
            <div className={styles.popupHeaderButtons}>
              <button
                className={styles.popupClose}
                onClick={handleResetAll}
              >
                Reset All
              </button>
              <button
                className={styles.popupClose}
                onClick={() => {
                  setIsOpen(false)
                  interactionRef.current = null
                }}
              >
                Close
              </button>
            </div>
          </div>
          <div className={styles.popupBody}>
            {Array.from({ length: NUM_ROWS }, (_, i) => {
              const ch = channels[i]
              if (!ch) return null
              return renderSourceRow(`ch-${i}`, `CH ${i + 1}`, ch)
            })}
            <div className={styles.sectionDivider}>Aux In / USB</div>
            {Array.from({ length: NUM_AUX_CHANNELS }, (_, i) => {
              const ch = channels[NUM_INPUT_CHANNELS + i]
              if (!ch) return null
              return renderSourceRow(`aux-${i}`, AUX_ROW_LABELS[i], ch)
            })}
          </div>
          <div className={styles.popupResizeHandle} onMouseDown={startResize} />
        </div>
      )}
    </>
  )
}
