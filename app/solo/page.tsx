'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Phase = 'menu' | 'setup' | 'play' | 'result'
type Diff = 'easy' | 'medium' | 'hard'
interface Move { r: number; c: number; hitMine: boolean }

function calcAdj(r: number, c: number, mines: Set<string>, size: number) {
  let n = 0
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue
    const nr = r + dr, nc = c + dc
    if (nr >= 0 && nr < size && nc >= 0 && nc < size && mines.has(`${nr},${nc}`)) n++
  }
  return n
}

function floodReveal(startR: number, startC: number, mines: Set<string>, revealed: Set<string>, size: number): Move[] {
  const moves: Move[] = []
  const queue = [{ r: startR, c: startC }]
  const seen = new Set<string>([`${startR},${startC}`])
  while (queue.length) {
    const { r, c } = queue.shift()!
    moves.push({ r, c, hitMine: false })
    if (calcAdj(r, c, mines, size) === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr, nc = c + dc, key = `${nr},${nc}`
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !seen.has(key) && !revealed.has(key) && !mines.has(key)) {
          seen.add(key)
          queue.push({ r: nr, c: nc })
        }
      }
    }
  }
  return moves
}

const DIFF_DELAY: Record<Diff, number> = { easy: 2500, medium: 1400, hard: 700 }
const DIFF_LABEL: Record<Diff, string> = { easy: '🎯 Easy', medium: '🧠 Medium', hard: '⚡ Hard' }
const DIFF_DESC: Record<Diff, string> = {
  easy: 'AI plays slowly and randomly',
  medium: 'AI avoids obvious danger zones',
  hard: 'AI plays perfectly — can you beat it?'
}

