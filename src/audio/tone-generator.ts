import type { ChannelChain } from '@/audio/channel'

interface ToneSpec {
  type: 'sine' | 'sawtooth' | 'square' | 'triangle' | 'pink-noise' | 'white-noise'
  frequency?: number
}

const TONE_PATTERN: ToneSpec[] = [
  { type: 'sine', frequency: 220 },
  { type: 'sine', frequency: 440 },
  { type: 'sawtooth', frequency: 330 },
  { type: 'square', frequency: 523 },
  { type: 'pink-noise' },
  { type: 'sine', frequency: 880 },
  { type: 'triangle', frequency: 660 },
  { type: 'white-noise' },
]

const TONE_LABELS: Record<string, string> = {
  'sine': 'Sin',
  'sawtooth': 'Saw',
  'square': 'Sqr',
  'triangle': 'Tri',
  'pink-noise': 'Pink',
  'white-noise': 'White',
}

export function getToneLabel(channelIndex: number): string {
  if (channelIndex >= TONE_PATTERN.length) return ''
  const spec = TONE_PATTERN[channelIndex]
  const name = TONE_LABELS[spec.type] ?? spec.type
  return spec.frequency ? `${name} ${spec.frequency}` : name
}

const NOISE_DURATION = 4 // seconds
const TONE_LEVEL = 0.3   // ~-10 dB output level per source

function generateWhiteNoise(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function generatePinkNoise(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)

  // Voss-McCartney pink noise algorithm
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buffer
}

interface ActiveSource {
  node: OscillatorNode | AudioBufferSourceNode
  gain: GainNode
}

export class ToneGenerator {
  private context: AudioContext
  private channels: ChannelChain[]
  private sources: ActiveSource[] = []
  private whiteNoiseBuffer: AudioBuffer | null = null
  private pinkNoiseBuffer: AudioBuffer | null = null

  constructor(context: AudioContext, channels: ChannelChain[]) {
    this.context = context
    this.channels = channels
  }

  start(): void {
    this.stop()

    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    // Generate noise buffers once (reused across start/stop cycles)
    if (!this.whiteNoiseBuffer) {
      this.whiteNoiseBuffer = generateWhiteNoise(this.context, NOISE_DURATION)
    }
    if (!this.pinkNoiseBuffer) {
      this.pinkNoiseBuffer = generatePinkNoise(this.context, NOISE_DURATION)
    }

    const count = Math.min(this.channels.length, TONE_PATTERN.length)
    for (let i = 0; i < count; i++) {
      const spec = TONE_PATTERN[i]
      const gain = this.context.createGain()
      gain.gain.value = TONE_LEVEL
      gain.connect(this.channels[i].inputNode)

      let node: OscillatorNode | AudioBufferSourceNode

      if (spec.type === 'white-noise' || spec.type === 'pink-noise') {
        const bufferSource = this.context.createBufferSource()
        bufferSource.buffer = spec.type === 'pink-noise'
          ? this.pinkNoiseBuffer
          : this.whiteNoiseBuffer
        bufferSource.loop = true
        bufferSource.connect(gain)
        bufferSource.start()
        node = bufferSource
      } else {
        const osc = this.context.createOscillator()
        osc.type = spec.type
        osc.frequency.value = spec.frequency!
        osc.connect(gain)
        osc.start()
        node = osc
      }

      this.sources.push({ node, gain })
    }
  }

  stop(): void {
    for (const { node, gain } of this.sources) {
      try { node.stop() } catch { /* already stopped */ }
      node.disconnect()
      gain.disconnect()
    }
    this.sources = []
  }

  dispose(): void {
    this.stop()
    this.whiteNoiseBuffer = null
    this.pinkNoiseBuffer = null
  }
}
