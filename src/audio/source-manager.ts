import type { ChannelChain } from '@/audio/channel'
import type { ChannelInputSource } from '@/state/mixer-model'
import { useMixerStore } from '@/state/mixer-store'

// ---- Tone definitions ----

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

export function getToneLabel(toneIndex: number): string {
  if (toneIndex < 0 || toneIndex >= TONE_PATTERN.length) return ''
  const spec = TONE_PATTERN[toneIndex]
  const name = TONE_LABELS[spec.type] ?? spec.type
  return spec.frequency ? `${name} ${spec.frequency}` : name
}

// ---- Noise generation ----

const NOISE_DURATION = 4 // seconds
const TONE_LEVEL = 0.3   // ~-10 dB output level per tone source

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

// ---- Per-channel active source tracking ----

interface ActiveChannelSource {
  type: ChannelInputSource['type']
  nodes: AudioNode[]           // all nodes to disconnect on teardown
  stopFn?: () => void          // stop oscillators/buffer sources
  stream?: MediaStream         // live input stream to stop tracks
  liveDeviceId?: string        // deviceId for shared live stream refcounting
}

// ---- SourceManager ----

export class SourceManager {
  private context: AudioContext
  private channels: ChannelChain[]
  private activeSources: (ActiveChannelSource | null)[]
  private whiteNoiseBuffer: AudioBuffer | null = null
  private pinkNoiseBuffer: AudioBuffer | null = null
  private trackBuffers: AudioBuffer[] = []
  private trackPlaying = false
  private trackOffset = 0
  private deviceLeftOutput: GainNode
  private deviceRightOutput: GainNode
  private deviceSource: AudioBufferSourceNode | null = null
  private deviceSplitter: ChannelSplitterNode | null = null
  private liveDevices: Map<string, {
    stream: MediaStream
    sourceNode: MediaStreamAudioSourceNode
    splitter: ChannelSplitterNode
    channelCount: number
    refCount: number
  }> = new Map()

  constructor(context: AudioContext, channels: ChannelChain[]) {
    this.context = context
    this.channels = channels
    this.activeSources = new Array(channels.length).fill(null)
    this.deviceLeftOutput = context.createGain()
    this.deviceRightOutput = context.createGain()
  }

  setTrackBuffers(buffers: AudioBuffer[]): void {
    this.trackBuffers = buffers
  }

  /** Connect/disconnect the source for a single channel. */
  setChannelSource(index: number, source: ChannelInputSource): void {
    if (index < 0 || index >= this.channels.length) return

    if (source.type !== 'none' && this.context.state === 'suspended') {
      this.context.resume().catch(() => {
        // Autoplay policy may block until user interaction; ignore here.
      })
    }

    // Tear down existing source
    this.teardownChannel(index)

    switch (source.type) {
      case 'tone':
        this.connectTone(index, source.toneIndex)
        break
      case 'track':
        // Track sources are only created during transport playback.
        // Record the assignment so startTrackSources knows about it.
        this.activeSources[index] = { type: 'track', nodes: [] }
        // If transport is already playing, start this track immediately
        if (this.trackPlaying) {
          this.startSingleTrack(index, source.trackIndex, source.channel)
        }
        break
      case 'live':
        this.connectLive(index, source.deviceId, source.channel)
        break
      case 'device': {
        const outputNode = source.channel === 'left' ? this.deviceLeftOutput : this.deviceRightOutput
        const inputNode = this.channels[index].inputNode
        outputNode.connect(inputNode)
        this.activeSources[index] = {
          type: 'device',
          nodes: [],
          stopFn: () => {
            try { outputNode.disconnect(inputNode) } catch { /* already disconnected */ }
          },
        }
        break
      }
      case 'none':
        // Already torn down
        break
    }
  }

  /** Start all track-assigned channels at the given offset. Called by transport play. */
  startTrackSources(offset: number, channelSources: ChannelInputSource[]): void {
    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    this.trackPlaying = true
    this.trackOffset = offset

    for (let i = 0; i < this.channels.length; i++) {
      const src = channelSources[i]
      if (src?.type === 'track') {
        this.startSingleTrack(i, src.trackIndex, src.channel)
      }
    }
  }

