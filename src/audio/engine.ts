import { useMixerStore } from '@/state/mixer-store'
import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'
import { createChannelChain, type ChannelChain } from '@/audio/channel'
import { TransportManager } from '@/audio/transport'
import { MeteringManager, dynamicsLevels } from '@/audio/metering'
import { SourceManager } from '@/audio/source-manager'
import { NUM_MIX_BUSES, INPUT_TYPE_CONFIG, GAIN_MIN, type MonitorSource } from '@/state/mixer-model'

export interface AudioEngine {
  init: () => Promise<void>
  dispose: () => void
  resume: () => Promise<void>
  getAudioState: () => AudioContextState | 'closed'
  getTransport: () => TransportManager | null
  getMetering: () => MeteringManager | null
  getSourceManager: () => SourceManager | null
}

interface MixBusChain {
  summing: GainNode
  faderGain: GainNode
  muteGain: GainNode
  analyser: AnalyserNode
  soloGain: GainNode
}

interface FxRuntime {
  input: GainNode
  output: AudioNode
  dispose: () => void
}

interface GateRuntime {
  enabled: boolean
  thresholdDb: number
  envelope: number
  detectorBuffer: Float32Array<ArrayBuffer>
}

type EqTargetBand = 'low' | 'lowMid' | 'highMid' | 'high'

function mapSelectedBandToEqTarget(selectedBand: 'high' | 'highMid' | 'lowMid' | 'low'): EqTargetBand {
  if (selectedBand === 'high') return 'high'
  if (selectedBand === 'low') return 'low'
  if (selectedBand === 'lowMid') return 'lowMid'
  return 'highMid'
}

function mapEqModeToBiquadType(modeIndex: number): BiquadFilterType {
  switch (modeIndex) {
    case 0: return 'highpass'  // HCUT
    case 1: return 'highshelf' // HSHV
    case 2: return 'peaking'   // VEQ
    case 3: return 'peaking'   // PEQ
    case 4: return 'lowshelf'  // LSHV
    case 5: return 'lowpass'   // LCUT
    default: return 'peaking'
  }
}

function createDecayImpulseResponse(
  context: AudioContext,
  durationSec: number,
  decay: number,
  highCutHz: number
): AudioBuffer {
  const length = Math.floor(context.sampleRate * durationSec)
  const ir = context.createBuffer(2, length, context.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    let lp = 0
    const alpha = Math.min(0.99, highCutHz / context.sampleRate)
    for (let i = 0; i < length; i++) {
      const t = i / length
      const env = Math.pow(1 - t, decay)
      const white = Math.random() * 2 - 1
      lp += alpha * (white - lp)
      data[i] = lp * env
    }
  }
  return ir
}

function createReverbFx(
  context: AudioContext,
  opts: { durationSec: number; decay: number; preDelaySec: number; highCutHz: number; wet: number }
): FxRuntime {
  const input = context.createGain()
  const preDelay = context.createDelay()
  preDelay.delayTime.value = opts.preDelaySec
  const convolver = context.createConvolver()
  convolver.buffer = createDecayImpulseResponse(context, opts.durationSec, opts.decay, opts.highCutHz)
  const tone = context.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = opts.highCutHz
  const wet = context.createGain()
  wet.gain.value = opts.wet

  input.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(tone)
  tone.connect(wet)

  return {
    input,
    output: wet,
    dispose: () => {
      convolver.disconnect()
      wet.disconnect()
      input.disconnect()
    },
  }
}

function createStereoDelayFx(context: AudioContext): FxRuntime {
  const input = context.createGain()
  const splitter = context.createChannelSplitter(2)
  const merger = context.createChannelMerger(2)

  const delayL = context.createDelay()
  const delayR = context.createDelay()
  delayL.delayTime.value = 0.28
  delayR.delayTime.value = 0.42

  const fbL = context.createGain()
  const fbR = context.createGain()
  fbL.gain.value = 0.35
  fbR.gain.value = 0.35

  const toneL = context.createBiquadFilter()
  const toneR = context.createBiquadFilter()
  toneL.type = 'lowpass'
  toneR.type = 'lowpass'
  toneL.frequency.value = 4500
  toneR.frequency.value = 4500

  input.connect(splitter)

  splitter.connect(delayL, 0)
  splitter.connect(delayR, 1)

  delayL.connect(toneL)
  toneL.connect(fbL)
  fbL.connect(delayL)
  delayL.connect(merger, 0, 0)

  delayR.connect(toneR)
  toneR.connect(fbR)
  fbR.connect(delayR)
  delayR.connect(merger, 0, 1)

  return {
    input,
    output: merger,
    dispose: () => {
      input.disconnect()
      merger.disconnect()
      delayL.disconnect()
      delayR.disconnect()
    },
  }
}

