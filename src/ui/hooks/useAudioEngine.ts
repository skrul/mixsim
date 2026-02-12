import { useEffect, useRef, useState } from 'react'
import { createAudioEngine, type AudioEngine } from '@/audio/engine'
import type { StemManifest } from '@/audio/transport'
import { useMixerStore } from '@/state/mixer-store'

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
        // Load stem manifest
        const manifestResponse = await fetch('/stems.config.json')
        if (!manifestResponse.ok) {
          throw new Error('Could not load stems.config.json. Place stem files in public/stems/ and create public/stems.config.json')
        }
        const manifest: StemManifest = await manifestResponse.json()

        // Initialize channels in store before engine starts
        // (engine reads channel count from store during init)
        useMixerStore.getState().initChannels(
          manifest.stems.length,
          manifest.stems.map((s) => s.label)
        )

        const engine = createAudioEngine()
        engineRef.current = engine
        await engine.init()

        // Load stems
        await engine.getTransport()!.loadStems(manifest)

        // Start metering
        engine.getMetering()!.start()

        // Subscribe to transport state changes to drive the transport
        const unsubTransport = useMixerStore.subscribe(
          (state) => state.transportState,
          (transportState) => {
            const transport = engine.getTransport()
            if (!transport) return
            if (transportState === 'playing') {
              transport.play()
            } else {
              transport.stop()
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

        setIsReady(true)

        // Store unsubscribers for cleanup
        engineRef.current = {
          ...engine,
          dispose: () => {
            unsubTransport()
            unsubRewind()
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
