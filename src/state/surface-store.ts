import { create } from 'zustand'

export type OutputBankLayer = 'dcas' | 'buses'

export interface SurfaceState {
  selectedChannel: number
  activeInputLayer: number
  outputBankLayer: OutputBankLayer
  activeBusLayer: number          // 0 = Bus 1-8, 1 = Bus 9-16
  sendsOnFader: boolean
  sendTargetBus: number
  selectedOutputIndex: number
  helpText: string

  setSelectedChannel: (channelId: number) => void
  setActiveInputLayer: (layer: number) => void
  setOutputBankLayer: (layer: OutputBankLayer) => void
  setActiveBusLayer: (layer: number) => void
  toggleSendsOnFader: (busIndex: number) => void
  setSelectedOutputIndex: (index: number) => void
  setHelpText: (text: string) => void
}

export const useSurfaceStore = create<SurfaceState>()((set, get) => ({
  selectedChannel: 0,
  activeInputLayer: 0,
  outputBankLayer: 'buses',
  activeBusLayer: 0,
  sendsOnFader: false,
  sendTargetBus: 0,
  selectedOutputIndex: -1,
  helpText: '',

  setSelectedChannel: (channelId) => set({ selectedChannel: channelId }),
  setActiveInputLayer: (layer) => set({ activeInputLayer: layer }),
  setOutputBankLayer: (layer) => {
    // Switching output bank layer deactivates sends-on-fader
    set({ outputBankLayer: layer, sendsOnFader: false, selectedOutputIndex: -1 })
  },
  setActiveBusLayer: (layer) => set({ activeBusLayer: layer }),
  toggleSendsOnFader: (busIndex) => {
    const state = get()
    if (state.sendsOnFader && state.sendTargetBus === busIndex) {
      // Same bus — deactivate
      set({ sendsOnFader: false, selectedOutputIndex: -1 })
    } else {
      // Activate (or switch target)
      set({ sendsOnFader: true, sendTargetBus: busIndex, selectedOutputIndex: busIndex })
    }
  },
  setSelectedOutputIndex: (index) => set({ selectedOutputIndex: index }),
  setHelpText: (text) => set({ helpText: text }),
}))
