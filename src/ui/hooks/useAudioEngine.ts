import { useEffect, useRef, useState } from 'react'
import { createAudioEngine, type AudioEngine } from '@/audio/engine'
import type { StemManifest } from '@/audio/transport'
import { useMixerStore } from '@/state/mixer-store'
import { NUM_INPUT_CHANNELS } from '@/state/mixer-model'
import { loadSessionSnapshotFromLocalStorage } from '@/state/session-persistence'
import { initSourceModeFromProfiles } from '@/state/source-profiles'

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    // Prevent double-init in StrictMode
    if (initRef.current) return
    initRef.current = true

    async function start() {
      try {
        const restoredFromLocalSession = loadSessionSnapshotFromLocalStorage().ok
        initSourceModeFromProfiles()

        // Load stem manifest
        const manifestResponse = await fetch('/stems.config.json')
        if (!manifestResponse.ok) {
          throw new Error('Could not load stems.config.json. Place stem files in public/stems/ and create public/stems.config.json')
        }
        const manifest: StemManifest = await manifestResponse.json()

        // Initialize all 32 channels — stems fill the first N, rest get defaults
        const stemLabels = manifest.stems.map((s) => s.label)
        const stemInputTypes = manifest.stems.map((s) => s.inputType ?? 'direct')
        const labels = Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
          stemLabels[i] ?? `Ch ${i + 1}`
        )
        const inputTypes = Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
          stemInputTypes[i] ?? 'direct'
        )
        if (!restoredFromLocalSession) {
          useMixerStore.getState().initChannels(NUM_INPUT_CHANNELS, labels, inputTypes)
        }

        const engine = createAudioEngine()
        engineRef.current = engine
        await engine.init()

        // Load stems
        await engine.getTransport()!.loadStems(manifest)

        // Feed stem buffers to SourceManager
        const sm = engine.getSourceManager()!
        sm.setStemBuffers(engine.getTransport()!.getStemBuffers())

        // Populate available stems in store and apply stems preset as default
        const store = useMixerStore.getState()
        store.setAvailableStems(
          manifest.stems.map((s, i) => ({ index: i, label: s.label }))
        )
        if (!restoredFromLocalSession) {
          store.applyPresetStems()
        }

        // Enumerate live audio devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const audioInputs = devices
            .filter((d) => d.kind === 'audioinput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label || `Input ${d.deviceId.slice(0, 8)}` }))
          store.setAvailableLiveDevices(audioInputs)
        } catch {
          // No mic permission or no devices — leave empty
        }

        // Start metering
        engine.getMetering()!.start()

        // Subscribe to transport state changes to drive transport + SourceManager
        const unsubTransport = useMixerStore.subscribe(
          (state) => state.transportState,
          (transportState) => {
            const transport = engine.getTransport()
            if (!transport) return
            const channelSources = useMixerStore.getState().channels.map((ch) => ch.inputSource)
            const hasStemChannels = channelSources.some((s) => s.type === 'stem')
            if (transportState === 'playing') {
              if (hasStemChannels) {
                transport.play()
                sm.startStemSources(transport.getOffset(), channelSources)
              }
            } else {
              if (transport.getIsPlaying()) {
                transport.stop()
              }
              sm.stopStemSources()
            }
          }
        )

        // Subscribe to rewind (currentTime reset to 0 while stopped)
        const unsubRewind = useMixerStore.subscribe(
          (state) => state.currentTime,
          (currentTime, prevTime) => {
            const transport = engine.getTransport()
            const state = useMixerStore.getState()
            if (!transport) return
            // Rewind detected: time jumped to 0 while stopped
            if (currentTime === 0 && prevTime > 0 && state.transportState === 'stopped') {
              transport.rewind()
            }
          }
        )

        // Seek/scrub handling: if currentTime is externally changed away from the
        // transport clock, retime transport and stem sources.
        const unsubSeek = useMixerStore.subscribe(
          (state) => state.currentTime,
          (currentTime) => {
            const transport = engine.getTransport()
            if (!transport) return

            const actualTime = transport.getCurrentTime()
            if (Math.abs(currentTime - actualTime) < 0.12) return

            transport.seek(currentTime)

            const state = useMixerStore.getState()
            if (state.transportState !== 'playing') return

            const channelSources = state.channels.map((ch) => ch.inputSource)
            const hasStemChannels = channelSources.some((s) => s.type === 'stem')
            if (!hasStemChannels) return

            sm.stopStemSources()
            sm.startStemSources(transport.getOffset(), channelSources)
          }
        )

        setIsReady(true)

        // Store unsubscribers for cleanup
        engineRef.current = {
          ...engine,
          dispose: () => {
            unsubTransport()
            unsubRewind()
            unsubSeek()
            engine.dispose()
          },
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Engine init failed')
      }
    }

    start()

    return () => {
      engineRef.current?.dispose()
    }
  }, [])

  return { isReady, error }
}
