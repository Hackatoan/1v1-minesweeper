ALTER TABLE games ADD COLUMN rematch_game_id UUID REFERENCES games(id);
