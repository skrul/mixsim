import { useRef, type ChangeEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { exportSessionSnapshot, importSessionSnapshot } from '@/state/session-persistence'
import styles from './TransportBar.module.css'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TransportBar() {
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const stemsLoaded = useMixerStore((s) => s.stemsLoaded)
  const applyPresetStems = useMixerStore((s) => s.applyPresetStems)
  const applyPresetTones = useMixerStore((s) => s.applyPresetTones)
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const rewind = useMixerStore((s) => s.rewind)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const sessionFileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className={styles.transportBar}>
      <div className={styles.sourceModeButtons}>
        <button
          className={styles.sourceModeButton}
          onClick={applyPresetStems}
          onMouseEnter={() => setHelpText('Set all channels to their default stem inputs from the loaded audio files.')}
          onMouseLeave={() => setHelpText('')}
        >
          Stems
        </button>
        <button
          className={styles.sourceModeButton}
          onClick={applyPresetTones}
          onMouseEnter={() => setHelpText('Set all channels to test tones — sine waves, sawtooth, square, triangle, and noise. Great for learning what each control does.')}
          onMouseLeave={() => setHelpText('')}
        >
          Tones
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
        onClick={() => sessionFileInputRef.current?.click()}
        onMouseEnter={() => setHelpText('Load mixer + control surface state from a saved JSON file.')}
        onMouseLeave={() => setHelpText('')}
      >
        Load File
      </button>
      <input ref={sessionFileInputRef} type="file" accept=".json,application/json" className={styles.hiddenFileInput} onChange={loadSession} />
      <div className={styles.separator} />
      <button
        onClick={rewind}
        disabled={!stemsLoaded}
        onMouseEnter={() => setHelpText("Return playback to the beginning of the track.")}
        onMouseLeave={() => setHelpText('')}
      >
        ⏮ Rewind
      </button>
      <button
        onClick={transportState === 'playing' ? stop : play}
        disabled={!stemsLoaded}
        className={transportState !== 'playing' ? styles.playButton : undefined}
        onMouseEnter={() => setHelpText("Start or stop playback of stem-assigned channels. Only channels set to a stem input will be affected.")}
        onMouseLeave={() => setHelpText('')}
      >
        {transportState === 'playing' ? '⏹ Stop' : '▶ Play'}
      </button>
      <span className={styles.title}>MixSim</span>
      <div className={styles.timeDisplay}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  )
}
