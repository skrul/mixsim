import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'
import { INPUT_TYPE_CONFIG, type ChannelState } from '@/state/mixer-store'
import { GAIN_MIN } from '@/state/mixer-model'

export interface ChannelChain {
  sourceAttenuation: GainNode
  phaseGain: GainNode
  inputGain: GainNode
  preFaderAnalyser: AnalyserNode
  gateGain: GainNode
  gateDetector: AnalyserNode
  compressor: DynamicsCompressorNode
  hpf: BiquadFilterNode
  eqLow: BiquadFilterNode
  eqMid: BiquadFilterNode
  eqHigh: BiquadFilterNode
  panner: StereoPannerNode
  faderGain: GainNode
  muteGain: GainNode
  analyser: AnalyserNode
  mainAssignGain: GainNode
  monoAssignGain: GainNode
  monoSplitter: ChannelSplitterNode
  monoSum: GainNode
  soloGain: GainNode
  sendGains: GainNode[]  // One per mix bus — controls send level
  inputNode: GainNode    // Where the source connects (sourceAttenuation)
}

export function createChannelChain(
  context: AudioContext,
  mainBus: AudioNode,
  monoBus: AudioNode,
  soloBus: AudioNode,
  initialState: ChannelState,
  mixBusSummingNodes: AudioNode[]
): ChannelChain {
  const preampDbToGain = (gainDb: number): number => (gainDb <= GAIN_MIN ? 0 : dbToGain(gainDb))

  const sourceAttenuation = context.createGain()
  const phaseGain = context.createGain()
  const inputGain = context.createGain()
  const preFaderAnalyser = context.createAnalyser()
  const gateGain = context.createGain()
  const gateDetector = context.createAnalyser()
  const compressor = context.createDynamicsCompressor()
  const hpf = context.createBiquadFilter()
  const eqLow = context.createBiquadFilter()
  const eqMid = context.createBiquadFilter()
  const eqHigh = context.createBiquadFilter()
  const panner = context.createStereoPanner()
  const faderGain = context.createGain()
  const muteGain = context.createGain()
  const analyser = context.createAnalyser()
  const mainAssignGain = context.createGain()
  const monoAssignGain = context.createGain()
  const monoSplitter = context.createChannelSplitter(2)
  const monoSum = context.createGain()
  const soloGain = context.createGain()

  preFaderAnalyser.fftSize = 1024
  gateDetector.fftSize = 1024
  analyser.fftSize = 1024

  // Source attenuation simulates mic/line level input
  const typeConfig = INPUT_TYPE_CONFIG[initialState.inputType]
  sourceAttenuation.gain.value = dbToGain(typeConfig.attenuation)
  phaseGain.gain.value = initialState.phaseInvert ? -1 : 1

  // Initial values
  inputGain.gain.value = preampDbToGain(initialState.gain)
  gateGain.gain.value = initialState.gateEnabled ? 0 : 1
  compressor.threshold.value = initialState.compEnabled ? initialState.compThreshold : 0
  compressor.ratio.value = initialState.compEnabled ? 4 : 1
  compressor.attack.value = 0.01
  compressor.release.value = 0.12
  compressor.knee.value = 6

  hpf.type = 'highpass'
  hpf.frequency.value = initialState.hpfEnabled ? initialState.hpfFreq : 10
  hpf.Q.value = 0.707

  eqLow.type = 'lowshelf'
  eqLow.frequency.value = initialState.eqLowFreq
  eqLow.gain.value = initialState.eqEnabled ? initialState.eqLowGain : 0

  eqMid.type = 'peaking'
  eqMid.frequency.value = initialState.eqMidFreq
  eqMid.gain.value = initialState.eqEnabled ? initialState.eqMidGain : 0
  eqMid.Q.value = initialState.eqMidQ

  eqHigh.type = 'highshelf'
  eqHigh.frequency.value = initialState.eqHighFreq
  eqHigh.gain.value = initialState.eqEnabled ? initialState.eqHighGain : 0

  panner.pan.value = initialState.pan

  faderGain.gain.value = faderPositionToGain(initialState.faderPosition)

  muteGain.gain.value = initialState.mute ? 0 : 1
  mainAssignGain.gain.value = initialState.mainLrBus ? 1 : 0
  monoAssignGain.gain.value = initialState.monoBus ? initialState.monoLevel : 0

  soloGain.gain.value = 0 // Always start off; engine manages solo state globally

  // Create send gain nodes (one per mix bus)
  const sendGains = mixBusSummingNodes.map((_, i) => {
    const g = context.createGain()
    g.gain.value = initialState.sends[i]?.level ?? 0
    return g
  })

  // Wire signal chain: source → attenuation → gain → processing
  sourceAttenuation
    .connect(phaseGain)
    .connect(inputGain)

  // Pre-fader meter tap (after gain, before processing)
  inputGain.connect(preFaderAnalyser)
  inputGain.connect(gateDetector)

  inputGain
    .connect(gateGain)
    .connect(hpf)
    .connect(eqLow)
    .connect(eqMid)
    .connect(eqHigh)
    .connect(compressor)
    .connect(panner)
    .connect(faderGain)
    .connect(muteGain)

  muteGain.connect(analyser)
  analyser.connect(mainAssignGain)
  mainAssignGain.connect(mainBus)

  analyser.connect(monoSplitter)
  monoSplitter.connect(monoSum, 0)
  monoSplitter.connect(monoSum, 1)
  monoSum.gain.value = 0.5
  monoSum.connect(monoAssignGain)
  monoAssignGain.connect(monoBus)

  // PFL solo tap: feed solo bus from pre-fader path so it is independent of
  // channel fader and mute, which is useful for gain staging.
  inputGain.connect(soloGain)
  soloGain.connect(soloBus)

  // Wire sends — default is post-fader (from faderGain, before muteGain)
  for (let i = 0; i < sendGains.length; i++) {
    const tapNode = initialState.sends[i]?.preFader ? panner : faderGain
    tapNode.connect(sendGains[i])
    sendGains[i].connect(mixBusSummingNodes[i])
  }

  return {
    sourceAttenuation,
    phaseGain,
    inputGain,
    preFaderAnalyser,
    gateGain,
    gateDetector,
    compressor,
    hpf,
    eqLow,
    eqMid,
    eqHigh,
    panner,
    faderGain,
    muteGain,
    analyser,
    mainAssignGain,
    monoAssignGain,
    monoSplitter,
    monoSum,
    soloGain,
    sendGains,
    inputNode: sourceAttenuation,
  }
}
