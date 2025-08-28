import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { validateUserAuth } from './auth-helpers.tsx';
import { calculateELOChanges } from './elo-system.tsx';
import { INITIAL_ELO } from './server-constants.tsx';

export function createAdminRoutes(supabase: any) {
  const app = new Hono();

  // Middleware to ensure user is admin
  const requireAdmin = async (c: any, next: any) => {
    const authResult = await validateUserAuth(c, supabase);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // Get user profile to check admin status
    const userProfile = await kv.get(`user:${authResult.user.id}`);
    if (!userProfile || !userProfile.isAdmin) {
      return c.json({ error: 'Admin privileges required' }, 403);
    }

    // Add user info to context for use in handlers
    c.set('user', authResult.user);
    c.set('userProfile', userProfile);
    await next();
  };

  // Get all matches for admin management
  app.get('/admin/matches', requireAdmin, async c => {
    try {
      console.log('=== Admin get matches request ===');

      const userProfile = c.get('userProfile');
      if (!userProfile.currentGroup) {
        return c.json({ error: 'User is not in any group' }, 404);
      }

      // Get all matches in the admin's group
      const matchPrefix = `match:${userProfile.currentGroup}:`;
      const allMatches = await kv.getByPrefix(matchPrefix);

      // Process and sort matches
      const matches = allMatches
        .map(item => item.value)
        .filter(match => match && typeof match === 'object' && match.id)
        .sort((a, b) => {
          // Sort by createdAt or date, most recent first
          const dateA = new Date(a.createdAt || a.date || 0);
          const dateB = new Date(b.createdAt || b.date || 0);
          return dateB.getTime() - dateA.getTime();
        });

      console.log(`Found ${matches.length} matches for admin in group ${userProfile.currentGroup}`);
      return c.json({ matches });
    } catch (error) {
      console.error('=== Admin get matches error ===', error);
      return c.json({ error: 'Internal server error while getting admin matches' }, 500);
    }
  });

  // Delete a match (admin only)
  app.delete('/admin/matches/:matchId', requireAdmin, async c => {
    try {
      console.log('=== Admin delete match request ===');

      const rawMatchId = c.req.param('matchId');
      const userProfile = c.get('userProfile');

      if (!rawMatchId) {
        return c.json({ error: 'Match ID is required' }, 400);
      }

      console.log('Raw match ID received:', rawMatchId);
      console.log('User group:', userProfile.currentGroup);

      // Handle both possible formats:
      // 1. Full key format: "match:DEMO01:match_1755587735331_demo3"
      // 2. Just the match ID: "match_1755587735331_demo3"
      let matchKey;
      let actualMatchId;

      if (rawMatchId.startsWith('match:')) {
        // Full key format - use as is
        matchKey = rawMatchId;
        // Extract the actual match ID from the end
        const parts = rawMatchId.split(':');
        actualMatchId = parts[parts.length - 1];
      } else {
        // Just the match ID - construct the full key
        actualMatchId = rawMatchId;
        matchKey = `match:${userProfile.currentGroup}:${actualMatchId}`;
      }

      console.log('Constructed match key:', matchKey);
      console.log('Actual match ID:', actualMatchId);

      const match = await kv.get(matchKey);
      if (!match) {
        console.log(`Match not found with key: ${matchKey}`);

        // Try alternative key format in case of inconsistency
        const alternativeKey = `match:${userProfile.currentGroup}:${actualMatchId}`;
        console.log('Trying alternative key:', alternativeKey);

        const alternativeMatch = await kv.get(alternativeKey);
        if (!alternativeMatch) {
          console.log('Match not found with alternative key either');

          // For debugging, let's list some matches in the group to see what's available
          const matchPrefix = `match:${userProfile.currentGroup}:`;
          const availableMatches = await kv.getByPrefix(matchPrefix);
          console.log(
            `Available matches in group ${userProfile.currentGroup}:`,
            availableMatches.map(m => ({ key: m.key, id: m.value?.id }))
          );

          return c.json(
            {
              error: 'Match not found',
              debug: {
                receivedId: rawMatchId,
                triedKeys: [matchKey, alternativeKey],
                groupCode: userProfile.currentGroup,
                availableMatchCount: availableMatches.length,
              },
            },
            404
          );
        }

        // Use the alternative match and key
        matchKey = alternativeKey;
        match = alternativeMatch;
      }

      // Verify match belongs to admin's group
      if (match.groupCode !== userProfile.currentGroup) {
        return c.json({ error: 'Match does not belong to your group' }, 403);
      }

      console.log('Deleting match:', actualMatchId);
      console.log('Match details:', {
        type: match.matchType,
        date: match.date,
        groupCode: match.groupCode,
      });

      // Before deleting, reverse the ELO changes if they exist
      if (match.eloChanges && Object.keys(match.eloChanges).length > 0) {
        console.log('Reversing ELO changes for match deletion...');
        console.log('ELO changes to reverse:', match.eloChanges);

        for (const [playerEmail, eloChange] of Object.entries(match.eloChanges)) {
          if (typeof eloChange === 'object' && eloChange.change) {
            try {
              // Skip guest players (they don't have stored profiles)
              if (playerEmail.startsWith('guest')) {
                console.log(`Skipping ELO reversion for guest player: ${playerEmail}`);
                continue;
              }

              // Find user by email or username (same logic as match creation)
              const userId =
                (await kv.get(`user:username:${playerEmail}`)) ||
                (await kv.get(`user:email:${playerEmail}`));
              if (userId) {
                const playerProfile = await kv.get(`user:${userId}`);
                if (playerProfile) {
                  // Reverse the ELO change
                  const reversedChange = -eloChange.change;

                  if (match.matchType === '2v2') {
                    // For 2v2 matches, update doublesElo if it was changed
                    if (playerProfile.doublesElo !== undefined) {
                      playerProfile.doublesElo =
                        (playerProfile.doublesElo || INITIAL_ELO) + reversedChange;
                    }
                  } else {
                    // For 1v1 matches, update singlesElo
                    playerProfile.singlesElo =
                      (playerProfile.singlesElo || INITIAL_ELO) + reversedChange;
                    // Also update legacy elo field for 1v1 matches
                    playerProfile.elo = (playerProfile.elo || INITIAL_ELO) + reversedChange;
                  }

                  // Reverse win/loss counts
                  if (match.matchType === '2v2') {
                    // For 2v2 matches - check the actual field structure
                    const isTeam1Player =
                      playerEmail === match.team1Player1Email ||
                      playerEmail === match.team1Player2Email;
                    const isTeam2Player =
                      playerEmail === match.team2Player1Email ||
                      playerEmail === match.team2Player2Email;
                    const isWinner =
                      (isTeam1Player && match.winningTeam === 'team1') ||
                      (isTeam2Player && match.winningTeam === 'team2');

                    if (isWinner) {
                      playerProfile.doublesWins = Math.max(0, (playerProfile.doublesWins || 0) - 1);
                    } else {
                      playerProfile.doublesLosses = Math.max(
                        0,
                        (playerProfile.doublesLosses || 0) - 1
                      );
                    }
                  } else {
                    // For 1v1 matches
                    const isWinner = match.winnerEmail === playerEmail;

                    if (isWinner) {
                      playerProfile.singlesWins = Math.max(0, (playerProfile.singlesWins || 0) - 1);
                      playerProfile.wins = Math.max(0, (playerProfile.wins || 0) - 1);
                    } else {
                      playerProfile.singlesLosses = Math.max(
                        0,
                        (playerProfile.singlesLosses || 0) - 1
                      );
                      playerProfile.losses = Math.max(0, (playerProfile.losses || 0) - 1);
                    }
                  }

                  // Save updated profile
                  await kv.set(`user:${userId}`, playerProfile);
                  console.log(
                    `Successfully reversed ELO change for ${playerProfile.name} (${playerEmail}): ${reversedChange}`
                  );
                }
              }
            } catch (playerError) {
              console.error(`Error reversing ELO for player ${playerEmail}:`, playerError);
              // Continue with other players
            }
          }
        }
      } else {
        console.log('No ELO changes found for this match - nothing to reverse');
      }

      // Delete the match using the correct key
      await kv.del(matchKey);

      console.log('Match deleted successfully:', actualMatchId);
      return c.json({ message: 'Match deleted successfully' });
    } catch (error) {
      console.error('=== Admin delete match error ===', error);
      return c.json({ error: 'Internal server error while deleting match' }, 500);
    }
  });

  // Toggle user admin status (super admin only)
  app.put('/admin/users/:userId/admin', requireAdmin, async c => {
    try {
      console.log('=== Admin toggle user admin status request ===');

      const targetUserId = c.req.param('userId');
      const { isAdmin } = await c.req.json();
      const adminProfile = c.get('userProfile');

      if (!targetUserId) {
        return c.json({ error: 'User ID is required' }, 400);
      }

      if (typeof isAdmin !== 'boolean') {
        return c.json({ error: 'isAdmin must be a boolean' }, 400);
      }

      // Get target user profile
      const targetUserProfile = await kv.get(`user:${targetUserId}`);
      if (!targetUserProfile) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Verify target user is in the same group
      if (targetUserProfile.currentGroup !== adminProfile.currentGroup) {
        return c.json({ error: 'User is not in your group' }, 403);
      }

      // Prevent admins from removing their own admin status
      if (targetUserId === adminProfile.id && !isAdmin) {
        return c.json({ error: 'Cannot remove your own admin privileges' }, 400);
      }

      console.log(`Updating admin status for user ${targetUserProfile.name} to:`, isAdmin);

      // Update admin status
      targetUserProfile.isAdmin = isAdmin;
      targetUserProfile.adminUpdatedAt = new Date().toISOString();
      targetUserProfile.adminUpdatedBy = adminProfile.id;

      await kv.set(`user:${targetUserId}`, targetUserProfile);

      console.log('User admin status updated successfully');
      return c.json({
        message: `User admin status ${isAdmin ? 'granted' : 'revoked'} successfully`,
        user: { ...targetUserProfile, password: undefined }, // Don't return password
      });
    } catch (error) {
      console.error('=== Admin toggle user admin status error ===', error);
      return c.json({ error: 'Internal server error while updating admin status' }, 500);
    }
  });

  // Delete group (admin only - permanent deletion)
  app.delete('/admin/group', requireAdmin, async c => {
    try {
      console.log('=== Admin delete group request ===');

      const adminProfile = c.get('userProfile');
      const groupCode = adminProfile.currentGroup;

      if (!groupCode) {
        return c.json({ error: 'Admin is not in any group' }, 400);
      }

      console.log(`Deleting group: ${groupCode}`);

      // Get the group details first
      const group = await kv.get(`group:${groupCode}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      console.log(`Found group "${group.name}" with ${group.memberCount || 0} members`);

      // Get all users in the group to remove them
      const groupUserPrefix = `group:${groupCode}:user:`;
      const groupUserEntries = await kv.getByPrefix(groupUserPrefix);

      console.log(`Found ${groupUserEntries.length} users to remove from group`);

      // Remove currentGroup from all users in this group
      for (const entry of groupUserEntries) {
        try {
          const userId = entry.value;
          const userProfile = await kv.get(`user:${userId}`);

          if (userProfile && userProfile.currentGroup === groupCode) {
            console.log(`Removing user ${userProfile.name} from group ${groupCode}`);

            // Remove currentGroup from user
            userProfile.currentGroup = null;
            userProfile.groupRemovedAt = new Date().toISOString();
            userProfile.groupRemovedReason = 'Group deleted by admin';

            await kv.set(`user:${userId}`, userProfile);
          }
        } catch (userError) {
          console.error(`Error removing user ${entry.value} from group:`, userError);
          // Continue with other users
        }
      }

      // Delete all group-related data
      console.log('Deleting group data...');

      // Delete the main group record
      await kv.del(`group:${groupCode}`);

      // Delete all group user associations
      for (const entry of groupUserEntries) {
        await kv.del(entry.key);
      }

      // Optionally delete all matches in the group (or keep for history)
      // For now, let's keep matches for historical purposes but mark them
      const matchPrefix = `match:${groupCode}:`;
      const groupMatches = await kv.getByPrefix(matchPrefix);

      console.log(`Found ${groupMatches.length} matches in deleted group`);

      // Keep matches but mark them as from deleted group
      for (const matchEntry of groupMatches) {
        try {
          const match = matchEntry.value;
          if (match && typeof match === 'object') {
            match.groupDeleted = true;
            match.groupDeletedAt = new Date().toISOString();
            match.groupDeletedBy = adminProfile.id;
            await kv.set(matchEntry.key, match);
          }
        } catch (matchError) {
          console.error(`Error updating match ${matchEntry.key}:`, matchError);
        }
      }

      console.log(`Group ${groupCode} deleted successfully`);
      return c.json({
        message: 'Group deleted successfully',
        deletedGroup: {
          code: groupCode,
          name: group.name,
          memberCount: groupUserEntries.length,
          matchCount: groupMatches.length,
        },
      });
    } catch (error) {
      console.error('=== Admin delete group error ===', error);
      return c.json({ error: 'Internal server error while deleting group' }, 500);
    }
  });

  // Delete user (admin only - soft delete)
  app.delete('/admin/users/:userId', requireAdmin, async c => {
    try {
      console.log('=== Admin delete user request ===');

      const targetUserId = c.req.param('userId');
      const adminProfile = c.get('userProfile');

      if (!targetUserId) {
        return c.json({ error: 'User ID is required' }, 400);
      }

      // Get target user profile
      const targetUserProfile = await kv.get(`user:${targetUserId}`);
      if (!targetUserProfile) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Verify target user is in the same group
      if (targetUserProfile.currentGroup !== adminProfile.currentGroup) {
        return c.json({ error: 'User is not in your group' }, 403);
      }

      // Prevent admins from deleting themselves
      if (targetUserId === adminProfile.id) {
        return c.json({ error: 'Cannot delete your own account' }, 400);
      }

      console.log(`Soft deleting user: ${targetUserProfile.name} (${targetUserProfile.email})`);

      // Soft delete - mark as deleted but preserve for match history
      targetUserProfile.isDeleted = true;
      targetUserProfile.deletedAt = new Date().toISOString();
      targetUserProfile.deletedBy = adminProfile.id;

      // Remove from active user lookups
      await kv.del(`user:username:${targetUserProfile.username}`);
      await kv.del(`user:email:${targetUserProfile.email}`);

      // But keep the profile for match history preservation
      await kv.set(`user:${targetUserId}`, targetUserProfile);

      // Also try to delete from Supabase auth (optional, might fail)
      try {
        await supabase.auth.admin.deleteUser(targetUserId);
        console.log('User also deleted from Supabase auth');
      } catch (authError) {
        console.warn('Failed to delete user from Supabase auth (this is okay):', authError.message);
      }

      console.log('User soft deleted successfully');
      return c.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('=== Admin delete user error ===', error);
      return c.json({ error: 'Internal server error while deleting user' }, 500);
    }
  });

  return app;
}
