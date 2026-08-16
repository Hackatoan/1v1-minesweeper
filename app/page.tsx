'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPlayerId, getPlayerName, setPlayerName } from './lib/session'
import { createGame, updateGame, listWaitingGames, getLeaderboard } from './lib/api-client'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [boardSize, setBoardSize] = useState(10)
  const [queueSize, setQueueSize] = useState(0)
  const [name, setName] = useState('')
  const [leaders, setLeaders] = useState<any[]>([])
  const [lbLoaded, setLbLoaded] = useState(false)

  // Nickname + leaderboard
  useEffect(() => {
    setName(getPlayerName())
    getLeaderboard().then(d => { setLeaders(d.players || []); setLbLoaded(true) }).catch(() => setLbLoaded(true))
  }, [])

  // Fetch queue size
  const fetchQueueSize = async () => {
    const games = await listWaitingGames(10, 15000)
    setQueueSize(games.length || 0)
  }

  // Polling queue size
  useEffect(() => {
    fetchQueueSize()
    const interval = setInterval(fetchQueueSize, 5000)
    return () => clearInterval(interval)
  }, [])

  async function joinRandomGame() {
    setIsQueueing(true)
    try {
      const userId = getPlayerId()
      if (!userId) throw new Error('No player ID')

      // Try to find an existing waiting game
      const games = await listWaitingGames(10, 15000)
      const available = games.filter((g: any) => g.player1_id !== userId)

      if (available.length > 0) {
        // Join the first available game
        const gameId = available[0].id
        try {
          await updateGame(gameId, { player2_id: userId, status: 'setup' })
          router.push(`/game/${gameId}`)
          return
        } catch {
          // Failed to join (race condition), fall through to create
        }
      }

      // No game found or failed to join, create a new public game
      const data = await createGame({ board_size: 10, is_public: true })
      router.push(`/game/${data.id}`)

    } catch (error) {
      console.error('Error joining random game:', error)
      alert('Failed to join random game')
    } finally {
      setIsQueueing(false)
    }
  }

  async function handleCreateGame() {
    setIsLoading(true)
    try {
      const userId = getPlayerId()
      if (!userId) throw new Error('No player ID')

      const data = await createGame({ board_size: boardSize, is_public: false })
      router.push(`/game/${data.id}`)
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center p-6 sm:p-24  from-transparent to-transparent">
      <div className="z-10 max-w-2xl w-full items-center justify-center flex flex-col gap-8 bg-brown-800 border-brown-700 p-12 rounded-3xl shadow-xl border border-brown-700">
        <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold text-pink-100 tracking-tight">1v1 Minesweeper</h1>
            <p className="text-xl text-pink-200/80 max-w-md mx-auto leading-relaxed">
            Challenge a friend to a game of competitive Minesweeper.
            Set up your board, then race to clear theirs without hitting a mine!
            </p>
        </div>
        <div className="flex flex-col gap-2 items-center w-full max-w-xs">
          <label className="text-pink-200/80 font-medium">Nickname</label>
          <input
            type="text"
            value={name}
            maxLength={24}
            placeholder="Enter a nickname for the leaderboard"
            onChange={(e) => { setName(e.target.value); setPlayerName(e.target.value) }}
            className="w-full px-4 py-2 rounded-xl bg-brown-900/50 border border-brown-600/60 text-pink-100 placeholder:text-pink-300/40 text-center focus:outline-none focus:border-pink-400"
          />
        </div>
        <div className="flex flex-col gap-2 items-center w-full max-w-xs mb-4">
          <label className="text-pink-200/80 font-medium">Board Size: {boardSize}x{boardSize}</label>
          <input
            type="range"
            min="5"
            max="20"
            value={boardSize}
            onChange={(e) => setBoardSize(parseInt(e.target.value))}
            className="w-full accent-pink-400"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={handleCreateGame}
              disabled={isLoading || isQueueing}
              className="flex-1 px-8 py-4 bg-pink-400 text-brown-900 border border-pink-500 text-lg rounded-xl font-black uppercase tracking-wider hover:bg-pink-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-[0_0px_0_theme(colors.pink.600)] active:translate-y-[4px] transition-all"
            >
              {isLoading ? 'Creating...' : 'Create Private Game'}
            </button>
            <div className="relative flex-1 flex flex-col">
                <button
                onClick={joinRandomGame}
                disabled={isLoading || isQueueing}
                className="w-full px-8 py-4 bg-pink-500 text-brown-900 border border-pink-600 text-lg rounded-xl font-black uppercase tracking-wider hover:bg-pink-600 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_0_theme(colors.pink.700)] active:shadow-[0_0px_0_theme(colors.pink.700)] active:translate-y-[4px] transition-all"
                >
                {isQueueing ? 'Joining...' : 'Find Random Match'}
                </button>
                {queueSize > 0 && (
                  <div className="absolute -bottom-8 w-full text-center text-xs font-medium text-pink-300/60">
                    Players waiting in queue: {queueSize}
                  </div>
                )}
            </div>
        </div>
        <div className="pt-4 border-t border-brown-700/50 w-full flex justify-center">
            <a
              href="/solo"
              className="w-full sm:w-auto px-8 py-3 bg-brown-700 text-pink-300 border border-brown-600/60 text-base rounded-xl font-bold uppercase tracking-wider hover:bg-brown-600 hover:text-pink-200 transition-all text-center"
            >
              🤖 Play vs AI
            </a>
        </div>

        <div className="w-full pt-4 border-t border-brown-700/50">
            <h2 className="text-center text-pink-300 font-bold uppercase tracking-wider mb-3">🏆 Leaderboard</h2>
            <table className="w-full text-sm text-pink-100">
              <thead>
                <tr className="text-pink-300/60">
                  <th className="text-left font-medium py-1 px-2">#</th>
                  <th className="text-left font-medium py-1 px-2">Player</th>
                  <th className="text-right font-medium py-1 px-2">W</th>
                  <th className="text-right font-medium py-1 px-2">L</th>
                </tr>
              </thead>
              <tbody>
                {!lbLoaded && (
                  <tr><td colSpan={4} className="py-2 px-2 text-pink-300/50">Loading…</td></tr>
                )}
                {lbLoaded && leaders.length === 0 && (
                  <tr><td colSpan={4} className="py-2 px-2 text-pink-300/50">No games played yet — be the first!</td></tr>
                )}
                {leaders.map((p, i) => (
                  <tr key={p.player} className={p.player === name ? 'text-pink-400 font-bold' : ''}>
                    <td className="py-1 px-2">{i + 1}</td>
                    <td className="py-1 px-2">{p.player}</td>
                    <td className="py-1 px-2 text-right">{p.wins}</td>
                    <td className="py-1 px-2 text-right">{p.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </main>
  )
}
