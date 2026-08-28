'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPlayerId, getPlayerName, setPlayerName } from '../lib/session'
import { createGame, updateGame, listWaitingGames, getLeaderboard } from '../lib/api-client'
import { LanguageSwitcher } from './LanguageSwitcher'

type LandingDict = Record<string, string>

export function LandingClient({ dict, locale }: { dict: LandingDict; locale: string; base?: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [boardSize, setBoardSize] = useState(10)
  const [queueSize, setQueueSize] = useState(0)
  const [name, setName] = useState('')
  const [leaders, setLeaders] = useState<any[]>([])
  const [lbLoaded, setLbLoaded] = useState(false)

  // Remember the visitor's locale so the locale-less solo + game-room pages
  // (which resolve language per-player from hk_lang) show their language. Also
  // set <html lang> here: the shared root layout renders lang="en" for SSR, so
  // correct it client-side on the localized routes for a11y/JS-aware crawlers.
  useEffect(() => {
    try { localStorage.setItem('hk_lang', locale) } catch { /* ignore */ }
    try { document.documentElement.lang = locale } catch { /* ignore */ }
  }, [locale])

  useEffect(() => {
    setName(getPlayerName())
    getLeaderboard().then(d => { setLeaders(d.players || []); setLbLoaded(true) }).catch(() => setLbLoaded(true))
  }, [])

  const fetchQueueSize = async () => {
    const games = await listWaitingGames(10, 15000)
    setQueueSize(games.length || 0)
  }

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
      const games = await listWaitingGames(10, 15000)
      const available = games.filter((g: any) => g.player1_id !== userId)
      if (available.length > 0) {
        const gameId = available[0].id
        try {
          await updateGame(gameId, { player2_id: userId, status: 'setup' })
          router.push(`/game/${gameId}`)
          return
        } catch {
          // race condition — fall through to create
        }
      }
      const data = await createGame({ board_size: 10, is_public: true })
      router.push(`/game/${data.id}`)
    } catch (error) {
      console.error('Error joining random game:', error)
      alert(dict.failRandom)
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
      alert(dict.failCreate)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center p-6 sm:p-24  from-transparent to-transparent">
      <LanguageSwitcher current={locale} />
      <div className="z-10 max-w-2xl w-full items-center justify-center flex flex-col gap-8 bg-brown-800 border-brown-700 p-12 rounded-3xl shadow-xl border border-brown-700">
        <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold text-pink-100 tracking-tight">1v1 Minesweeper</h1>
            <p className="text-xl text-pink-200/80 max-w-md mx-auto leading-relaxed">{dict.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 items-center w-full max-w-xs">
          <label className="text-pink-200/80 font-medium">{dict.nickname}</label>
          <input
            type="text"
            value={name}
            maxLength={24}
            placeholder={dict.nicknamePlaceholder}
            onChange={(e) => { setName(e.target.value); setPlayerName(e.target.value) }}
            className="w-full px-4 py-2 rounded-xl bg-brown-900/50 border border-brown-600/60 text-pink-100 placeholder:text-pink-300/40 text-center focus:outline-none focus:border-pink-400"
          />
        </div>
        <div className="flex flex-col gap-2 items-center w-full max-w-xs mb-4">
          <label className="text-pink-200/80 font-medium">{dict.boardSize}: {boardSize}x{boardSize}</label>
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
              {isLoading ? dict.creating : dict.createPrivate}
            </button>
            <div className="relative flex-1 flex flex-col">
                <button
                onClick={joinRandomGame}
                disabled={isLoading || isQueueing}
                className="w-full px-8 py-4 bg-pink-500 text-brown-900 border border-pink-600 text-lg rounded-xl font-black uppercase tracking-wider hover:bg-pink-600 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_0_theme(colors.pink.700)] active:shadow-[0_0px_0_theme(colors.pink.700)] active:translate-y-[4px] transition-all"
                >
                {isQueueing ? dict.joining : dict.findMatch}
                </button>
                {queueSize > 0 && (
                  <div className="absolute -bottom-8 w-full text-center text-xs font-medium text-pink-300/60">
                    {dict.queueWaiting}: {queueSize}
                  </div>
                )}
            </div>
        </div>
        <div className="pt-4 border-t border-brown-700/50 w-full flex justify-center">
            <a
              href="/solo"
              className="w-full sm:w-auto px-8 py-3 bg-brown-700 text-pink-300 border border-brown-600/60 text-base rounded-xl font-bold uppercase tracking-wider hover:bg-brown-600 hover:text-pink-200 transition-all text-center"
            >
              {dict.playVsAi}
            </a>
        </div>

        <div className="w-full pt-4 border-t border-brown-700/50">
            <h2 className="text-center text-pink-300 font-bold uppercase tracking-wider mb-3">{dict.leaderboard}</h2>
            <table className="w-full text-sm text-pink-100">
              <thead>
                <tr className="text-pink-300/60">
                  <th className="text-left font-medium py-1 px-2">#</th>
                  <th className="text-left font-medium py-1 px-2">{dict.colPlayer}</th>
                  <th className="text-right font-medium py-1 px-2">W</th>
                  <th className="text-right font-medium py-1 px-2">L</th>
                </tr>
              </thead>
              <tbody>
                {!lbLoaded && (
                  <tr><td colSpan={4} className="py-2 px-2 text-pink-300/50">{dict.loading}</td></tr>
                )}
                {lbLoaded && leaders.length === 0 && (
                  <tr><td colSpan={4} className="py-2 px-2 text-pink-300/50">{dict.noGames}</td></tr>
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
