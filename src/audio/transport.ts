import { useMixerStore } from '@/state/mixer-store'
import type { ChannelChain } from '@/audio/channel'

export interface StemConfig {
  url: string
  label: string
}

export interface StemManifest {
  title: string
  stems: StemConfig[]
}

interface StemData {
  buffer: AudioBuffer
  label: string
}

export class TransportManager {
  private context: AudioContext
  private channels: ChannelChain[]
  private stems: StemData[] = []
  private sourceNodes: AudioBufferSourceNode[] = []
  private isPlaying = false
  private startedAt = 0
  private pausedAt = 0
  private rafId: number | null = null

  constructor(context: AudioContext, channels: ChannelChain[]) {
    this.context = context
    this.channels = channels
  }

  async loadStems(manifest: StemManifest): Promise<void> {
    const store = useMixerStore.getState()

    try {
      const loadPromises = manifest.stems.map(async (stem) => {
        const response = await fetch(stem.url)
        if (!response.ok) throw new Error(`Failed to load ${stem.url}: ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
        return { buffer: audioBuffer, label: stem.label }
      })

      this.stems = await Promise.all(loadPromises)

      const maxDuration = Math.max(...this.stems.map((s) => s.buffer.duration))
      store.setDuration(maxDuration)
      store.initChannels(this.stems.length, this.stems.map((s) => s.label))
      store.setStemsLoaded(true)
    } catch (error) {
      store.setLoadingError(
        error instanceof Error ? error.message : 'Failed to load stems'
      )
    }
  }

  play(): void {
    if (this.isPlaying) return

    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    this.disposeSourceNodes()

    const offset = this.pausedAt
    const startTime = this.context.currentTime

    this.sourceNodes = this.stems.map((stem, i) => {
      const source = this.context.createBufferSource()
      source.buffer = stem.buffer
      source.connect(this.channels[i].inputNode)
      source.start(startTime, offset)
      return source
    })

    this.startedAt = startTime - offset
    this.isPlaying = true

    // Detect natural end of playback
    if (this.sourceNodes.length > 0) {
      this.sourceNodes[0].onended = () => {
        if (this.isPlaying) {
          this.isPlaying = false
          this.pausedAt = 0
          useMixerStore.getState().stop()
          useMixerStore.getState().setCurrentTime(0)
        }
      }
    }

    this.startTimeUpdates()
  }

  stop(): void {
    if (!this.isPlaying) return
    this.pausedAt = 0
    this.isPlaying = false
    this.disposeSourceNodes()
    this.stopTimeUpdates()
  }

  rewind(): void {
    if (this.isPlaying) {
      this.disposeSourceNodes()
      this.isPlaying = false
    }
    this.pausedAt = 0
    this.stopTimeUpdates()
    useMixerStore.getState().setCurrentTime(0)
  }

  dispose(): void {
    this.disposeSourceNodes()
    this.stopTimeUpdates()
    this.stems = []
  }

  private disposeSourceNodes(): void {
    this.sourceNodes.forEach((source) => {
      try { source.stop() } catch { /* already stopped */ }
      source.disconnect()
    })
    this.sourceNodes = []
  }

  private startTimeUpdates(): void {
    const update = () => {
      if (!this.isPlaying) return
      const elapsed = this.context.currentTime - this.startedAt
      useMixerStore.getState().setCurrentTime(elapsed)
      this.rafId = requestAnimationFrame(update)
    }
    this.rafId = requestAnimationFrame(update)
  }

  private stopTimeUpdates(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}
