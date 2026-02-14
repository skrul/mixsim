import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { InputType } from '@/audio/transport'
import { GAIN_DEFAULT, NUM_MIX_BUSES, NUM_DCA_GROUPS, type SendState, type MixBusState, type DcaGroupState, type MonitorState, type MonitorSource } from '@/state/mixer-model'

// Re-export constants from mixer-model for existing consumers
export { GAIN_MIN, GAIN_MAX, GAIN_DEFAULT, INPUT_TYPE_CONFIG } from '@/state/mixer-model'

// ---- Types ----

export interface ChannelState {
  id: number
  label: string
  color: string
  inputType: InputType
  gain: number           // Input gain in dB, -12 to +60 (X32 range)
  faderPosition: number  // 0..1 normalized physical position, default 0.75 (unity)
  pan: number            // -1 (full left) to +1 (full right), default 0
  mute: boolean
  solo: boolean
  hpfEnabled: boolean
  hpfFreq: number        // 20..500 Hz, default 80
  eqEnabled: boolean
  eqLowFreq: number      // 40..500 Hz, default 200
  eqLowGain: number      // -15..+15 dB, default 0
  eqMidFreq: number      // 200..8000 Hz, default 1000
  eqMidGain: number      // -15..+15 dB, default 0
  eqMidQ: number         // 0.1..10, default 1.0
  eqHighFreq: number     // 2000..16000 Hz, default 5000
  eqHighGain: number     // -15..+15 dB, default 0
  sends: SendState[]     // One per mix bus, length === NUM_MIX_BUSES
  dcaGroups: number[]    // Which DCA group IDs this channel belongs to
}

export type TransportState = 'stopped' | 'playing'

export interface MasterState {
  faderPosition: number
}

export interface MixerState {
  channels: ChannelState[]
  mixBuses: MixBusState[]
  dcaGroups: DcaGroupState[]
  master: MasterState
  monitor: MonitorState
  transportState: TransportState
  currentTime: number
  duration: number
  stemsLoaded: boolean
  loadingError: string | null
  soloActive: boolean

  // Channel actions
  setChannelGain: (channelId: number, gainDb: number) => void
  setChannelFader: (channelId: number, position: number) => void
  setChannelLabel: (channelId: number, label: string) => void
  setChannelPan: (channelId: number, pan: number) => void
  toggleChannelMute: (channelId: number) => void
  toggleChannelSolo: (channelId: number) => void
  setChannelHpfEnabled: (channelId: number, enabled: boolean) => void
  setChannelHpfFreq: (channelId: number, freq: number) => void
  setChannelEqEnabled: (channelId: number, enabled: boolean) => void
  setChannelEqLowFreq: (channelId: number, freq: number) => void
  setChannelEqLowGain: (channelId: number, gain: number) => void
  setChannelEqMidFreq: (channelId: number, freq: number) => void
  setChannelEqMidGain: (channelId: number, gain: number) => void
  setChannelEqMidQ: (channelId: number, q: number) => void
  setChannelEqHighFreq: (channelId: number, freq: number) => void
  setChannelEqHighGain: (channelId: number, gain: number) => void
  setChannelSendLevel: (channelId: number, busIndex: number, level: number) => void
  setChannelSendPreFader: (channelId: number, busIndex: number, preFader: boolean) => void

  // Mix bus actions
  setMixBusFader: (busIndex: number, position: number) => void
  toggleMixBusMute: (busIndex: number) => void
  setMixBusLabel: (busIndex: number, label: string) => void

  // DCA actions
  setDcaFader: (dcaId: number, position: number) => void
  toggleDcaMute: (dcaId: number) => void
  setDcaLabel: (dcaId: number, label: string) => void
  assignChannelToDca: (channelId: number, dcaId: number) => void
  unassignChannelFromDca: (channelId: number, dcaId: number) => void

  // Monitor actions
  setMonitorSource: (source: MonitorSource) => void
  setMonitorLevel: (level: number) => void

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
  initChannels: (count: number, labels: string[], inputTypes?: InputType[]) => void
}

// ---- Helpers ----

