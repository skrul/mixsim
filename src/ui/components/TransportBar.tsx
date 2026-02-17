import { useRef, type ChangeEvent } from 'react'
import { useMixerStore } from '@/state/mixer-store'
import { useSurfaceStore } from '@/state/surface-store'
import { NUM_TONE_SLOTS, type ChannelInputSource } from '@/state/mixer-model'
import { getToneLabel } from '@/audio/source-manager'
import { exportSessionSnapshot, importSessionSnapshot } from '@/state/session-persistence'
import styles from './TransportBar.module.css'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function sourceToValue(source: ChannelInputSource): string {
  switch (source.type) {
    case 'stem': return `stem:${source.stemIndex}`
    case 'tone': return `tone:${source.toneIndex}`
    case 'live': return `live:${source.deviceId}`
    case 'none': return 'none'
  }
}

function valueToSource(value: string): ChannelInputSource {
  if (value === 'none') return { type: 'none' }
  const [type, rest] = value.split(':')
  switch (type) {
    case 'stem': return { type: 'stem', stemIndex: parseInt(rest, 10) }
    case 'tone': return { type: 'tone', toneIndex: parseInt(rest, 10) }
    case 'live': return { type: 'live', deviceId: rest }
    default: return { type: 'none' }
  }
}

interface TransportBarProps {
  compact?: boolean
}

