import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore, type FaderBankMode } from '@/state/surface-store'
import { NUM_MIX_BUSES, NUM_DCA_GROUPS } from '@/state/mixer-model'
import { InputChannel } from './InputChannel'
import { BusFaderStrip } from './BusFaderStrip'
import { DcaFaderStrip } from './DcaFaderStrip'
import styles from './InputChannelBank.module.css'

const CHANNELS_PER_LAYER = 8

const BANK_MODES: { mode: FaderBankMode; label: string }[] = [
  { mode: 'inputs', label: 'Inputs' },
  { mode: 'buses', label: 'Buses' },
  { mode: 'dcas', label: 'DCAs' },
]

export function InputChannelBank() {
  const channelCount = useMixerStore((s) => s.channels.length)
  const activeLayer = useSurfaceStore((s) => s.activeLayer)
  const setActiveLayer = useSurfaceStore((s) => s.setActiveLayer)
  const faderBankMode = useSurfaceStore((s) => s.faderBankMode)
  const setFaderBankMode = useSurfaceStore((s) => s.setFaderBankMode)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)

  const layerCount = Math.ceil(channelCount / CHANNELS_PER_LAYER)
  const startIndex = activeLayer * CHANNELS_PER_LAYER
  const endIndex = Math.min(startIndex + CHANNELS_PER_LAYER, channelCount)

  const visibleIndices: (number | null)[] = []
  for (let i = startIndex; i < startIndex + CHANNELS_PER_LAYER; i++) {
    visibleIndices.push(i < endIndex ? i : null)
  }

  return (
    <div className={styles.bank}>
      <div className={styles.bankModeButtons}>
        {BANK_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            className={`${styles.bankModeButton} ${faderBankMode === mode ? styles.activeBankMode : ''}`}
            onClick={() => setFaderBankMode(mode)}
            onMouseEnter={() => setHelpText("Switch the fader bank between input channels, mix bus outputs, and DCA group masters.")}
            onMouseLeave={() => setHelpText('')}
          >
            {label}
          </button>
        ))}
      </div>
      {faderBankMode === 'inputs' && (
        <>
          {layerCount > 1 && (
            <div className={styles.layerButtons}>
              {Array.from({ length: layerCount }, (_, layerIdx) => {
                const from = layerIdx * CHANNELS_PER_LAYER + 1
                const to = Math.min((layerIdx + 1) * CHANNELS_PER_LAYER, channelCount)
                return (
                  <button
                    key={layerIdx}
                    className={`${styles.layerButton} ${activeLayer === layerIdx ? styles.activeLayer : ''}`}
                    onClick={() => setActiveLayer(layerIdx)}
                    onMouseEnter={() => setHelpText("Switch between layers of input channels. Each layer shows 8 channels. Use this to access all channels when there are more than 8.")}
                    onMouseLeave={() => setHelpText('')}
                  >
                    Ch {from}–{to}
                  </button>
                )
              })}
            </div>
          )}
          <div className={styles.channels}>
            {visibleIndices.map((idx, slotIdx) =>
              idx !== null ? (
                <InputChannel key={idx} channelIndex={idx} />
              ) : (
                <div key={`empty-${slotIdx}`} className={styles.emptySlot} />
              )
            )}
          </div>
        </>
      )}
      {faderBankMode === 'buses' && (
        <div className={styles.channels}>
          {Array.from({ length: NUM_MIX_BUSES }, (_, i) => (
            <BusFaderStrip key={i} busIndex={i} />
          ))}
        </div>
      )}
      {faderBankMode === 'dcas' && (
        <div className={styles.channels}>
          {Array.from({ length: NUM_DCA_GROUPS }, (_, i) => (
            <DcaFaderStrip key={i} dcaIndex={i} />
          ))}
        </div>
      )}
    </div>
  )
}
