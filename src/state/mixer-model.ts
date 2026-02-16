// ---- Gain range (matches X32: -12 to +60 dB) ----

export const GAIN_MIN = -12
export const GAIN_MAX = 60
export const GAIN_DEFAULT = GAIN_MIN  // Zeroed out at startup

// ---- Input type attenuation ----

export const INPUT_TYPE_CONFIG = {
  mic:    { attenuation: -40 },
  line:   { attenuation: -20 },
  direct: { attenuation: 0 },
} as const

// ---- Channel / bus / send constants ----

export const NUM_INPUT_CHANNELS = 32
export const NUM_MIX_BUSES = 16
export const NUM_DCA_GROUPS = 8

// ---- Channel input source ----

export type ChannelInputSource =
  | { type: 'stem'; stemIndex: number }
  | { type: 'tone'; toneIndex: number }
  | { type: 'live'; deviceId: string }
  | { type: 'none' }

export const NUM_TONE_SLOTS = 8

// ---- Types ----

export interface SendState {
  level: number       // 0..1, default 0 (off)
  preFader: boolean   // true = pre-fader, false = post-fader
}

export interface MixBusState {
  id: number
  label: string
  faderPosition: number  // 0..1, default 0 (-∞)
  mute: boolean
  solo: boolean
}

export interface DcaGroupState {
  id: number
  label: string
  faderPosition: number  // 0..1, default 0.75 (unity)
  mute: boolean
  solo: boolean
  assignedChannels: number[]  // channel IDs
}

export type MonitorSource = 'main' | 'solo' | `bus-${number}`

export interface MonitorState {
  source: MonitorSource  // user's manual selection, default 'main'
  level: number          // 0..1, headphone volume, default 0.75
}