const DEFAULT_COLORS = [
  '#ff4444', '#ff8800', '#ffcc00', '#44cc44',
  '#44cccc', '#4488ff', '#cc44ff', '#ff44cc',
]

function createDefaultChannel(id: number, label: string, inputType: InputType = 'direct'): ChannelState {
  return {
    id,
    label,
    color: DEFAULT_COLORS[id % DEFAULT_COLORS.length],
    inputType,
    gain: GAIN_DEFAULT,
    faderPosition: 0,
    pan: 0,
    mute: false,
    solo: false,
    hpfEnabled: false,
    hpfFreq: 80,
    eqEnabled: false,
    eqLowFreq: 200,
    eqLowGain: 0,
    eqMidFreq: 1000,
    eqMidGain: 0,
    eqMidQ: 1.0,
    eqHighFreq: 5000,
    eqHighGain: 0,
    sends: Array.from({ length: NUM_MIX_BUSES }, () => ({ level: 0, preFader: false })),
    dcaGroups: [],
  }
}

function createDefaultDcaGroup(id: number): DcaGroupState {
  return {
    id,
    label: `DCA ${id + 1}`,
    faderPosition: 0.75,
    mute: false,
    assignedChannels: [],
  }
}

function updateDcaGroup(
  state: MixerState,
  dcaId: number,
  patch: Partial<DcaGroupState>
): Partial<MixerState> {
  return {
    dcaGroups: state.dcaGroups.map((dca, i) =>
      i === dcaId ? { ...dca, ...patch } : dca
    ),
  }
}

function createDefaultMixBus(id: number): MixBusState {
  return {
    id,
    label: `Mix ${id + 1}`,
    faderPosition: 0.75,
    mute: false,
  }
}

function updateMixBus(
  state: MixerState,
  busIndex: number,
  patch: Partial<MixBusState>
): Partial<MixerState> {
  return {
    mixBuses: state.mixBuses.map((bus, i) =>
      i === busIndex ? { ...bus, ...patch } : bus
    ),
  }
}

function updateChannel(
  state: MixerState,
  channelId: number,
  patch: Partial<ChannelState>
): Partial<MixerState> {
  return {
    channels: state.channels.map((ch) =>
      ch.id === channelId ? { ...ch, ...patch } : ch
    ),
  }
}

// ---- Store ----

