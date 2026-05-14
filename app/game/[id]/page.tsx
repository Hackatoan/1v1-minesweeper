'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getPlayerId } from '../../lib/session'
import { getGame, updateGame, pingGame } from '../../lib/api-client'
import { copyToClipboard } from '../../lib/clipboard'

export default function GameLobby() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string
  const [game, setGame] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const uid = getPlayerId()
        if (!uid) throw new Error('No player ID')
        setUserId(uid)

        // Fetch initial game state
        const gameData = await getGame(gameId)
        if (!gameData) throw new Error('Game not found')
        setGame(gameData)

        // If I am not player 1, and there is no player 2, join as player 2
        if (gameData.player1_id !== uid && !gameData.player2_id) {
          try {
            const updatedGame = await updateGame(gameId, { player2_id: uid, status: 'setup' })
            setGame(updatedGame)
          } catch {
            console.error('Failed to join or game is already full.')
            alert('Failed to join or game is already full.')
            router.push('/')
            return
          }
        } else if (gameData.player1_id !== uid && gameData.player2_id !== uid) {
          // I am a 3rd person
          alert('Game is already full.')
          router.push('/')
          return
        }

      } catch (e) {
        console.error('Error in lobby:', e)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [gameId, router])

  // Polling game state
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(async () => {
      const g = await getGame(gameId)
      if (g) setGame(g)
    }, 1500)
    return () => clearInterval(interval)
  }, [userId, gameId])

  // Heartbeat for host in waiting room
  useEffect(() => {
    if (!game || game.status !== 'waiting') return
    const interval = setInterval(() => pingGame(gameId), 5000)
    pingGame(gameId)
    return () => clearInterval(interval)
  }, [game?.status, gameId])

  // Redirect when status changes
  useEffect(() => {
    if (game?.status === 'setup') {
      router.push(`/game/${gameId}/setup`)
    } else if (game?.status === 'playing') {
      router.push(`/game/${gameId}/play`)
    } else if (game?.status === 'finished') {
      router.push(`/game/${gameId}/result`)
    }
  }, [game?.status, gameId, router])

  if (loading) return (
      <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
  )

  if (!game) return <div className="p-8 text-center text-pink-200/80">Game not found</div>

  const isPlayer1 = game.player1_id === userId
  const inviteLink = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
      copyToClipboard(inviteLink, setCopied)
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 from-transparent to-transparent">
      <div className="bg-brown-800 border-brown-700 p-10 rounded-3xl shadow-xl max-w-md w-full flex flex-col gap-8 text-center border">
        <h2 className="text-3xl font-extrabold text-pink-100">Game Lobby</h2>

        {isPlayer1 && !game.player2_id ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500"></span>
                </span>
            </div>
            <p className="text-pink-200/80 font-medium">Waiting for an opponent to join...</p>
            <div className="bg-brown-900/50 p-4 rounded-xl break-all text-sm font-mono text-pink-300/80 border border-brown-700/50 shadow-inner">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className={`px-6 py-3 rounded-xl font-bold transition-all shadow-md transform hover:-translate-y-0.5 ${
                  copied
                  ? 'bg-pink-500 text-white shadow-[0_4px_0_theme(colors.pink.700)] active:shadow-[0_0px_0_theme(colors.pink.700)] active:translate-y-[4px]'
                  : 'bg-pink-400 text-pink-900 hover:bg-pink-500 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-[0_0px_0_theme(colors.pink.600)] active:translate-y-[4px]'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center">
            <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
            <p className="text-pink-200/80 font-medium text-lg">Starting game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