export function TransportBar({ compact = false }: TransportBarProps) {
  const selectedChannel = useSurfaceStore((s) => s.selectedChannel)
  const resetSurfaceState = useSurfaceStore((s) => s.resetSurfaceState)
  const selectedChannelState = useMixerStore((s) => s.channels[selectedChannel])
  const transportState = useMixerStore((s) => s.transportState)
  const currentTime = useMixerStore((s) => s.currentTime)
  const duration = useMixerStore((s) => s.duration)
  const stemsLoaded = useMixerStore((s) => s.stemsLoaded)
  const availableStems = useMixerStore((s) => s.availableStems)
  const availableLiveDevices = useMixerStore((s) => s.availableLiveDevices)
  const setChannelInputSource = useMixerStore((s) => s.setChannelInputSource)
  const resetBoard = useMixerStore((s) => s.resetBoard)
  const applyPresetStems = useMixerStore((s) => s.applyPresetStems)
  const applyPresetTones = useMixerStore((s) => s.applyPresetTones)
  const play = useMixerStore((s) => s.play)
  const stop = useMixerStore((s) => s.stop)
  const rewind = useMixerStore((s) => s.rewind)
  const setHelpText = useSurfaceStore((s) => s.setHelpText)
  const sessionFileInputRef = useRef<HTMLInputElement>(null)

  const handleZeroBoard = () => {
    resetBoard()
    resetSurfaceState()
    setHelpText('Board reset to zero/default state.')
  }

  const saveSession = () => {
    const result = exportSessionSnapshot()
    if (!result.ok) {
      setHelpText(result.error)
      return
    }

    const blob = new Blob([result.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.fileName
    link.click()
    URL.revokeObjectURL(url)
    setHelpText('Session file saved.')
  }

  const loadSession = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = importSessionSnapshot(await file.text())
    setHelpText(result.ok ? 'Session loaded.' : result.error)
  }

  return (
    <div className={`${styles.transportBar} ${compact ? styles.compact : ''}`}>
      {compact ? (
        <>
          <div className={styles.compactHeader}>TOOLS</div>
          {selectedChannelState && (
            <div className={styles.inputPicker}>
              <div className={styles.inputPickerLabel}>CH {selectedChannel + 1} INPUT</div>
              <select
                className={styles.inputSelect}
                value={sourceToValue(selectedChannelState.inputSource)}
                onChange={(e) => setChannelInputSource(selectedChannel, valueToSource(e.target.value))}
                onMouseEnter={() => setHelpText('Choose the source for the selected input channel: stems, tones, live device, or none.')}
                onMouseLeave={() => setHelpText('')}
              >
                <option value="none">None</option>
                {availableStems.length > 0 && (
                  <optgroup label="Stems">
                    {availableStems.map((s) => (
                      <option key={`stem:${s.index}`} value={`stem:${s.index}`}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Tones">
                  {Array.from({ length: NUM_TONE_SLOTS }, (_, i) => (
                    <option key={`tone:${i}`} value={`tone:${i}`}>
                      {getToneLabel(i)}
                    </option>
                  ))}
                </optgroup>
                {availableLiveDevices.length > 0 && (
                  <optgroup label="Live Input">
                    {availableLiveDevices.map((d) => (
                      <option key={`live:${d.deviceId}`} value={`live:${d.deviceId}`}>
                        {d.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
          <div className={styles.compactGrid}>
            <button
              className={styles.sourceModeButton}
              onClick={applyPresetStems}
              onMouseEnter={() => setHelpText('Set all channels to their default stem inputs from the loaded audio files.')}
              onMouseLeave={() => setHelpText('')}
            >
              Stems
            </button>
            <button
              className={styles.sourceModeButton}
              onClick={applyPresetTones}
              onMouseEnter={() => setHelpText('Set all channels to test tones — sine waves, sawtooth, square, triangle, and noise. Great for learning what each control does.')}
              onMouseLeave={() => setHelpText('')}
            >
              Tones
            </button>
            <button
              className={styles.sessionButton}
              onClick={saveSession}
              onMouseEnter={() => setHelpText('Save the full mixer + control surface state to a JSON file.')}
              onMouseLeave={() => setHelpText('')}
            >
              Save File
            </button>
            <button
              className={styles.sessionButton}
              onClick={() => sessionFileInputRef.current?.click()}
              onMouseEnter={() => setHelpText('Load mixer + control surface state from a saved JSON file.')}
              onMouseLeave={() => setHelpText('')}
            >
              Load File
            </button>
            <button
              className={styles.dangerButton}
              onClick={handleZeroBoard}
              onMouseEnter={() => setHelpText('Reset the mixer and control surface to default zero state.')}
              onMouseLeave={() => setHelpText('')}
            >
              Zero Board
            </button>
            <button
              onClick={rewind}
              disabled={!stemsLoaded}
              onMouseEnter={() => setHelpText("Return playback to the beginning of the track.")}
              onMouseLeave={() => setHelpText('')}
            >
              ⏮ Rewind
            </button>
            <button
              onClick={transportState === 'playing' ? stop : play}
              disabled={!stemsLoaded}
              className={transportState !== 'playing' ? styles.playButton : undefined}
              onMouseEnter={() => setHelpText("Start or stop playback of stem-assigned channels. Only channels set to a stem input will be affected.")}
              onMouseLeave={() => setHelpText('')}
            >
              {transportState === 'playing' ? '⏹ Stop' : '▶ Play'}
            </button>
          </div>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </>
      ) : (
        <>
          <div className={styles.sourceModeButtons}>
            <button
              className={styles.sourceModeButton}
              onClick={applyPresetStems}
              onMouseEnter={() => setHelpText('Set all channels to their default stem inputs from the loaded audio files.')}
              onMouseLeave={() => setHelpText('')}
            >
              Stems
            </button>
            <button
              className={styles.sourceModeButton}
              onClick={applyPresetTones}
              onMouseEnter={() => setHelpText('Set all channels to test tones — sine waves, sawtooth, square, triangle, and noise. Great for learning what each control does.')}
              onMouseLeave={() => setHelpText('')}
            >
              Tones
            </button>
          </div>
          <div className={styles.separator} />
          <button
            className={styles.sessionButton}
            onClick={saveSession}
            onMouseEnter={() => setHelpText('Save the full mixer + control surface state to a JSON file.')}
            onMouseLeave={() => setHelpText('')}
          >
            Save File
          </button>
          <button
            className={styles.sessionButton}
            onClick={() => sessionFileInputRef.current?.click()}
            onMouseEnter={() => setHelpText('Load mixer + control surface state from a saved JSON file.')}
            onMouseLeave={() => setHelpText('')}
          >
            Load File
          </button>
          <div className={styles.separator} />
          <button
            onClick={rewind}
            disabled={!stemsLoaded}
            onMouseEnter={() => setHelpText("Return playback to the beginning of the track.")}
            onMouseLeave={() => setHelpText('')}
          >
            ⏮ Rewind
          </button>
          <button
            onClick={transportState === 'playing' ? stop : play}
            disabled={!stemsLoaded}
            className={transportState !== 'playing' ? styles.playButton : undefined}
            onMouseEnter={() => setHelpText("Start or stop playback of stem-assigned channels. Only channels set to a stem input will be affected.")}
            onMouseLeave={() => setHelpText('')}
          >
            {transportState === 'playing' ? '⏹ Stop' : '▶ Play'}
          </button>
          <span className={styles.title}>MixSim</span>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </>
      )}
      <input ref={sessionFileInputRef} type="file" accept=".json,application/json" className={styles.hiddenFileInput} onChange={loadSession} />
    </div>
  )
}
