import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_INPUT_CHANNELS } from '@/state/mixer-model'
import { InputChannel } from './InputChannel'
import styles from './InputChannelBank.module.css'

const CHANNELS_PER_LAYER = 8
const NUM_LAYERS = NUM_INPUT_CHANNELS / CHANNELS_PER_LAYER // 4
const EFFECTS_RETURNS_LAYER = 5
const EFFECTS_RETURN_LABELS = ['FX1L', 'FX1R', 'FX2L', 'FX2R', 'FX3L', 'FX3R', 'FX4L', 'FX4R'] as const

const LAYER_LABELS = Array.from({ length: NUM_LAYERS }, (_, i) => {
  const from = i * CHANNELS_PER_LAYER + 1
  const to = (i + 1) * CHANNELS_PER_LAYER
  return `CH ${from}–${to}`
})

function getLayerChannelIndex(activeLayer: number, slotIndex: number): number {
  if (activeLayer >= 0 && activeLayer < NUM_LAYERS) {
    return activeLayer * CHANNELS_PER_LAYER + slotIndex
  }
  if (activeLayer === EFFECTS_RETURNS_LAYER) {
    // Temporary mapping: use channels 25-32 as backing strips for FX returns.
    return 24 + slotIndex
  }
  return -1
}

export function InputChannelBank() {
  const channelCount = useMixerStore((s) => s.channels.length)
  const activeInputLayer = useSurfaceStore((s) => s.activeInputLayer)
  const setActiveInputLayer = useSurfaceStore((s) => s.setActiveInputLayer)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

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
        <button
          className={`${styles.layerButton} ${activeInputLayer === EFFECTS_RETURNS_LAYER ? styles.activeLayer : ''}`}
          onClick={() => setActiveInputLayer(EFFECTS_RETURNS_LAYER)}
          onMouseEnter={() => setHelpText('Show effects return channels FX1L through FX4R on the input fader bank.')}
          onMouseLeave={() => setHelpText('')}
        >
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
          const idx = getLayerChannelIndex(activeInputLayer, slotIdx)
          const scribbleLabel = activeInputLayer === EFFECTS_RETURNS_LAYER
            ? EFFECTS_RETURN_LABELS[slotIdx]
            : undefined
          return idx >= 0 && idx < channelCount ? (
            <InputChannel key={`${activeInputLayer}-${slotIdx}`} channelIndex={idx} scribbleLabel={scribbleLabel} />
          ) : (
            <div key={slotIdx} className={styles.emptySlot} />
          )
        })}
      </div>
    </div>
  )
}
