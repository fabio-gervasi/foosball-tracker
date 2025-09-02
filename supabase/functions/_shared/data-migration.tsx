import * as kv from './kv_store.tsx';
import { INITIAL_ELO } from './server-constants.tsx';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Migrate existing groups to have members array and create group-user relationships
export async function migrateGroupDataStructure() {
  try {
    console.log('=== Checking for group data migration ===');

    // Get all groups
    const groupPrefix = 'group:';
    const allGroups = await kv.getByPrefix(groupPrefix);

    for (const groupData of allGroups) {
      if (groupData && groupData.value && typeof groupData.value === 'object') {
        const group = groupData.value;
        const groupKey = groupData.key;

        // Skip if this is a lookup key (like group:name:something) or user relationship key
        if (groupKey.includes(':name:') || groupKey.includes(':user:')) {
          continue;
        }

        // Extract group code from key (format: "group:CODE")
        const groupCode = groupKey.replace('group:', '');

        if (!groupCode || !group.code) {
          console.warn('Skipping group with invalid code:', groupKey);
          continue;
        }

        console.log(`Processing group migration for: ${group.name} (${group.code})`);

        // Check if group has memberCount but no members array
        if (group.memberCount !== undefined && (!group.members || !Array.isArray(group.members))) {
          console.log(`Migrating group ${group.code} from memberCount to members array`);

          // Initialize empty members array
          group.members = [];

          // Remove old memberCount field
          delete group.memberCount;

          // Save the migrated group
          await kv.set(groupKey, group);
          console.log(`Group ${group.code} migrated to members array`);
        }

        // Ensure group has members array
        if (!group.members || !Array.isArray(group.members)) {
          group.members = [];
          await kv.set(groupKey, group);
        }

        // Now create group-user relationship entries for all users in this group
        // First find all users who claim to be in this group
        const userPrefix = 'user:';
        const allUsers = await kv.getByPrefix(userPrefix);
        const usersInGroup = [];

        for (const userData of allUsers) {
          if (userData && userData.value && typeof userData.value === 'object') {
            const user = userData.value;
            const userKey = userData.key;

            // Skip lookup keys
            if (userKey.includes(':username:') || userKey.includes(':email:')) {
              continue;
            }

            // Check if this user is in the current group
            if (user.currentGroup === group.code) {
              usersInGroup.push(user.id);

              // Create group-user relationship entry if it doesn't exist
              const relationshipKey = `group:${group.code}:user:${user.id}`;
              const existingRelationship = await kv.get(relationshipKey);

              if (!existingRelationship) {
                console.log(`Creating group-user relationship: ${relationshipKey}`);
                await kv.set(relationshipKey, user.id);
              }
            }
          }
        }

        // Update group members array if we found users not in the array
        let groupUpdated = false;
        for (const userId of usersInGroup) {
          if (!group.members.includes(userId)) {
            group.members.push(userId);
            groupUpdated = true;
            console.log(`Added user ${userId} to group ${group.code} members array`);
          }
        }

        if (groupUpdated) {
          group.memberCount = group.members.length;
          await kv.set(groupKey, group);
          console.log(`Updated group ${group.code} with ${group.members.length} members`);
        }

        console.log(`Group ${group.code} migration completed with ${usersInGroup.length} users`);
      }
    }

    console.log('=== Group data migration completed ===');

    // Run user profile migration after group migration
    await migrateUserProfiles();

    // Run match ELO migration
    await migrateMatchEloData();
  } catch (error) {
    console.error('=== Error during group data migration ===', error);
  }
}

