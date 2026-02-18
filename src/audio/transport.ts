import { useMixerStore } from '@/state/mixer-store'

export type InputType = 'mic' | 'line' | 'direct'

export interface StemConfig {
  url: string
  label: string
  inputType?: InputType
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
  private stems: StemData[] = []
  private isPlaying = false
  private startedAt = 0
  private pausedAt = 0
  private rafId: number | null = null
  private duration = 0

  constructor(context: AudioContext) {
    this.context = context
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

      this.duration = Math.max(...this.stems.map((s) => s.buffer.duration))
      store.setDuration(this.duration)
      store.setStemsLoaded(true)
    } catch (error) {
      store.setLoadingError(
        error instanceof Error ? error.message : 'Failed to load stems'
      )
    }
  }

  /** Get loaded stem audio buffers for SourceManager to use. */
  getStemBuffers(): AudioBuffer[] {
    return this.stems.map((s) => s.buffer)
  }

  /** Get the current playback offset (for starting stem sources). */
  getOffset(): number {
    return this.pausedAt
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      return Math.max(0, Math.min(this.duration, this.context.currentTime - this.startedAt))
    }
    return Math.max(0, Math.min(this.duration, this.pausedAt))
  }

  play(): void {
    if (this.isPlaying) return

    if (this.context.state === 'suspended') {
      this.context.resume()
    }

    this.startedAt = this.context.currentTime - this.pausedAt
    this.isPlaying = true
    this.startTimeUpdates()
  }

  stop(): void {
    if (this.isPlaying) {
      this.pausedAt = this.context.currentTime - this.startedAt
    }
    this.isPlaying = false
    this.stopTimeUpdates()
    useMixerStore.getState().setCurrentTime(this.pausedAt)
  }

  rewind(): void {
    this.isPlaying = false
    this.pausedAt = 0
    this.stopTimeUpdates()
    useMixerStore.getState().setCurrentTime(0)
  }

  seek(time: number): void {
    const clamped = Math.max(0, Math.min(this.duration, Number.isFinite(time) ? time : 0))
    this.pausedAt = clamped
    if (this.isPlaying) {
      this.startedAt = this.context.currentTime - clamped
    }
    useMixerStore.getState().setCurrentTime(clamped)
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  dispose(): void {
    this.stopTimeUpdates()
    this.stems = []
  }

  private startTimeUpdates(): void {
    const update = () => {
      if (!this.isPlaying) return
      const elapsed = this.context.currentTime - this.startedAt
      if (elapsed >= this.duration) {
        // Natural end of playback
        this.isPlaying = false
        this.pausedAt = 0
        this.stopTimeUpdates()
        useMixerStore.getState().stop()
        useMixerStore.getState().setCurrentTime(0)
        return
      }
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
