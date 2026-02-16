import { create } from 'zustand'

export type OutputBankLayer = 'dcas' | 'buses'
export type SendsOnFaderMode = 'bus' | 'channel'

export interface SurfaceState {
  selectedChannel: number
  dcaAssignArmedId: number | null
  busAssignArmedId: number | null
  activeInputLayer: number
  outputBankLayer: OutputBankLayer
  activeBusLayer: number          // 0 = Bus 1-8, 1 = Bus 9-16
  sendsOnFader: boolean
  sendsOnFaderMode: SendsOnFaderMode
  sendTargetBus: number
  selectedOutputIndex: number
  helpText: string

  setSelectedChannel: (channelId: number) => void
  setDcaAssignArmedId: (dcaId: number | null) => void
  setBusAssignArmedId: (busId: number | null) => void
  setActiveInputLayer: (layer: number) => void
  setOutputBankLayer: (layer: OutputBankLayer) => void
  setActiveBusLayer: (layer: number) => void
  selectBusForSendsOnFader: (busIndex: number) => void
  toggleSendsOnFaderForSelectedBus: () => void
  toggleSendsOnFaderForSelectedChannel: () => void
  disableSendsOnFader: () => void
  setSelectedOutputIndex: (index: number) => void
  setHelpText: (text: string) => void
}

export const useSurfaceStore = create<SurfaceState>()((set, get) => ({
  selectedChannel: 0,
  dcaAssignArmedId: null,
  busAssignArmedId: null,
  activeInputLayer: 0,
  outputBankLayer: 'buses',
  activeBusLayer: 0,
  sendsOnFader: false,
  sendsOnFaderMode: 'bus',
  sendTargetBus: 0,
  selectedOutputIndex: -1,
  helpText: '',

  setSelectedChannel: (channelId) => set({ selectedChannel: channelId }),
  setDcaAssignArmedId: (dcaId) => set({ dcaAssignArmedId: dcaId, busAssignArmedId: null }),
  setBusAssignArmedId: (busId) => set({ busAssignArmedId: busId, dcaAssignArmedId: null }),
  setActiveInputLayer: (layer) => set({ activeInputLayer: layer }),
  setOutputBankLayer: (layer) => {
    // Moving to DCA layer exits Sends-on-Fader and DCA assign mode.
    // Staying/returning on bus layers should preserve current SOF state.
    if (layer === 'dcas') {
      set({
        outputBankLayer: layer,
        sendsOnFader: false,
        sendsOnFaderMode: 'bus',
        selectedOutputIndex: -1,
        dcaAssignArmedId: null,
        busAssignArmedId: null,
      })
      return
    }
    set({ outputBankLayer: layer, dcaAssignArmedId: null, busAssignArmedId: null })
  },
  setActiveBusLayer: (layer) => set({ activeBusLayer: layer }),
  selectBusForSendsOnFader: (busIndex) => {
    const state = get()
    set({
      outputBankLayer: 'buses',
      sendTargetBus: busIndex,
      selectedOutputIndex: busIndex,
      // If SOF bus mode is active, retarget instantly. Otherwise only selection changes.
      ...(state.sendsOnFader && state.sendsOnFaderMode === 'bus'
        ? { sendsOnFader: true, sendsOnFaderMode: 'bus' as const }
        : {}),
    })
  },
  toggleSendsOnFaderForSelectedBus: () => {
    const state = get()
    if (state.sendsOnFader && state.sendsOnFaderMode === 'bus') {
      set({
        sendsOnFader: false,
        sendsOnFaderMode: 'bus',
        selectedOutputIndex: state.sendTargetBus,
      })
      return
    }
    set({
      sendsOnFader: true,
      sendsOnFaderMode: 'bus',
      outputBankLayer: 'buses',
      selectedOutputIndex: state.sendTargetBus,
    })
  },
  toggleSendsOnFaderForSelectedChannel: () => {
    const state = get()
    if (state.sendsOnFader && state.sendsOnFaderMode === 'channel') {
      set({ sendsOnFader: false, sendsOnFaderMode: 'bus', selectedOutputIndex: -1 })
      return
    }
    set({
      sendsOnFader: true,
      sendsOnFaderMode: 'channel',
      outputBankLayer: 'buses',
      selectedOutputIndex: -1,
    })
  },
  disableSendsOnFader: () =>
    set({ sendsOnFader: false, sendsOnFaderMode: 'bus', selectedOutputIndex: -1 }),
  setSelectedOutputIndex: (index) => set({ selectedOutputIndex: index }),
  setHelpText: (text) => set({ helpText: text }),
}))