export const useMixerStore = create<MixerState>()(
  subscribeWithSelector((set) => ({
    channels: [],
    mixBuses: Array.from({ length: NUM_MIX_BUSES }, (_, i) => createDefaultMixBus(i)),
    dcaGroups: Array.from({ length: NUM_DCA_GROUPS }, (_, i) => createDefaultDcaGroup(i)),
    master: { faderPosition: 0 },
    monitor: { source: 'main', level: 0.75 },
    transportState: 'stopped',
    currentTime: 0,
    duration: 0,
    stemsLoaded: false,
    loadingError: null,
    soloActive: false,

    // Channel actions
    setChannelGain: (channelId, gainDb) =>
      set((state) => updateChannel(state, channelId, { gain: gainDb })),

    setChannelFader: (channelId, position) =>
      set((state) => updateChannel(state, channelId, { faderPosition: position })),

    setChannelLabel: (channelId, label) =>
      set((state) => updateChannel(state, channelId, { label })),

    setChannelPan: (channelId, pan) =>
      set((state) => updateChannel(state, channelId, { pan })),

    toggleChannelMute: (channelId) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        return updateChannel(state, channelId, { mute: !ch.mute })
      }),

    toggleChannelSolo: (channelId) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        const channels = state.channels.map((c) =>
          c.id === channelId ? { ...c, solo: !c.solo } : c
        )
        return {
          channels,
          soloActive: channels.some((c) => c.solo),
        }
      }),

    setChannelHpfEnabled: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { hpfEnabled: enabled })),

    setChannelHpfFreq: (channelId, freq) =>
      set((state) => updateChannel(state, channelId, { hpfFreq: freq })),

    setChannelEqEnabled: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { eqEnabled: enabled })),

    setChannelEqLowFreq: (channelId, freq) =>
      set((state) => updateChannel(state, channelId, { eqLowFreq: freq })),

    setChannelEqLowGain: (channelId, gain) =>
      set((state) => updateChannel(state, channelId, { eqLowGain: gain })),

    setChannelEqMidFreq: (channelId, freq) =>
      set((state) => updateChannel(state, channelId, { eqMidFreq: freq })),

    setChannelEqMidGain: (channelId, gain) =>
      set((state) => updateChannel(state, channelId, { eqMidGain: gain })),

    setChannelEqMidQ: (channelId, q) =>
      set((state) => updateChannel(state, channelId, { eqMidQ: q })),

    setChannelEqHighFreq: (channelId, freq) =>
      set((state) => updateChannel(state, channelId, { eqHighFreq: freq })),

    setChannelEqHighGain: (channelId, gain) =>
      set((state) => updateChannel(state, channelId, { eqHighGain: gain })),

    setChannelSendLevel: (channelId, busIndex, level) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        const sends = ch.sends.map((s, i) =>
          i === busIndex ? { ...s, level } : s
        )
        return updateChannel(state, channelId, { sends })
      }),

    setChannelSendPreFader: (channelId, busIndex, preFader) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        const sends = ch.sends.map((s, i) =>
          i === busIndex ? { ...s, preFader } : s
        )
        return updateChannel(state, channelId, { sends })
      }),

    // Mix bus actions
    setMixBusFader: (busIndex, position) =>
      set((state) => updateMixBus(state, busIndex, { faderPosition: position })),

    toggleMixBusMute: (busIndex) =>
      set((state) => {
        const bus = state.mixBuses[busIndex]
        if (!bus) return {}
        return updateMixBus(state, busIndex, { mute: !bus.mute })
      }),

    setMixBusLabel: (busIndex, label) =>
      set((state) => updateMixBus(state, busIndex, { label })),

    // DCA actions
    setDcaFader: (dcaId, position) =>
      set((state) => updateDcaGroup(state, dcaId, { faderPosition: position })),

    toggleDcaMute: (dcaId) =>
      set((state) => {
        const dca = state.dcaGroups[dcaId]
        if (!dca) return {}
        return updateDcaGroup(state, dcaId, { mute: !dca.mute })
      }),

    setDcaLabel: (dcaId, label) =>
      set((state) => updateDcaGroup(state, dcaId, { label })),

    assignChannelToDca: (channelId, dcaId) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch || ch.dcaGroups.includes(dcaId)) return {}
        const dca = state.dcaGroups[dcaId]
        if (!dca) return {}
        return {
          ...updateChannel(state, channelId, { dcaGroups: [...ch.dcaGroups, dcaId] }),
          dcaGroups: state.dcaGroups.map((d, i) =>
            i === dcaId ? { ...d, assignedChannels: [...d.assignedChannels, channelId] } : d
          ),
        }
      }),

    unassignChannelFromDca: (channelId, dcaId) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        return {
          ...updateChannel(state, channelId, { dcaGroups: ch.dcaGroups.filter((id) => id !== dcaId) }),
          dcaGroups: state.dcaGroups.map((d, i) =>
            i === dcaId ? { ...d, assignedChannels: d.assignedChannels.filter((id) => id !== channelId) } : d
          ),
        }
      }),

    // Monitor
    setMonitorSource: (source) => set((state) => ({ monitor: { ...state.monitor, source } })),
    setMonitorLevel: (level) => set((state) => ({ monitor: { ...state.monitor, level } })),

    // Master
    setMasterFader: (position) =>
      set({ master: { faderPosition: position } }),

    // Transport
    play: () => set({ transportState: 'playing' }),
    stop: () => set({ transportState: 'stopped' }),
    rewind: () => set({ transportState: 'stopped', currentTime: 0 }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setStemsLoaded: (loaded) => set({ stemsLoaded: loaded }),
    setLoadingError: (error) => set({ loadingError: error }),

    initChannels: (count, labels, inputTypes) =>
      set({
        channels: Array.from({ length: count }, (_, i) =>
          createDefaultChannel(i, labels[i] ?? `Ch ${i + 1}`, inputTypes?.[i] ?? 'direct')
        ),
      }),
  }))
)
