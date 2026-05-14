import { NextResponse } from 'next/server'
import { pool } from '../../lib/db'

export async function GET() {
  const { rows } = await pool.query('SELECT games_played FROM global_stats WHERE id = 1')
  return NextResponse.json(rows[0] ?? { games_played: 0 })
}
