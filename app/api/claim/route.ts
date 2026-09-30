import { NextRequest, NextResponse } from 'next/server'
import { cleanName, claimNickname } from '../../lib/leaderboard'
import { verifyFirebaseToken } from '../../lib/verifyFirebaseToken'

// Merge a previously-played anonymous nickname's stats into the signed-in
// account making this request. Rate-limited implicitly by requiring a fresh
// verified ID token per call (an attacker can't cheaply mint those).
// Mirrors tic-tac-toe-online's POST /api/claim (PR #17).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const decoded = await verifyFirebaseToken(body && body.idToken)
  if (!decoded) return NextResponse.json({ ok: false, reason: 'sign in required' }, { status: 401 })

  const nickname = cleanName(body && body.nickname)
  if (!nickname) return NextResponse.json({ ok: false, reason: 'nickname required' }, { status: 400 })

  const result = await claimNickname(nickname, decoded.uid, decoded.name)
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
