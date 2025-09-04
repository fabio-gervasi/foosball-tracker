-- Migration: Add icon column to groups table and migrate existing icon data
-- This fixes the missing group icons issue by adding the icon column and migrating KV store data

-- Add icon column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS icon TEXT;

-- Migrate group icon data from KV store to relational table
UPDATE groups
SET icon = (
  SELECT g.value->>'icon'
  FROM kv_store_171cbf6f g
  WHERE g.key = 'group:' || groups.code
    AND g.value->>'icon' IS NOT NULL
)
WHERE EXISTS (
  SELECT 1
  FROM kv_store_171cbf6f g
  WHERE g.key = 'group:' || groups.code
    AND g.value->>'icon' IS NOT NULL
);

-- Log the migration results
DO $$
DECLARE
  groups_with_icons INTEGER;
BEGIN
  SELECT COUNT(*) INTO groups_with_icons
  FROM groups
  WHERE icon IS NOT NULL;

  RAISE NOTICE '✅ Group icon migration completed';
  RAISE NOTICE '   - Groups with icons: %', groups_with_icons;
END $$;
