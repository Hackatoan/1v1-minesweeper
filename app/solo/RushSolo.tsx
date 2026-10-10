'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useT, type TFunc } from '../lib/i18n-client'
import { sfx } from '../lib/sfx'
import { RUSH_BOARD_SIZE, RUSH_LIVES, RUSH_TIME_CAP_MS } from '../lib/rush'
import {
  RUSH_AI_DELAY, digRushGame, livesOf, newRushGame, pickRushDig, safeRevealed, safeTotal, settle,
  type RushDiff, type RushSide, type RushSoloGame,
} from '../lib/rush-solo'

const NUMBER_COLORS = ['text-transparent', 'text-blue-500', 'text-orange-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']
const CELL = 'mine-cell w-12 h-12 sm:w-14 sm:h-14 text-xl font-black flex items-center justify-center'

const randInt = (n: number) => Math.floor(Math.random() * n)
const pct = (d: number) => `${Math.round(d * 100)}%`

const RushCell = memo(function RushCell({ r, c, cell, flagged, t, onPress, onFlag }: {
  r: number; c: number; cell: { n: number; hit: boolean } | undefined; flagged: boolean
  t: TFunc
  onPress: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
}) {
  if (cell) {
    return (
      <div role="img" aria-label={t('solo.cellRevealed', { row: r + 1, col: c + 1, count: cell.n })}
        className={`${CELL} bg-brown-700 border border-brown-600/50 shadow-inner`}>
        {cell.n > 0 && <span className={NUMBER_COLORS[cell.n] || 'text-zinc-800'}>{cell.n}</span>}
      </div>
    )
  }
  return (
    <button onClick={() => onPress(r, c)}
      onContextMenu={(e) => { e.preventDefault(); onFlag(r, c) }}
      aria-label={flagged ? t('solo.cellFlagged', { row: r + 1, col: c + 1 }) : t('solo.cellHidden', { row: r + 1, col: c + 1 })}
      className={`${CELL} bg-brown-600 border border-brown-500/50 hover:bg-pink-300 cursor-pointer shadow-sm hover:shadow active:scale-95`}>
      {flagged && '🚩'}
    </button>
  )
})

