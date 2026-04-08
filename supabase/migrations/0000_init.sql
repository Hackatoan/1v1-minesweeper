-- Create Enum for Game Status
CREATE TYPE game_status AS ENUM ('waiting', 'setup', 'playing', 'finished');

-- Create games table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status game_status DEFAULT 'waiting' NOT NULL,
  player1_id UUID NOT NULL,
  player2_id UUID,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create boards table
CREATE TABLE boards (
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  mine_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reveal_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (game_id, owner_id)
);

-- Create moves table
CREATE TABLE moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  cell JSONB NOT NULL, -- e.g., {"r": 5, "c": 3}
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  hit_mine BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Simple policies (since we'll use anon auth, we allow authenticated anon users to access rows)
-- In a real app we'd restrict further, but for this MVP:
CREATE POLICY "Public games select" ON games FOR SELECT USING (true);
CREATE POLICY "Public games insert" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Public games update" ON games FOR UPDATE USING (true);

CREATE POLICY "Public boards select" ON boards FOR SELECT USING (true);
CREATE POLICY "Public boards insert" ON boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Public boards update" ON boards FOR UPDATE USING (true);

CREATE POLICY "Public moves select" ON moves FOR SELECT USING (true);
CREATE POLICY "Public moves insert" ON moves FOR INSERT WITH CHECK (true);

-- Enable realtime for the tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE games, boards, moves;
