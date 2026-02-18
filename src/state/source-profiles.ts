import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore, type SourceMode } from '@/state/surface-store'
import { applySnapshot, createSnapshot, type SessionSnapshot } from '@/state/session-persistence'

const SOURCE_PROFILES_KEY = 'mixsim.source-profiles.v1'

interface SourceProfilesState {
  activeMode: SourceMode
  profiles: Partial<Record<SourceMode, SessionSnapshot>>
}

function profileMatchesModeDefaults(snapshot: SessionSnapshot, mode: SourceMode): boolean {
  if (mode === 'custom') return true
  if (mode === 'demo') return true
  if (mode === 'stems') {
    return snapshot.mixer.channels.some((ch) => ch.inputSource.type === 'stem')
  }
  if (mode === 'tones') {
    return snapshot.mixer.channels.some((ch) => ch.inputSource.type === 'tone')
  }
  return true
}

function loadProfilesState(): SourceProfilesState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { activeMode: 'custom', profiles: {} }
  }
  try {
    const raw = window.localStorage.getItem(SOURCE_PROFILES_KEY)
    if (!raw) return { activeMode: 'custom', profiles: {} }
    const parsed = JSON.parse(raw) as Partial<SourceProfilesState>
    return {
      activeMode:
        parsed.activeMode === 'stems' ||
        parsed.activeMode === 'tones' ||
        parsed.activeMode === 'custom' ||
        parsed.activeMode === 'demo'
        ? parsed.activeMode
        : 'custom',
      profiles: parsed.profiles ?? {},
    }
  } catch {
    return { activeMode: 'custom', profiles: {} }
  }
}

function saveProfilesState(state: SourceProfilesState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(SOURCE_PROFILES_KEY, JSON.stringify(state))
  } catch {
    // ignore persistence failures
  }
}

export function initSourceModeFromProfiles(): void {
  const profiles = loadProfilesState()
  useSurfaceStore.getState().setSourceMode(profiles.activeMode)
}

export function saveCurrentSnapshotForMode(mode: SourceMode): void {
  if (mode === 'demo') return
  const state = loadProfilesState()
  state.profiles[mode] = createSnapshot()
  state.activeMode = mode
  saveProfilesState(state)
}

export function switchSourceMode(mode: SourceMode): void {
  const surface = useSurfaceStore.getState()
  const currentMode = surface.sourceMode
  const state = loadProfilesState()

  if (currentMode !== 'demo') {
    state.profiles[currentMode] = createSnapshot()
  }

  if (mode === 'demo') {
    useSurfaceStore.getState().setSourceMode('demo')
    state.activeMode = 'demo'
    saveProfilesState(state)
    return
  }

  const nextSnapshot = state.profiles[mode]
  if (nextSnapshot && profileMatchesModeDefaults(nextSnapshot, mode)) {
    applySnapshot(nextSnapshot)
  } else {
    resetSourceModeDefaults(mode)
    return
  }

  useSurfaceStore.getState().setSourceMode(mode)
  state.activeMode = mode
  state.profiles[mode] = createSnapshot()
  saveProfilesState(state)
}

export function resetSourceModeDefaults(modeArg?: SourceMode): void {
  const surface = useSurfaceStore.getState()
  const mode = modeArg ?? surface.sourceMode
  const state = loadProfilesState()
  const mixer = useMixerStore.getState()

  if (mode === 'stems') {
    mixer.applyPresetStems()
  } else if (mode === 'tones') {
    mixer.applyPresetTones()
  } else if (mode === 'demo') {
    return
  } else {
    mixer.applyPresetNone()
  }
  mixer.resetBoard()

  if (mode === 'tones') {
    const monitor = useMixerStore.getState().monitor
    if (monitor.level > 0.25) {
      useMixerStore.setState({ monitor: { ...monitor, level: 0.25 } })
    }
  }

  useSurfaceStore.getState().setSourceMode(mode)
  state.activeMode = mode
  state.profiles[mode] = createSnapshot()
  saveProfilesState(state)
}

export function markCustomModeFromManualInputChange(): void {
  const surface = useSurfaceStore.getState()
  const previousMode = surface.sourceMode
  const state = loadProfilesState()

  if (previousMode !== 'custom' && previousMode !== 'demo') {
    state.profiles[previousMode] = createSnapshot()
  }
  useSurfaceStore.getState().setSourceMode('custom')
  state.activeMode = 'custom'
  state.profiles.custom = createSnapshot()
  saveProfilesState(state)
}

export function ensureActiveSourceModeConsistency(): void {
  const mode = useSurfaceStore.getState().sourceMode
  const mixer = useMixerStore.getState()
  const channels = mixer.channels

  if (mode === 'demo') return

  if (mode === 'tones') {
    const hasTone = channels.some((ch) => ch.inputSource.type === 'tone')
    if (!hasTone) {
      resetSourceModeDefaults('tones')
    }
    return
  }

  if (mode === 'stems') {
    const hasStem = channels.some((ch) => ch.inputSource.type === 'stem')
    if (!hasStem && mixer.availableStems.length > 0) {
      resetSourceModeDefaults('stems')
    }
  }
}
