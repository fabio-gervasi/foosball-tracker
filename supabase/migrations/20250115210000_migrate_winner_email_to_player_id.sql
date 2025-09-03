-- Migration: Fix winner_email to use player IDs instead of emails/guest names
-- This resolves the winners & stats display issue where rankings and match history show no winners

-- First, let's add a new column for the proper winner_player_id
ALTER TABLE matches ADD COLUMN winner_player_id UUID REFERENCES users(id);

-- Migrate existing winner_email values to winner_player_id where possible
-- For registered players, convert email to user_id
UPDATE matches
SET winner_player_id = (
  SELECT u.id
  FROM users u
  WHERE u.email = matches.winner_email
  AND matches.winner_email IS NOT NULL
  AND matches.winner_email LIKE '%@%'
)
WHERE winner_email LIKE '%@%'
AND winner_player_id IS NULL;

-- For matches with match_results but missing winner_email, determine winner from results
UPDATE matches
SET winner_player_id = (
  SELECT
    CASE
      WHEN mp.user_id IS NOT NULL THEN mp.user_id
      ELSE NULL  -- Keep as NULL for guest players, we'll handle this in the app layer
    END
  FROM match_players mp
  WHERE mp.match_id = matches.id
  AND mp.team = (
    SELECT mr.winning_team
    FROM match_results mr
    WHERE mr.match_id = matches.id
    GROUP BY mr.winning_team
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  ORDER BY
    CASE WHEN mp.user_id IS NOT NULL THEN 0 ELSE 1 END, -- Prefer registered users
    mp.position -- Then by position (1 before 2)
  LIMIT 1
)
WHERE winner_player_id IS NULL
AND EXISTS (
  SELECT 1 FROM match_results
  WHERE match_id = matches.id
);

-- Keep winner_email for backward compatibility and guest names
-- winner_player_id will be used for registered players
-- winner_email will still contain guest names or emails where player_id is NULL

-- Add index for better performance
CREATE INDEX idx_matches_winner_player_id ON matches(winner_player_id);
