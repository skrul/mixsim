import { create } from 'zustand'

export type FaderBankMode = 'inputs' | 'buses' | 'dcas'

export interface SurfaceState {
  selectedChannel: number
  activeLayer: number
  faderBankMode: FaderBankMode
  helpText: string

  setSelectedChannel: (channelId: number) => void
  setActiveLayer: (layer: number) => void
  setFaderBankMode: (mode: FaderBankMode) => void
  setHelpText: (text: string) => void
}

export const useSurfaceStore = create<SurfaceState>()((set) => ({
  selectedChannel: 0,
  activeLayer: 0,
  faderBankMode: 'inputs',
  helpText: '',

  setSelectedChannel: (channelId) => set({ selectedChannel: channelId }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setFaderBankMode: (mode) => set({ faderBankMode: mode }),
  setHelpText: (text) => set({ helpText: text }),
}))
