'use client'

let _cached: string | null = null

export function getPlayerId(): string {
  if (_cached) return _cached
  if (typeof window === 'undefined') return ''

  let id = localStorage.getItem('player_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('player_id', id)
  }
  _cached = id
  return id
}

// Nickname used for the shared cross-game leaderboards. Same localStorage key
// as the other Hackatoa games so a single nickname follows the player around.
export function cleanName(n: string): string {
  return (n || '').trim().replace(/\s+/g, ' ').slice(0, 24)
}

export function getPlayerName(): string {
  if (typeof window === 'undefined') return ''
  return cleanName(localStorage.getItem('playerName') || '')
}

export function setPlayerName(name: string): string {
  const c = cleanName(name)
  if (c && typeof window !== 'undefined') localStorage.setItem('playerName', c)
  return c
}
