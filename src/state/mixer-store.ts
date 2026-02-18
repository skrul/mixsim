import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { InputType } from '@/audio/transport'
import { GAIN_DEFAULT, NUM_INPUT_CHANNELS, NUM_MIX_BUSES, NUM_DCA_GROUPS, NUM_TONE_SLOTS, type SendState, type MixBusState, type DcaGroupState, type MonitorState, type MonitorSource, type ChannelInputSource } from '@/state/mixer-model'
import { getToneLabel } from '@/audio/source-manager'

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
  gateEnabled: boolean
  gateThreshold: number  // -80..0 dB
  compEnabled: boolean
  compThreshold: number  // -60..0 dB
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
  eqSelectedBand: 'high' | 'highMid' | 'lowMid' | 'low'
  eqModeIndex: number    // 0..5, EQ mode selector shown in UI strip
  monoBus: boolean       // Route channel to center/mono bus
  mainLrBus: boolean     // Route channel to main LR bus
  inputSource: ChannelInputSource
  sends: SendState[]     // One per mix bus, length === NUM_MIX_BUSES
  dcaGroups: number[]    // Which DCA group IDs this channel belongs to
}

export type TransportState = 'stopped' | 'playing'

export interface MasterState {
  faderPosition: number
  solo: boolean
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
  availableStems: { index: number; label: string }[]
  availableLiveDevices: { deviceId: string; label: string }[]

  // Input source actions
  setChannelInputSource: (channelId: number, source: ChannelInputSource) => void
  setAvailableStems: (stems: { index: number; label: string }[]) => void
  setAvailableLiveDevices: (devices: { deviceId: string; label: string }[]) => void
  applyPresetStems: () => void
  applyPresetTones: () => void
  applyPresetNone: () => void

  // Channel actions
  setChannelGain: (channelId: number, gainDb: number) => void
  setChannelFader: (channelId: number, position: number) => void
  setChannelLabel: (channelId: number, label: string) => void
  setChannelPan: (channelId: number, pan: number) => void
  toggleChannelMute: (channelId: number) => void
  toggleChannelSolo: (channelId: number) => void
  clearAllSolos: () => void
  setChannelGateEnabled: (channelId: number, enabled: boolean) => void
  setChannelGateThreshold: (channelId: number, thresholdDb: number) => void
  setChannelCompEnabled: (channelId: number, enabled: boolean) => void
  setChannelCompThreshold: (channelId: number, thresholdDb: number) => void
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
  setChannelEqSelectedBand: (channelId: number, band: 'high' | 'highMid' | 'lowMid' | 'low') => void
  setChannelEqModeIndex: (channelId: number, modeIndex: number) => void
  cycleChannelEqMode: (channelId: number) => void
  setChannelMonoBus: (channelId: number, enabled: boolean) => void
  setChannelMainLrBus: (channelId: number, enabled: boolean) => void
  setChannelSendLevel: (channelId: number, busIndex: number, level: number) => void
  setChannelSendPreFader: (channelId: number, busIndex: number, preFader: boolean) => void

  // Mix bus actions
  setMixBusFader: (busIndex: number, position: number) => void
  toggleMixBusMute: (busIndex: number) => void
  toggleMixBusSolo: (busIndex: number) => void
  setMixBusLabel: (busIndex: number, label: string) => void

  // DCA actions
  setDcaFader: (dcaId: number, position: number) => void
  toggleDcaMute: (dcaId: number) => void
  toggleDcaSolo: (dcaId: number) => void
  setDcaLabel: (dcaId: number, label: string) => void
  assignChannelToDca: (channelId: number, dcaId: number) => void
  unassignChannelFromDca: (channelId: number, dcaId: number) => void

  // Monitor actions
  setMonitorSource: (source: MonitorSource) => void
  setMonitorLevel: (level: number) => void

  // Master actions
  setMasterFader: (position: number) => void
  toggleMasterSolo: () => void

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
  resetBoard: () => void
}

// ---- Helpers ----

const DEFAULT_COLORS = [
  '#ff4444', '#ff8800', '#ffcc00', '#44cc44',
  '#44cccc', '#4488ff', '#cc44ff', '#ff44cc',
]

