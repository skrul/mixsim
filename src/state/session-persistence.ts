import { useMixerStore, type ChannelState, type MasterState, type MixerState } from '@/state/mixer-store'
import { useSurfaceStore, type OutputBankLayer, type SelectedFocus, type SendsOnFaderMode } from '@/state/surface-store'
import type { DcaGroupState, MixBusState, MonitorState } from '@/state/mixer-model'

const SESSION_VERSION = 1

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

function applySnapshot(snapshot: SessionSnapshot): void {
  const mixer = snapshot.mixer
  const surface = snapshot.surface

  useMixerStore.setState({
    channels: mixer.channels,
    mixBuses: mixer.mixBuses,
    dcaGroups: mixer.dcaGroups,
    master: mixer.master,
    monitor: mixer.monitor,
    transportState: 'stopped',
    soloActive: computeSoloActive(mixer),
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
