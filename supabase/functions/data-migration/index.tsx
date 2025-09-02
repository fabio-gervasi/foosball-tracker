import { Hono } from 'npm:hono';
import * as kv from '../_shared/kv_store.tsx';
import { ADMIN_SECRET } from '../_shared/server-constants.tsx';
import { migrateMatchEloData } from '../_shared/data-migration.tsx';
import type { Match } from '../../../src/types/index.ts';

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

  return app;
}