  /** Stop all track-assigned channels. Called by transport stop. */
  stopTrackSources(): void {
    this.trackPlaying = false
    for (let i = 0; i < this.activeSources.length; i++) {
      const active = this.activeSources[i]
      if (active?.type === 'track' && active.nodes.length > 0) {
        active.stopFn?.()
        for (const node of active.nodes) node.disconnect()
        active.nodes = []
        active.stopFn = undefined
      }
    }
  }

  startDevice(trackIndex: number): void {
    this.stopDevice()
    const buffer = this.trackBuffers[trackIndex]
    if (!buffer) return

    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const splitter = this.context.createChannelSplitter(2)
    source.connect(splitter)
    splitter.connect(this.deviceLeftOutput, 0)
    splitter.connect(this.deviceRightOutput, 1)

    source.start()
    this.deviceSource = source
    this.deviceSplitter = splitter
  }

  stopDevice(): void {
    if (this.deviceSource) {
      try { this.deviceSource.stop() } catch { /* */ }
      this.deviceSource.disconnect()
      this.deviceSource = null
    }
    if (this.deviceSplitter) {
      this.deviceSplitter.disconnect()
      this.deviceSplitter = null
    }
  }

  dispose(): void {
    this.stopDevice()
    for (let i = 0; i < this.channels.length; i++) {
      this.teardownChannel(i)
    }
    // Stop any remaining shared live devices
    for (const entry of this.liveDevices.values()) {
      entry.splitter.disconnect()
      entry.sourceNode.disconnect()
      entry.stream.getTracks().forEach((t) => t.stop())
    }
    this.liveDevices.clear()
    this.whiteNoiseBuffer = null
    this.pinkNoiseBuffer = null
    this.trackBuffers = []
  }

  // ---- Private ----

  private teardownChannel(index: number): void {
    const active = this.activeSources[index]
    if (!active) return

    active.stopFn?.()
    for (const node of active.nodes) {
      try { node.disconnect() } catch { /* already disconnected */ }
    }
    if (active.liveDeviceId) {
      // Decrement shared device refcount; tear down source+splitter when no channels use it
      const entry = this.liveDevices.get(active.liveDeviceId)
      if (entry) {
        entry.refCount--
        if (entry.refCount <= 0) {
          entry.splitter.disconnect()
          entry.sourceNode.disconnect()
          entry.stream.getTracks().forEach((t) => t.stop())
          this.liveDevices.delete(active.liveDeviceId)
        }
      }
    } else if (active.stream) {
      active.stream.getTracks().forEach((t) => t.stop())
    }
    this.activeSources[index] = null
  }

  private ensureNoiseBuffers(): void {
    if (!this.whiteNoiseBuffer) {
      this.whiteNoiseBuffer = generateWhiteNoise(this.context, NOISE_DURATION)
    }
    if (!this.pinkNoiseBuffer) {
      this.pinkNoiseBuffer = generatePinkNoise(this.context, NOISE_DURATION)
    }
  }

  private connectTone(channelIndex: number, toneIndex: number): void {
    if (toneIndex < 0 || toneIndex >= TONE_PATTERN.length) return
    this.ensureNoiseBuffers()

    const spec = TONE_PATTERN[toneIndex]
    const gain = this.context.createGain()
    gain.gain.value = TONE_LEVEL
    gain.connect(this.channels[channelIndex].inputNode)

    if (spec.type === 'white-noise' || spec.type === 'pink-noise') {
      const bufferSource = this.context.createBufferSource()
      bufferSource.buffer = spec.type === 'pink-noise'
        ? this.pinkNoiseBuffer
        : this.whiteNoiseBuffer
      bufferSource.loop = true
      bufferSource.connect(gain)
      bufferSource.start()
      this.activeSources[channelIndex] = {
        type: 'tone',
        nodes: [bufferSource, gain],
        stopFn: () => { try { bufferSource.stop() } catch { /* */ } },
      }
    } else {
      const osc = this.context.createOscillator()
      osc.type = spec.type
      osc.frequency.value = spec.frequency!
      osc.connect(gain)
      osc.start()
      this.activeSources[channelIndex] = {
        type: 'tone',
        nodes: [osc, gain],
        stopFn: () => { try { osc.stop() } catch { /* */ } },
      }
    }
  }

