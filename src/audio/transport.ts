import { useMixerStore } from '@/state/mixer-store'

export type InputType = 'mic' | 'line' | 'direct'

export interface TrackConfig {
  url: string
  label: string
  inputType?: InputType
  stereo?: boolean
}

export interface TrackManifest {
  songs: { title: string; tracks: TrackConfig[]; snapshot?: string }[]
}

interface TrackData {
  buffer: AudioBuffer
  label: string
}

export class TransportManager {
  private context: AudioContext
  private tracks: TrackData[] = []
  private isPlaying = false
  private startedAt = 0
  private pausedAt = 0
  private rafId: number | null = null
  private duration = 0

  constructor(context: AudioContext) {
    this.context = context
  }

  async loadTracks(manifest: TrackManifest): Promise<void> {
    const store = useMixerStore.getState()

    try {
      const allTracks = manifest.songs.flatMap((s) => s.tracks)
      const loadPromises = allTracks.map(async (track) => {
        const response = await fetch(track.url)
        if (!response.ok) throw new Error(`Failed to load ${track.url}: ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
        return { buffer: audioBuffer, label: track.label }
      })

      this.tracks = await Promise.all(loadPromises)

      this.duration = Math.max(...this.tracks.map((s) => s.buffer.duration))
      store.setDuration(this.duration)
      store.setTracksLoaded(true)
    } catch (error) {
      store.setLoadingError(
        error instanceof Error ? error.message : 'Failed to load tracks'
      )
    }
  }

  /** Get loaded track audio buffers for SourceManager to use. */
  getTrackBuffers(): AudioBuffer[] {
    return this.tracks.map((s) => s.buffer)
  }

  /** Get the current playback offset (for starting track sources). */
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
    this.tracks = []
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
