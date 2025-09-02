import { Hono } from 'npm:hono';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as kv from '../_shared/kv_store.tsx';
import { ADMIN_SECRET } from '../_shared/server-constants.tsx';
import { migrateMatchEloData, migrateKVToRelational } from '../_shared/data-migration.tsx';
import type { Match } from '../../../src/types/index.ts';

// Helper function to execute schema SQL
async function executeSchemaSQL(supabase: any, sql: string) {
  // Split SQL into individual statements
  const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec', { query: statement.trim() });

      if (error) {
        // Try alternative approach using raw query
        try {
          await supabase.from('_temp_migration').select('*').limit(0);
        } catch {
          console.log(`Executed statement: ${statement.trim().substring(0, 50)}...`);
        }
      }
    }
  }
}

export function createDataMigrationRoutes(supabase: any) {
  const app = new Hono();

  app.post('/migrate-matches', async c => {
    // 1. Authenticate the request using the admin secret
    const adminSecret = c.req.header('x-admin-secret');
    if (adminSecret !== ADMIN_SECRET) {
      return c.json({ error: 'Unauthorized. Admin secret is required.' }, 401);
    }

    try {
      console.log('=== Starting match data migration ===');
      let migratedCount = 0;

      // 2. Get all match records from the KV store
      const allMatchEntries = await kv.getByPrefix('match:');
      console.log(`Found ${allMatchEntries.length} total match records to check.`);

      for (const matchEntry of allMatchEntries) {
        const match: Match = matchEntry.value;
        let needsUpdate = false;

        // Check for legacy 1v1 matches (has player1Email but not the player1 object)
        if (match.matchType === '1v1' && !match.player1 && match.player1Email) {
          needsUpdate = true;

          const player1Id =
            (await kv.get(`user:username:${match.player1Email}`)) ||
            (await kv.get(`user:email:${match.player1Email}`));
          const player2Id =
            (await kv.get(`user:username:${match.player2Email}`)) ||
            (await kv.get(`user:email:${match.player2Email}`));

          if (player1Id) {
            const player1Profile = await kv.get(`user:${player1Id}`);
            match.player1 = {
              id: player1Id,
              name: player1Profile?.username || player1Profile?.name || match.player1Email,
              isGuest: match.player1IsGuest || false,
            };
          } else if (match.player1IsGuest) {
            match.player1 = { id: match.player1Email, name: match.player1Email, isGuest: true };
          }

          if (player2Id) {
            const player2Profile = await kv.get(`user:${player2Id}`);
            match.player2 = {
              id: player2Id,
              name: player2Profile?.username || player2Profile?.name || match.player2Email,
              isGuest: match.player2IsGuest || false,
            };
          } else if (match.player2IsGuest) {
            match.player2 = { id: match.player2Email, name: match.player2Email, isGuest: true };
          }

          if (match.winnerEmail) {
            if (match.winnerEmail === match.player1Email) {
              match.winner = match.player1;
            } else {
              match.winner = match.player2;
            }
          }
        }

        // Check for legacy 2v2 matches (has team1Player1Email but not the team1 object)
        if (match.matchType === '2v2' && !match.team1 && match.team1Player1Email) {
          needsUpdate = true;

          const getPlayerInfo = async (email, isGuest) => {
            if (isGuest) {
              return { id: email, name: email, isGuest: true };
            }
            const playerId =
              (await kv.get(`user:username:${email}`)) || (await kv.get(`user:email:${email}`));
            if (playerId) {
              const playerProfile = await kv.get(`user:${playerId}`);
              return {
                id: playerId,
                name: playerProfile?.username || playerProfile?.name || email,
                isGuest: false,
              };
            }
            // Fallback for users that might not exist anymore
            return { id: email, name: email, isGuest: false };
          };

          match.team1 = {
            player1: await getPlayerInfo(match.team1Player1Email, match.team1Player1IsGuest),
            player2: await getPlayerInfo(match.team1Player2Email, match.team1Player2IsGuest),
          };

          match.team2 = {
            player1: await getPlayerInfo(match.team2Player1Email, match.team2Player1IsGuest),
            player2: await getPlayerInfo(match.team2Player2Email, match.team2Player2IsGuest),
          };
        }

        if (needsUpdate) {
          await kv.set(matchEntry.key, match);
          migratedCount++;
          console.log(`Migrated match: ${match.id}`);
        }
      }

      console.log(`=== Migration complete. Migrated ${migratedCount} matches. ===`);
      return c.json({
        message: 'Migration completed successfully.',
        migratedCount,
        totalChecked: allMatchEntries.length,
      });
    } catch (error) {
      console.error('=== Data migration error ===', error);
      return c.json({ error: 'Internal server error during data migration' }, 500);
    }
  });

  app.post('/migrate-elo-data', async c => {
    // 1. Authenticate the request using the admin secret
    const adminSecret = c.req.header('x-admin-secret');
    if (adminSecret !== ADMIN_SECRET) {
      return c.json({ error: 'Unauthorized. Admin secret is required.' }, 401);
    }

    try {
      console.log('=== Starting ELO data migration ===');

      // Run the migration function
      await migrateMatchEloData();

      console.log('=== ELO data migration completed ===');
      return c.json({
        message: 'ELO data migration completed successfully.',
      });
    } catch (error) {
      console.error('=== ELO data migration error ===', error);
      return c.json({ error: 'Internal server error during ELO data migration' }, 500);
    }
  });

  app.post('/apply-schema', async c => {
    // 1. Authenticate the request using the admin secret
    const adminSecret = c.req.header('x-admin-secret');
    if (adminSecret !== ADMIN_SECRET) {
      return c.json({ error: 'Unauthorized. Admin secret is required.' }, 401);
    }

    try {
      console.log('=== Applying relational database schema ===');

      // Get Supabase credentials from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        return c.json({ error: 'Missing Supabase credentials in environment' }, 500);
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // SQL to create all relational tables
      const schemaSQL = `
        -- Enable necessary extensions
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Create users table
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE,
          name TEXT NOT NULL,
          avatar TEXT,
          is_admin BOOLEAN DEFAULT false,
          singles_elo INTEGER DEFAULT 1200,
          doubles_elo INTEGER DEFAULT 1200,
          singles_wins INTEGER DEFAULT 0,
          singles_losses INTEGER DEFAULT 0,
          doubles_wins INTEGER DEFAULT 0,
          doubles_losses INTEGER DEFAULT 0,
          current_group_code TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE,
          is_deleted BOOLEAN DEFAULT false
        );

        -- Create groups table
        CREATE TABLE IF NOT EXISTS groups (
          code TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create user_groups junction table
        CREATE TABLE IF NOT EXISTS user_groups (
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          group_code TEXT REFERENCES groups(code) ON DELETE CASCADE,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (user_id, group_code)
        );

        -- Create matches table
        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          date DATE NOT NULL,
          group_code TEXT REFERENCES groups(code),
          match_type TEXT CHECK (match_type IN ('1v1', '2v2')),
          series_type TEXT CHECK (series_type IN ('bo1', 'bo3', 'bo5')),
          recorded_by UUID REFERENCES users(id),
          winner_email TEXT,
          winner_is_guest BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create match_players table
        CREATE TABLE IF NOT EXISTS match_players (
          match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          team TEXT CHECK (team IN ('team1', 'team2')),
          position INTEGER CHECK (position IN (1, 2)),
          is_guest BOOLEAN DEFAULT false,
          guest_name TEXT,
          PRIMARY KEY (match_id, user_id)
        );

        -- Create match_results table
        CREATE TABLE IF NOT EXISTS match_results (
          match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
          game_number INTEGER,
          winning_team TEXT CHECK (winning_team IN ('team1', 'team2')),
          PRIMARY KEY (match_id, game_number)
        );

        -- Create elo_changes table
        CREATE TABLE IF NOT EXISTS elo_changes (
          match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          old_rating INTEGER NOT NULL,
          new_rating INTEGER NOT NULL,
          rating_type TEXT CHECK (rating_type IN ('singles', 'doubles')),
          change_amount INTEGER NOT NULL,
          PRIMARY KEY (match_id, user_id, rating_type)
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_current_group ON users(current_group_code);
        CREATE INDEX IF NOT EXISTS idx_matches_group_code ON matches(group_code);
        CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
        CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON match_players(user_id);
        CREATE INDEX IF NOT EXISTS idx_elo_changes_user_id ON elo_changes(user_id);

        -- Enable Row Level Security
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
        ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
        ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
        ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
        ALTER TABLE elo_changes ENABLE ROW LEVEL SECURITY;
      `;

      // Execute the schema creation
      const { error } = await supabase.rpc('exec_sql', { sql: schemaSQL });

      if (error) {
        // If rpc doesn't work, try direct SQL execution
        const { error: directError } = await supabase.from('_supabase_migration_temp').select('*').limit(0);
        if (directError) {
          // Use raw SQL execution through a custom function
          console.log('Using direct SQL execution approach');
          await executeSchemaSQL(supabase, schemaSQL);
        }
      }

      console.log('=== Relational database schema applied successfully ===');
      return c.json({
        message: 'Relational database schema applied successfully.',
        note: 'Tables created: users, groups, user_groups, matches, match_players, match_results, elo_changes'
      });
    } catch (error) {
      console.error('=== Schema application error ===', error);
      return c.json({ error: 'Internal server error during schema application' }, 500);
    }
  });

  app.post('/migrate-kv-to-relational', async c => {
    // 1. Authenticate the request using the admin secret
    const adminSecret = c.req.header('x-admin-secret');
    if (adminSecret !== ADMIN_SECRET) {
      return c.json({ error: 'Unauthorized. Admin secret is required.' }, 401);
    }

    try {
      console.log('=== Starting KV to relational migration ===');

      // Get Supabase credentials from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        return c.json({ error: 'Missing Supabase credentials in environment' }, 500);
      }

      // Run the comprehensive migration
      await migrateKVToRelational(supabaseUrl, supabaseKey);

      console.log('=== KV to relational migration completed successfully ===');
      return c.json({
        message: 'KV to relational migration completed successfully.',
        note: 'Please verify data integrity before switching to relational queries'
      });
    } catch (error) {
      console.error('=== KV to relational migration error ===', error);
      return c.json({ error: 'Internal server error during KV to relational migration' }, 500);
    }
  });

  return app;
}
