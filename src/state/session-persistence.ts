import { useMixerStore, type ChannelState, type MasterState, type MixerState } from '@/state/mixer-store'
import { useSurfaceStore, type OutputBankLayer, type SelectedFocus, type SendsOnFaderMode } from '@/state/surface-store'
import type { DcaGroupState, MixBusState, MonitorState } from '@/state/mixer-model'

const SESSION_VERSION = 1
const SESSION_STORAGE_KEY = 'mixsim.session.v1'

interface SavedMixerState {
  channels: ChannelState[]
  mixBuses: MixBusState[]
  dcaGroups: DcaGroupState[]
  master: MasterState
  monitor: MonitorState
}

interface SavedSurfaceState {
  selectedFocus?: SelectedFocus
  selectedChannel: number
  activeInputLayer: number
  outputBankLayer: OutputBankLayer
  activeBusLayer: number
  sendsOnFader: boolean
  sendsOnFaderMode: SendsOnFaderMode
  sendTargetBus: number
  selectedOutputIndex: number
}

interface SessionSnapshot {
  version: number
  savedAt: string
  mixer: SavedMixerState
  surface: SavedSurfaceState
}

function computeSoloActive(data: SavedMixerState): boolean {
  return (
    data.channels.some((c) => c.solo) ||
    data.mixBuses.some((b) => b.solo) ||
    data.dcaGroups.some((d) => d.solo) ||
    data.master.solo
  )
}

function createSnapshot(): SessionSnapshot {
  const mixer = useMixerStore.getState()
  const surface = useSurfaceStore.getState()
  return {
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
    mixer: {
      channels: mixer.channels,
      mixBuses: mixer.mixBuses,
      dcaGroups: mixer.dcaGroups,
      master: mixer.master,
      monitor: mixer.monitor,
    },
    surface: {
      selectedFocus: surface.selectedFocus,
      selectedChannel: surface.selectedChannel,
      activeInputLayer: surface.activeInputLayer,
      outputBankLayer: surface.outputBankLayer,
      activeBusLayer: surface.activeBusLayer,
      sendsOnFader: surface.sendsOnFader,
      sendsOnFaderMode: surface.sendsOnFaderMode,
      sendTargetBus: surface.sendTargetBus,
      selectedOutputIndex: surface.selectedOutputIndex,
    },
  }
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<SessionSnapshot>
  return (
    v.version === SESSION_VERSION &&
    !!v.mixer &&
    !!v.surface &&
    Array.isArray((v.mixer as Partial<SavedMixerState>).channels) &&
    Array.isArray((v.mixer as Partial<SavedMixerState>).mixBuses) &&
    Array.isArray((v.mixer as Partial<SavedMixerState>).dcaGroups)
  )
}

function inferSelectedFocus(surface: SavedSurfaceState): SelectedFocus {
  if (surface.selectedFocus === 'input' || surface.selectedFocus === 'output') return surface.selectedFocus
  return surface.selectedOutputIndex >= 0 ? 'output' : 'input'
}

function normalizeSavedChannels(channels: ChannelState[]): ChannelState[] {
  const defaults = useMixerStore.getState().channels
  return defaults.map((base, i) => {
    const saved = channels[i]
    if (!saved) return base
    return {
      ...base,
      ...saved,
      sends: saved.sends ?? base.sends,
      dcaGroups: saved.dcaGroups ?? base.dcaGroups,
    }
  })
}

function applySnapshot(snapshot: SessionSnapshot): void {
  const mixer = snapshot.mixer
  const surface = snapshot.surface
  const normalizedChannels = normalizeSavedChannels(mixer.channels)

  useMixerStore.setState({
    channels: normalizedChannels,
    mixBuses: mixer.mixBuses,
    dcaGroups: mixer.dcaGroups,
    master: mixer.master,
    monitor: mixer.monitor,
    transportState: 'stopped',
    soloActive: computeSoloActive({ ...mixer, channels: normalizedChannels }),
  } as Partial<MixerState>)

  useSurfaceStore.setState({
    selectedFocus: inferSelectedFocus(surface),
    selectedChannel: surface.selectedChannel,
    activeInputLayer: surface.activeInputLayer,
    outputBankLayer: surface.outputBankLayer,
    activeBusLayer: surface.activeBusLayer,
    sendsOnFader: surface.sendsOnFader,
    sendsOnFaderMode: surface.sendsOnFaderMode,
    sendTargetBus: surface.sendTargetBus,
    selectedOutputIndex: surface.selectedOutputIndex,
    dcaAssignArmedId: null,
    busAssignArmedId: null,
    helpText: '',
  })
}

export function exportSessionSnapshot(): { ok: true; data: string; fileName: string } | { ok: false; error: string } {
  try {
    const snapshot = createSnapshot()
    const stamp = snapshot.savedAt.replace(/[:.]/g, '-')
    return {
      ok: true,
      data: JSON.stringify(snapshot, null, 2),
      fileName: `mixsim-session-${stamp}.json`,
    }
  } catch {
    return { ok: false, error: 'Failed to export session snapshot.' }
  }
}

export function importSessionSnapshot(raw: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSessionSnapshot(parsed)) {
      return { ok: false, error: 'Saved session format is invalid.' }
    }
    applySnapshot(parsed)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to load session snapshot file.' }
  }
}

export function saveSessionSnapshotToLocalStorage(): { ok: true } | { ok: false; error: string } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, error: 'Local storage is not available.' }
  }
  try {
    const snapshot = createSnapshot()
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to persist session locally.' }
  }
}

export function loadSessionSnapshotFromLocalStorage(): { ok: true } | { ok: false; error: string } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, error: 'Local storage is not available.' }
  }
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return { ok: false, error: 'No saved local session.' }
    const parsed: unknown = JSON.parse(raw)
    if (!isSessionSnapshot(parsed)) return { ok: false, error: 'Saved local session format is invalid.' }
    applySnapshot(parsed)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to load local session.' }
  }
}
