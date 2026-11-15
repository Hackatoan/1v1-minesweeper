// Remembers the last-used game settings (mode, board size, AI difficulty) per
// screen in localStorage so returning players don't have to re-pick them.
// Purely client-side; anything malformed or out of range is ignored and the
// screen falls back to its normal defaults.

export type PrefMode = 'classic' | 'rush'
export type PrefDiff = 'easy' | 'medium' | 'hard'
export interface GamePrefs { mode?: PrefMode; boardSize?: number; diff?: PrefDiff }

export const LANDING_PREFS_KEY = '1v1ms_landing_prefs'
export const SOLO_PREFS_KEY = '1v1ms_solo_prefs'

export function parsePrefs(raw: string | null, minSize: number, maxSize: number): GamePrefs {
  if (!raw) return {}
  let v: unknown
  try { v = JSON.parse(raw) } catch { return {} }
  if (!v || typeof v !== 'object') return {}
  const o = v as Record<string, unknown>
  const out: GamePrefs = {}
  if (o.mode === 'classic' || o.mode === 'rush') out.mode = o.mode
  if (o.diff === 'easy' || o.diff === 'medium' || o.diff === 'hard') out.diff = o.diff
  if (typeof o.boardSize === 'number' && Number.isInteger(o.boardSize) && o.boardSize >= minSize && o.boardSize <= maxSize) {
    out.boardSize = o.boardSize
  }
  return out
}

export function loadPrefs(key: string, minSize: number, maxSize: number): GamePrefs {
  try { return parsePrefs(localStorage.getItem(key), minSize, maxSize) } catch { return {} }
}

export function savePrefs(key: string, prefs: GamePrefs): void {
  try { localStorage.setItem(key, JSON.stringify(prefs)) } catch { /* storage unavailable */ }
}