function Hearts({ lives }: { lives: number }) {
  return (
    <span className="tracking-wider" aria-label={`${lives}/${RUSH_LIVES}`}>
      {Array.from({ length: RUSH_LIVES }, (_, i) => (i < lives ? '❤️' : '🖤')).join('')}
    </span>
  )
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RushSolo({ diff, onMenu, onAgain }: { diff: RushDiff; onMenu: () => void; onAgain: () => void }) {
  const { t } = useT()
  // The match lives in a ref so the AI timer and click handlers always act on
  // the latest state; `game` mirrors it purely to trigger re-renders.
  const gameRef = useRef<RushSoloGame | null>(null)
  const [game, setGame] = useState<RushSoloGame | null>(null)
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [flagMode, setFlagMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTickRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  const commit = useCallback((next: RushSoloGame, who: 'player' | 'ai') => {
    const prev = gameRef.current
    gameRef.current = next
    setGame(next)
    if (!prev) return
    if (who === 'player') {
      if (next.me.hits > prev.me.hits) { sfx('boom'); setFlags(new Set()); showToast(t('rush.hitToast')) }
      else if (next.me.clears > prev.me.clears) { sfx('turn'); setFlags(new Set()); showToast(t('rush.clearToast')) }
    } else {
      if (next.ai.hits > prev.ai.hits) sfx('hit')
      else if (next.ai.clears > prev.ai.clears) sfx('error')
    }
    if (next.winner && !prev.winner) sfx(next.winner === 'player' ? 'win' : 'lose')
  }, [showToast, t])

  // Start the match on mount (client-only: boards are random).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t0 = Date.now()
    const g = newRushGame(t0, randInt)
    gameRef.current = g
    setGame(g)
    setNow(t0)
    sfx('join')
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clock: also ends the match when the cap is reached.
  const started = game !== null
  const over = game?.winner != null
  useEffect(() => {
    if (!started || over) return
    const id = setInterval(() => {
      const t1 = Date.now()
      setNow(t1)
      const g = gameRef.current
      if (g && !g.winner) {
        const settled = settle(g, t1)
        if (settled.winner) commit(settled, 'ai')
      }
    }, 250)
    return () => clearInterval(id)
  }, [started, over, commit])

  // AI: one dig per tick.
  useEffect(() => {
    if (!started || over) return
    const step = () => {
      const g = gameRef.current
      if (!g || g.winner) return
      const at = pickRushDig(g.ai, diff, randInt)
      if (!at) return
      commit(digRushGame(g, 'ai', at, Date.now(), randInt), 'ai')
    }
    const first = setTimeout(step, 1200)
    const iv = setInterval(step, RUSH_AI_DELAY[diff])
    return () => { clearTimeout(first); clearInterval(iv) }
  }, [started, over, diff, commit])

  const remaining = game ? RUSH_TIME_CAP_MS - (now - game.startedAt) : RUSH_TIME_CAP_MS
  const secsLeft = Math.ceil(remaining / 1000)
  useEffect(() => {
    if (!started || over) return
    if (secsLeft >= 1 && secsLeft <= 10 && lastTickRef.current !== secsLeft) sfx('tick')
    lastTickRef.current = secsLeft
  }, [secsLeft, started, over])

  const toggleFlag = useCallback((r: number, c: number) => {
    const g = gameRef.current
    const k = `${r},${c}`
    if (!g || g.me.revealed.has(k)) return
    sfx('flag')
    setFlags((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  }, [])

  const dig = useCallback((r: number, c: number) => {
    const g = gameRef.current
    if (!g || g.winner) return
    const k = `${r},${c}`
    if (g.me.revealed.has(k) || flags.has(k)) return
    sfx('reveal')
    commit(digRushGame(g, 'player', { r, c }, Date.now(), randInt), 'player')
  }, [flags, commit])

  if (!game) return (
    <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
      <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
    </div>
  )

  if (game.winner) {
    const won = game.winner === 'player'
    return (
      <div className="flex flex-1 w-full flex-col items-center justify-center p-6">
        <div className="bg-brown-800 border border-brown-700 p-10 rounded-3xl shadow-xl max-w-sm w-full text-center flex flex-col items-center gap-8">
          <div className="text-7xl">{won ? '🎉' : '🤖'}</div>
          <h2 className="text-4xl font-extrabold text-pink-100">{won ? t('solo.youWin') : t('solo.aiWins')}</h2>
          <p className="text-pink-200/60 text-sm">{t('solo.rushScore', { me: game.me.clears, ai: game.ai.clears })}</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button onClick={onAgain}
              className="flex-1 px-6 py-3 bg-pink-400 text-brown-900 rounded-xl font-bold hover:bg-pink-500 border border-pink-500 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-none active:translate-y-1 transition-all uppercase">
              {t('solo.playAgain')}
            </button>
            <button onClick={onMenu}
              className="flex-1 px-6 py-3 bg-brown-700 text-pink-200 rounded-xl font-bold hover:bg-brown-600 border border-brown-600/50">
              {t('solo.menu')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const me: RushSide = game.me
  const ai: RushSide = game.ai
  const modeBtn = (active: boolean, flag: boolean) =>
    `px-4 py-2 rounded-lg font-bold text-sm transition-all ${
      active
        ? flag ? 'bg-rose-500 text-white shadow-md' : 'bg-brown-600 border border-brown-500/50 hover:bg-brown-500 text-white shadow-md'
        : 'text-pink-300/60 hover:text-brown-700 hover:bg-brown-700 border border-brown-600/50 shadow-inner'
    }`

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full flex flex-col items-center gap-4 sm:gap-6 pb-28 lg:pb-8">
        {/* AI strip */}
        <div className="w-full bg-brown-900/50 border border-brown-700/50 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 shadow-inner text-sm">
          <span className="font-bold text-pink-300/80 uppercase tracking-wider">{t('solo.aiLabel')}</span>
          <Hearts lives={livesOf(ai)} />
          <span className="font-mono text-pink-100">✅ {ai.clears}</span>
          <span className="font-mono text-pink-300/70" title={t('rush.opponentBoard')}>
            {safeRevealed(ai)}/{safeTotal(ai)} · {pct(ai.density)}
          </span>
        </div>

        {/* Player board */}
        <div className="w-full flex flex-col items-center gap-4 bg-brown-800 border border-brown-700 p-4 sm:p-8 rounded-3xl shadow-xl relative">
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.lives')}</span>
              <span className="text-2xl"><Hearts lives={livesOf(me)} /></span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.timeLeft')}</span>
              <span className={`text-2xl font-mono font-bold ${remaining < 30_000 ? 'text-rose-400' : 'text-pink-100'}`}>{fmtClock(remaining)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-pink-300/60 font-bold uppercase tracking-wider">{t('rush.cleared')}</span>
              <span className="text-2xl font-mono font-bold text-pink-400">{me.clears}</span>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-pink-100">{t('rush.yourBoard', { n: me.idx + 1 })}</h2>
            <p className="text-sm text-pink-300/60">
              {t('rush.mines', { count: me.mines.length })} · {t('rush.density')} {pct(me.density)}
            </p>
          </div>

          <div role="group" aria-label={`${t('solo.dig')} / ${t('solo.flag')}`} className="flex gap-2 bg-brown-900/50 p-1 rounded-xl shadow-inner border border-brown-700/50">
            <button onClick={() => setFlagMode(false)} aria-pressed={!flagMode} className={modeBtn(!flagMode, false)}>{t('solo.dig')}</button>
            <button onClick={() => setFlagMode(true)} aria-pressed={flagMode} className={modeBtn(flagMode, true)}>{t('solo.flag')}</button>
          </div>

          <div className="mine-grid shadow-lg" style={{ gridTemplateColumns: `repeat(${RUSH_BOARD_SIZE}, minmax(0, 1fr))` }}>
            {Array.from({ length: RUSH_BOARD_SIZE }).flatMap((_, r) =>
              Array.from({ length: RUSH_BOARD_SIZE }).map((__, c) => {
                const k = `${r},${c}`
                return (
                  <RushCell key={`${me.idx}-${k}`} r={r} c={c} cell={me.revealed.get(k)} flagged={flags.has(k)}
                    t={t} onPress={flagMode ? toggleFlag : dig} onFlag={toggleFlag} />
                )
              })
            )}
          </div>

          <div className="font-mono text-sm text-pink-300/70">{safeRevealed(me)} / {safeTotal(me)}</div>

          {toast && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-brown-900/95 border border-pink-400/60 text-pink-100 font-bold px-4 py-2 rounded-xl shadow-lg whitespace-nowrap pointer-events-none">
              {toast}
            </div>
          )}
        </div>

        <p className="text-xs text-pink-300/50 text-center max-w-md">{t('rush.howTo')}</p>
        <button onClick={onMenu} className="text-brown-400 hover:text-rose-600 font-medium transition-colors hover:underline text-sm">
          {t('solo.back')}
        </button>
      </div>
    </div>
  )
}
