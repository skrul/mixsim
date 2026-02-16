import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_INPUT_CHANNELS } from '@/state/mixer-model'
import { InputChannel } from './InputChannel'
import styles from './InputChannelBank.module.css'

const CHANNELS_PER_LAYER = 8
const NUM_LAYERS = NUM_INPUT_CHANNELS / CHANNELS_PER_LAYER // 4

const LAYER_LABELS = Array.from({ length: NUM_LAYERS }, (_, i) => {
  const from = i * CHANNELS_PER_LAYER + 1
  const to = (i + 1) * CHANNELS_PER_LAYER
  return `CH ${from}–${to}`
})

export function InputChannelBank() {
  const channelCount = useMixerStore((s) => s.channels.length)
  const activeInputLayer = useSurfaceStore((s) => s.activeInputLayer)
  const setActiveInputLayer = useSurfaceStore((s) => s.setActiveInputLayer)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const startIndex = activeInputLayer * CHANNELS_PER_LAYER

  return (
    <div className={styles.bank}>
      <div className={styles.layerColumn}>
        <div className={styles.groupLabel}>INPUTS</div>
        {LAYER_LABELS.map((label, layerIdx) => (
          <button
            key={layerIdx}
            className={`${styles.layerButton} ${activeInputLayer === layerIdx ? styles.activeLayer : ''}`}
            onClick={() => setActiveInputLayer(layerIdx)}
            onMouseEnter={() => setHelpText('Switch between layers of input channels. Each layer shows 8 channels.')}
            onMouseLeave={() => setHelpText('')}
          >
            <div className={styles.pad} />
            <span className={styles.layerButtonLabel}>{label}</span>
          </button>
        ))}
        <button className={`${styles.layerButton}`} disabled>
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>
            <span>AUX IN 1-6</span>
            <span>USB REC</span>
          </span>
        </button>
        <button className={`${styles.layerButton}`} disabled>
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>
            <span>EFFECTS</span>
            <span>RETURNS</span>
          </span>
        </button>
        <button className={`${styles.layerButton}`} disabled>
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>
            <span>BUS 1-8</span>
            <span>MASTER</span>
          </span>
        </button>
        <button className={`${styles.layerButton}`} disabled>
          <div className={styles.pad} />
          <span className={styles.layerButtonLabel}>
            <span>BUS 9-16</span>
            <span>MASTER</span>
          </span>
        </button>
      </div>
      <div className={styles.channels}>
        {Array.from({ length: CHANNELS_PER_LAYER }, (_, slotIdx) => {
          const idx = startIndex + slotIdx
          return idx < channelCount ? (
            <InputChannel key={slotIdx} channelIndex={idx} />
          ) : (
            <div key={slotIdx} className={styles.emptySlot} />
          )
        })}
      </div>
    </div>
  )
}
