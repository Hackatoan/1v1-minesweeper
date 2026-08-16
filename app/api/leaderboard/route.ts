import { NextResponse } from 'next/server'
import { GAME, getLeaderboard } from '../../lib/leaderboard'

export async function GET() {
  const players = await getLeaderboard(20)
  return NextResponse.json({ game: GAME, players })
}
