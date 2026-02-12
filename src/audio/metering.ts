/**
 * Metering system.
 *
 * Meter levels are stored in a shared mutable object (NOT in Zustand)
 * to avoid triggering React re-renders at 60fps. Meter UI components
 * read from this object directly via requestAnimationFrame.
 */

export interface MeterLevels {
  channels: Float32Array
  masterL: number
  masterR: number
}

// Shared singleton — written by MeteringManager, read by Meter components
export const meterLevels: MeterLevels = {
  channels: new Float32Array(8).fill(-Infinity),
  masterL: -Infinity,
  masterR: -Infinity,
}

function computePeakDb(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }
  if (peak === 0) return -Infinity
  return 20 * Math.log10(peak)
}

export class MeteringManager {
  private channelAnalysers: AnalyserNode[]
  private masterAnalyser: AnalyserNode
  private rafId: number | null = null
  private timeDomainBuffers: Float32Array[]
  private masterBuffer: Float32Array

  constructor(channelAnalysers: AnalyserNode[], masterAnalyser: AnalyserNode) {
    this.channelAnalysers = channelAnalysers
    this.masterAnalyser = masterAnalyser

    this.timeDomainBuffers = channelAnalysers.map(
      (a) => new Float32Array(a.fftSize)
    )
    this.masterBuffer = new Float32Array(masterAnalyser.fftSize)

    meterLevels.channels = new Float32Array(channelAnalysers.length).fill(-Infinity)
    meterLevels.masterL = -Infinity
    meterLevels.masterR = -Infinity
  }

  start(): void {
    const tick = () => {
      this.updateLevels()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    meterLevels.channels.fill(-Infinity)
    meterLevels.masterL = -Infinity
    meterLevels.masterR = -Infinity
  }

  private updateLevels(): void {
    for (let i = 0; i < this.channelAnalysers.length; i++) {
      this.channelAnalysers[i].getFloatTimeDomainData(this.timeDomainBuffers[i])
      meterLevels.channels[i] = computePeakDb(this.timeDomainBuffers[i])
    }

    this.masterAnalyser.getFloatTimeDomainData(this.masterBuffer)
    const masterPeak = computePeakDb(this.masterBuffer)
    meterLevels.masterL = masterPeak
    meterLevels.masterR = masterPeak
  }
}