// Migrate user profiles to ensure they have all required ELO fields
export async function migrateUserProfiles() {
  try {
    console.log('=== Checking for user profile migration ===');

    // Get all user profiles (not lookup keys)
    const userPrefix = 'user:';
    const allUsers = await kv.getByPrefix(userPrefix);

    for (const userData of allUsers) {
      if (userData && userData.value && typeof userData.value === 'object') {
        const user = userData.value;
        const userKey = userData.key;

        // Skip lookup keys
        if (userKey.includes(':username:') || userKey.includes(':email:')) {
          continue;
        }

        // Check if user needs migration
        let needsUpdate = false;
        const updatedUser = { ...user };

        // Ensure user has doublesElo field
        if (!updatedUser.doublesElo && updatedUser.doublesElo !== 0) {
          console.log(`Adding doublesElo field to user: ${user.username || user.name || user.id}`);
          updatedUser.doublesElo = INITIAL_ELO;
          needsUpdate = true;
        }

        // Ensure user has singlesElo field (for backward compatibility)
        if (!updatedUser.singlesElo && updatedUser.singlesElo !== 0) {
          console.log(`Adding singlesElo field to user: ${user.username || user.name || user.id}`);
          updatedUser.singlesElo = updatedUser.elo || INITIAL_ELO;
          needsUpdate = true;
        }

        // Ensure user has doubles wins/losses fields
        if (!updatedUser.doublesWins && updatedUser.doublesWins !== 0) {
          console.log(`Adding doublesWins field to user: ${user.username || user.name || user.id}`);
          updatedUser.doublesWins = 0;
          needsUpdate = true;
        }

        if (!updatedUser.doublesLosses && updatedUser.doublesLosses !== 0) {
          console.log(
            `Adding doublesLosses field to user: ${user.username || user.name || user.id}`
          );
          updatedUser.doublesLosses = 0;
          needsUpdate = true;
        }

        // Ensure user has singles wins/losses fields
        if (!updatedUser.singlesWins && updatedUser.singlesWins !== 0) {
          console.log(`Adding singlesWins field to user: ${user.username || user.name || user.id}`);
          updatedUser.singlesWins = updatedUser.wins || 0;
          needsUpdate = true;
        }

        if (!updatedUser.singlesLosses && updatedUser.singlesLosses !== 0) {
          console.log(
            `Adding singlesLosses field to user: ${user.username || user.name || user.id}`
          );
          updatedUser.singlesLosses = updatedUser.losses || 0;
          needsUpdate = true;
        }

        // Save updated user if changes were made
        if (needsUpdate) {
          await kv.set(userKey, updatedUser);
          console.log(`Updated user profile: ${user.username || user.name || user.id}`);
        }
      }
    }

    console.log('=== User profile migration completed ===');
  } catch (error) {
    console.error('=== Error during user profile migration ===', error);
  }
}

// Migrate existing match ELO data from email-based to ID-based storage
export async function migrateMatchEloData() {
  try {
    console.log('=== Checking for match ELO data migration ===');

    // Get all groups to process their matches
    const groupPrefix = 'group:';
    const allGroups = await kv.getByPrefix(groupPrefix);

    for (const groupData of allGroups) {
      if (groupData && groupData.value && typeof groupData.value === 'object') {
        const group = groupData.value;

        // Skip if this is a lookup key
        if (groupData.key.includes(':name:') || groupData.key.includes(':user:')) {
          continue;
        }

        const groupCode = group.code;
        if (!groupCode) continue;

        console.log(`Processing matches for group: ${groupCode}`);

        // Get all matches for this group
        const matchPrefix = `match:${groupCode}:`;
        const groupMatches = await kv.getByPrefix(matchPrefix);

        let migratedCount = 0;

        for (const matchData of groupMatches) {
          if (matchData && matchData.value && typeof matchData.value === 'object') {
            const match = matchData.value;
            const matchKey = matchData.key;

            // Skip if this is not a match record
            if (!match.id || !match.eloChanges) {
              continue;
            }

            // Check if ELO changes are already using ID-based format
            const eloKeys = Object.keys(match.eloChanges);
            const needsMigration = eloKeys.some(
              key => key.includes('@') || key.startsWith('guest_')
            );

            if (!needsMigration) {
              continue; // Already migrated
            }

            console.log(`Migrating match ${match.id} ELO data`);

            const newEloChanges = {};

            // For 1v1 matches
            if (match.matchType === '1v1' || !match.matchType) {
              if (match.player1?.id && match.eloChanges[match.player1.email]) {
                newEloChanges[match.player1.id] = match.eloChanges[match.player1.email];
              }
              if (match.player2?.id && match.eloChanges[match.player2.email]) {
                newEloChanges[match.player2.id] = match.eloChanges[match.player2.email];
              }
            }
            // For 2v2 matches
            else if (match.matchType === '2v2') {
              if (match.team1?.player1?.id && match.eloChanges[match.team1.player1.email]) {
                newEloChanges[match.team1.player1.id] = match.eloChanges[match.team1.player1.email];
              }
              if (match.team1?.player2?.id && match.eloChanges[match.team1.player2.email]) {
                newEloChanges[match.team1.player2.id] = match.eloChanges[match.team1.player2.email];
              }
              if (match.team2?.player1?.id && match.eloChanges[match.team2.player1.email]) {
                newEloChanges[match.team2.player1.id] = match.eloChanges[match.team2.player1.email];
              }
              if (match.team2?.player2?.id && match.eloChanges[match.team2.player2.email]) {
                newEloChanges[match.team2.player2.id] = match.eloChanges[match.team2.player2.email];
              }
            }

            // Update the match with new ELO changes
            if (Object.keys(newEloChanges).length > 0) {
              match.eloChanges = newEloChanges;
              await kv.set(matchKey, match);
              migratedCount++;
              console.log(`Migrated ELO data for match ${match.id}`);
            }
          }
        }

        if (migratedCount > 0) {
          console.log(`Migrated ${migratedCount} matches for group ${groupCode}`);
        }
      }
    }

    console.log('=== Match ELO data migration completed ===');
  } catch (error) {
    console.error('=== Error during match ELO data migration ===', error);
  }
}

