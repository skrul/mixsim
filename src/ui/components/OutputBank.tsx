import { useSurfaceStore, type OutputBankLayer } from '@/state/surface-store'
import { NUM_DCA_GROUPS } from '@/state/mixer-model'
import { BusFaderStrip } from './BusFaderStrip'
import { DcaFaderStrip } from './DcaFaderStrip'
import styles from './OutputBank.module.css'

const BUSES_PER_LAYER = 8

export function OutputBank() {
  const outputBankLayer = useSurfaceStore((s) => s.outputBankLayer)
  const activeBusLayer = useSurfaceStore((s) => s.activeBusLayer)
  const setOutputBankLayer = useSurfaceStore((s) => s.setOutputBankLayer)
  const setActiveBusLayer = useSurfaceStore((s) => s.setActiveBusLayer)
  const sendsOnFader = useSurfaceStore((s) => s.sendsOnFader)
  const sendTargetBus = useSurfaceStore((s) => s.sendTargetBus)
  const toggleSendsOnFader = useSurfaceStore((s) => s.toggleSendsOnFader)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const handleSendsOnFader = () => {
    if (sendsOnFader) {
      toggleSendsOnFader(sendTargetBus)
    } else {
      toggleSendsOnFader(0)
    }
  }

  const busStartIndex = activeBusLayer * BUSES_PER_LAYER

  return (
    <div className={styles.bank}>
      <div className={styles.layerColumn}>
        <div className={styles.groupLabel}>BUSES / GROUPS</div>
        <button
          className={`${styles.layerButton} ${sendsOnFader ? styles.sendsActive : ''}`}
          onClick={handleSendsOnFader}
          onMouseEnter={() => setHelpText('Toggle Sends on Fader mode. When active, the input faders control send levels to the selected bus.')}
          onMouseLeave={() => setHelpText('')}
        >
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>SENDS ON FADER</span>
        </button>
        <button
          className={`${styles.layerButton} ${outputBankLayer === 'dcas' ? styles.activeLayer : ''}`}
          onClick={() => setOutputBankLayer('dcas' as OutputBankLayer)}
          onMouseEnter={() => setHelpText('Show DCA group masters on this fader bank.')}
          onMouseLeave={() => setHelpText('')}
        >
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>GROUP DCA 1–8</span>
        </button>
        <button
          className={`${styles.layerButton} ${outputBankLayer === 'buses' && activeBusLayer === 0 ? styles.activeLayer : ''}`}
          onClick={() => { setOutputBankLayer('buses' as OutputBankLayer); setActiveBusLayer(0) }}
          onMouseEnter={() => setHelpText('Show mix buses 1–8 on this fader bank.')}
          onMouseLeave={() => setHelpText('')}
        >
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>BUS 1–8</span>
        </button>
        <button
          className={`${styles.layerButton} ${outputBankLayer === 'buses' && activeBusLayer === 1 ? styles.activeLayer : ''}`}
          onClick={() => { setOutputBankLayer('buses' as OutputBankLayer); setActiveBusLayer(1) }}
          onMouseEnter={() => setHelpText('Show mix buses 9–16 on this fader bank.')}
          onMouseLeave={() => setHelpText('')}
        >
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>BUS 9–16</span>
        </button>
        <button className={`${styles.layerButton}`} disabled>
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>MTX MAIN C</span>
        </button>
      </div>
      <div className={styles.strips}>
        {outputBankLayer === 'buses' &&
          Array.from({ length: BUSES_PER_LAYER }, (_, i) => (
            <BusFaderStrip key={i} busIndex={busStartIndex + i} />
          ))}
        {outputBankLayer === 'dcas' &&
          Array.from({ length: NUM_DCA_GROUPS }, (_, i) => (
            <DcaFaderStrip key={i} dcaIndex={i} />
          ))}
      </div>
    </div>
  )
}
