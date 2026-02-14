import { useMixerStore, type SourceMode } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import styles from './TransportBar.module.css'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const SOURCE_MODES: { mode: SourceMode; label: string; helpText: string }[] = [
  {
    mode: 'stems',
    label: 'Stems',
    helpText: 'Play audio from the loaded stem files. Use the transport controls to play, stop, and rewind.',
  },
  {
    mode: 'tones',
    label: 'Tones',
    helpText: 'Generate continuous test tones on each channel — sine waves, sawtooth, square, triangle, and noise at different frequencies. Great for learning what each control does without waiting for music to play.',
  },
]

export function TransportBar() {
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const stemsLoaded = useMixerStore((s) => s.stemsLoaded)
  const sourceMode = useMixerStore((s) => s.sourceMode)
  const setSourceMode = useMixerStore((s) => s.setSourceMode)
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const rewind = useMixerStore((s) => s.rewind)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const isTones = sourceMode === 'tones'

  return (
    <div className={styles.transportBar}>
      <div className={styles.sourceModeButtons}>
        {SOURCE_MODES.map(({ mode, label, helpText }) => (
          <button
            key={mode}
            className={`${styles.sourceModeButton} ${sourceMode === mode ? styles.activeSourceMode : ''}`}
            onClick={() => setSourceMode(mode)}
            onMouseEnter={() => setHelpText(helpText)}
            onMouseLeave={() => setHelpText('')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.separator} />
      <button
        onClick={rewind}
        disabled={isTones || !stemsLoaded}
        onMouseEnter={() => setHelpText("Return playback to the beginning of the track.")}
        onMouseLeave={() => setHelpText('')}
      >
        ⏮ Rewind
      </button>
      <button
        onClick={transportState === 'playing' ? stop : play}
        disabled={isTones || !stemsLoaded}
        className={!isTones && transportState !== 'playing' ? styles.playButton : undefined}
        onMouseEnter={() => setHelpText("Start or stop playback of the loaded audio stems. Each stem is routed to its own input channel on the mixer.")}
        onMouseLeave={() => setHelpText('')}
      >
        {transportState === 'playing' ? '⏹ Stop' : '▶ Play'}
      </button>
      <span className={styles.title}>MixSim</span>
      {!isTones && (
        <div className={styles.timeDisplay}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
      {isTones && (
        <div className={styles.tonesIndicator}>♪ Test Tones Active</div>
      )}
    </div>
  )
}
