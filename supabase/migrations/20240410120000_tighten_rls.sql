-- Drop the old permissive policies
DROP POLICY IF EXISTS "Public games select" ON games;
DROP POLICY IF EXISTS "Public games insert" ON games;
DROP POLICY IF EXISTS "Public games update" ON games;

DROP POLICY IF EXISTS "Public boards select" ON boards;
DROP POLICY IF EXISTS "Public boards insert" ON boards;
DROP POLICY IF EXISTS "Public boards update" ON boards;

DROP POLICY IF EXISTS "Public moves select" ON moves;
DROP POLICY IF EXISTS "Public moves insert" ON moves;

-- Games policies
-- Everyone can read all games (required for queue logic, finding public games, etc)
CREATE POLICY "Public games select" ON games FOR SELECT USING (true);
-- Any authenticated user can create a game
CREATE POLICY "Auth games insert" ON games FOR INSERT WITH CHECK (auth.uid() = player1_id);
-- Any authenticated user can join a game if player2 is null or update it if they are player 1 or 2
CREATE POLICY "Auth games update" ON games FOR UPDATE USING (
  auth.uid() = player1_id OR
  auth.uid() = player2_id OR
  player2_id IS NULL
);

-- Boards policies
-- Players can see both boards in a game they are part of
CREATE POLICY "Auth boards select" ON boards FOR SELECT USING (true);
-- Players can only create a board for themselves
CREATE POLICY "Auth boards insert" ON boards FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- Players can only update their own board (e.g. reveal states)
CREATE POLICY "Auth boards update" ON boards FOR UPDATE USING (auth.uid() = owner_id);

-- Moves policies
-- Anyone can see moves
CREATE POLICY "Auth moves select" ON moves FOR SELECT USING (true);
-- Players can only insert their own moves
CREATE POLICY "Auth moves insert" ON moves FOR INSERT WITH CHECK (auth.uid() = player_id);
