import { useMixerStore } from '@/state/mixer-store'
import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'
import { createChannelChain, type ChannelChain } from '@/audio/channel'
import { TransportManager } from '@/audio/transport'
import { MeteringManager } from '@/audio/metering'
import { ToneGenerator } from '@/audio/tone-generator'
import { NUM_MIX_BUSES, type MonitorSource } from '@/state/mixer-model'

export interface AudioEngine {
  init: () => Promise<void>
  dispose: () => void
  getTransport: () => TransportManager | null
  getMetering: () => MeteringManager | null
  getToneGenerator: () => ToneGenerator | null
}

interface MixBusChain {
  summing: GainNode
  faderGain: GainNode
  muteGain: GainNode
  analyser: AnalyserNode
}

export function createAudioEngine(): AudioEngine {
  let context: AudioContext | null = null
  let channels: ChannelChain[] = []
  let mixBusChains: MixBusChain[] = []
  let masterGain: GainNode | null = null
  let masterAnalyser: AnalyserNode | null = null
  let soloBusGain: GainNode | null = null
  // Monitor routing: selectable source taps → monitorLevel → destination
  let monitorTapMain: GainNode | null = null
  let monitorTapSolo: GainNode | null = null
  let monitorTapBuses: GainNode[] = []
  let monitorLevel: GainNode | null = null
  let transport: TransportManager | null = null
  let metering: MeteringManager | null = null
  let toneGenerator: ToneGenerator | null = null
  const unsubscribers: (() => void)[] = []

  function applyMonitorTaps(source: MonitorSource, soloActive: boolean): void {
    if (!context) return
    const t = context.currentTime

    // Solo overrides user selection
    const effectiveSource = soloActive ? 'solo' : source

    monitorTapMain!.gain.setValueAtTime(effectiveSource === 'main' ? 1 : 0, t)
    monitorTapSolo!.gain.setValueAtTime(effectiveSource === 'solo' ? 1 : 0, t)
    for (let i = 0; i < monitorTapBuses.length; i++) {
      monitorTapBuses[i].gain.setValueAtTime(effectiveSource === `bus-${i}` ? 1 : 0, t)
    }
  }

  async function init(): Promise<void> {
    context = new AudioContext()

    // Master bus: masterGain → masterAnalyser (metering only, no direct output)
    masterGain = context.createGain()
    masterAnalyser = context.createAnalyser()
    masterAnalyser.fftSize = 2048

    masterGain.connect(masterAnalyser)

    // Solo bus summing point (no direct output — routed via monitor)
    soloBusGain = context.createGain()
    soloBusGain.gain.value = 1

    // Monitor routing: each source has a tap GainNode (0 or 1)
    // All taps feed into monitorLevel → destination
    monitorLevel = context.createGain()
    monitorLevel.connect(context.destination)

    monitorTapMain = context.createGain()
    monitorTapSolo = context.createGain()

    masterAnalyser.connect(monitorTapMain)
    monitorTapMain.connect(monitorLevel)

    soloBusGain.connect(monitorTapSolo)
    monitorTapSolo.connect(monitorLevel)

    // Mix bus chains: summing → faderGain → muteGain → analyser → monitorTap → monitorLevel
    const store = useMixerStore.getState()
    mixBusChains = []
    monitorTapBuses = []
    for (let i = 0; i < NUM_MIX_BUSES; i++) {
      const summing = context.createGain()
      summing.gain.value = 1
      const faderGain = context.createGain()
      faderGain.gain.value = faderPositionToGain(store.mixBuses[i]?.faderPosition ?? 0.75)
      const muteGain = context.createGain()
      muteGain.gain.value = store.mixBuses[i]?.mute ? 0 : 1
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024

      summing.connect(faderGain)
      faderGain.connect(muteGain)
      muteGain.connect(analyser)

      const busTap = context.createGain()
      analyser.connect(busTap)
      busTap.connect(monitorLevel)
      monitorTapBuses.push(busTap)

      mixBusChains.push({ summing, faderGain, muteGain, analyser })
    }

    // Set initial monitor state
    monitorLevel.gain.value = store.monitor.level
    applyMonitorTaps(store.monitor.source, store.soloActive)

    masterGain.gain.value = faderPositionToGain(store.master.faderPosition)

    // Per-channel chains (with mix bus summing nodes for sends)
    const mixBusSummingNodes = mixBusChains.map((b) => b.summing)
    const channelCount = store.channels.length
    channels = []
    for (let i = 0; i < channelCount; i++) {
      const ch = store.channels[i]
      const chain = createChannelChain(context, masterGain, soloBusGain, ch, mixBusSummingNodes)
      channels.push(chain)
    }

    subscribeToStore()

    transport = new TransportManager(context, channels)
    toneGenerator = new ToneGenerator(context, channels)
    metering = new MeteringManager(
      channels.map((ch) => ch.analyser),
      channels.map((ch) => ch.preFaderAnalyser),
      mixBusChains.map((b) => b.analyser),
      masterAnalyser
    )
  }

  function subscribeToStore(): void {
    const store = useMixerStore

    for (let i = 0; i < channels.length; i++) {
      const chain = channels[i]

      // Gain
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

      // Fader (DCA-aware: effective gain = channel fader × Π(DCA faders))
      const unsubFader = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return {
            position: ch.faderPosition,
            dcaPositions: ch.dcaGroups.map((dcaId) => state.dcaGroups[dcaId]?.faderPosition ?? 0.75),
          }
        },
        (data) => {
          if (!data || !context) return
          let effectiveGain = faderPositionToGain(data.position)
          for (const dcaPos of data.dcaPositions) {
            effectiveGain *= faderPositionToGain(dcaPos)
          }
          chain.faderGain.gain.setValueAtTime(effectiveGain, context.currentTime)
        },
        {
          equalityFn: (a, b) =>
            a?.position === b?.position &&
            a?.dcaPositions.length === b?.dcaPositions.length &&
            (a?.dcaPositions.every((p, j) => p === b?.dcaPositions[j]) ?? false),
        }
      )
      unsubscribers.push(unsubFader)

      // Pan
      const unsubPan = store.subscribe(
        (state) => state.channels[i]?.pan,
        (pan) => {
          if (pan !== undefined && context) {
            chain.panner.pan.setValueAtTime(pan, context.currentTime)
          }
        }
      )
      unsubscribers.push(unsubPan)

      // Mute (DCA-aware: effective mute = channel mute OR any assigned DCA muted)
      const unsubMute = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return {
            mute: ch.mute,
            dcaMutes: ch.dcaGroups.map((dcaId) => state.dcaGroups[dcaId]?.mute ?? false),
          }
        },
        (data) => {
          if (!data || !context) return
          const effectiveMute = data.mute || data.dcaMutes.some((m) => m)
          chain.muteGain.gain.setValueAtTime(effectiveMute ? 0 : 1, context.currentTime)
        },
        {
          equalityFn: (a, b) =>
            a?.mute === b?.mute &&
            a?.dcaMutes.length === b?.dcaMutes.length &&
            (a?.dcaMutes.every((m, j) => m === b?.dcaMutes[j]) ?? false),
        }
      )
      unsubscribers.push(unsubMute)

      // HPF (enabled + freq as a group)
      const unsubHpf = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return { enabled: ch.hpfEnabled, freq: ch.hpfFreq }
        },
        (hpf) => {
          if (hpf && context) {
            chain.hpf.frequency.setValueAtTime(
              hpf.enabled ? hpf.freq : 10,
              context.currentTime
            )
          }
        },
        { equalityFn: (a, b) => a?.enabled === b?.enabled && a?.freq === b?.freq }
      )
      unsubscribers.push(unsubHpf)

      // EQ (enabled + all band params as a group)
      const unsubEq = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return {
            enabled: ch.eqEnabled,
            lowFreq: ch.eqLowFreq, lowGain: ch.eqLowGain,
            midFreq: ch.eqMidFreq, midGain: ch.eqMidGain, midQ: ch.eqMidQ,
            highFreq: ch.eqHighFreq, highGain: ch.eqHighGain,
          }
        },
        (eq) => {
          if (!eq || !context) return
          const t = context.currentTime

          chain.eqLow.frequency.setValueAtTime(eq.lowFreq, t)
          chain.eqLow.gain.setValueAtTime(eq.enabled ? eq.lowGain : 0, t)

          chain.eqMid.frequency.setValueAtTime(eq.midFreq, t)
          chain.eqMid.gain.setValueAtTime(eq.enabled ? eq.midGain : 0, t)
          chain.eqMid.Q.setValueAtTime(eq.midQ, t)

          chain.eqHigh.frequency.setValueAtTime(eq.highFreq, t)
          chain.eqHigh.gain.setValueAtTime(eq.enabled ? eq.highGain : 0, t)
        },
        {
          equalityFn: (a, b) =>
            a?.enabled === b?.enabled &&
            a?.lowFreq === b?.lowFreq && a?.lowGain === b?.lowGain &&
            a?.midFreq === b?.midFreq && a?.midGain === b?.midGain && a?.midQ === b?.midQ &&
            a?.highFreq === b?.highFreq && a?.highGain === b?.highGain,
        }
      )
      unsubscribers.push(unsubEq)

      // Sends (level + pre/post for all buses)
      const unsubSends = store.subscribe(
        (state) => state.channels[i]?.sends,
        (sends, prevSends) => {
          if (!sends || !context) return
          const t = context.currentTime
          for (let b = 0; b < sends.length; b++) {
            const send = sends[b]
            const prev = prevSends?.[b]

            // Update send level
            if (!prev || send.level !== prev.level) {
              chain.sendGains[b].gain.setValueAtTime(send.level, t)
            }

            // Handle pre/post toggle: disconnect from old tap, reconnect to new
            if (prev && send.preFader !== prev.preFader) {
              const oldTap = prev.preFader ? chain.panner : chain.faderGain
              const newTap = send.preFader ? chain.panner : chain.faderGain
              try { oldTap.disconnect(chain.sendGains[b]) } catch { /* not connected */ }
              newTap.connect(chain.sendGains[b])
            }
          }
        },
        {
          equalityFn: (a, b) => {
            if (!a || !b || a.length !== b.length) return false
            return a.every((s, j) => s.level === b[j].level && s.preFader === b[j].preFader)
          }
        }
      )
      unsubscribers.push(unsubSends)
    }

    // Mix bus fader + mute
    for (let b = 0; b < mixBusChains.length; b++) {
      const busChain = mixBusChains[b]

      const unsubBusFader = store.subscribe(
        (state) => state.mixBuses[b]?.faderPosition,
        (position) => {
          if (position !== undefined && context) {
            busChain.faderGain.gain.setValueAtTime(
              faderPositionToGain(position),
              context.currentTime
            )
          }
        }
      )
      unsubscribers.push(unsubBusFader)

      const unsubBusMute = store.subscribe(
        (state) => state.mixBuses[b]?.mute,
        (mute) => {
          if (mute !== undefined && context) {
            busChain.muteGain.gain.setValueAtTime(mute ? 0 : 1, context.currentTime)
          }
        }
      )
      unsubscribers.push(unsubBusMute)
    }

    // Master fader
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

    // Solo state (per-channel soloGain nodes)
    const unsubSoloChannels = store.subscribe(
      (state) => state.channels.map((ch) => ch.solo),
      (solos) => {
        if (!context) return
        const t = context.currentTime
        for (let j = 0; j < channels.length; j++) {
          channels[j].soloGain.gain.setValueAtTime(solos[j] ? 1 : 0, t)
        }
      },
      {
        equalityFn: (a, b) =>
          a.length === b.length && a.every((s, i) => s === b[i]),
      }
    )
    unsubscribers.push(unsubSoloChannels)

    // Monitor source + solo override (combined subscription)
    const unsubMonitor = store.subscribe(
      (state) => ({
        source: state.monitor.source,
        level: state.monitor.level,
        soloActive: state.soloActive,
      }),
      ({ source, level, soloActive }) => {
        if (!context) return
        monitorLevel!.gain.setValueAtTime(level, context.currentTime)
        applyMonitorTaps(source, soloActive)
      },
      {
        equalityFn: (a, b) =>
          a.source === b.source && a.level === b.level && a.soloActive === b.soloActive,
      }
    )
    unsubscribers.push(unsubMonitor)
  }

  function dispose(): void {
    metering?.stop()
    toneGenerator?.dispose()
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
    getToneGenerator: () => toneGenerator,
  }
}
