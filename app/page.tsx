'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession } from './lib/supabase'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [boardSize, setBoardSize] = useState(10)
  const [queueSize, setQueueSize] = useState(0)

  // Fetch queue size
  const fetchQueueSize = async () => {
      const { count } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'waiting')
          .eq('is_public', true)
      setQueueSize(count || 0)
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
          const session = await getSession()
          const userId = session?.user.id
          if (!userId) throw new Error('No user session')

          // Try to find an existing waiting game
          const { data: games } = await supabase
              .from('games')
              .select('*')
              .eq('status', 'waiting')
              .eq('is_public', true)
              .neq('player1_id', userId)
              .order('created_at', { ascending: true })
              .limit(1)

          if (games && games.length > 0) {
              // Join the game
              const gameId = games[0].id
              const { error } = await supabase
                  .from('games')
                  .update({ player2_id: userId, status: 'setup' })
                  .eq('id', gameId)
                  .is('player2_id', null)

              if (!error) {
                  router.push(`/game/${gameId}`)
                  return
              }
          }

          // No game found or failed to join, create a new public game
          const { data, error } = await supabase
              .from('games')
              .insert({
                  id: Math.random().toString(36).substring(2, 8).toUpperCase(),
                  player1_id: userId,
                  status: 'waiting',
                  board_size: boardSize,
                  is_public: true
              })
              .select()
              .single()

          if (error) throw error
          router.push(`/game/${data.id}`)

      } catch (error) {
          console.error('Error joining random game:', error)
          alert('Failed to join random game')
      } finally {
          setIsQueueing(false)
      }
  }

  async function createGame() {
    setIsLoading(true)
    try {
      const session = await getSession()
      const userId = session?.user.id

      if (!userId) {
          throw new Error('No user session')
      }

      const { data, error } = await supabase
        .from('games')
        .insert({
          id: Math.random().toString(36).substring(2, 8).toUpperCase(),
          player1_id: userId,
          status: 'waiting',
          board_size: boardSize,
          is_public: false
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/game/${data.id}`)
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center p-6 sm:p-24 bg-gradient-to-br from-brown-50 to-brown-200">
      <div className="z-10 max-w-2xl w-full items-center justify-center flex flex-col gap-8 bg-white p-12 rounded-3xl shadow-xl border border-brown-100">
        <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold text-brown-800 tracking-tight">1v1 Minesweeper</h1>
            <p className="text-xl text-brown-600 max-w-md mx-auto leading-relaxed">
            Challenge a friend to a game of competitive Minesweeper.
            Set up your board, then race to clear theirs without hitting a mine!
            </p>
        </div>
        <div className="flex flex-col gap-2 items-center w-full max-w-xs mb-4">
          <label className="text-brown-600 font-medium">Board Size: {boardSize}x{boardSize}</label>
          <input
            type="range"
            min="5"
            max="20"
            value={boardSize}
            onChange={(e) => setBoardSize(parseInt(e.target.value))}
            className="w-full accent-amber-600"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={createGame}
              disabled={isLoading || isQueueing}
              className="flex-1 px-8 py-4 bg-amber-600 text-white text-lg rounded-xl font-bold hover:bg-amber-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-amber-500/30 transition-all transform hover:-translate-y-1"
            >
              {isLoading ? 'Creating...' : 'Create Private Game'}
            </button>
            <div className="relative flex-1 flex flex-col">
                <button
                onClick={joinRandomGame}
                disabled={isLoading || isQueueing}
                className="w-full px-8 py-4 bg-orange-600 text-white text-lg rounded-xl font-bold hover:bg-orange-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/30 transition-all transform hover:-translate-y-1"
                >
                {isQueueing ? 'Joining...' : 'Find Random Match'}
                </button>
                <div className="absolute -bottom-8 w-full text-center text-xs font-medium text-brown-500">
                    Players waiting in queue: {queueSize}
                </div>
            </div>
        </div>
      </div>
    </main>
  )
}