function createStereoChorusFx(context: AudioContext): FxRuntime {
  const input = context.createGain()
  const splitter = context.createChannelSplitter(2)
  const merger = context.createChannelMerger(2)

  const delayL = context.createDelay()
  const delayR = context.createDelay()
  delayL.delayTime.value = 0.012
  delayR.delayTime.value = 0.014

  const lfoL = context.createOscillator()
  const lfoR = context.createOscillator()
  lfoL.type = 'sine'
  lfoR.type = 'sine'
  lfoL.frequency.value = 0.35
  lfoR.frequency.value = 0.41

  const depthL = context.createGain()
  const depthR = context.createGain()
  depthL.gain.value = 0.004
  depthR.gain.value = 0.004

  const wet = context.createGain()
  wet.gain.value = 0.9

  lfoL.connect(depthL)
  depthL.connect(delayL.delayTime)
  lfoR.connect(depthR)
  depthR.connect(delayR.delayTime)
  lfoL.start()
  lfoR.start()

  input.connect(splitter)
  splitter.connect(delayL, 0)
  splitter.connect(delayR, 1)

  delayL.connect(merger, 0, 0)
  delayR.connect(merger, 0, 1)
  merger.connect(wet)

  return {
    input,
    output: wet,
    dispose: () => {
      lfoL.stop()
      lfoR.stop()
      lfoL.disconnect()
      lfoR.disconnect()
      input.disconnect()
      wet.disconnect()
    },
  }
}

