import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { FADER_UNITY_POSITION } from '@/audio/fader-taper'

// ---- Types ----

export interface ChannelState {
  id: number
  label: string
  gain: number           // Input gain in dB, range: -20 to +20, default 0
  faderPosition: number  // 0..1 normalized physical position, default 0.75 (unity)
}

export type TransportState = 'stopped' | 'playing'

export interface MasterState {
  faderPosition: number
}

export interface MixerState {
  channels: ChannelState[]
  master: MasterState
  transportState: TransportState
  currentTime: number
  duration: number
  stemsLoaded: boolean
  loadingError: string | null

  // Channel actions
  setChannelGain: (channelId: number, gainDb: number) => void
  setChannelFader: (channelId: number, position: number) => void
  setChannelLabel: (channelId: number, label: string) => void

  // Master actions
  setMasterFader: (position: number) => void

  // Transport actions
  play: () => void
  stop: () => void
  rewind: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void

  // Loading actions
  setStemsLoaded: (loaded: boolean) => void
  setLoadingError: (error: string | null) => void

  // Init
  initChannels: (count: number, labels: string[]) => void
}

// ---- Helpers ----

function createDefaultChannel(id: number, label: string): ChannelState {
  return {
    id,
    label,
    gain: 0,
    faderPosition: FADER_UNITY_POSITION,
  }
}

// ---- Store ----

export const useMixerStore = create<MixerState>()(
  subscribeWithSelector((set) => ({
    channels: [],
    master: { faderPosition: FADER_UNITY_POSITION },
    transportState: 'stopped',
    currentTime: 0,
    duration: 0,
    stemsLoaded: false,
    loadingError: null,

    setChannelGain: (channelId, gainDb) =>
      set((state) => ({
        channels: state.channels.map((ch) =>
          ch.id === channelId ? { ...ch, gain: gainDb } : ch
        ),
      })),

    setChannelFader: (channelId, position) =>
      set((state) => ({
        channels: state.channels.map((ch) =>
          ch.id === channelId ? { ...ch, faderPosition: position } : ch
        ),
      })),

    setChannelLabel: (channelId, label) =>
      set((state) => ({
        channels: state.channels.map((ch) =>
          ch.id === channelId ? { ...ch, label } : ch
        ),
      })),

    setMasterFader: (position) =>
      set({ master: { faderPosition: position } }),

    play: () => set({ transportState: 'playing' }),
    stop: () => set({ transportState: 'stopped' }),
    rewind: () => set({ transportState: 'stopped', currentTime: 0 }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setStemsLoaded: (loaded) => set({ stemsLoaded: loaded }),
    setLoadingError: (error) => set({ loadingError: error }),

    initChannels: (count, labels) =>
      set({
        channels: Array.from({ length: count }, (_, i) =>
          createDefaultChannel(i, labels[i] ?? `Ch ${i + 1}`)
        ),
      }),
  }))
)
