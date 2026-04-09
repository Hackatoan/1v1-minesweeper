import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useGamePresence(gameId: string, userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  useEffect(() => {
    if (!gameId || !userId) return

    const room = supabase.channel(`presence-${gameId}`, {
      config: { presence: { key: userId } },
    })

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState()
        const currentUsers = Object.keys(state)
        setOnlineUsers(currentUsers)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => Array.from(new Set([...prev, key])))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== key))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(room)
    }
  }, [gameId, userId])

  return onlineUsers
}
