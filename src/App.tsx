import { useMixerStore } from '@/state/mixer-store'
import { useAudioEngine } from '@/ui/hooks/useAudioEngine'
import { TransportBar } from '@/ui/components/TransportBar'
import { ChannelStrip } from '@/ui/components/ChannelStrip'
import { MasterSection } from '@/ui/components/MasterSection'
import styles from './App.module.css'

function App() {
  const { isReady, error } = useAudioEngine()
  const channels = useMixerStore((s) => s.channels)
  const loadingError = useMixerStore((s) => s.loadingError)

  if (error || loadingError) {
    return <div className={styles.error}>Error: {error || loadingError}</div>
  }

  if (!isReady) {
    return <div className={styles.loading}>Loading stems...</div>
  }

  return (
    <div className={styles.app}>
      <TransportBar />
      <div className={styles.mixerSurface}>
        <div className={styles.channelStrips}>
          {channels.map((_, i) => (
            <ChannelStrip key={i} channelIndex={i} />
          ))}
        </div>
        <MasterSection />
      </div>
    </div>
  )
}

export default App
