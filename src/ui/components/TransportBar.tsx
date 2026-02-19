import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_TONE_SLOTS, type ChannelInputSource } from '@/state/mixer-model'
import { getToneLabel } from '@/audio/source-manager'
import { exportSessionSnapshot, importSessionSnapshot } from '@/state/session-persistence'
import { markCustomModeFromManualInputChange, resetSourceModeDefaults, saveCurrentSnapshotForMode, switchSourceMode } from '@/state/source-profiles'
import styles from './TransportBar.module.css'

const DEMO_SNAPSHOT_URL = '/demo-session.json'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function truncateLabel(label: string, max = 26): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

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

interface TransportBarProps {
  compact?: boolean
}

export function TransportBar({ compact = false }: TransportBarProps) {
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const resetSurfaceState = useSurfaceStore((s) => s.resetSurfaceState)
  const selectedChannelState = useMixerStore((s) => s.channels[selectedChannel])
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const stemsLoaded = useMixerStore((s) => s.stemsLoaded)
  const availableStems = useMixerStore((s) => s.availableStems)
  const availableLiveDevices = useMixerStore((s) => s.availableLiveDevices)
  const setChannelInputSource = useMixerStore((s) => s.setChannelInputSource)
  const resetBoard = useMixerStore((s) => s.resetBoard)
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const setCurrentTime = useMixerStore((s) => s.setCurrentTime)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const setSourceMode = useSurfaceStore((s) => s.setSourceMode)
  const sourceMode = useSurfaceStore((s) => s.sourceMode)
  const sessionFileInputRef = useRef<HTMLInputElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)

  useEffect(() => {
    if (!isScrubbing) {
      setScrubTime(currentTime)
    }
  }, [currentTime, isScrubbing])

  const handleZeroBoard = () => {
    resetBoard()
    resetSurfaceState()
    setHelpText('Board reset to zero/default state.')
  }

  const saveSession = () => {
    const result = exportSessionSnapshot()
    if (!result.ok) {
      setHelpText(result.error)
      return
    }

    const blob = new Blob([result.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.fileName
    link.click()
    URL.revokeObjectURL(url)
    setHelpText('Session file saved.')
  }

  const loadSession = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = importSessionSnapshot(await file.text())
    setHelpText(result.ok ? 'Session loaded.' : result.error)
  }

  const handleSeekInput = (event: FormEvent<HTMLInputElement>) => {
    if (duration <= 0) return
    const value = Number(event.currentTarget.value)
    const next = Math.max(0, Math.min(duration, Number.isFinite(value) ? value : 0))
    setScrubTime(next)
  }

  const commitSeek = (raw: string) => {
    if (duration <= 0) return
    const value = Number(raw)
    const next = Math.max(0, Math.min(duration, Number.isFinite(value) ? value : 0))
    setCurrentTime(next)
  }

  const handleManualInputSourceChange = (value: string) => {
    if (sourceMode !== 'custom') {
      markCustomModeFromManualInputChange()
    }
    setChannelInputSource(selectedChannel, valueToSource(value))
    saveCurrentSnapshotForMode('custom')
  }

  const handleSwitchSourceMode = (mode: 'stems' | 'tones' | 'custom') => {
    switchSourceMode(mode)
    setHelpText(`Switched source mode to ${mode}.`)
  }

  const activateDemoSnapshot = (raw: string): boolean => {
    const result = importSessionSnapshot(raw)
    if (!result.ok) {
      setHelpText(result.error)
      return false
    }
    setSourceMode('demo')
    setHelpText('Demo mix loaded. Demo mode changes are not auto-saved.')
    return true
  }

  const handleDemoClick = async () => {
    try {
      const response = await fetch(DEMO_SNAPSHOT_URL, { cache: 'no-store' })
      if (!response.ok) {
        setHelpText('Demo file not found. Add /public/demo-session.json to the repo.')
        return
      }
      const raw = await response.text()
      activateDemoSnapshot(raw)
    } catch {
      setHelpText('Failed to load demo-session.json.')
    }
  }

  const handleResetModeDefaults = () => {
    if (sourceMode === 'demo') {
      setHelpText('Demo mode uses the loaded demo file. Load Demo again or switch to stems/tones/custom.')
      return
    }
    resetSourceModeDefaults(sourceMode)
    setHelpText(`Reset ${sourceMode} mode to defaults.`)
  }

  return (
    <div className={`${styles.transportBar} ${compact ? styles.compact : ''}`}>
      {compact ? (
        <>
          <div className={styles.compactHeader}>TOOLS</div>
          {selectedChannelState && (
            <div className={styles.inputPicker}>
              <div className={styles.inputPickerLabel}>CH {selectedChannel + 1} INPUT</div>
              <select
                className={styles.inputSelect}
                value={sourceToValue(selectedChannelState.inputSource)}
                onChange={(e) => handleManualInputSourceChange(e.target.value)}
                onMouseEnter={() => setHelpText('Choose the source for the selected input channel: stems, tones, live device, or none.')}
                onMouseLeave={() => setHelpText('')}
              >
                <option value="none">None</option>
                {availableStems.length > 0 && (
                  <optgroup label="Stems">
                    {availableStems.map((s) => (
                      <option key={`stem:${s.index}`} value={`stem:${s.index}`}>
                        {truncateLabel(s.label)}
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
                        {truncateLabel(d.label)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
          <div className={styles.compactGrid}>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'stems' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('stems')}
              onMouseEnter={() => setHelpText('Set all channels to their default stem inputs from the loaded audio files.')}
              onMouseLeave={() => setHelpText('')}
            >
              Stems
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'tones' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('tones')}
              onMouseEnter={() => setHelpText('Set all channels to test tones — sine waves, sawtooth, square, triangle, and noise. Great for learning what each control does.')}
              onMouseLeave={() => setHelpText('')}
            >
              Tones
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'custom' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('custom')}
              onMouseEnter={() => setHelpText('Use your own custom input assignments and mix settings.')}
              onMouseLeave={() => setHelpText('')}
            >
              Custom
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'demo' ? styles.sourceModeButtonActive : ''}`}
              onClick={handleDemoClick}
              onMouseEnter={() => setHelpText('Load the preconfigured demo mix (cached from a saved session file) and start playback.')}
              onMouseLeave={() => setHelpText('')}
            >
              Demo
            </button>
            <button
              className={styles.sessionButton}
              onClick={saveSession}
              onMouseEnter={() => setHelpText('Save the full mixer + control surface state to a JSON file.')}
              onMouseLeave={() => setHelpText('')}
            >
              Save File
            </button>
            <button
              className={styles.sessionButton}
              onClick={handleResetModeDefaults}
              onMouseEnter={() => setHelpText('Reset the active source mode to its default input mapping and a zeroed board.')}
              onMouseLeave={() => setHelpText('')}
            >
              Reset Mode
            </button>
            <button
              className={styles.sessionButton}
              onClick={() => sessionFileInputRef.current?.click()}
              onMouseEnter={() => setHelpText('Load mixer + control surface state from a saved JSON file.')}
              onMouseLeave={() => setHelpText('')}
            >
              Load File
            </button>
            <button
              className={styles.dangerButton}
              onClick={handleZeroBoard}
              onMouseEnter={() => setHelpText('Reset the mixer and control surface to default zero state.')}
              onMouseLeave={() => setHelpText('')}
            >
              Zero Board
            </button>
            <button
              onClick={transportState === 'playing' ? stop : play}
              disabled={!stemsLoaded}
              className={`${styles.transportToggleButton} ${transportState !== 'playing' ? styles.playButton : ''}`}
              onMouseEnter={() => setHelpText("Start or pause playback of stem-assigned channels. Only channels set to a stem input will be affected.")}
              onMouseLeave={() => setHelpText('')}
            >
              {transportState === 'playing' ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>
          <div
            className={styles.seekRow}
            onMouseEnter={() => setHelpText('Drag to scrub through the loaded stems.')}
            onMouseLeave={() => setHelpText('')}
          >
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.001)}
              step={0.01}
              value={Math.max(0, Math.min(isScrubbing ? scrubTime : currentTime, duration || 0))}
              onChange={(e) => {
                if (!isScrubbing) commitSeek(e.target.value)
              }}
              onInput={handleSeekInput}
              onPointerDown={() => setIsScrubbing(true)}
              onPointerUp={(e) => {
                setIsScrubbing(false)
                commitSeek(e.currentTarget.value)
              }}
              onPointerCancel={(e) => {
                setIsScrubbing(false)
                commitSeek(e.currentTarget.value)
              }}
              disabled={!stemsLoaded || duration <= 0}
              className={styles.seekBar}
              aria-label="Playback position"
            />
          </div>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </>
      ) : (
        <>
          <div className={styles.sourceModeButtons}>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'stems' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('stems')}
              onMouseEnter={() => setHelpText('Set all channels to their default stem inputs from the loaded audio files.')}
              onMouseLeave={() => setHelpText('')}
            >
              Stems
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'tones' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('tones')}
              onMouseEnter={() => setHelpText('Set all channels to test tones — sine waves, sawtooth, square, triangle, and noise. Great for learning what each control does.')}
              onMouseLeave={() => setHelpText('')}
            >
              Tones
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'custom' ? styles.sourceModeButtonActive : ''}`}
              onClick={() => handleSwitchSourceMode('custom')}
              onMouseEnter={() => setHelpText('Use your own custom input assignments and mix settings.')}
              onMouseLeave={() => setHelpText('')}
            >
              Custom
            </button>
            <button
              className={`${styles.sourceModeButton} ${sourceMode === 'demo' ? styles.sourceModeButtonActive : ''}`}
              onClick={handleDemoClick}
              onMouseEnter={() => setHelpText('Load the preconfigured demo mix (cached from a saved session file) and start playback.')}
              onMouseLeave={() => setHelpText('')}
            >
              Demo
            </button>
          </div>
          <div className={styles.separator} />
          <button
            className={styles.sessionButton}
            onClick={saveSession}
            onMouseEnter={() => setHelpText('Save the full mixer + control surface state to a JSON file.')}
            onMouseLeave={() => setHelpText('')}
          >
            Save File
          </button>
          <button
            className={styles.sessionButton}
            onClick={handleResetModeDefaults}
            onMouseEnter={() => setHelpText('Reset the active source mode to its default input mapping and a zeroed board.')}
            onMouseLeave={() => setHelpText('')}
          >
            Reset Mode
          </button>
          <button
            className={styles.sessionButton}
            onClick={() => sessionFileInputRef.current?.click()}
            onMouseEnter={() => setHelpText('Load mixer + control surface state from a saved JSON file.')}
            onMouseLeave={() => setHelpText('')}
          >
            Load File
          </button>
          <div className={styles.separator} />
          <button
            onClick={transportState === 'playing' ? stop : play}
            disabled={!stemsLoaded}
            className={`${styles.transportToggleButton} ${transportState !== 'playing' ? styles.playButton : ''}`}
            onMouseEnter={() => setHelpText("Start or pause playback of stem-assigned channels. Only channels set to a stem input will be affected.")}
            onMouseLeave={() => setHelpText('')}
          >
            {transportState === 'playing' ? '⏸ Pause' : '▶ Play'}
          </button>
          <span className={styles.title}>MixSim</span>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </>
      )}
      <input ref={sessionFileInputRef} type="file" accept=".json,application/json" className={styles.hiddenFileInput} onChange={loadSession} />
    </div>
  )
}
