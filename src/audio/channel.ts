import { faderPositionToGain, dbToGain } from '@/audio/fader-taper'

export interface ChannelChain {
  inputGain: GainNode
  faderGain: GainNode
  analyser: AnalyserNode
  inputNode: GainNode // Where the source connects (same ref as inputGain)
}

export function createChannelChain(
  context: AudioContext,
  destination: AudioNode,
  initialGainDb: number,
  initialFaderPosition: number
): ChannelChain {
  const inputGain = context.createGain()
  const faderGain = context.createGain()
  const analyser = context.createAnalyser()

  analyser.fftSize = 1024

  inputGain.gain.value = dbToGain(initialGainDb)
  faderGain.gain.value = faderPositionToGain(initialFaderPosition)

  inputGain.connect(faderGain)
  faderGain.connect(analyser)
  analyser.connect(destination)

  return { inputGain, faderGain, analyser, inputNode: inputGain }
}
