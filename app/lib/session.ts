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
