# 1v1 Minesweeper

![1v1 Minesweeper](https://1v1sw.hackatoa.com/og-image.svg)

Competitive multiplayer minesweeper. Both players secretly place mines on each other's boards, then race to clear the minefield without detonating.

**▶ Play at [1v1sw.hackatoa.com](https://1v1sw.hackatoa.com)**

## Features

- **vs AI** — three difficulty levels (Easy, Medium, Hard)
  - Easy: slow and random
  - Medium: avoids neighbors of previous explosions  
  - Hard: perfect solver — always picks safe cells
- **Real-time multiplayer** — private invite link or random matchmaking
- Adjustable board size (5×5 to 20×20)
- Flood-fill reveal on zero-mine-adjacent cells
- Flag mode (right-click or toggle)

## How to play

1. Both players place mines on their own board
2. Once both are ready, the race begins
3. Click cells on your opponent's board to reveal safe zones
4. **First to reveal all safe cells wins — hit a mine and you lose!**

## Tech stack

- Next.js 15 (App Router)
- Supabase (PostgreSQL for game state)
- Tailwind CSS
- Docker + GitHub Actions CI/CD

## Self-hosting

```bash
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
docker run -p 3000:3000 ghcr.io/hackatoan/1v1-minesweeper:latest
```

---

Part of [Hackatoa Games](https://games.hackatoa.com) · [Buy me a coffee](https://buymeacoffee.com/hackatoa)
