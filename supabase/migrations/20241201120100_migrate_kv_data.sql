-- Migration: Migrate data from KV store to relational tables

-- Migrate users from KV store to relational table
-- Handle duplicates by selecting the most recent record for each email
INSERT INTO users (id, email, username, name, avatar, is_admin, singles_elo, doubles_elo, singles_wins, singles_losses, doubles_wins, doubles_losses, current_group_code, created_at, updated_at, deleted_at, is_deleted)
SELECT DISTINCT ON ((user_data.value->>'email'))
  (user_data.value->>'id')::uuid,
  user_data.value->>'email',
  user_data.value->>'username',
  user_data.value->>'name',
  user_data.value->>'avatar',
  COALESCE((user_data.value->>'isAdmin')::boolean, false),
  COALESCE((user_data.value->>'singlesElo')::integer, (user_data.value->>'elo')::integer, 1200),
  COALESCE((user_data.value->>'doublesElo')::integer, 1200),
  COALESCE((user_data.value->>'singlesWins')::integer, (user_data.value->>'wins')::integer, 0),
  COALESCE((user_data.value->>'singlesLosses')::integer, (user_data.value->>'losses')::integer, 0),
  COALESCE((user_data.value->>'doublesWins')::integer, 0),
  COALESCE((user_data.value->>'doublesLosses')::integer, 0),
  user_data.value->>'currentGroup',
  COALESCE((user_data.value->>'createdAt')::timestamp, NOW()),
  COALESCE((user_data.value->>'updatedAt')::timestamp, NOW()),
  CASE WHEN (user_data.value->>'deletedAt') IS NOT NULL THEN (user_data.value->>'deletedAt')::timestamp END,
  COALESCE((user_data.value->>'isDeleted')::boolean, false)
FROM kv_store_171cbf6f user_data
WHERE user_data.key LIKE 'user:%'
  AND user_data.key NOT LIKE 'user:username:%'
  AND user_data.key NOT LIKE 'user:email:%'
ORDER BY (user_data.value->>'email'), COALESCE((user_data.value->>'updatedAt')::timestamp, (user_data.value->>'createdAt')::timestamp, NOW()) DESC
ON CONFLICT (email) DO NOTHING;

-- Migrate groups from KV store to relational table
INSERT INTO groups (code, name, created_by, created_at, updated_at)
SELECT
  g.value->>'code',
  g.value->>'name',
  CASE
    WHEN (g.value->>'createdBy') IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = (g.value->>'createdBy')::uuid)
    THEN (g.value->>'createdBy')::uuid
    ELSE NULL
  END,
  COALESCE((g.value->>'createdAt')::timestamp, NOW()),
  COALESCE((g.value->>'updatedAt')::timestamp, NOW())
FROM kv_store_171cbf6f g
WHERE g.key LIKE 'group:%'
  AND g.key NOT LIKE 'group:name:%'
  AND g.key NOT LIKE 'group:%:user:%'
ON CONFLICT (code) DO NOTHING;

-- Migrate user-group relationships
INSERT INTO user_groups (user_id, group_code, joined_at)
SELECT
  u.id,
  u.current_group_code,
  NOW()
FROM users u
WHERE u.current_group_code IS NOT NULL
ON CONFLICT (user_id, group_code) DO NOTHING;

-- Migrate matches from KV store to relational table
INSERT INTO matches (id, date, group_code, match_type, series_type, recorded_by, winner_email, winner_is_guest, created_at)
SELECT
  m.value->>'id',
  COALESCE((m.value->>'date')::date, (m.value->>'createdAt')::date, CURRENT_DATE),
  CASE
    WHEN m.key LIKE 'match:%:%' THEN split_part(m.key, ':', 2)
    ELSE m.value->>'groupCode'
  END,
  COALESCE(m.value->>'matchType', '1v1'),
  COALESCE(m.value->>'seriesType', 'bo1'),
  CASE
    WHEN (m.value->>'recordedBy') IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->>'recordedBy')::uuid)
    THEN (m.value->>'recordedBy')::uuid
    ELSE NULL
  END,
  m.value->>'winnerEmail',
  COALESCE((m.value->>'winnerIsGuest')::boolean, false),
  COALESCE((m.value->>'createdAt')::timestamp, NOW())
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
ON CONFLICT (id) DO NOTHING;

