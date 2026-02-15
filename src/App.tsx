import { useMixerStore } from '@/state/mixer-store'
import { useAudioEngine } from '@/ui/hooks/useAudioEngine'
import { TransportBar } from '@/ui/components/TransportBar'
import { ChannelDetailPanel } from '@/ui/components/ChannelDetailPanel'
import { InputChannelBank } from '@/ui/components/InputChannelBank'
import { OutputBank } from '@/ui/components/OutputBank'
import { MasterSection } from '@/ui/components/MasterSection'
import { MonitorSection } from '@/ui/components/MonitorSection'
import { ControlPanel } from '@/ui/components/ControlPanel'
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
      <ChannelDetailPanel />
      <div className={styles.mixerSurface}>
        <InputChannelBank />
        <div className={styles.bankSeparator} />
        <OutputBank />
        <div className={styles.bankSeparator} />
        <MasterSection />
        <div className={styles.bankSeparator} />
        <div className={styles.rightColumn}>
          <MonitorSection />
          <ControlPanel />
        </div>
      </div>
      <InfoBar />
    </div>
  )
}

export default App
