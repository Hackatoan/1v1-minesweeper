'use client'
import { getPlayerId } from './session'

function headers() {
  return { 'Content-Type': 'application/json', 'X-Player-Id': getPlayerId() }
}

// Games
export async function getGame(id: string) {
  const res = await fetch(`/api/games/${id}`, { headers: headers() })
  if (!res.ok) return null
  return res.json()
}

export async function createGame(data: { board_size: number, is_public: boolean, player2_id?: string | null, status?: string }) {
  const res = await fetch('/api/games', { method: 'POST', headers: headers(), body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Failed to create game')
  return res.json()
}

export async function updateGame(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/games/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Failed to update game')
  return res.json()
}

export async function listWaitingGames(boardSize: number, cutoffMs: number) {
  const res = await fetch(`/api/games?status=waiting&is_public=true&board_size=${boardSize}&since=${cutoffMs}`, { headers: headers() })
  if (!res.ok) return []
  return res.json()
}

// Boards
export async function getBoards(gameId: string) {
  const res = await fetch(`/api/games/${gameId}/boards`, { headers: headers() })
  if (!res.ok) return []
  return res.json()
}

export async function submitBoard(gameId: string, mines: {r: number, c: number}[]) {
  const res = await fetch(`/api/games/${gameId}/boards`, { method: 'POST', headers: headers(), body: JSON.stringify({ mine_positions: mines }) })
  if (!res.ok) throw new Error('Failed to submit board')
  return res.json()
}

export async function hasMyBoard(gameId: string): Promise<boolean> {
  const playerId = getPlayerId()
  const boards = await getBoards(gameId)
  return boards.some((b: any) => b.owner_id === playerId)
}

// Moves
export async function getMoves(gameId: string) {
  const res = await fetch(`/api/games/${gameId}/moves`, { headers: headers() })
  if (!res.ok) return []
  return res.json()
}

export async function insertMoves(gameId: string, moves: any[]) {
  const res = await fetch(`/api/games/${gameId}/moves`, { method: 'POST', headers: headers(), body: JSON.stringify({ moves }) })
  if (!res.ok) throw new Error('Failed to insert moves')
  return res.json()
}

// Ping / presence
export async function pingGame(gameId: string) {
  await fetch(`/api/games/${gameId}/ping`, { method: 'POST', headers: headers() }).catch(() => {})
}

// Stats
export async function getGamesPlayed(): Promise<number> {
  const res = await fetch('/api/stats')
  if (!res.ok) return 0
  const data = await res.json()
  return data.games_played
}

export async function incrementGamesPlayed() {
  await fetch('/api/stats/increment', { method: 'POST', headers: headers() })
}
