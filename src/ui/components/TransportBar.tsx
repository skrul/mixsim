import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { exportSessionSnapshot, importSessionSnapshot } from '@/state/session-persistence'
import { InputsPanel } from './InputsPanel'
import styles from './TransportBar.module.css'

const DEMO_SNAPSHOT_URL = '/demo-session.json'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface TransportBarProps {
  compact?: boolean
}

export function TransportBar({ compact = false }: TransportBarProps) {
  const resetSurfaceState = useSurfaceStore((s) => s.resetSurfaceState)
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const tracksLoaded = useMixerStore((s) => s.tracksLoaded)
  const resetBoard = useMixerStore((s) => s.resetBoard)
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const setCurrentTime = useMixerStore((s) => s.setCurrentTime)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const setSourceMode = useSurfaceStore((s) => s.setSourceMode)
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

  return (
    <div className={`${styles.transportBar} ${compact ? styles.compact : ''}`}>
      {compact ? (
        <>
          <div className={styles.compactHeader}>TOOLS</div>
          <div className={styles.compactGrid}>
            <InputsPanel compact />
            <button
              className={`${styles.sourceModeButton} ${useSurfaceStore.getState().sourceMode === 'demo' ? styles.sourceModeButtonActive : ''}`}
              onClick={handleDemoClick}
              onMouseEnter={() => setHelpText('Load the preconfigured demo mix and start playback.')}
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
              disabled={!tracksLoaded}
              className={`${styles.transportToggleButton} ${transportState !== 'playing' ? styles.playButton : ''}`}
              onMouseEnter={() => setHelpText("Start or pause playback of track-assigned channels.")}
              onMouseLeave={() => setHelpText('')}
            >
              {transportState === 'playing' ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>
          <div
            className={styles.seekRow}
            onMouseEnter={() => setHelpText('Drag to scrub through the loaded tracks.')}
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
              disabled={!tracksLoaded || duration <= 0}
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
          <InputsPanel />
          <button
            className={`${styles.sourceModeButton} ${useSurfaceStore.getState().sourceMode === 'demo' ? styles.sourceModeButtonActive : ''}`}
            onClick={handleDemoClick}
            onMouseEnter={() => setHelpText('Load the preconfigured demo mix and start playback.')}
            onMouseLeave={() => setHelpText('')}
          >
            Demo
          </button>
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
          <div className={styles.separator} />
          <button
            onClick={transportState === 'playing' ? stop : play}
            disabled={!tracksLoaded}
            className={`${styles.transportToggleButton} ${transportState !== 'playing' ? styles.playButton : ''}`}
            onMouseEnter={() => setHelpText("Start or pause playback of track-assigned channels.")}
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
