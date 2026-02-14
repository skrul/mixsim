import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
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
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const rewind = useMixerStore((s) => s.rewind)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  return (
    <div className={styles.transportBar}>
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
        onMouseEnter={() => setHelpText("Start or stop playback of the loaded audio stems. Each stem is routed to its own input channel on the mixer.")}
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