function createDefaultChannel(id: number, label: string, inputType: InputType = 'direct'): ChannelState {
  const isFxReturn = id >= 24 && id <= 31
  const defaultPan = isFxReturn ? (id % 2 === 0 ? -1 : 1) : 0
  return {
    id,
    label,
    color: DEFAULT_COLORS[id % DEFAULT_COLORS.length],
    inputType,
    gain: GAIN_DEFAULT,
    faderPosition: 0,
    pan: defaultPan,
    mute: false,
    solo: false,
    gateEnabled: false,
    gateThreshold: -58,
    compEnabled: false,
    compThreshold: -25.5,
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
    eqSelectedBand: 'highMid',
    eqModeIndex: 0,
    monoBus: false,
    mainLrBus: true,
    inputSource: { type: 'none' },
    sends: Array.from({ length: NUM_MIX_BUSES }, () => ({ level: 0, preFader: true })),
    dcaGroups: [],
  }
}

function createDefaultDcaGroup(id: number): DcaGroupState {
  return {
    id,
    label: `DCA ${id + 1}`,
    faderPosition: 0.75,
    mute: false,
    solo: false,
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
  const isFxSendBus = id >= 12 && id <= 15
  return {
    id,
    label: isFxSendBus ? `FX ${id - 11}` : `Mix ${id + 1}`,
    faderPosition: 0,
    mute: false,
    solo: false,
  }
}

function computeSoloActive(state: MixerState): boolean {
  return (
    state.channels.some((c) => c.solo) ||
    state.mixBuses.some((b) => b.solo) ||
    state.dcaGroups.some((d) => d.solo) ||
    state.master.solo
  )
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
    channels: Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
      createDefaultChannel(i, `Ch ${i + 1}`)
    ),
    mixBuses: Array.from({ length: NUM_MIX_BUSES }, (_, i) => createDefaultMixBus(i)),
    dcaGroups: Array.from({ length: NUM_DCA_GROUPS }, (_, i) => createDefaultDcaGroup(i)),
    master: { faderPosition: 0, solo: false },
    monitor: { source: 'main', level: 0.75 },
    transportState: 'stopped',
    currentTime: 0,
    duration: 0,
    stemsLoaded: false,
    loadingError: null,
    soloActive: false,
    availableStems: [],
    availableLiveDevices: [],

    // Input source actions
    setChannelInputSource: (channelId, source) =>
      set((state) => {
        let label: string | undefined
        switch (source.type) {
          case 'stem':
            label = state.availableStems[source.stemIndex]?.label
            break
          case 'tone':
            label = getToneLabel(source.toneIndex)
            break
          case 'live':
            label = state.availableLiveDevices.find((d) => d.deviceId === source.deviceId)?.label
            break
          case 'none':
            label = ''
            break
        }
        return updateChannel(state, channelId, {
          inputSource: source,
          ...(label !== undefined ? { label } : {}),
        })
      }),

    setAvailableStems: (stems) => set({ availableStems: stems }),

    setAvailableLiveDevices: (devices) => set({ availableLiveDevices: devices }),

    applyPresetStems: () =>
      set((state) => ({
        channels: state.channels.map((ch, i) => ({
          ...ch,
          inputSource: i < state.availableStems.length
            ? { type: 'stem' as const, stemIndex: i }
            : { type: 'none' as const },
          label: i < state.availableStems.length
            ? state.availableStems[i].label
            : ch.label,
        })),
      })),

    applyPresetTones: () =>
      set((state) => ({
        channels: state.channels.map((ch, i) => ({
          ...ch,
          inputSource: i < NUM_TONE_SLOTS
            ? { type: 'tone' as const, toneIndex: i }
            : { type: 'none' as const },
          label: i < NUM_TONE_SLOTS
            ? getToneLabel(i)
            : '',
        })),
      })),

    applyPresetNone: () =>
      set((state) => ({
        channels: state.channels.map((ch, i) => ({
          ...ch,
          inputSource: { type: 'none' as const },
          label: `Ch ${i + 1}`,
        })),
      })),

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
        const nextState = { ...state, channels }
        return {
          channels,
          soloActive: computeSoloActive(nextState),
        }
      }),

    clearAllSolos: () =>
      set((state) => ({
        channels: state.channels.map((c) => ({ ...c, solo: false })),
        mixBuses: state.mixBuses.map((b) => ({ ...b, solo: false })),
        dcaGroups: state.dcaGroups.map((d) => ({ ...d, solo: false })),
        master: { ...state.master, solo: false },
        soloActive: false,
      })),

    setChannelGateEnabled: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { gateEnabled: enabled })),

    setChannelGateThreshold: (channelId, thresholdDb) =>
      set((state) => updateChannel(state, channelId, { gateThreshold: thresholdDb })),

    setChannelCompEnabled: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { compEnabled: enabled })),

    setChannelCompThreshold: (channelId, thresholdDb) =>
      set((state) => updateChannel(state, channelId, { compThreshold: thresholdDb })),

    setChannelHpfEnabled: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { hpfEnabled: enabled })),

    setChannelHpfFreq: (channelId, freq) =>
      set((state) => updateChannel(state, channelId, { hpfFreq: freq })),

    setChannelEqEnabled: (channelId, enabled) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        const modeIndex = Number.isFinite(ch.eqModeIndex) ? ch.eqModeIndex : 0
        return updateChannel(state, channelId, { eqEnabled: enabled, eqModeIndex: modeIndex })
      }),

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

    setChannelEqSelectedBand: (channelId, band) =>
      set((state) => updateChannel(state, channelId, { eqSelectedBand: band })),

    setChannelEqModeIndex: (channelId, modeIndex) =>
      set((state) =>
        updateChannel(state, channelId, {
          eqModeIndex: Number.isFinite(modeIndex) ? Math.max(0, Math.min(5, Math.floor(modeIndex))) : 0,
        })
      ),

    cycleChannelEqMode: (channelId) =>
      set((state) => {
        const ch = state.channels.find((c) => c.id === channelId)
        if (!ch) return {}
        if (!ch.eqEnabled) return {}
        const current = Number.isFinite(ch.eqModeIndex) ? ch.eqModeIndex : -1
        return updateChannel(state, channelId, { eqModeIndex: (current + 1) % 6 })
      }),

    setChannelMonoBus: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { monoBus: enabled })),

    setChannelMainLrBus: (channelId, enabled) =>
      set((state) => updateChannel(state, channelId, { mainLrBus: enabled })),

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

    toggleMixBusSolo: (busIndex) =>
      set((state) => {
        const bus = state.mixBuses[busIndex]
        if (!bus) return {}
        const mixBuses = state.mixBuses.map((b, i) =>
          i === busIndex ? { ...b, solo: !b.solo } : b
        )
        const nextState = { ...state, mixBuses }
        return {
          mixBuses,
          soloActive: computeSoloActive(nextState),
        }
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

    toggleDcaSolo: (dcaId) =>
      set((state) => {
        const dca = state.dcaGroups[dcaId]
        if (!dca) return {}
        const dcaGroups = state.dcaGroups.map((d, i) =>
          i === dcaId ? { ...d, solo: !d.solo } : d
        )
        const nextState = { ...state, dcaGroups }
        return {
          dcaGroups,
          soloActive: computeSoloActive(nextState),
        }
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
      set((state) => ({ master: { ...state.master, faderPosition: position } })),
    toggleMasterSolo: () =>
      set((state) => {
        const masterSolo = !state.master.solo
        const master = { ...state.master, solo: masterSolo }
        const nextState = { ...state, master }
        return {
          master,
          soloActive: computeSoloActive(nextState),
        }
      }),

    // Transport
    play: () => set({ transportState: 'playing' }),
    stop: () => set({ transportState: 'stopped' }),
    rewind: () => set({ transportState: 'stopped', currentTime: 0 }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setStemsLoaded: (loaded) => set({ stemsLoaded: loaded }),
    setLoadingError: (error) => set({ loadingError: error }),

    initChannels: (_count, labels, inputTypes) =>
      set({
        channels: Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
          createDefaultChannel(i, labels[i] ?? `Ch ${i + 1}`, inputTypes?.[i] ?? 'direct')
        ),
      }),

    resetBoard: () =>
      set((state) => ({
        channels: Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) => {
          const prev = state.channels[i]
          const base = createDefaultChannel(i, prev?.label ?? `Ch ${i + 1}`, prev?.inputType ?? 'direct')
          return {
            ...base,
            // Zero board should not wipe source patching.
            inputSource: prev?.inputSource ?? { type: 'none' as const },
            label: prev?.label ?? base.label,
            inputType: prev?.inputType ?? base.inputType,
          }
        }),
        mixBuses: Array.from({ length: NUM_MIX_BUSES }, (_, i) => createDefaultMixBus(i)),
        dcaGroups: Array.from({ length: NUM_DCA_GROUPS }, (_, i) => createDefaultDcaGroup(i)),
        master: { faderPosition: 0, solo: false },
        monitor: { source: 'main', level: 0.75 },
        transportState: 'stopped',
        currentTime: 0,
        soloActive: false,
        loadingError: null,
        // Keep discovered devices/stems and loaded duration metadata.
        stemsLoaded: state.stemsLoaded,
        duration: state.duration,
        availableStems: state.availableStems,
        availableLiveDevices: state.availableLiveDevices,
      })),
  }))
)
