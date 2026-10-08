-- Rush mode: server-generated small boards, 3 lives. Mirrors the idempotent
-- boot-time migration in app/lib/db.ts.
ALTER TABLE games ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE games ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS board_idx INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rush_boards (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  idx INT NOT NULL,
  density REAL NOT NULL,
  mine_positions JSONB NOT NULL,
  PRIMARY KEY (game_id, player_id, idx)
);