export default function SoloPage() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [diff, setDiff] = useState<Diff>('medium')
  const [boardSize, setBoardSize] = useState(8)
  const maxMines = Math.floor(boardSize * boardSize * 0.15)
  const totalSafe = boardSize * boardSize - maxMines

  // Setup
  const [playerMines, setPlayerMines] = useState<Set<string>>(new Set())

  // Play
  const [aiMines, setAiMines] = useState<Set<string>>(new Set())
  const [playerMoves, setPlayerMoves] = useState<Map<string, Move>>(new Map())
  const [aiMoves, setAiMoves] = useState<Map<string, Move>>(new Map())
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [flagMode, setFlagMode] = useState(false)
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null)

  // Refs so AI interval always sees current state
  const aiMovesRef = useRef<Map<string, Move>>(new Map())
  const playerMinesRef = useRef<Set<string>>(new Set())
  const gameOverRef = useRef(false)

  useEffect(() => { aiMovesRef.current = aiMoves }, [aiMoves])
  useEffect(() => { playerMinesRef.current = playerMines }, [playerMines])

  // Win check
  useEffect(() => {
    if (phase !== 'play' || winner !== null) return
    const pHitMine = [...playerMoves.values()].some(m => m.hitMine)
    const aHitMine = [...aiMoves.values()].some(m => m.hitMine)
    const pSafe = [...playerMoves.values()].filter(m => !m.hitMine).length
    const aSafe = [...aiMoves.values()].filter(m => !m.hitMine).length
    if (pHitMine) { gameOverRef.current = true; setWinner('ai'); setPhase('result') }
    else if (aHitMine) { gameOverRef.current = true; setWinner('player'); setPhase('result') }
    else if (pSafe >= totalSafe) { gameOverRef.current = true; setWinner('player'); setPhase('result') }
    else if (aSafe >= totalSafe) { gameOverRef.current = true; setWinner('ai'); setPhase('result') }
  }, [playerMoves, aiMoves, phase, winner, totalSafe])

  function startPlay() {
    if (playerMines.size !== maxMines) return
    playerMinesRef.current = playerMines
    const mines = new Set<string>()
    while (mines.size < maxMines) {
      mines.add(`${Math.floor(Math.random() * boardSize)},${Math.floor(Math.random() * boardSize)}`)
    }
    setAiMines(mines)
    setPlayerMoves(new Map())
    setAiMoves(new Map())
    setFlags(new Set())
    setFlagMode(false)
    setWinner(null)
    gameOverRef.current = false
    aiMovesRef.current = new Map()
    setPhase('play')
  }

  // AI interval
  useEffect(() => {
    if (phase !== 'play') return
    gameOverRef.current = false

    const doAiMove = () => {
      if (gameOverRef.current) return
      const revealed = aiMovesRef.current
      const pMines = playerMinesRef.current

      const unrevealed: [number, number][] = []
      for (let r = 0; r < boardSize; r++) for (let c = 0; c < boardSize; c++) {
        if (!revealed.has(`${r},${c}`)) unrevealed.push([r, c])
      }
      if (!unrevealed.length) return

      let pick: [number, number]

      if (diff === 'hard') {
        const safe = unrevealed.filter(([r, c]) => !pMines.has(`${r},${c}`))
        if (!safe.length) return
        pick = safe[Math.floor(Math.random() * safe.length)]
      } else if (diff === 'medium') {
        // Avoid neighbors of previous mine hits
        const danger = new Set<string>()
        for (const [key, m] of revealed) {
          if (m.hitMine) {
            const [er, ec] = key.split(',').map(Number)
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              if (dr || dc) danger.add(`${er + dr},${ec + dc}`)
            }
          }
        }
        const safer = unrevealed.filter(([r, c]) => !danger.has(`${r},${c}`))
        pick = (safer.length > 0 ? safer : unrevealed)[Math.floor(Math.random() * (safer.length || unrevealed.length))]
      } else {
        pick = unrevealed[Math.floor(Math.random() * unrevealed.length)]
      }

      const [r, c] = pick
      const hitMine = pMines.has(`${r},${c}`)
      const currentRevealed = new Set(aiMovesRef.current.keys())
      const newMoves = hitMine
        ? [{ r, c, hitMine: true }]
        : floodReveal(r, c, pMines, currentRevealed, boardSize)

      setAiMoves(prev => {
        const next = new Map(prev)
        for (const m of newMoves) next.set(`${m.r},${m.c}`, m)
        return next
      })
    }

    const delay = DIFF_DELAY[diff]
    const t0 = setTimeout(doAiMove, 1200)
    const iv = setInterval(doAiMove, delay)
    return () => { clearTimeout(t0); clearInterval(iv); gameOverRef.current = true }
  }, [phase, diff, boardSize]) // playerMines accessed via ref

  const handlePlayerClick = (r: number, c: number) => {
    if (winner !== null || phase !== 'play') return
    const key = `${r},${c}`
    if (playerMoves.has(key)) return
    if (flagMode) {
      setFlags(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
      return
    }
    if (flags.has(key)) return
    const hitMine = aiMines.has(key)
    const currentRevealed = new Set(playerMoves.keys())
    const newMoves = hitMine ? [{ r, c, hitMine: true }] : floodReveal(r, c, aiMines, currentRevealed, boardSize)
    setPlayerMoves(prev => { const n = new Map(prev); newMoves.forEach(m => n.set(`${m.r},${m.c}`, m)); return n })
    setFlags(prev => { const n = new Set(prev); newMoves.forEach(m => n.delete(`${m.r},${m.c}`)); return n })
  }

  const numColor = (n: number) =>
    ['', 'text-blue-400', 'text-green-400', 'text-red-400', 'text-purple-400', 'text-yellow-400', 'text-cyan-400', 'text-pink-400', 'text-gray-400'][n] ?? ''

  const playerSafe = [...playerMoves.values()].filter(m => !m.hitMine).length
  const aiSafe = [...aiMoves.values()].filter(m => !m.hitMine).length

  // ── Render ──

  if (phase === 'menu') return (
    <main className="flex flex-1 w-full flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full flex flex-col gap-8 bg-brown-800 border border-brown-700 p-10 rounded-3xl shadow-xl">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-pink-100">1v1 Minesweeper</h1>
          <p className="text-pink-200/60">vs AI</p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-pink-200/80 font-semibold text-sm uppercase tracking-wide text-center">Difficulty</label>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Diff[]).map(d => (
              <button key={d} onClick={() => setDiff(d)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${diff === d
                  ? 'bg-pink-400 text-brown-900 shadow-[0_4px_0_theme(colors.pink.600)]'
                  : 'bg-brown-700 text-pink-200/60 border border-brown-600/50 hover:bg-brown-600'}`}>
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>
          <p className="text-center text-pink-300/40 text-sm">{DIFF_DESC[diff]}</p>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <label className="text-pink-200/80 font-medium text-sm">Board Size: {boardSize}×{boardSize}</label>
          <input type="range" min="5" max="15" value={boardSize}
            onChange={e => setBoardSize(parseInt(e.target.value))}
            className="w-full accent-pink-400" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => { setPlayerMines(new Set()); setPhase('setup') }}
            className="flex-1 px-8 py-4 bg-pink-400 text-brown-900 border border-pink-500 text-lg rounded-xl font-black uppercase tracking-wider hover:bg-pink-500 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-none active:translate-y-1 transition-all">
            Play vs AI
          </button>
          <Link href="/"
            className="flex-1 px-8 py-4 bg-brown-700 text-pink-200 border border-brown-600 text-lg rounded-xl font-black uppercase tracking-wider text-center hover:bg-brown-600 shadow-[0_4px_0_theme(colors.brown.900)] active:shadow-none active:translate-y-1 transition-all">
            vs Player
          </Link>
        </div>
      </div>
    </main>
  )

  if (phase === 'setup') return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full flex flex-col gap-8 bg-brown-800 border border-brown-700 p-8 sm:p-12 rounded-3xl shadow-xl">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-extrabold text-pink-100">Setup Your Board</h2>
          <p className="text-pink-200/80">Place your mines. The AI will need to navigate this minefield!</p>
          <div className="pt-4 flex justify-center">
            <div className="bg-brown-700 border border-brown-600/50 px-6 py-3 rounded-2xl font-mono font-bold text-xl flex items-center gap-3">
              <span>Mines:</span>
              <span className={`px-3 py-1 rounded-xl ${playerMines.size === maxMines ? 'bg-brown-900/50 text-pink-400' : 'bg-pink-200 text-pink-900'}`}>
                {playerMines.size} / {maxMines}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="mine-grid" style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
            {Array.from({ length: boardSize }).map((_, r) =>
              Array.from({ length: boardSize }).map((_, c) => {
                const isMine = playerMines.has(`${r},${c}`)
                return (
                  <button key={`${r}-${c}`}
                    onClick={() => setPlayerMines(prev => {
                      const n = new Set(prev)
                      n.has(`${r},${c}`) ? n.delete(`${r},${c}`) : n.size < maxMines && n.add(`${r},${c}`)
                      return n
                    })}
                    className={`mine-cell w-10 sm:w-12 text-lg ${isMine ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-brown-900/50 hover:bg-brown-200'}`}>
                    {isMine && '💣'}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 bg-brown-700 text-pink-200 rounded-xl font-bold hover:bg-brown-600 border border-brown-600/50">
            Back
          </button>
          <button onClick={startPlay} disabled={playerMines.size !== maxMines}
            className="px-10 py-4 bg-pink-400 text-brown-900 text-lg rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-500 border border-pink-600 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-none active:translate-y-1 transition-all uppercase tracking-wider">
            Ready For Battle!
          </button>
        </div>
      </div>
    </div>
  )

  if (phase === 'result') return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6">
      <div className="bg-brown-800 border border-brown-700 p-10 rounded-3xl shadow-xl max-w-sm w-full text-center flex flex-col items-center gap-8">
        <div className="text-7xl">{winner === 'player' ? '🎉' : '🤖'}</div>
        <h2 className="text-4xl font-extrabold text-pink-100">{winner === 'player' ? 'You Win!' : 'AI Wins!'}</h2>
        <p className="text-pink-200/60 text-sm">{diff === 'hard' && winner === 'player' ? 'Impressive — you beat the perfect AI!' : winner === 'player' ? 'You cleared the AI\'s board first!' : 'The AI was faster this time.'}</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button onClick={() => { setPlayerMines(new Set()); setPhase('setup') }}
            className="flex-1 px-6 py-3 bg-pink-400 text-brown-900 rounded-xl font-bold hover:bg-pink-500 border border-pink-500 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-none active:translate-y-1 transition-all uppercase">
            Play Again
          </button>
          <button onClick={() => setPhase('menu')}
            className="flex-1 px-6 py-3 bg-brown-700 text-pink-200 rounded-xl font-bold hover:bg-brown-600 border border-brown-600/50">
            Menu
          </button>
        </div>
      </div>
    </div>
  )

  // Play phase
  return (
    <div className="flex flex-1 w-full flex-col items-center p-4 pt-6 pb-24">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Attack board — player clicks on AI's board */}
        <div className="flex flex-col items-center gap-4 bg-brown-800 border border-brown-700 p-4 sm:p-8 rounded-3xl shadow-xl order-first lg:order-last">
          <div className="text-center w-full flex flex-col items-center">
            <h2 className="text-2xl font-extrabold text-pink-100">Attack Board</h2>
            <p className="text-pink-300/50 mt-1 text-sm">Find all safe cells. Avoid the AI&apos;s mines!</p>
            <div className="mt-4 flex gap-2 bg-brown-900/50 p-1 rounded-xl border border-brown-700/50">
              <button onClick={() => setFlagMode(false)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!flagMode ? 'bg-brown-600 text-white shadow-md' : 'text-pink-300/60 hover:bg-brown-700'}`}>
                ⛏️ Dig
              </button>
              <button onClick={() => setFlagMode(true)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${flagMode ? 'bg-rose-500 text-white shadow-md' : 'text-pink-300/60 hover:bg-brown-700'}`}>
                🚩 Flag
              </button>
            </div>
          </div>

          <div className="mine-grid shadow-lg" style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
            {Array.from({ length: boardSize }).map((_, r) =>
              Array.from({ length: boardSize }).map((_, c) => {
                const key = `${r},${c}`
                const move = playerMoves.get(key)
                const isRevealed = !!move
                const adj = isRevealed && !move.hitMine ? calcAdj(r, c, aiMines, boardSize) : 0
                const isFlagged = flags.has(key)
                return (
                  <button key={`atk-${key}`}
                    onClick={() => flagMode
                      ? setFlags(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
                      : handlePlayerClick(r, c)
                    }
                    onContextMenu={e => { e.preventDefault(); if (!isRevealed) setFlags(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }) }}
                    disabled={isRevealed}
                    className={`mine-cell w-8 h-8 sm:w-10 sm:h-10 text-sm font-black flex items-center justify-center
                      ${!isRevealed ? 'bg-brown-600 border border-brown-500/50 hover:bg-pink-300 cursor-pointer'
                        : move.hitMine ? 'bg-rose-500'
                        : 'bg-brown-700 border border-brown-600/50 shadow-inner'}`}>
                    {move?.hitMine && '💥'}
                    {!isRevealed && isFlagged && '🚩'}
                    {isRevealed && !move.hitMine && adj > 0 && <span className={numColor(adj)}>{adj}</span>}
                  </button>
                )
              })
            )}
          </div>

          <div className="bg-brown-900/50 px-6 py-3 rounded-2xl border border-brown-700/50 w-full text-center shadow-inner">
            <div className="text-xs text-pink-300/60 font-bold uppercase tracking-wider mb-1">Your Progress</div>
            <div className="text-xl font-mono font-bold text-pink-400">
              {playerSafe} <span className="text-brown-500">/</span> {totalSafe}
            </div>
          </div>
        </div>

        {/* Defense board — AI attacks player's board */}
        <div className="flex flex-col items-center gap-4 bg-brown-800/50 border border-brown-700/50 p-4 sm:p-6 rounded-3xl order-last lg:order-first">
          <div className="text-center">
            <h2 className="text-xl font-bold text-brown-500">Your Defenses</h2>
            <p className="text-xs text-pink-300/40 mt-1">Watch the AI&apos;s progress</p>
          </div>

          <div className="mine-grid" style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}>
            {Array.from({ length: boardSize }).map((_, r) =>
              Array.from({ length: boardSize }).map((_, c) => {
                const key = `${r},${c}`
                const isMine = playerMines.has(key)
                const aiMove = aiMoves.get(key)
                return (
                  <div key={`def-${key}`}
                    className={`mine-cell w-6 h-6 sm:w-8 sm:h-8 text-xs flex items-center justify-center
                      ${aiMove?.hitMine ? 'bg-rose-500'
                        : aiMove ? 'bg-brown-700 border border-brown-600/50 shadow-inner'
                        : isMine ? 'bg-brown-400' : 'bg-brown-300'}`}>
                    {isMine && !aiMove && '💣'}
                    {aiMove?.hitMine && '💥'}
                    {aiMove && !aiMove.hitMine && <span className="text-pink-400 font-bold text-[10px]">✓</span>}
                  </div>
                )
              })
            )}
          </div>

          <div className="bg-brown-900/50 px-4 py-2 rounded-xl border border-brown-700/50 w-full text-center">
            <div className="text-xs text-pink-300/40 font-bold uppercase tracking-wider">AI Progress</div>
            <div className="text-base font-mono font-bold text-brown-500">
              {aiSafe} <span className="text-brown-600">/</span> {totalSafe}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
