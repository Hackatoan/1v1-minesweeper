'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getPlayerId } from '../../../lib/session'
import { getGame, getRushState, digRush, updateGame, incrementGamesPlayed, type RushState } from '../../../lib/api-client'
import { useGamePresence } from '../../../lib/useGamePresence'
import { useT, TFunc } from '../../../lib/i18n-client'
import useLongPress from '../../../lib/useLongPress'
import { sfx, initSfx } from '../../../lib/sfx'
import { Game } from '../../../lib/types'

const NUMBER_COLORS = ['text-transparent', 'text-blue-500', 'text-orange-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']
const CELL = 'mine-cell w-12 h-12 sm:w-14 sm:h-14 text-xl font-black flex items-center justify-center'

const RushCell = React.memo(function RushCell({
  r, c, n, revealed, hit, flagged, t, onDig, onFlag,
}: {
  r: number; c: number; n: number; revealed: boolean; hit: boolean; flagged: boolean
  t: TFunc
  onDig: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
}) {
  const longPress = useLongPress(() => onFlag(r, c), () => onDig(r, c))

  if (revealed) {
    const label = hit
      ? t('game.cellMineHit', { row: r + 1, col: c + 1 })
      : t('game.cellRevealed', { row: r + 1, col: c + 1, count: n })
    return (
      <div role="img" aria-label={label}
        className={`${CELL} ${hit ? 'bg-rose-500 shadow-inner' : 'bg-brown-700 border border-brown-600/50 shadow-inner'}`}>
        {hit ? '💥' : n > 0 && <span className={NUMBER_COLORS[n] || 'text-zinc-800'}>{n}</span>}
      </div>
    )
  }
  return (
    <button
      {...longPress}
      onContextMenu={(e) => { e.preventDefault(); onFlag(r, c) }}
      aria-label={flagged ? t('game.cellFlagged', { row: r + 1, col: c + 1 }) : t('game.cellHidden', { row: r + 1, col: c + 1 })}
      className={`${CELL} bg-brown-600 border border-brown-500/50 hover:bg-pink-300 cursor-pointer shadow-sm hover:shadow active:scale-95`}
    >
      {flagged && '🚩'}
    </button>
  )
})

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="tracking-wider" aria-label={`${lives}/${max}`}>
      {Array.from({ length: max }, (_, i) => (i < lives ? '❤️' : '🖤')).join('')}
    </span>
  )
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RushPlay() {
  const { t } = useT()
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [userId, setUserId] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [state, setState] = useState<RushState | null>(null)
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [flagMode, setFlagMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Request ordering: a slow poll that started before a click must never
  // overwrite the (newer) state the click's response returned.
  const seqRef = useRef(0)
  const appliedRef = useRef(0)
  const clockOffsetRef = useRef(0)
  const prevRef = useRef<{ lives: number; clears: number; oppLives: number; oppClears: number } | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const prevIdxRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const prevOnlineRef = useRef<boolean | null>(null)

  const apply = useCallback((seq: number, next: RushState | null) => {
    if (!next || seq < appliedRef.current) return
    appliedRef.current = seq
    clockOffsetRef.current = next.server_now - Date.now()

    const prev = prevRef.current
    if (prev) {
      let msg: string | null = null
      if (next.me.lives < prev.lives) { sfx('boom'); msg = t('rush.hitToast') }
      else if (next.me.clears > prev.clears) { sfx('turn'); msg = t('rush.clearToast') }
      // Opponent events: their mistake lands, their clear adds pressure.
      else if (next.opp.lives < prev.oppLives) sfx('hit')
      else if (next.opp.clears > prev.oppClears) sfx('error')
      if (msg) {
        setToast(msg)
        if (liveRegionRef.current) liveRegionRef.current.textContent = msg
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 1800)
      }
      if (next.me.idx !== (prevIdxRef.current ?? next.me.idx)) setFlags(new Set())
    }
    prevRef.current = { lives: next.me.lives, clears: next.me.clears, oppLives: next.opp.lives, oppClears: next.opp.clears }
    if (!prev) sfx('join')
    prevIdxRef.current = next.me.idx
    setState(next)
  }, [t])

  useEffect(() => { initSfx() }, [])

  useEffect(() => {
    const uid = getPlayerId()
    if (!uid) { router.push('/'); return }
    setUserId(uid)
  }, [router])

  // One poll loop: rush state (authoritative) + the game row (presence only).
  useEffect(() => {
    if (!userId) return
    let stopped = false
    const tick = async () => {
      const seq = ++seqRef.current
      const [s, g] = await Promise.all([getRushState(gameId), getGame(gameId)])
      if (stopped) return
      if (g) setGame(g)
      if (s) apply(seq, s)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => { stopped = true; clearInterval(interval) }
  }, [userId, gameId, apply])

  useEffect(() => {
    if (state?.status === 'finished') router.push(`/game/${gameId}/result`)
  }, [state?.status, gameId, router])

  // Countdown display only; the server decides when time is actually up.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const onlineUsers = useGamePresence(gameId, game)
  const isOpponentOnline = game
    ? (game.player1_id === userId ? !!game.player2_id && onlineUsers.includes(game.player2_id) : onlineUsers.includes(game.player1_id))
    : false

  useEffect(() => {
    if (!state) return
    if (prevOnlineRef.current === null) { prevOnlineRef.current = isOpponentOnline; return }
    if (prevOnlineRef.current !== isOpponentOnline && liveRegionRef.current) {
      liveRegionRef.current.textContent = isOpponentOnline ? t('game.opponentReconnected') : t('game.oppDisconnected')
      prevOnlineRef.current = isOpponentOnline
    }
  }, [isOpponentOnline, state, t])

  const revealedMap = useMemo(() => {
    const m = new Map<string, { n: number; hit: boolean }>()
    for (const c of state?.me.revealed ?? []) m.set(`${c.r},${c.c}`, { n: c.n, hit: !!c.hit })
    return m
  }, [state?.me.revealed])

  // Last-10-seconds countdown tick, once per whole second.
  const secsLeft = state?.started_at
    ? Math.ceil((state.cap_ms - (now + clockOffsetRef.current - new Date(state.started_at).getTime())) / 1000)
    : null
  useEffect(() => {
    if (secsLeft === null || state?.status !== 'playing') return
    if (secsLeft >= 1 && secsLeft <= 10 && lastTickRef.current !== secsLeft) sfx('tick')
    lastTickRef.current = secsLeft
  }, [secsLeft, state?.status])

  const toggleFlag = useCallback((r: number, c: number) => {
    if (revealedMap.has(`${r},${c}`)) return
    sfx('flag')
    setFlags((prev) => {
      const next = new Set(prev)
      const k = `${r},${c}`
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }, [revealedMap])

  const dig = useCallback(async (r: number, c: number) => {
    if (busyRef.current || !state || state.status !== 'playing') return
    const k = `${r},${c}`
    if (revealedMap.has(k) || flags.has(k)) return
    busyRef.current = true
    sfx('reveal')
    try {
      const seq = ++seqRef.current
      apply(seq, await digRush(gameId, { r, c }))
    } finally {
      busyRef.current = false
    }
  }, [state, revealedMap, flags, gameId, apply])

  const handleCell = useCallback((r: number, c: number) => {
    if (flagMode) toggleFlag(r, c); else dig(r, c)
  }, [flagMode, toggleFlag, dig])

  const forfeit = async () => {
    if (!userId || !game) return
    if (!confirm(t('game.confirmForfeit'))) return
    const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id
    await updateGame(gameId, { status: 'finished', winner_id: winnerId })
    await incrementGamesPlayed()
    router.push('/')
  }

  if (!state) return (
    <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
      <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
    </div>
  )

  const size = state.size
  const remaining = state.started_at
    ? state.cap_ms - (now + clockOffsetRef.current - new Date(state.started_at).getTime())
    : state.cap_ms
  const pct = (d: number | null) => (d == null ? '—' : `${Math.round(d * 100)}%`)

  const modeBtn = (active: boolean, flag: boolean) =>
    `px-4 py-2 rounded-lg font-bold text-sm transition-all ${
      active
        ? flag ? 'bg-rose-500 text-white shadow-md' : 'bg-brown-600 border border-brown-500/50 hover:bg-brown-500 text-white shadow-md'
        : 'text-pink-300/60 hover:text-brown-700 hover:bg-brown-700 border border-brown-600/50 shadow-inner'
    }`

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-4 sm:p-6">
      <div ref={liveRegionRef} aria-live="polite" role="status" className="sr-only"></div>

      <div className="max-w-xl w-full flex flex-col items-center gap-4 sm:gap-6 pb-28 lg:pb-8">
        {!isOpponentOnline && (
          <div className="w-full bg-rose-950/30 border border-rose-900/50 text-rose-400 px-5 py-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div>
              <p className="font-bold">⚠️ {t('game.oppDisconnected')}</p>
              <p className="text-sm opacity-90">{t('game.oppDisconnectedDesc')}</p>
            </div>
            <button onClick={forfeit} className="bg-rose-900/50 hover:bg-rose-800 text-rose-200 px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap">
              {t('game.leaveGame')}
            </button>
          </div>
        )}

        {/* Opponent strip */}
        <div className="w-full bg-brown-900/50 border border-brown-700/50 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 shadow-inner text-sm">
          <span className="font-bold text-pink-300/80 uppercase tracking-wider">{t('rush.opponent')}</span>
          <Hearts lives={state.opp.lives} max={state.max_lives} />
          <span className="font-mono text-pink-100">✅ {state.opp.clears}</span>
          <span className="font-mono text-pink-300/70" title={t('rush.opponentBoard')}>
            {state.opp.safe_revealed}/{state.opp.safe_total || '—'} · {pct(state.opp.density)}
          </span>
        </div>

        {/* My board */}
        <div className="w-full flex flex-col items-center gap-4 bg-brown-800 border border-brown-700 p-4 sm:p-8 rounded-3xl shadow-xl relative">
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.lives')}</span>
              <span className="text-2xl"><Hearts lives={state.me.lives} max={state.max_lives} /></span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.timeLeft')}</span>
              <span className={`text-2xl font-mono font-bold ${remaining < 30_000 ? 'text-rose-400' : 'text-pink-100'}`}>{fmtClock(remaining)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.cleared')}</span>
              <span className="text-2xl font-mono font-bold text-pink-400">{state.me.clears}</span>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-pink-100">{t('rush.yourBoard', { n: state.me.idx + 1 })}</h2>
            <p className="text-sm text-pink-300/60">
              {t('rush.mines', { count: state.me.mines })} · {t('rush.density')} {pct(state.me.density)}
            </p>
          </div>

          <div role="group" aria-label={`${t('game.dig')} / ${t('game.flag')}`} className="hidden lg:flex gap-2 bg-brown-900/50 p-1 rounded-xl shadow-inner border border-brown-700/50">
            <button onClick={() => setFlagMode(false)} aria-pressed={!flagMode} className={modeBtn(!flagMode, false)}>{t('game.dig')}</button>
            <button onClick={() => setFlagMode(true)} aria-pressed={flagMode} className={modeBtn(flagMode, true)}>{t('game.flag')}</button>
          </div>

          <div className="mine-grid shadow-lg" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {Array.from({ length: size }).flatMap((_, r) =>
              Array.from({ length: size }).map((__, c) => {
                const k = `${r},${c}`
                const cell = revealedMap.get(k)
                return (
                  <RushCell
                    key={`${state.me.idx}-${k}`}
                    r={r} c={c}
                    n={cell?.n ?? 0}
                    revealed={!!cell}
                    hit={cell?.hit ?? false}
                    flagged={flags.has(k)}
                    t={t}
                    onDig={handleCell}
                    onFlag={toggleFlag}
                  />
                )
              })
            )}
          </div>

          <div className="font-mono text-sm text-pink-300/70">{state.me.safe_revealed} / {state.me.safe_total}</div>

          {toast && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-brown-900/95 border border-pink-400/60 text-pink-100 font-bold px-4 py-2 rounded-xl shadow-lg whitespace-nowrap pointer-events-none">
              {toast}
            </div>
          )}
        </div>

        <p className="text-xs text-pink-300/50 text-center max-w-md">{t('rush.howTo')}</p>
        <p className="lg:hidden text-xs text-pink-300/40">{t('game.tapHint')}</p>
        <button onClick={forfeit} className="text-brown-400 hover:text-rose-600 font-medium transition-colors hover:underline text-sm">
          {t('game.forfeitMatch')}
        </button>
      </div>

      <div role="group" aria-label={`${t('game.dig')} / ${t('game.flag')}`} className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-brown-900/95 border-t border-brown-700/60 backdrop-blur-sm flex items-center justify-center gap-3">
        <button onClick={() => setFlagMode(false)} aria-pressed={!flagMode} className={`flex-1 max-w-40 py-3 rounded-xl text-base ${modeBtn(!flagMode, false)}`}>{t('game.dig')}</button>
        <button onClick={() => setFlagMode(true)} aria-pressed={flagMode} className={`flex-1 max-w-40 py-3 rounded-xl text-base ${modeBtn(flagMode, true)}`}>{t('game.flag')}</button>
      </div>
    </div>
  )
}
