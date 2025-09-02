-- Fix match_players table schema to allow NULL user_id for guest players

-- Drop the existing primary key that includes user_id
ALTER TABLE match_players DROP CONSTRAINT match_players_pkey;

-- Allow NULL values in user_id
ALTER TABLE match_players ALTER COLUMN user_id DROP NOT NULL;

-- Add a surrogate primary key
ALTER TABLE match_players ADD COLUMN id SERIAL PRIMARY KEY;

-- Add a check constraint to ensure either user_id is set (for registered players)
-- or is_guest is true (for guest players)
ALTER TABLE match_players ADD CONSTRAINT check_player_reference
  CHECK (
    (user_id IS NOT NULL AND is_guest = false) OR
    (user_id IS NULL AND is_guest = true)
  );
