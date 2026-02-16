import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'
import { INPUT_TYPE_CONFIG, type ChannelState } from '@/state/mixer-store'

export interface ChannelChain {
  sourceAttenuation: GainNode
  inputGain: GainNode
  preFaderAnalyser: AnalyserNode
  hpf: BiquadFilterNode
  eqLow: BiquadFilterNode
  eqMid: BiquadFilterNode
  eqHigh: BiquadFilterNode
  panner: StereoPannerNode
  faderGain: GainNode
  muteGain: GainNode
  analyser: AnalyserNode
  soloGain: GainNode
  sendGains: GainNode[]  // One per mix bus — controls send level
  inputNode: GainNode    // Where the source connects (sourceAttenuation)
}

export function createChannelChain(
  context: AudioContext,
  mainBus: AudioNode,
  soloBus: AudioNode,
  initialState: ChannelState,
  mixBusSummingNodes: AudioNode[]
): ChannelChain {
  const sourceAttenuation = context.createGain()
  const inputGain = context.createGain()
  const preFaderAnalyser = context.createAnalyser()
  const hpf = context.createBiquadFilter()
  const eqLow = context.createBiquadFilter()
  const eqMid = context.createBiquadFilter()
  const eqHigh = context.createBiquadFilter()
  const panner = context.createStereoPanner()
  const faderGain = context.createGain()
  const muteGain = context.createGain()
  const analyser = context.createAnalyser()
  const soloGain = context.createGain()

  preFaderAnalyser.fftSize = 1024
  analyser.fftSize = 1024

  // Source attenuation simulates mic/line level input
  const typeConfig = INPUT_TYPE_CONFIG[initialState.inputType]
  sourceAttenuation.gain.value = dbToGain(typeConfig.attenuation)

  // Initial values
  inputGain.gain.value = dbToGain(initialState.gain)

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

  soloGain.gain.value = 0 // Always start off; engine manages solo state globally

  // Create send gain nodes (one per mix bus)
  const sendGains = mixBusSummingNodes.map((_, i) => {
    const g = context.createGain()
    g.gain.value = initialState.sends[i]?.level ?? 0
    return g
  })

  // Wire signal chain: source → attenuation → gain → processing
  sourceAttenuation
    .connect(inputGain)

  // Pre-fader meter tap (after gain, before processing)
  inputGain.connect(preFaderAnalyser)

  inputGain
    .connect(hpf)
    .connect(eqLow)
    .connect(eqMid)
    .connect(eqHigh)
    .connect(panner)
    .connect(faderGain)
    .connect(muteGain)

  muteGain.connect(analyser)
  analyser.connect(mainBus)

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
    inputGain,
    preFaderAnalyser,
    hpf,
    eqLow,
    eqMid,
    eqHigh,
    panner,
    faderGain,
    muteGain,
    analyser,
    soloGain,
    sendGains,
    inputNode: sourceAttenuation,
  }
}
