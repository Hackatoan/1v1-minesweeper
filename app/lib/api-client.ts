'use client'
import { getPlayerId, getPlayerName } from './session'
import { getCachedIdToken } from './firebase'
import { Board, MoveInput, LeaderboardEntry, GameMode, MinePosition } from './types'
import type { RushView } from './rush-server'

function headers() {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Player-Id': getPlayerId(),
    'X-Player-Name': getPlayerName(),
  }
  // Optional: if the player is signed in, thread their Firebase ID token
  // along so the server can verify it and link this result to their
  // account instead of just the (unauthenticated) nickname. Anonymous play
  // keeps working exactly as before when this is absent.
  const idToken = getCachedIdToken()
  if (idToken) h['X-Id-Token'] = idToken
  return h
}

// Games
export async function getGame(id: string) {
  const res = await fetch(`/api/games/${id}`, { headers: headers() })
  if (!res.ok) return null
  return res.json()
}

export async function createGame(data: { board_size: number, is_public: boolean, player2_id?: string | null, status?: string, mode?: GameMode }) {
  const res = await fetch('/api/games', { method: 'POST', headers: headers(), body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Failed to create game')
  return res.json()
}

export async function updateGame(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/games/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Failed to update game')
  return res.json()
}

export async function listWaitingGames(boardSize: number, cutoffMs: number, mode: GameMode = 'classic') {
  const res = await fetch(`/api/games?status=waiting&is_public=true&board_size=${boardSize}&since=${cutoffMs}&mode=${mode}`, { headers: headers() })
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
  const boards: Board[] = await getBoards(gameId)
  return boards.some((b) => b.owner_id === playerId)
}

// Moves
export async function getMoves(gameId: string, since?: string) {
  const url = since
    ? `/api/games/${gameId}/moves?since=${encodeURIComponent(since)}`
    : `/api/games/${gameId}/moves`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  return res.json()
}

export async function insertMoves(gameId: string, moves: MoveInput[]) {
  const res = await fetch(`/api/games/${gameId}/moves`, { method: 'POST', headers: headers(), body: JSON.stringify({ moves }) })
  if (!res.ok) throw new Error('Failed to insert moves')
  return res.json()
}

// Rush mode — the server owns the boards, so the client only ever sends the
// clicked cell and gets back its own revealed cells plus both players' stats.
export type RushState = RushView

export async function getRushState(gameId: string): Promise<RushState | null> {
  const res = await fetch(`/api/games/${gameId}/rush`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export async function digRush(gameId: string, cell: MinePosition): Promise<RushState | null> {
  const res = await fetch(`/api/games/${gameId}/rush`, { method: 'POST', headers: headers(), body: JSON.stringify({ cell }) })
  if (!res.ok) return null
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

// Leaderboard
export async function getLeaderboard(): Promise<{ game: string, players: LeaderboardEntry[] }> {
  const res = await fetch('/api/leaderboard')
  if (!res.ok) return { game: '', players: [] }
  return res.json()
}
