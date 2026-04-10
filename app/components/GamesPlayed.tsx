'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function GamesPlayed() {
  const [gamesPlayed, setGamesPlayed] = useState<number | null>(null);

  useEffect(() => {
    async function fetchGamesPlayed() {
      const { data, error } = await supabase
        .from('global_stats')
        .select('games_played')
        .eq('id', 1)
        .single();

      if (data) {
        setGamesPlayed(data.games_played);
      }
    }

    fetchGamesPlayed();

    const channel = supabase
      .channel('global_stats_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'global_stats',
          filter: 'id=eq.1'
        },
        (payload) => {
          setGamesPlayed(payload.new.games_played);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (gamesPlayed === null) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-brown-900 text-pink-300 px-4 py-2 rounded-xl font-bold shadow-lg border border-brown-700 text-sm flex flex-col items-end pointer-events-none">
      <span className="text-[10px] uppercase tracking-wider text-brown-400">Total Games</span>
      <span className="text-xl tracking-tight">{gamesPlayed.toLocaleString()}</span>
    </div>
  );
}