-- Migrate match players (1v1 matches)
INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->>'player1') IS NOT NULL
         AND (m.value->'player1'->>'id') IS NOT NULL
         AND (m.value->'player1'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'player1'->>'id')::uuid)
    THEN (m.value->'player1'->>'id')::uuid
    ELSE NULL
  END,
  'team1',
  1,
  COALESCE((m.value->'player1'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'player1'->>'isGuest')::boolean = true THEN m.value->'player1'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND (m.value->>'matchType' = '1v1' OR m.value->>'matchType' IS NULL)
  AND m.value->>'player1' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->>'player2') IS NOT NULL
         AND (m.value->'player2'->>'id') IS NOT NULL
         AND (m.value->'player2'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'player2'->>'id')::uuid)
    THEN (m.value->'player2'->>'id')::uuid
    ELSE NULL
  END,
  'team2',
  1,
  COALESCE((m.value->'player2'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'player2'->>'isGuest')::boolean = true THEN m.value->'player2'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND (m.value->>'matchType' = '1v1' OR m.value->>'matchType' IS NULL)
  AND m.value->>'player2' IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate match players (2v2 matches)
INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->'team1'->>'player1') IS NOT NULL
         AND (m.value->'team1'->'player1'->>'id') IS NOT NULL
         AND (m.value->'team1'->'player1'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'team1'->'player1'->>'id')::uuid)
    THEN (m.value->'team1'->'player1'->>'id')::uuid
    ELSE NULL
  END,
  'team1',
  1,
  COALESCE((m.value->'team1'->'player1'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'team1'->'player1'->>'isGuest')::boolean = true THEN m.value->'team1'->'player1'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND m.value->>'matchType' = '2v2'
  AND m.value->'team1'->>'player1' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->'team1'->>'player2') IS NOT NULL
         AND (m.value->'team1'->'player2'->>'id') IS NOT NULL
         AND (m.value->'team1'->'player2'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'team1'->'player2'->>'id')::uuid)
    THEN (m.value->'team1'->'player2'->>'id')::uuid
    ELSE NULL
  END,
  'team1',
  2,
  COALESCE((m.value->'team1'->'player2'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'team1'->'player2'->>'isGuest')::boolean = true THEN m.value->'team1'->'player2'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND m.value->>'matchType' = '2v2'
  AND m.value->'team1'->>'player2' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->'team2'->>'player1') IS NOT NULL
         AND (m.value->'team2'->'player1'->>'id') IS NOT NULL
         AND (m.value->'team2'->'player1'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'team2'->'player1'->>'id')::uuid)
    THEN (m.value->'team2'->'player1'->>'id')::uuid
    ELSE NULL
  END,
  'team2',
  1,
  COALESCE((m.value->'team2'->'player1'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'team2'->'player1'->>'isGuest')::boolean = true THEN m.value->'team2'->'player1'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND m.value->>'matchType' = '2v2'
  AND m.value->'team2'->>'player1' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO match_players (match_id, user_id, team, position, is_guest, guest_name)
SELECT
  m.value->>'id',
  CASE
    WHEN (m.value->'team2'->>'player2') IS NOT NULL
         AND (m.value->'team2'->'player2'->>'id') IS NOT NULL
         AND (m.value->'team2'->'player2'->>'id')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM users WHERE id = (m.value->'team2'->'player2'->>'id')::uuid)
    THEN (m.value->'team2'->'player2'->>'id')::uuid
    ELSE NULL
  END,
  'team2',
  2,
  COALESCE((m.value->'team2'->'player2'->>'isGuest')::boolean, false),
  CASE WHEN (m.value->'team2'->'player2'->>'isGuest')::boolean = true THEN m.value->'team2'->'player2'->>'name' ELSE NULL END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND m.value->>'matchType' = '2v2'
  AND m.value->'team2'->>'player2' IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate match results (simplified - only basic winning team)
INSERT INTO match_results (match_id, game_number, winning_team)
SELECT
  m.value->>'id',
  1, -- Default to game 1 for now
  CASE
    WHEN m.value->>'winningTeam' = 'team1' THEN 'team1'
    WHEN m.value->>'winningTeam' = 'team2' THEN 'team2'
    ELSE 'team1' -- Default fallback
  END
FROM kv_store_171cbf6f m
WHERE m.key LIKE 'match:%'
  AND m.value->>'winningTeam' IS NOT NULL
ON CONFLICT DO NOTHING;

-- Note: ELO changes migration is complex and will be handled by application code
-- after the basic data migration is complete
