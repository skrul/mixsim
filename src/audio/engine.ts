import { useMixerStore } from '@/state/mixer-store'
import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'
import { createChannelChain, type ChannelChain } from '@/audio/channel'
import { TransportManager } from '@/audio/transport'
import { MeteringManager } from '@/audio/metering'

export interface AudioEngine {
  init: () => Promise<void>
  dispose: () => void
  getTransport: () => TransportManager | null
  getMetering: () => MeteringManager | null
}

export function createAudioEngine(): AudioEngine {
  let context: AudioContext | null = null
  let channels: ChannelChain[] = []
  let masterGain: GainNode | null = null
  let masterAnalyser: AnalyserNode | null = null
  let transport: TransportManager | null = null
  let metering: MeteringManager | null = null
  const unsubscribers: (() => void)[] = []

  async function init(): Promise<void> {
    context = new AudioContext()

    // Master bus
    masterGain = context.createGain()
    masterAnalyser = context.createAnalyser()
    masterAnalyser.fftSize = 2048

    masterGain.connect(masterAnalyser)
    masterAnalyser.connect(context.destination)

    const store = useMixerStore.getState()
    masterGain.gain.value = faderPositionToGain(store.master.faderPosition)

    // Per-channel chains
    const channelCount = store.channels.length
    channels = []
    for (let i = 0; i < channelCount; i++) {
      const ch = store.channels[i]
      const chain = createChannelChain(context, masterGain, ch.gain, ch.faderPosition)
      channels.push(chain)
    }

    subscribeToStore()

    transport = new TransportManager(context, channels)
    metering = new MeteringManager(
      channels.map((ch) => ch.analyser),
      masterAnalyser
    )
  }

  function subscribeToStore(): void {
    const store = useMixerStore

    for (let i = 0; i < channels.length; i++) {
      const chain = channels[i]

      const unsubGain = store.subscribe(
        (state) => state.channels[i]?.gain,
        (gainDb) => {
          if (gainDb !== undefined && context) {
            chain.inputGain.gain.setValueAtTime(
              dbToGain(gainDb),
              context.currentTime
            )
          }
        }
      )
      unsubscribers.push(unsubGain)

      const unsubFader = store.subscribe(
        (state) => state.channels[i]?.faderPosition,
        (position) => {
          if (position !== undefined && context) {
            chain.faderGain.gain.setValueAtTime(
              faderPositionToGain(position),
              context.currentTime
            )
          }
        }
      )
      unsubscribers.push(unsubFader)
    }

    const unsubMaster = store.subscribe(
      (state) => state.master.faderPosition,
      (position) => {
        if (masterGain && context) {
          masterGain.gain.setValueAtTime(
            faderPositionToGain(position),
            context.currentTime
          )
        }
      }
    )
    unsubscribers.push(unsubMaster)
  }

  function dispose(): void {
    metering?.stop()
    transport?.dispose()
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers.length = 0
    context?.close()
    context = null
    channels = []
  }

  return {
    init,
    dispose,
    getTransport: () => transport,
    getMetering: () => metering,
  }
}