// Comprehensive migration from KV store to relational tables
export async function migrateKVToRelational(supabaseUrl: string, supabaseKey: string) {
  try {
    console.log('=== Starting comprehensive KV to relational migration ===');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Phase 1: Migrate users
    await migrateUsersToRelational(supabase);

    // Phase 2: Migrate groups
    await migrateGroupsToRelational(supabase);

    // Phase 3: Migrate user-group relationships
    await migrateUserGroupsToRelational(supabase);

    // Phase 4: Migrate matches
    await migrateMatchesToRelational(supabase);

    // Phase 5: Migrate match players
    await migrateMatchPlayersToRelational(supabase);

    // Phase 6: Migrate match results
    await migrateMatchResultsToRelational(supabase);

    // Phase 7: Migrate ELO changes
    await migrateEloChangesToRelational(supabase);

    console.log('=== Comprehensive KV to relational migration completed ===');
  } catch (error) {
    console.error('=== Error during comprehensive migration ===', error);
    throw error;
  }
}

async function migrateUsersToRelational(supabase: any) {
  console.log('=== Migrating users to relational table ===');

  const userPrefix = 'user:';
  const allUsers = await kv.getByPrefix(userPrefix);
  let migratedCount = 0;

  for (const userData of allUsers) {
    if (userData && userData.value && typeof userData.value === 'object') {
      const user = userData.value;
      const userKey = userData.key;

      // Skip lookup keys
      if (userKey.includes(':username:') || userKey.includes(':email:')) {
        continue;
      }

      // Prepare user data for relational table
      const relationalUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        is_admin: user.isAdmin || false,
        singles_elo: user.singlesElo || user.elo || INITIAL_ELO,
        doubles_elo: user.doublesElo || INITIAL_ELO,
        singles_wins: user.singlesWins || user.wins || 0,
        singles_losses: user.singlesLosses || user.losses || 0,
        doubles_wins: user.doublesWins || 0,
        doubles_losses: user.doublesLosses || 0,
        current_group_code: user.currentGroup,
        created_at: user.createdAt ? new Date(user.createdAt) : new Date(),
        updated_at: user.updatedAt ? new Date(user.updatedAt) : new Date(),
        deleted_at: user.deletedAt ? new Date(user.deletedAt) : null,
        is_deleted: user.isDeleted || false
      };

      // Insert into relational table
      const { error } = await supabase
        .from('users')
        .upsert(relationalUser, { onConflict: 'id' });

      if (error) {
        console.error(`Error migrating user ${user.id}:`, error);
      } else {
        migratedCount++;
        console.log(`Migrated user: ${user.username || user.name || user.id}`);
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} users ===`);
}

async function migrateGroupsToRelational(supabase: any) {
  console.log('=== Migrating groups to relational table ===');

  const groupPrefix = 'group:';
  const allGroups = await kv.getByPrefix(groupPrefix);
  let migratedCount = 0;

  for (const groupData of allGroups) {
    if (groupData && groupData.value && typeof groupData.value === 'object') {
      const group = groupData.value;
      const groupKey = groupData.key;

      // Skip lookup keys
      if (groupKey.includes(':name:') || groupKey.includes(':user:')) {
        continue;
      }

      // Prepare group data for relational table
      const relationalGroup = {
        code: group.code,
        name: group.name,
        created_by: group.createdBy,
        created_at: group.createdAt ? new Date(group.createdAt) : new Date(),
        updated_at: group.updatedAt ? new Date(group.updatedAt) : new Date()
      };

      // Insert into relational table
      const { error } = await supabase
        .from('groups')
        .upsert(relationalGroup, { onConflict: 'code' });

      if (error) {
        console.error(`Error migrating group ${group.code}:`, error);
      } else {
        migratedCount++;
        console.log(`Migrated group: ${group.name} (${group.code})`);
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} groups ===`);
}

