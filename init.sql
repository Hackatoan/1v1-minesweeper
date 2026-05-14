CREATE TYPE game_status AS ENUM ('waiting', 'setup', 'playing', 'finished');

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  status game_status DEFAULT 'waiting' NOT NULL,
  player1_id TEXT NOT NULL,
  player2_id TEXT,
  winner_id TEXT,
  rematch_game_id TEXT REFERENCES games(id),
  board_size INTEGER DEFAULT 10 NOT NULL,
  is_public BOOLEAN DEFAULT false NOT NULL,
  last_ping TIMESTAMPTZ DEFAULT now() NOT NULL,
  player_pings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE boards (
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  mine_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reveal_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (game_id, owner_id)
);

CREATE TABLE moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  cell JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  hit_mine BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE global_stats (
  id INT PRIMARY KEY DEFAULT 1,
  games_played INT DEFAULT 0 NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO global_stats (id, games_played) VALUES (1, 0);

CREATE OR REPLACE FUNCTION increment_games_played()
RETURNS void AS $$
BEGIN
  UPDATE global_stats SET games_played = games_played + 1 WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_last_ping ON games(last_ping);
CREATE INDEX idx_moves_game_id ON moves(game_id);
