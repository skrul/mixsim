import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { exportSessionSnapshot, importSessionSnapshot } from '@/state/session-persistence'
import { InputsPanel } from './InputsPanel'
import styles from './TransportBar.module.css'

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
  const availableTracks = useMixerStore((s) => s.availableTracks)
  const playbackDevice = useMixerStore((s) => s.playbackDevice)
  const setPlaybackDeviceTrack = useMixerStore((s) => s.setPlaybackDeviceTrack)
  const playbackDeviceToggle = useMixerStore((s) => s.playbackDeviceToggle)
  const playbackDeviceStop = useMixerStore((s) => s.playbackDeviceStop)
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const tracksLoaded = useMixerStore((s) => s.tracksLoaded)
  const songSnapshots = useMixerStore((s) => s.songSnapshots)
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

  const handleLoadSong = async (snapshotUrl: string) => {
    try {
      const response = await fetch(snapshotUrl, { cache: 'no-store' })
      if (!response.ok) {
        setHelpText('Snapshot file not found.')
        return
      }
      const raw = await response.text()
      activateDemoSnapshot(raw)
    } catch {
      setHelpText('Failed to load song snapshot.')
    }
  }

  return (
    <div className={compact ? styles.compactWrapper : `${styles.transportBar}`}>
      {compact ? (
        <>
          <div className={styles.compact}>
            <div className={styles.compactHeader}>TOOLS</div>
            <div className={styles.compactGrid}>
              <InputsPanel compact />
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
            {songSnapshots.length > 0 && (
              <select
                className={styles.loadSongSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) handleLoadSong(e.target.value)
                  e.target.value = ''
                }}
                onMouseEnter={() => setHelpText('Load a preconfigured mix for a song and enter demo mode.')}
                onMouseLeave={() => setHelpText('')}
              >
                <option value="" disabled>Load Song…</option>
                {songSnapshots.map((s) => (
                  <option key={s.title} value={s.snapshotUrl}>{s.title}</option>
                ))}
              </select>
            )}
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
          </div>
          <div className={styles.compact}>
            <div className={styles.compactHeader}>PLAYER</div>
            <select
              className={styles.playerSelect}
              value={playbackDevice.trackIndex ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  playbackDeviceStop()
                  setPlaybackDeviceTrack(null)
                } else {
                  setPlaybackDeviceTrack(parseInt(val, 10))
                }
              }}
            >
              <option value="">Select track...</option>
              {(() => {
                const songGroups: { title: string; tracks: typeof availableTracks }[] = []
                for (const t of availableTracks) {
                  const last = songGroups[songGroups.length - 1]
                  if (last && last.title === t.songTitle) {
                    last.tracks.push(t)
                  } else {
                    songGroups.push({ title: t.songTitle, tracks: [t] })
                  }
                }
                return songGroups.map((group) => (
                  <optgroup key={group.title} label={group.title}>
                    {group.tracks.map((t) => (
                      <option key={t.index} value={t.index}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
            <button
              className={`${styles.transportToggleButton} ${!playbackDevice.playing ? styles.playButton : ''}`}
              disabled={playbackDevice.trackIndex === null}
              onClick={playbackDeviceToggle}
              onMouseEnter={() => setHelpText('Start or stop the aux player. Independent from the main transport.')}
              onMouseLeave={() => setHelpText('')}
            >
              {playbackDevice.playing ? '⏹ Stop' : '▶ Play'}
            </button>
          </div>
        </>
      ) : (
        <>
          <InputsPanel />
          {songSnapshots.length > 0 && (
            <select
              className={styles.loadSongSelect}
              value=""
              onChange={(e) => {
                if (e.target.value) handleLoadSong(e.target.value)
                e.target.value = ''
              }}
              onMouseEnter={() => setHelpText('Load a preconfigured mix for a song and enter demo mode.')}
              onMouseLeave={() => setHelpText('')}
            >
              <option value="" disabled>Load Song…</option>
              {songSnapshots.map((s) => (
                <option key={s.title} value={s.snapshotUrl}>{s.title}</option>
              ))}
            </select>
          )}
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
