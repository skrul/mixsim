import { create } from 'zustand'

export type OutputBankLayer = 'dcas' | 'buses'
export type SendsOnFaderMode = 'bus' | 'channel'
export type SelectedFocus = 'input' | 'output'
export type SourceMode = 'stems' | 'tones' | 'custom'

export interface SurfaceState {
  selectedFocus: SelectedFocus
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
  sourceMode: SourceMode
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
  setSourceMode: (mode: SourceMode) => void
  resetSurfaceState: () => void
  setHelpText: (text: string) => void
}

export const useSurfaceStore = create<SurfaceState>()((set, get) => ({
  selectedFocus: 'input',
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
  sourceMode: 'custom',
  helpText: '',

  setSelectedChannel: (channelId) => set({ selectedFocus: 'input', selectedChannel: channelId, selectedOutputIndex: -1 }),
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
        selectedFocus: 'input',
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
      selectedFocus: 'output',
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
        selectedFocus: 'output',
        selectedOutputIndex: state.sendTargetBus,
      })
      return
    }
    set({
      sendsOnFader: true,
      sendsOnFaderMode: 'bus',
      outputBankLayer: 'buses',
      selectedFocus: 'output',
      selectedOutputIndex: state.sendTargetBus,
    })
  },
  toggleSendsOnFaderForSelectedChannel: () => {
    const state = get()
    if (state.sendsOnFader && state.sendsOnFaderMode === 'channel') {
      set({ sendsOnFader: false, sendsOnFaderMode: 'bus', selectedFocus: 'input', selectedOutputIndex: -1 })
      return
    }
    set({
      sendsOnFader: true,
      sendsOnFaderMode: 'channel',
      outputBankLayer: 'buses',
      selectedFocus: 'input',
      selectedOutputIndex: -1,
    })
  },
  disableSendsOnFader: () =>
    set({ sendsOnFader: false, sendsOnFaderMode: 'bus', selectedOutputIndex: -1 }),
  setSelectedOutputIndex: (index) => set({ selectedFocus: index >= 0 ? 'output' : 'input', selectedOutputIndex: index }),
  setSourceMode: (mode) => set({ sourceMode: mode }),
  resetSurfaceState: () =>
    set((state) => ({
      selectedFocus: 'input',
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
      sourceMode: state.sourceMode,
      helpText: '',
    })),
  setHelpText: (text) => set({ helpText: text }),
}))
