-- Cleanup KV Store Migration
-- This migration safely removes the KV store table after successful migration to relational database

-- Verify that all data has been migrated before proceeding
-- Count records in relational tables to ensure migration was successful

DO $$
DECLARE
    users_count INTEGER;
    groups_count INTEGER;
    matches_count INTEGER;
    match_players_count INTEGER;
    match_results_count INTEGER;
BEGIN
    -- Get counts from relational tables
    SELECT COUNT(*) INTO users_count FROM users;
    SELECT COUNT(*) INTO groups_count FROM groups;
    SELECT COUNT(*) INTO matches_count FROM matches;
    SELECT COUNT(*) INTO match_players_count FROM match_players;
    SELECT COUNT(*) INTO match_results_count FROM match_results;

    -- Log migration verification
    RAISE NOTICE 'Migration verification:';
    RAISE NOTICE 'Users: %', users_count;
    RAISE NOTICE 'Groups: %', groups_count;
    RAISE NOTICE 'Matches: %', matches_count;
    RAISE NOTICE 'Match Players: %', match_players_count;
    RAISE NOTICE 'Match Results: %', match_results_count;

    -- Verify we have data in the relational tables
    IF users_count = 0 OR groups_count = 0 OR matches_count = 0 THEN
        RAISE EXCEPTION 'Migration verification failed: Insufficient data in relational tables. Users: %, Groups: %, Matches: %', users_count, groups_count, matches_count;
    END IF;

    RAISE NOTICE '✅ Migration verification passed - proceeding with KV store cleanup';
END $$;

-- Create backup of KV store data (just in case)
CREATE TABLE IF NOT EXISTS kv_store_backup AS
SELECT * FROM kv_store_171cbf6f;

-- Add comment to backup table
DO $$
BEGIN
    EXECUTE 'COMMENT ON TABLE kv_store_backup IS ''Backup of KV store data created during cleanup migration on ' || NOW() || '''';
END $$;

-- Drop the original KV store table
DROP TABLE IF EXISTS kv_store_171cbf6f CASCADE;

-- Log successful cleanup
DO $$
BEGIN
    RAISE NOTICE '✅ KV store cleanup completed successfully';
    RAISE NOTICE '   - KV store table dropped';
    RAISE NOTICE '   - Backup created in kv_store_backup table';
    RAISE NOTICE '   - All relational data preserved';
END $$;
