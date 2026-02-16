/**
 * Metering system.
 *
 * Meter levels are stored in a shared mutable object (NOT in Zustand)
 * to avoid triggering React re-renders at 60fps. Meter UI components
 * read from this object directly via requestAnimationFrame.
 */

export interface MeterLevels {
  channels: Float32Array
  preFaderChannels: Float32Array
  mixBuses: Float32Array
  solo: number
  masterL: number
  masterR: number
}

// Shared singleton — written by MeteringManager, read by Meter components
export const meterLevels: MeterLevels = {
  channels: new Float32Array(8).fill(-Infinity),
  preFaderChannels: new Float32Array(8).fill(-Infinity),
  mixBuses: new Float32Array(6).fill(-Infinity),
  solo: -Infinity,
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
  private preFaderAnalysers: AnalyserNode[]
  private mixBusAnalysers: AnalyserNode[]
  private masterLAnalyser: AnalyserNode
  private masterRAnalyser: AnalyserNode
  private soloAnalyser: AnalyserNode
  private rafId: number | null = null
  private timeDomainBuffers: Float32Array<ArrayBuffer>[]
  private preFaderBuffers: Float32Array<ArrayBuffer>[]
  private mixBusBuffers: Float32Array<ArrayBuffer>[]
  private masterLBuffer: Float32Array<ArrayBuffer>
  private masterRBuffer: Float32Array<ArrayBuffer>
  private soloBuffer: Float32Array<ArrayBuffer>

  constructor(
    channelAnalysers: AnalyserNode[],
    preFaderAnalysers: AnalyserNode[],
    mixBusAnalysers: AnalyserNode[],
    masterLAnalyser: AnalyserNode,
    masterRAnalyser: AnalyserNode,
    soloAnalyser: AnalyserNode
  ) {
    this.channelAnalysers = channelAnalysers
    this.preFaderAnalysers = preFaderAnalysers
    this.mixBusAnalysers = mixBusAnalysers
    this.masterLAnalyser = masterLAnalyser
    this.masterRAnalyser = masterRAnalyser
    this.soloAnalyser = soloAnalyser

    this.timeDomainBuffers = channelAnalysers.map(
      (a) => new Float32Array(a.fftSize)
    )
    this.preFaderBuffers = preFaderAnalysers.map(
      (a) => new Float32Array(a.fftSize)
    )
    this.mixBusBuffers = mixBusAnalysers.map(
      (a) => new Float32Array(a.fftSize)
    )
    this.masterLBuffer = new Float32Array(masterLAnalyser.fftSize)
    this.masterRBuffer = new Float32Array(masterRAnalyser.fftSize)
    this.soloBuffer = new Float32Array(soloAnalyser.fftSize)

    meterLevels.channels = new Float32Array(channelAnalysers.length).fill(-Infinity)
    meterLevels.preFaderChannels = new Float32Array(preFaderAnalysers.length).fill(-Infinity)
    meterLevels.mixBuses = new Float32Array(mixBusAnalysers.length).fill(-Infinity)
    meterLevels.solo = -Infinity
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
    meterLevels.preFaderChannels.fill(-Infinity)
    meterLevels.mixBuses.fill(-Infinity)
    meterLevels.solo = -Infinity
    meterLevels.masterL = -Infinity
    meterLevels.masterR = -Infinity
  }

  private updateLevels(): void {
    for (let i = 0; i < this.channelAnalysers.length; i++) {
      this.channelAnalysers[i].getFloatTimeDomainData(this.timeDomainBuffers[i])
      meterLevels.channels[i] = computePeakDb(this.timeDomainBuffers[i])
    }

    for (let i = 0; i < this.preFaderAnalysers.length; i++) {
      this.preFaderAnalysers[i].getFloatTimeDomainData(this.preFaderBuffers[i])
      meterLevels.preFaderChannels[i] = computePeakDb(this.preFaderBuffers[i])
    }

    for (let i = 0; i < this.mixBusAnalysers.length; i++) {
      this.mixBusAnalysers[i].getFloatTimeDomainData(this.mixBusBuffers[i])
      meterLevels.mixBuses[i] = computePeakDb(this.mixBusBuffers[i])
    }

    this.soloAnalyser.getFloatTimeDomainData(this.soloBuffer)
    meterLevels.solo = computePeakDb(this.soloBuffer)

    this.masterLAnalyser.getFloatTimeDomainData(this.masterLBuffer)
    meterLevels.masterL = computePeakDb(this.masterLBuffer)

    this.masterRAnalyser.getFloatTimeDomainData(this.masterRBuffer)
    meterLevels.masterR = computePeakDb(this.masterRBuffer)
  }
}
