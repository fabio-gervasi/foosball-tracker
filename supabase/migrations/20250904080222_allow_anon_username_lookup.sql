-- BETTER APPROACH: Create a dedicated username lookup table
-- This is more secure than allowing anonymous access to the entire users table

-- Create a username_lookup table for secure username->email mapping
CREATE TABLE IF NOT EXISTS username_lookup (
  username TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_username_lookup_username ON username_lookup(username);

-- Function to keep username_lookup table in sync with users table
CREATE OR REPLACE FUNCTION sync_username_lookup()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO username_lookup (username, email, updated_at)
    VALUES (NEW.username, NEW.email, NOW())
    ON CONFLICT (username) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM username_lookup WHERE username = OLD.username;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync the lookup table
DROP TRIGGER IF EXISTS trigger_sync_username_lookup ON users;
CREATE TRIGGER trigger_sync_username_lookup
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_username_lookup();

-- Populate the lookup table with existing data
INSERT INTO username_lookup (username, email)
SELECT username, email FROM users
WHERE username IS NOT NULL AND is_deleted = false
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Allow anonymous access to the lookup table only
CREATE POLICY "Allow anonymous username lookup" ON username_lookup
FOR SELECT
USING (auth.role() = 'anon');

-- REVERT: Remove the insecure policy from users table
DROP POLICY IF EXISTS "Allow anonymous username lookup" ON users;
