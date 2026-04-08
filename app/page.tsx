'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession } from './lib/supabase'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

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
          player1_id: userId,
          status: 'waiting'
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="z-10 max-w-2xl w-full items-center justify-center flex flex-col gap-8 bg-white p-12 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight">1v1 Minesweeper</h1>
            <p className="text-xl text-slate-600 max-w-md mx-auto leading-relaxed">
            Challenge a friend to a game of competitive Minesweeper.
            Set up your board, then race to clear theirs without hitting a mine!
            </p>
        </div>
        <button
          onClick={createGame}
          disabled={isLoading}
          className="px-8 py-4 bg-indigo-600 text-white text-lg rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-1"
        >
          {isLoading ? (
             <span className="flex items-center gap-2">
                 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Creating...
             </span>
          ) : 'Create New Game'}
        </button>
      </div>
    </main>
  )
}
