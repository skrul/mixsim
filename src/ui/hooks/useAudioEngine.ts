import { useEffect, useRef, useState } from 'react'
import { createAudioEngine, type AudioEngine } from '@/audio/engine'
import type { TrackManifest } from '@/audio/transport'
import { useMixerStore } from '@/state/mixer-store'
import { NUM_INPUT_CHANNELS } from '@/state/mixer-model'
import { loadSessionSnapshotFromLocalStorage } from '@/state/session-persistence'

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioSuspended, setAudioSuspended] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    // Prevent double-init in StrictMode
    if (initRef.current) return
    initRef.current = true

    async function start() {
      try {
        const restoredFromLocalSession = loadSessionSnapshotFromLocalStorage().ok

        // Load track manifest
        const manifestResponse = await fetch('/tracks.config.json')
        if (!manifestResponse.ok) {
          throw new Error('Could not load tracks.config.json. Place track files in public/stems/ and create public/tracks.config.json')
        }
        const manifest: TrackManifest = await manifestResponse.json()

        // Flatten all songs into a single track list with song metadata
        const flatTracks = manifest.songs.flatMap((song) =>
          song.tracks.map((t) => ({ ...t, songTitle: song.title }))
        )

        // Initialize all 32 channels — tracks fill the first N, rest get defaults
        const trackLabels = flatTracks.map((s) => s.label)
        const trackInputTypes = flatTracks.map((s) => s.inputType ?? 'direct')
        const labels = Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
          trackLabels[i] ?? `Ch ${i + 1}`
        )
        const inputTypes = Array.from({ length: NUM_INPUT_CHANNELS }, (_, i) =>
          trackInputTypes[i] ?? 'direct'
        )
        if (!restoredFromLocalSession) {
          useMixerStore.getState().initChannels(NUM_INPUT_CHANNELS, labels, inputTypes)
        }

        const engine = createAudioEngine()
        engineRef.current = engine
        await engine.init()
        setAudioSuspended(engine.getAudioState() === 'suspended')

        // Load tracks
        await engine.getTransport()!.loadTracks(manifest)

        // Feed track buffers to SourceManager
        const sm = engine.getSourceManager()!
        sm.setTrackBuffers(engine.getTransport()!.getTrackBuffers())

        // Populate available tracks in store
        const store = useMixerStore.getState()
        store.setAvailableTracks(
          flatTracks.map((t, i) => ({ index: i, label: t.label, songTitle: t.songTitle, stereo: t.stereo ?? false }))
        )

        // Populate song snapshots for songs that have a snapshot field
        store.setSongSnapshots(
          manifest.songs
            .filter((s) => s.snapshot)
            .map((s) => ({ title: s.title, snapshotUrl: s.snapshot! }))
        )

        // Re-bind channel sources from store (handles restored sessions + fresh start)
        store.channels.forEach((ch, i) => {
          sm.setChannelSource(i, ch.inputSource)
        })

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

        // Autoplay-policy recovery: any user gesture can resume audio context
        // after a browser refresh.
        const resumeOnGesture = () => {
          void engine.resume().then(() => {
            setAudioSuspended(engine.getAudioState() === 'suspended')
          })
        }
        window.addEventListener('pointerdown', resumeOnGesture, { passive: true })
        window.addEventListener('keydown', resumeOnGesture, { passive: true })

        const suspendedPoll = window.setInterval(() => {
          setAudioSuspended(engine.getAudioState() === 'suspended')
        }, 500)

        // Subscribe to transport state changes to drive transport + SourceManager
        const unsubTransport = useMixerStore.subscribe(
          (state) => state.transportState,
          (transportState) => {
            const transport = engine.getTransport()
            if (!transport) return
            const channelSources = useMixerStore.getState().channels.map((ch) => ch.inputSource)
            const hasTrackChannels = channelSources.some((s) => s.type === 'track')
            if (transportState === 'playing') {
              if (hasTrackChannels) {
                transport.play()
                sm.startTrackSources(transport.getOffset(), channelSources)
              }
            } else {
              if (transport.getIsPlaying()) {
                transport.stop()
              }
              sm.stopTrackSources()
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
        // transport clock, retime transport and track sources.
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
            const hasTrackChannels = channelSources.some((s) => s.type === 'track')
            if (!hasTrackChannels) return

            sm.stopTrackSources()
            sm.startTrackSources(transport.getOffset(), channelSources)
          }
        )

        // Subscribe to playback device state changes
        const unsubPlaybackDevice = useMixerStore.subscribe(
          (state) => ({
            trackIndex: state.playbackDevice.trackIndex,
            playing: state.playbackDevice.playing,
          }),
          ({ trackIndex, playing }, prev) => {
            if (playing && trackIndex !== null) {
              // Start or restart if track changed while playing
              if (!prev.playing || trackIndex !== prev.trackIndex) {
                sm.startDevice(trackIndex)
              }
            } else {
              // Stop if was playing
              if (prev.playing) {
                sm.stopDevice()
              }
            }
          },
          {
            equalityFn: (a, b) => a.trackIndex === b.trackIndex && a.playing === b.playing,
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
            unsubPlaybackDevice()
            window.removeEventListener('pointerdown', resumeOnGesture)
            window.removeEventListener('keydown', resumeOnGesture)
            window.clearInterval(suspendedPoll)
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

  const resumeAudio = async () => {
    const engine = engineRef.current
    if (!engine) return
    await engine.resume()
    setAudioSuspended(engine.getAudioState() === 'suspended')
  }

  return { isReady, error, audioSuspended, resumeAudio }
}