export function createAudioEngine(): AudioEngine {
  let context: AudioContext | null = null
  let channels: ChannelChain[] = []
  let mixBusChains: MixBusChain[] = []
  let masterGain: GainNode | null = null
  let monoBusGain: GainNode | null = null
  let monoAnalyser: AnalyserNode | null = null
  let masterLAnalyser: AnalyserNode | null = null
  let masterRAnalyser: AnalyserNode | null = null
  let mainSoloTapGain: GainNode | null = null
  let soloBusGain: GainNode | null = null
  let soloAnalyser: AnalyserNode | null = null
  // Monitor routing: selectable source taps → monitorLevel → destination
  let monitorTapMain: GainNode | null = null
  let monitorTapMono: GainNode | null = null
  let monitorTapSolo: GainNode | null = null
  let monitorTapBuses: GainNode[] = []
  let monitorLevel: GainNode | null = null
  let transport: TransportManager | null = null
  let metering: MeteringManager | null = null
  let sourceManager: SourceManager | null = null
  let gateRuntimes: GateRuntime[] = []
  let gateRafId: number | null = null
  const fxDisposers: (() => void)[] = []
  const unsubscribers: (() => void)[] = []

  function applyMonitorTaps(source: MonitorSource, soloActive: boolean): void {
    if (!context) return
    const t = context.currentTime

    // Solo overrides user selection
    const effectiveSource = soloActive ? 'solo' : source

    monitorTapMain!.gain.setValueAtTime(effectiveSource === 'main' ? 1 : 0, t)
    monitorTapMono!.gain.setValueAtTime(effectiveSource === 'mono' ? 1 : 0, t)
    monitorTapSolo!.gain.setValueAtTime(effectiveSource === 'solo' ? 1 : 0, t)
    for (let i = 0; i < monitorTapBuses.length; i++) {
      monitorTapBuses[i].gain.setValueAtTime(effectiveSource === `bus-${i}` ? 1 : 0, t)
    }
  }

  function updateGates(): void {
    if (!context) return
    const t = context.currentTime

    for (let i = 0; i < channels.length; i++) {
      const chain = channels[i]
      const runtime = gateRuntimes[i]
      if (!chain || !runtime) continue

      if (!runtime.enabled) {
        runtime.envelope = 1
        chain.gateGain.gain.setValueAtTime(1, t)
        continue
      }

      chain.gateDetector.getFloatTimeDomainData(runtime.detectorBuffer)

      let peak = 0
      for (let j = 0; j < runtime.detectorBuffer.length; j++) {
        const sample = Math.abs(runtime.detectorBuffer[j])
        if (sample > peak) peak = sample
      }
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity
      const target = peakDb >= runtime.thresholdDb ? 1 : 0

      // Basic envelope follower for gate opening/closing.
      const attack = 0.28
      const release = 0.04
      runtime.envelope += (target - runtime.envelope) * (target > runtime.envelope ? attack : release)
      if (runtime.envelope < 0.0001) runtime.envelope = 0

      chain.gateGain.gain.setValueAtTime(runtime.envelope, t)
      dynamicsLevels.gateReductionDb[i] = runtime.enabled ? (1 - runtime.envelope) * 30 : 0
      dynamicsLevels.compReductionDb[i] = Math.max(0, -(chain.compressor.reduction ?? 0))
    }

    gateRafId = requestAnimationFrame(updateGates)
  }

  async function init(): Promise<void> {
    context = new AudioContext()
    const store = useMixerStore.getState()

    // Master bus: masterGain feeds monitor and dedicated L/R meters
    masterGain = context.createGain()
    monoBusGain = context.createGain()
    monoBusGain.gain.value = 1
    monoAnalyser = context.createAnalyser()
    monoAnalyser.fftSize = 2048
    const masterSplitter = context.createChannelSplitter(2)
    const masterMerger = context.createChannelMerger(2)
    masterLAnalyser = context.createAnalyser()
    masterRAnalyser = context.createAnalyser()
    masterLAnalyser.fftSize = 2048
    masterRAnalyser.fftSize = 2048

    masterGain.connect(masterSplitter)
    masterSplitter.connect(masterLAnalyser, 0)
    masterSplitter.connect(masterRAnalyser, 1)
    masterSplitter.connect(masterMerger, 0, 0)
    masterSplitter.connect(masterMerger, 1, 1)

    // Solo bus summing point (no direct output — routed via monitor)
    soloBusGain = context.createGain()
    soloBusGain.gain.value = 1
    soloAnalyser = context.createAnalyser()
    soloAnalyser.fftSize = 2048

    // Optional tap from main bus into solo bus (for Main SOLO button)
    mainSoloTapGain = context.createGain()
    mainSoloTapGain.gain.value = store.master.solo ? 1 : 0
    masterGain.connect(mainSoloTapGain)
    mainSoloTapGain.connect(soloBusGain)

    // Monitor routing: each source has a tap GainNode (0 or 1)
    // All taps feed into monitorLevel → destination
    monitorLevel = context.createGain()
    monitorLevel.connect(context.destination)

    monitorTapMain = context.createGain()
    monitorTapMono = context.createGain()
    monitorTapSolo = context.createGain()

    masterMerger.connect(monitorTapMain)
    monitorTapMain.connect(monitorLevel)

    monoBusGain.connect(monitorTapMono)
    monoBusGain.connect(monoAnalyser)
    monitorTapMono.connect(monitorLevel)

    soloBusGain.connect(soloAnalyser)
    soloAnalyser.connect(monitorTapSolo)
    monitorTapSolo.connect(monitorLevel)

    // Mix bus chains: summing → faderGain → muteGain → analyser → monitorTap → monitorLevel
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
      const soloGain = context.createGain()
      soloGain.gain.value = store.mixBuses[i]?.solo ? 1 : 0

      summing.connect(faderGain)
      faderGain.connect(muteGain)
      muteGain.connect(analyser)
      analyser.connect(soloGain)
      soloGain.connect(soloBusGain)

      const busTap = context.createGain()
      analyser.connect(busTap)
      busTap.connect(monitorLevel)
      monitorTapBuses.push(busTap)

      mixBusChains.push({ summing, faderGain, muteGain, analyser, soloGain })
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
      const chain = createChannelChain(context, masterGain, monoBusGain, soloBusGain, ch, mixBusSummingNodes)
      channels.push(chain)
    }
    gateRuntimes = channels.map((chain, i) => {
      const ch = store.channels[i]
      return {
        enabled: ch?.gateEnabled ?? false,
        thresholdDb: ch?.gateThreshold ?? -58,
        envelope: ch?.gateEnabled ? 0 : 1,
        detectorBuffer: new Float32Array(chain.gateDetector.fftSize),
      }
    })
    dynamicsLevels.gateReductionDb = new Float32Array(channels.length).fill(0)
    dynamicsLevels.compReductionDb = new Float32Array(channels.length).fill(0)

    // Default X32-style FX sends/returns:
    // Bus 13-16 feed FX1-4, returned on FX1L/R .. FX4L/R (channels 25-32).
    const fxMap = [
      { busIndex: 12, returnL: 24, returnR: 25, type: 'room' as const },
      { busIndex: 13, returnL: 26, returnR: 27, type: 'plate' as const },
      { busIndex: 14, returnL: 28, returnR: 29, type: 'delay' as const },
      { busIndex: 15, returnL: 30, returnR: 31, type: 'chorus' as const },
    ]

    for (const slot of fxMap) {
      const bus = mixBusChains[slot.busIndex]
      const retL = channels[slot.returnL]
      const retR = channels[slot.returnR]
      if (!bus || !retL || !retR) continue

      const fx =
        slot.type === 'room'
          ? createReverbFx(context, { durationSec: 1.2, decay: 2.2, preDelaySec: 0.012, highCutHz: 6000, wet: 1 })
          : slot.type === 'plate'
            ? createReverbFx(context, { durationSec: 1.8, decay: 2.8, preDelaySec: 0.02, highCutHz: 9000, wet: 1 })
            : slot.type === 'delay'
              ? createStereoDelayFx(context)
              : createStereoChorusFx(context)

      bus.muteGain.connect(fx.input)
      const split = context.createChannelSplitter(2)
      fx.output.connect(split)
      split.connect(retL.inputNode, 0)
      split.connect(retR.inputNode, 1)

      fxDisposers.push(() => {
        try { bus.muteGain.disconnect(fx.input) } catch { /* already disconnected */ }
        try { fx.output.disconnect(split) } catch { /* already disconnected */ }
        try { split.disconnect(retL.inputNode) } catch { /* already disconnected */ }
        try { split.disconnect(retR.inputNode) } catch { /* already disconnected */ }
        fx.dispose()
      })
    }

    transport = new TransportManager(context)
    sourceManager = new SourceManager(context, channels)
    subscribeToStore()
    metering = new MeteringManager(
      channels.map((ch) => ch.analyser),
      channels.map((ch) => ch.preFaderAnalyser),
      mixBusChains.map((b) => b.analyser),
      masterLAnalyser,
      masterRAnalyser,
      soloAnalyser,
      monoAnalyser
    )
    gateRafId = requestAnimationFrame(updateGates)
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
              gainDb <= GAIN_MIN ? 0 : dbToGain(gainDb),
              context.currentTime
            )
          }
        }
      )
      unsubscribers.push(unsubGain)

      // Gate (enabled + threshold)
      const unsubGate = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return { enabled: ch.gateEnabled, threshold: ch.gateThreshold }
        },
        (gate) => {
          if (!gate || !context) return
          const runtime = gateRuntimes[i]
          if (!runtime) return
          runtime.enabled = gate.enabled
          runtime.thresholdDb = gate.threshold
          if (!gate.enabled) {
            runtime.envelope = 1
            channels[i].gateGain.gain.setValueAtTime(1, context.currentTime)
          }
        },
        {
          fireImmediately: true,
          equalityFn: (a, b) => a?.enabled === b?.enabled && a?.threshold === b?.threshold,
        }
      )
      unsubscribers.push(unsubGate)

      // Compressor (enabled + threshold)
      const unsubCompressor = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return { enabled: ch.compEnabled, threshold: ch.compThreshold }
        },
        (comp) => {
          if (!comp || !context) return
          const t = context.currentTime
          const compressor = channels[i].compressor
          if (comp.enabled) {
            compressor.threshold.setValueAtTime(comp.threshold, t)
            compressor.ratio.setValueAtTime(4, t)
            compressor.knee.setValueAtTime(6, t)
            compressor.attack.setValueAtTime(0.01, t)
            compressor.release.setValueAtTime(0.12, t)
          } else {
            // Near-bypass behavior while keeping a stable node graph.
            compressor.threshold.setValueAtTime(0, t)
            compressor.ratio.setValueAtTime(1, t)
            compressor.knee.setValueAtTime(0, t)
            compressor.attack.setValueAtTime(0.003, t)
            compressor.release.setValueAtTime(0.05, t)
          }
        },
        {
          fireImmediately: true,
          equalityFn: (a, b) => a?.enabled === b?.enabled && a?.threshold === b?.threshold,
        }
      )
      unsubscribers.push(unsubCompressor)

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

      // Channel routing assignment: Main LR and Mono bus
      const unsubRouting = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return { mainLrBus: ch.mainLrBus, monoBus: ch.monoBus, monoLevel: ch.monoLevel }
        },
        (routing) => {
          if (!routing || !context) return
          const t = context.currentTime
          chain.mainAssignGain.gain.setValueAtTime(routing.mainLrBus ? 1 : 0, t)
          chain.monoAssignGain.gain.setValueAtTime(routing.monoBus ? routing.monoLevel : 0, t)
        },
        {
          fireImmediately: true,
          equalityFn: (a, b) =>
            a?.mainLrBus === b?.mainLrBus &&
            a?.monoBus === b?.monoBus &&
            a?.monoLevel === b?.monoLevel,
        }
      )
      unsubscribers.push(unsubRouting)

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
              hpf.enabled ? Math.max(10, hpf.freq) : 10,
              context.currentTime
            )
          }
        },
        { equalityFn: (a, b) => a?.enabled === b?.enabled && a?.freq === b?.freq }
      )
      unsubscribers.push(unsubHpf)

      // Phase invert
      const unsubPhaseInvert = store.subscribe(
        (state) => state.channels[i]?.phaseInvert,
        (phaseInvert) => {
          if (phaseInvert !== undefined && context) {
            chain.phaseGain.gain.setValueAtTime(phaseInvert ? -1 : 1, context.currentTime)
          }
        }
      )
      unsubscribers.push(unsubPhaseInvert)

      // EQ (enabled + all band params as a group)
      const unsubEq = store.subscribe(
        (state) => {
          const ch = state.channels[i]
          if (!ch) return null
          return {
            enabled: ch.eqEnabled,
            selectedBand: ch.eqSelectedBand,
            modeIndex: ch.eqModeIndex,
            lowFreq: ch.eqLowFreq, lowGain: ch.eqLowGain,
            lowMidFreq: ch.eqLowMidFreq, lowMidGain: ch.eqLowMidGain,
            highMidFreq: ch.eqHighMidFreq, highMidGain: ch.eqHighMidGain,
            midQ: ch.eqMidQ,
            highFreq: ch.eqHighFreq, highGain: ch.eqHighGain,
          }
        },
        (eq) => {
          if (!eq || !context) return
          const t = context.currentTime

          // Base EQ defaults when no mode override is active for a band.
          chain.eqLow.type = 'lowshelf'
          chain.eqLow.frequency.setValueAtTime(eq.lowFreq, t)
          chain.eqLow.gain.setValueAtTime(eq.enabled ? eq.lowGain : 0, t)
          chain.eqLow.Q.setValueAtTime(0.707, t)

          chain.eqLowMid.type = 'peaking'
          chain.eqLowMid.frequency.setValueAtTime(eq.lowMidFreq, t)
          chain.eqLowMid.gain.setValueAtTime(eq.enabled ? eq.lowMidGain : 0, t)
          chain.eqLowMid.Q.setValueAtTime(eq.midQ, t)

          chain.eqHighMid.type = 'peaking'
          chain.eqHighMid.frequency.setValueAtTime(eq.highMidFreq, t)
          chain.eqHighMid.gain.setValueAtTime(eq.enabled ? eq.highMidGain : 0, t)
          chain.eqHighMid.Q.setValueAtTime(eq.midQ, t)

          chain.eqHigh.type = 'highshelf'
          chain.eqHigh.frequency.setValueAtTime(eq.highFreq, t)
          chain.eqHigh.gain.setValueAtTime(eq.enabled ? eq.highGain : 0, t)
          chain.eqHigh.Q.setValueAtTime(0.707, t)

          if (!eq.enabled) return

          const targetBand = mapSelectedBandToEqTarget(eq.selectedBand)
          const modeType = mapEqModeToBiquadType(eq.modeIndex)
          const targetNode = targetBand === 'low'
            ? chain.eqLow
            : targetBand === 'lowMid'
              ? chain.eqLowMid
              : targetBand === 'highMid'
                ? chain.eqHighMid
                : chain.eqHigh
          const targetFreq = targetBand === 'low'
            ? eq.lowFreq
            : targetBand === 'lowMid'
              ? eq.lowMidFreq
              : targetBand === 'highMid'
                ? eq.highMidFreq
                : eq.highFreq
          const targetGain = targetBand === 'low'
            ? eq.lowGain
            : targetBand === 'lowMid'
              ? eq.lowMidGain
              : targetBand === 'highMid'
                ? eq.highMidGain
                : eq.highGain

          targetNode.type = modeType
          targetNode.frequency.setValueAtTime(targetFreq, t)

          if (modeType === 'highpass' || modeType === 'lowpass') {
            targetNode.Q.setValueAtTime(0.707, t)
            targetNode.gain.setValueAtTime(0, t)
          } else if (modeType === 'peaking') {
            // VEQ (2) is broader/smoother than PEQ (3).
            const modeQ = eq.modeIndex === 2 ? Math.max(0.1, eq.midQ * 0.6) : eq.midQ
            targetNode.Q.setValueAtTime(modeQ, t)
            targetNode.gain.setValueAtTime(targetGain, t)
          } else {
            targetNode.Q.setValueAtTime(0.707, t)
            targetNode.gain.setValueAtTime(targetGain, t)
          }
        },
        {
          equalityFn: (a, b) =>
            a?.enabled === b?.enabled &&
            a?.selectedBand === b?.selectedBand &&
            a?.modeIndex === b?.modeIndex &&
            a?.lowFreq === b?.lowFreq && a?.lowGain === b?.lowGain &&
            a?.lowMidFreq === b?.lowMidFreq && a?.lowMidGain === b?.lowMidGain &&
            a?.highMidFreq === b?.highMidFreq && a?.highMidGain === b?.highMidGain &&
            a?.midQ === b?.midQ &&
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

      // Input source
      const unsubInputSource = store.subscribe(
        (state) => state.channels[i]?.inputSource,
        (inputSource) => {
          if (!inputSource || !sourceManager || !context) return
          sourceManager.setChannelSource(i, inputSource)

          // Adjust sourceAttenuation based on input type:
          // - Stems use the channel's configured inputType attenuation (simulates mic/line level)
          // - Tones have their own level control, so no attenuation needed
          // - Live inputs are real mic-level signals, so no attenuation needed
          // - None: reset to channel's configured inputType
          const ch = useMixerStore.getState().channels[i]
          let attenuationDb: number
          if (inputSource.type === 'stem' || inputSource.type === 'none') {
            attenuationDb = INPUT_TYPE_CONFIG[ch?.inputType ?? 'direct'].attenuation
          } else {
            attenuationDb = 0
          }
          chain.sourceAttenuation.gain.setValueAtTime(
            dbToGain(attenuationDb),
            context.currentTime
          )
        },
        { fireImmediately: true }
      )
      unsubscribers.push(unsubInputSource)
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

      const unsubBusSolo = store.subscribe(
        (state) => state.mixBuses[b]?.solo,
        (solo) => {
          if (solo !== undefined && context) {
            busChain.soloGain.gain.setValueAtTime(solo ? 1 : 0, context.currentTime)
          }
        }
      )
      unsubscribers.push(unsubBusSolo)
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

    // Main SOLO tap enable
    const unsubMasterSolo = store.subscribe(
      (state) => state.master.solo,
      (solo) => {
        if (!context || !mainSoloTapGain) return
        mainSoloTapGain.gain.setValueAtTime(solo ? 1 : 0, context.currentTime)
      }
    )
    unsubscribers.push(unsubMasterSolo)

    // Solo state (per-channel soloGain nodes)
    const unsubSoloChannels = store.subscribe(
      (state) => state.channels.map((ch) =>
        ch.solo || ch.dcaGroups.some((dcaId) => state.dcaGroups[dcaId]?.solo)
      ),
      (effectiveSolos) => {
        if (!context) return
        const t = context.currentTime
        for (let j = 0; j < channels.length; j++) {
          channels[j].soloGain.gain.setValueAtTime(effectiveSolos[j] ? 1 : 0, t)
        }
      },
      {
        fireImmediately: true,
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
    sourceManager?.dispose()
    transport?.dispose()
    fxDisposers.forEach((disposeFx) => disposeFx())
    fxDisposers.length = 0
    if (gateRafId !== null) {
      cancelAnimationFrame(gateRafId)
      gateRafId = null
    }
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers.length = 0
    context?.close()
    context = null
    channels = []
    gateRuntimes = []
    dynamicsLevels.gateReductionDb.fill(0)
    dynamicsLevels.compReductionDb.fill(0)
  }

  return {
    init,
    dispose,
    resume: async () => {
      if (!context) return
      if (context.state === 'suspended') {
        try {
          await context.resume()
        } catch {
          // Ignore autoplay-policy failures until next user gesture.
        }
      }
    },
    getAudioState: () => context?.state ?? 'closed',
    getTransport: () => transport,
    getMetering: () => metering,
    getSourceManager: () => sourceManager,
  }
}
