'use client';
import { useEffect, useState } from 'react';
import { getGamesPlayed } from '../lib/api-client';

export function GamesPlayed() {
  const [gamesPlayed, setGamesPlayed] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getGamesPlayed()
      setGamesPlayed(count)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 10000)
    return () => clearInterval(interval)
  }, []);

  if (gamesPlayed === null) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-brown-900 text-pink-300 px-4 py-2 rounded-xl font-bold shadow-lg border border-brown-700 text-sm flex flex-col items-end pointer-events-none">
      <span className="text-[10px] uppercase tracking-wider text-brown-400">Total Games</span>
      <span className="text-xl tracking-tight">{gamesPlayed.toLocaleString()}</span>
    </div>
  );
}
