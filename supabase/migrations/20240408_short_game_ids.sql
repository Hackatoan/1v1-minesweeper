-- Change game ID from UUID to TEXT to allow short IDs
-- Drop dependencies first
ALTER TABLE boards DROP CONSTRAINT boards_game_id_fkey;
ALTER TABLE moves DROP CONSTRAINT moves_game_id_fkey;
ALTER TABLE games DROP CONSTRAINT games_rematch_game_id_fkey;

-- Change column types
ALTER TABLE games ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE games ALTER COLUMN rematch_game_id TYPE TEXT USING rematch_game_id::text;
ALTER TABLE boards ALTER COLUMN game_id TYPE TEXT USING game_id::text;
ALTER TABLE moves ALTER COLUMN game_id TYPE TEXT USING game_id::text;

-- Re-add constraints
ALTER TABLE boards ADD CONSTRAINT boards_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE moves ADD CONSTRAINT moves_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE games ADD CONSTRAINT games_rematch_game_id_fkey FOREIGN KEY (rematch_game_id) REFERENCES games(id);

-- Remove gen_random_uuid() default
ALTER TABLE games ALTER COLUMN id DROP DEFAULT;
