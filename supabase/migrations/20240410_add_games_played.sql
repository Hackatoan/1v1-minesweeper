CREATE TABLE IF NOT EXISTS global_stats (
    id INT PRIMARY KEY DEFAULT 1,
    games_played INT DEFAULT 0 NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO global_stats (id, games_played) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- Allow read access
ALTER TABLE global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public global_stats select" ON global_stats FOR SELECT USING (true);

-- Create a function to increment the counter
CREATE OR REPLACE FUNCTION increment_games_played()
RETURNS void AS $$
BEGIN
  UPDATE global_stats SET games_played = games_played + 1 WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
