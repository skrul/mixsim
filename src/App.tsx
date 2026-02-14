import { useMixerStore } from '@/state/mixer-store'
import { useAudioEngine } from '@/ui/hooks/useAudioEngine'
import { TransportBar } from '@/ui/components/TransportBar'
import { SelectedChannelStrip } from '@/ui/components/SelectedChannelStrip'
import { InputChannelBank } from '@/ui/components/InputChannelBank'
import { MasterSection } from '@/ui/components/MasterSection'
import { MonitorSection } from '@/ui/components/MonitorSection'
import { InfoBar } from '@/ui/components/InfoBar'
import styles from './App.module.css'

function App() {
  const { isReady, error } = useAudioEngine()
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
        <SelectedChannelStrip />
        <InputChannelBank />
        <MasterSection />
        <MonitorSection />
      </div>
      <InfoBar />
    </div>
  )
}

export default App