async function migrateUserGroupsToRelational(supabase: any) {
  console.log('=== Migrating user-group relationships ===');

  // Get all users and their group relationships
  const userPrefix = 'user:';
  const allUsers = await kv.getByPrefix(userPrefix);
  let migratedCount = 0;

  for (const userData of allUsers) {
    if (userData && userData.value && typeof userData.value === 'object') {
      const user = userData.value;
      const userKey = userData.key;

      // Skip lookup keys
      if (userKey.includes(':username:') || userKey.includes(':email:')) {
        continue;
      }

      // If user has a current group, create the relationship
      if (user.currentGroup) {
        const relationship = {
          user_id: user.id,
          group_code: user.currentGroup,
          joined_at: user.joinedGroupAt ? new Date(user.joinedGroupAt) : new Date()
        };

        const { error } = await supabase
          .from('user_groups')
          .upsert(relationship, { onConflict: 'user_id,group_code' });

        if (error) {
          console.error(`Error migrating user-group relationship ${user.id}-${user.currentGroup}:`, error);
        } else {
          migratedCount++;
          console.log(`Migrated user-group relationship: ${user.id} -> ${user.currentGroup}`);
        }
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} user-group relationships ===`);
}

async function migrateMatchesToRelational(supabase: any) {
  console.log('=== Migrating matches to relational table ===');

  const matchPrefix = 'match:';
  const allMatches = await kv.getByPrefix(matchPrefix);
  let migratedCount = 0;

  for (const matchData of allMatches) {
    if (matchData && matchData.value && typeof matchData.value === 'object') {
      const match = matchData.value;

      // Extract group code from key (format: "match:GROUPCODE:matchId")
      const keyParts = matchData.key.split(':');
      const groupCode = keyParts[1];

      // Prepare match data for relational table
      const relationalMatch = {
        id: match.id,
        date: match.date ? new Date(match.date) : new Date(),
        group_code: groupCode,
        match_type: match.matchType || '1v1',
        series_type: match.seriesType || 'bo1',
        recorded_by: match.recordedBy,
        winner_email: match.winnerEmail,
        winner_is_guest: match.winnerIsGuest || false,
        created_at: match.createdAt ? new Date(match.createdAt) : new Date()
      };

      // Insert into relational table
      const { error } = await supabase
        .from('matches')
        .upsert(relationalMatch, { onConflict: 'id' });

      if (error) {
        console.error(`Error migrating match ${match.id}:`, error);
      } else {
        migratedCount++;
        console.log(`Migrated match: ${match.id}`);
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} matches ===`);
}

async function migrateMatchPlayersToRelational(supabase: any) {
  console.log('=== Migrating match players to relational table ===');

  const matchPrefix = 'match:';
  const allMatches = await kv.getByPrefix(matchPrefix);
  let migratedCount = 0;

  for (const matchData of allMatches) {
    if (matchData && matchData.value && typeof matchData.value === 'object') {
      const match = matchData.value;

      // Handle 1v1 matches
      if (match.matchType === '1v1' || !match.matchType) {
        if (match.player1) {
          await insertMatchPlayer(supabase, match.id, match.player1, 'team1', 1);
          migratedCount++;
        }
        if (match.player2) {
          await insertMatchPlayer(supabase, match.id, match.player2, 'team2', 1);
          migratedCount++;
        }
      }
      // Handle 2v2 matches
      else if (match.matchType === '2v2') {
        if (match.team1) {
          if (match.team1.player1) {
            await insertMatchPlayer(supabase, match.id, match.team1.player1, 'team1', 1);
            migratedCount++;
          }
          if (match.team1.player2) {
            await insertMatchPlayer(supabase, match.id, match.team1.player2, 'team1', 2);
            migratedCount++;
          }
        }
        if (match.team2) {
          if (match.team2.player1) {
            await insertMatchPlayer(supabase, match.id, match.team2.player1, 'team2', 1);
            migratedCount++;
          }
          if (match.team2.player2) {
            await insertMatchPlayer(supabase, match.id, match.team2.player2, 'team2', 2);
            migratedCount++;
          }
        }
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} match players ===`);
}

async function insertMatchPlayer(supabase: any, matchId: string, player: any, team: string, position: number) {
  const matchPlayer = {
    match_id: matchId,
    user_id: player.isGuest ? null : player.id,
    team: team,
    position: position,
    is_guest: player.isGuest || false,
    guest_name: player.isGuest ? player.name : null
  };

  const { error } = await supabase
    .from('match_players')
    .upsert(matchPlayer, { onConflict: 'match_id,user_id' });

  if (error) {
    console.error(`Error migrating match player ${matchId}-${player.id}:`, error);
  }
}

async function migrateMatchResultsToRelational(supabase: any) {
  console.log('=== Migrating match results to relational table ===');

  const matchPrefix = 'match:';
  const allMatches = await kv.getByPrefix(matchPrefix);
  let migratedCount = 0;

  for (const matchData of allMatches) {
    if (matchData && matchData.value && typeof matchData.value === 'object') {
      const match = matchData.value;

      // Handle match results if they exist
      if (match.gameResults && Array.isArray(match.gameResults)) {
        for (let i = 0; i < match.gameResults.length; i++) {
          const result = match.gameResults[i];
          const matchResult = {
            match_id: match.id,
            game_number: i + 1,
            winning_team: result
          };

          const { error } = await supabase
            .from('match_results')
            .upsert(matchResult, { onConflict: 'match_id,game_number' });

          if (error) {
            console.error(`Error migrating match result ${match.id}-${i + 1}:`, error);
          } else {
            migratedCount++;
          }
        }
      }
      // Handle series score for matches without detailed game results
      else if (match.seriesScore && match.winningTeam) {
        const matchResult = {
          match_id: match.id,
          game_number: 1,
          winning_team: match.winningTeam
        };

        const { error } = await supabase
          .from('match_results')
          .upsert(matchResult, { onConflict: 'match_id,game_number' });

        if (error) {
          console.error(`Error migrating match result ${match.id}-1:`, error);
        } else {
          migratedCount++;
        }
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} match results ===`);
}

async function migrateEloChangesToRelational(supabase: any) {
  console.log('=== Migrating ELO changes to relational table ===');

  const matchPrefix = 'match:';
  const allMatches = await kv.getByPrefix(matchPrefix);
  let migratedCount = 0;

  for (const matchData of allMatches) {
    if (matchData && matchData.value && typeof matchData.value === 'object') {
      const match = matchData.value;

      if (match.eloChanges && typeof match.eloChanges === 'object') {
        for (const [playerId, change] of Object.entries(match.eloChanges)) {
          if (typeof change === 'object' && change !== null) {
            const eloChange = change as any;

            // Determine rating type based on match type
            const ratingType = match.matchType === '2v2' ? 'doubles' : 'singles';

            const relationalEloChange = {
              match_id: match.id,
              user_id: playerId,
              old_rating: eloChange.oldRating || eloChange.old_rating,
              new_rating: eloChange.newRating || eloChange.new_rating,
              rating_type: ratingType,
              change_amount: eloChange.change || eloChange.change_amount
            };

            const { error } = await supabase
              .from('elo_changes')
              .upsert(relationalEloChange, { onConflict: 'match_id,user_id,rating_type' });

            if (error) {
              console.error(`Error migrating ELO change ${match.id}-${playerId}:`, error);
            } else {
              migratedCount++;
            }
          }
        }
      }
    }
  }

  console.log(`=== Migrated ${migratedCount} ELO changes ===`);
}