  private startSingleTrack(channelIndex: number, trackIndex: number, channel?: 'left' | 'right'): void {
    const buffer = this.trackBuffers[trackIndex]
    if (!buffer) return

    // Tear down any existing track nodes for this channel (but keep the assignment)
    const active = this.activeSources[channelIndex]
    if (active?.type === 'track' && active.nodes.length > 0) {
      active.stopFn?.()
      for (const node of active.nodes) node.disconnect()
      active.nodes = []
      active.stopFn = undefined
    }

    const source = this.context.createBufferSource()
    source.buffer = buffer

    if (channel && buffer.numberOfChannels >= 2) {
      const splitter = this.context.createChannelSplitter(2)
      source.connect(splitter)
      const outputIndex = channel === 'left' ? 0 : 1
      splitter.connect(this.channels[channelIndex].inputNode, outputIndex)

      if (!this.activeSources[channelIndex]) {
        this.activeSources[channelIndex] = { type: 'track', nodes: [] }
      }
      this.activeSources[channelIndex]!.nodes = [source, splitter]
    } else {
      source.connect(this.channels[channelIndex].inputNode)

      if (!this.activeSources[channelIndex]) {
        this.activeSources[channelIndex] = { type: 'track', nodes: [] }
      }
      this.activeSources[channelIndex]!.nodes = [source]
    }

    source.start(this.context.currentTime, this.trackOffset)
    this.activeSources[channelIndex]!.stopFn = () => {
      try { source.stop() } catch { /* */ }
    }
  }

  private async connectLive(channelIndex: number, deviceId: string, channel?: number): Promise<void> {
    try {
      // Resume AudioContext if suspended (requires prior user gesture)
      if (this.context.state === 'suspended') {
        await this.context.resume()
      }

      // Reuse an existing device entry or open a new one.
      // A single MediaStreamAudioSourceNode + ChannelSplitterNode is shared
      // across all mixer channels that use the same hardware device.
      let entry = this.liveDevices.get(deviceId)
      if (!entry) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            channelCount: { ideal: 32 },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })

        // Re-enumerate with full labels now that we have permission
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Input ${d.deviceId.slice(0, 8)}` }))
        useMixerStore.getState().setAvailableLiveDevices(audioInputs)

        const channelCount = stream.getAudioTracks()[0]?.getSettings()?.channelCount ?? 1
        const sourceNode = this.context.createMediaStreamSource(stream)
        const splitter = this.context.createChannelSplitter(channelCount)
        sourceNode.connect(splitter)

        entry = { stream, sourceNode, splitter, channelCount, refCount: 0 }
        this.liveDevices.set(deviceId, entry)
      }

      const store = useMixerStore.getState()
      store.setLiveDeviceChannelCount(deviceId, entry.channelCount)

      if (entry.channelCount > 1 && channel === undefined) {
        // Auto-select channel 0 for multi-channel devices.
        // This updates the store which will re-trigger connectLive with channel=0.
        store.setChannelInputSource(channelIndex, { type: 'live', deviceId, channel: 0 })
        return
      }

      entry.refCount++
      const selectedChannel = channel ?? 0

      // Per-channel gain node taps into the shared splitter output
      const gain = this.context.createGain()
      const { splitter } = entry
      splitter.connect(gain, selectedChannel)
      gain.connect(this.channels[channelIndex].inputNode)

      this.activeSources[channelIndex] = {
        type: 'live',
        nodes: [gain],
        liveDeviceId: deviceId,
        stopFn: () => {
          try { splitter.disconnect(gain, selectedChannel) } catch { /* */ }
        },
      }
    } catch (err) {
      console.warn(`Failed to open live input ${deviceId}:`, err)
    }
  }
}
