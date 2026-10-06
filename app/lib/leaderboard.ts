import createLeaderboard from '@hackatoan/leaderboard'
import { pool } from './db'

// Thin shim over the shared leaderboard SDK (github.com/Hackatoan/game-leaderboard).
// Same exports as the old inline implementation, plus anti-cheat guards and a profanity
// filter. Reuses this app's shared pg pool.
const lb = createLeaderboard({ gameId: process.env.GAME_ID || '1v1ms', pool })

export const GAME = lb.GAME
export const cleanName = lb.cleanName
export const recordMatch = lb.recordMatch
export const claimNickname = lb.claimNickname
export const getLeaderboard = lb.getLeaderboard
