import { NextResponse } from 'next/server'
import { pool } from '../../../lib/db'

export async function POST() {
  await pool.query('SELECT increment_games_played()')
  return NextResponse.json({ ok: true })
}
