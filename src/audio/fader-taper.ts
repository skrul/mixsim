/**
 * Fader taper conversion functions.
 *
 * Models the X32 fader law:
 *   - Position 0.0  → -∞ dB (silence)
 *   - Position 0.75 → 0 dB (unity)
 *   - Position 1.0  → +10 dB (max)
 *
 * Lower region (0–0.75): exponential — dB = 40 * log10(position / 0.75)
 * Upper region (0.75–1.0): linear-in-dB — 0 to +10 dB
 */

const UNITY_POS = 0.75
const MAX_DB = 10
const MIN_DB = -90

export function faderPositionToDb(position: number): number {
  if (position <= 0) return -Infinity
  if (position >= 1) return MAX_DB

  if (position <= UNITY_POS) {
    const normalized = position / UNITY_POS
    const db = 40 * Math.log10(normalized)
    return Math.max(db, MIN_DB)
  } else {
    const fraction = (position - UNITY_POS) / (1 - UNITY_POS)
    return fraction * MAX_DB
  }
}

export function faderPositionToGain(position: number): number {
  const db = faderPositionToDb(position)
  if (db <= MIN_DB) return 0
  return Math.pow(10, db / 20)
}

export function dbToGain(db: number): number {
  if (db <= MIN_DB) return 0
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity
  return 20 * Math.log10(gain)
}

export function formatDb(db: number): string {
  if (db <= MIN_DB || db === -Infinity) return '-∞'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`
}

export const FADER_UNITY_POSITION = UNITY_POS
