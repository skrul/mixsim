import { useEffect } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { saveSessionSnapshotToLocalStorage } from '@/state/session-persistence'
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

  useEffect(() => {
    let saveTimer: number | null = null
    const scheduleSave = () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
      }
      saveTimer = window.setTimeout(() => {
        saveSessionSnapshotToLocalStorage()
      }, 250)
    }

    const unsubscribeMixer = useMixerStore.subscribe(scheduleSave)
    const unsubscribeSurface = useSurfaceStore.subscribe(scheduleSave)

    return () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
      }
      unsubscribeMixer()
      unsubscribeSurface()
    }
  }, [])

  if (error || loadingError) {
    return <div className={styles.error}>Error: {error || loadingError}</div>
  }

  if (!isReady) {
    return <div className={styles.loading}>Loading stems...</div>
  }

  return (
    <div className={styles.app}>
      <div className={styles.topSurface}>
        <div className={styles.detailPanelWrap}>
          <ChannelDetailPanel />
        </div>
        <ControlPanel />
      </div>
      <div className={styles.mixerSurface}>
        <InputChannelBank />
        <div className={styles.bankSeparator} />
        <OutputBank />
        <div className={styles.bankSeparator} />
        <MasterSection />
        <div className={styles.bankSeparator} />
        <div className={styles.rightColumn}>
          <div className={styles.utilityRow}>
            <MonitorSection />
            <TransportBar compact />
          </div>
        </div>
      </div>
      <InfoBar />
    </div>
  )
}

export default App
