import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { INITIAL_ELO, K_FACTOR } from './server-constants.tsx';
import { validateUserAuth } from './auth-helpers.tsx';
import {
  calculateELOChanges,
  calculateTeamELOChanges,
  calculate2v2FoosballEloSimple,
} from './elo-system.tsx';

export function createMatchRoutes(supabase: any) {
  const app = new Hono();

  // Get all matches for current user's group
  app.get('/matches', async c => {
    try {
      console.log('=== Get matches request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userProfile.currentGroup) {
        console.log('User has no current group, returning empty matches');
        return c.json({ matches: [] });
      }

      console.log('Loading matches for group:', userProfile.currentGroup);

      // Get all matches for the user's group
      const matchPrefix = `match:${userProfile.currentGroup}:`;
      const matchItems = await kv.getByPrefix(matchPrefix);

      const matches = matchItems
        .map(item => item.value)
        .filter(match => match && typeof match === 'object')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`Found ${matches.length} matches for group ${userProfile.currentGroup}`);

      return c.json({ matches });
    } catch (error) {
      console.error('=== Get matches error ===', error);
      return c.json({ error: 'Internal server error while getting matches' }, 500);
    }
  });

  // Record a new match
  app.post('/matches', async c => {
    try {
      console.log('=== Record match request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userProfile.currentGroup) {
        return c.json({ error: 'User must be in a group to record matches' }, 400);
      }

      const matchData = await c.req.json();
      console.log('Match data received:', matchData);

      // Validate match data structure
      if (
        !matchData.matchType ||
        (matchData.matchType !== '1v1' && matchData.matchType !== '2v2')
      ) {
        return c.json({ error: 'Invalid match type. Must be "1v1" or "2v2"' }, 400);
      }

      // Validate series type
      if (
        matchData.seriesType &&
        matchData.seriesType !== 'bo1' &&
        matchData.seriesType !== 'bo3'
      ) {
        return c.json({ error: 'Invalid series type. Must be "bo1" or "bo3"' }, 400);
      }

      // For 1v1 matches
      if (matchData.matchType === '1v1') {
        if (!matchData.player1Email || !matchData.player2Email || !matchData.winnerEmail) {
          return c.json({ error: 'Missing required fields for 1v1 match' }, 400);
        }
      }

      // For 2v2 matches
      if (matchData.matchType === '2v2') {
        if (
          !matchData.team1Player1Email ||
          !matchData.team1Player2Email ||
          !matchData.team2Player1Email ||
          !matchData.team2Player2Email ||
          !matchData.winningTeam
        ) {
          return c.json({ error: 'Missing required fields for 2v2 match' }, 400);
        }
      }

      // Create match record with player names for display
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const match = {
        id: matchId,
        groupCode: userProfile.currentGroup,
        matchType: matchData.matchType,
        seriesType: matchData.seriesType || 'bo1', // Default to Best of 1
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        recordedBy: authResult.user.id,
        ...matchData,
      };

      // Add player names for confirmation screen display
      if (matchData.matchType === '1v1') {
        // Get player names for 1v1
        const player1Id =
          (await kv.get(`user:username:${matchData.player1Email}`)) ||
          (await kv.get(`user:email:${matchData.player1Email}`));
        const player2Id =
          (await kv.get(`user:username:${matchData.player2Email}`)) ||
          (await kv.get(`user:email:${matchData.player2Email}`));

        if (player1Id) {
          const player1Profile = await kv.get(`user:${player1Id}`);
          match.player1 = {
            id: player1Id,
            name: player1Profile?.username || player1Profile?.name || matchData.player1Email,
            isGuest: matchData.player1IsGuest || false,
          };
        } else if (matchData.player1IsGuest) {
          match.player1 = {
            id: matchData.player1Email,
            name: matchData.player1Email,
            isGuest: true,
          };
        }

        if (player2Id) {
          const player2Profile = await kv.get(`user:${player2Id}`);
          match.player2 = {
            id: player2Id,
            name: player2Profile?.username || player2Profile?.name || matchData.player2Email,
            isGuest: matchData.player2IsGuest || false,
          };
        } else if (matchData.player2IsGuest) {
          match.player2 = {
            id: matchData.player2Email,
            name: matchData.player2Email,
            isGuest: true,
          };
        }

        // Set winner
        if (matchData.winnerEmail === matchData.player1Email) {
          match.winner = match.player1;
        } else {
          match.winner = match.player2;
        }
      } else if (matchData.matchType === '2v2') {
        // Get player names for 2v2
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
          return { id: email, name: email, isGuest: false };
        };

        match.team1 = {
          player1: await getPlayerInfo(matchData.team1Player1Email, matchData.team1Player1IsGuest),
          player2: await getPlayerInfo(matchData.team1Player2Email, matchData.team1Player2IsGuest),
        };

        match.team2 = {
          player1: await getPlayerInfo(matchData.team2Player1Email, matchData.team2Player1IsGuest),
          player2: await getPlayerInfo(matchData.team2Player2Email, matchData.team2Player2IsGuest),
        };
      }

      // Calculate and store ELO changes before updating player stats
      const eloChanges = await calculateMatchELOChanges(match);
      match.eloChanges = eloChanges;

      // Store the match
      await kv.set(`match:${userProfile.currentGroup}:${matchId}`, match);

      // Update player stats and ELO ratings
      await updatePlayerStats(match);

      console.log('Match recorded successfully:', matchId);
      return c.json({
        message: 'Match recorded successfully',
        match,
        eloChanges,
      });
    } catch (error) {
      console.error('=== Record match error ===', error);
      return c.json({ error: 'Internal server error while recording match' }, 500);
    }
  });

  // Helper function to calculate ELO changes for a match
  async function calculateMatchELOChanges(match: any) {
    try {
      const eloChanges = {};

      if (match.matchType === '1v1') {
        const player1Id =
          (await kv.get(`user:username:${match.player1Email}`)) ||
          (await kv.get(`user:email:${match.player1Email}`));
        const player2Id =
          (await kv.get(`user:username:${match.player2Email}`)) ||
          (await kv.get(`user:email:${match.player2Email}`));

        if (player1Id && player2Id) {
          const player1Profile = await kv.get(`user:${player1Id}`);
          const player2Profile = await kv.get(`user:${player2Id}`);

          if (player1Profile && player2Profile) {
            const isPlayer1Winner = match.winnerEmail === match.player1Email;

            // Check if this is a Best of 3 sweep for 1.2x ELO multiplier
            const multiplier = match.seriesType === 'bo3' && match.isSweep ? 1.2 : 1;

            const eloData = calculateELOChanges(
              player1Profile.singlesElo || INITIAL_ELO,
              player2Profile.singlesElo || INITIAL_ELO,
              isPlayer1Winner,
              multiplier
            );

            eloChanges[match.player1Email] = {
              oldRating: player1Profile.singlesElo || INITIAL_ELO,
              newRating: eloData.player1.newRating,
              change: eloData.player1.change,
            };

            eloChanges[match.player2Email] = {
              oldRating: player2Profile.singlesElo || INITIAL_ELO,
              newRating: eloData.player2.newRating,
              change: eloData.player2.change,
            };
          }
        }
      } else if (match.matchType === '2v2') {
        // For 2v2 matches, use the new advanced ELO calculation
        const team1Player1Id =
          (await kv.get(`user:username:${match.team1Player1Email}`)) ||
          (await kv.get(`user:email:${match.team1Player1Email}`));
        const team1Player2Id =
          (await kv.get(`user:username:${match.team1Player2Email}`)) ||
          (await kv.get(`user:email:${match.team1Player2Email}`));
        const team2Player1Id =
          (await kv.get(`user:username:${match.team2Player1Email}`)) ||
          (await kv.get(`user:email:${match.team2Player1Email}`));
        const team2Player2Id =
          (await kv.get(`user:username:${match.team2Player2Email}`)) ||
          (await kv.get(`user:email:${match.team2Player2Email}`));

        if (team1Player1Id && team1Player2Id && team2Player1Id && team2Player2Id) {
          const team1Player1Profile = await kv.get(`user:${team1Player1Id}`);
          const team1Player2Profile = await kv.get(`user:${team1Player2Id}`);
          const team2Player1Profile = await kv.get(`user:${team2Player1Id}`);
          const team2Player2Profile = await kv.get(`user:${team2Player2Id}`);

          if (
            team1Player1Profile &&
            team1Player2Profile &&
            team2Player1Profile &&
            team2Player2Profile
          ) {
            const isTeam1Winner = match.winningTeam === 'team1';

            // Check if this is a Best of 3 sweep for 1.2x ELO multiplier
            const multiplier = match.seriesType === 'bo3' && match.isSweep ? 1.2 : 1;

            // Calculate total games played for each player (singles + doubles)
            const getGamesPlayed = profile => {
              const singlesGames = (profile.singlesWins || 0) + (profile.singlesLosses || 0);
              const doublesGames = (profile.doublesWins || 0) + (profile.doublesLosses || 0);
              return singlesGames + doublesGames;
            };

            const eloData = calculate2v2FoosballEloSimple(
              {
                rating: team1Player1Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team1Player1Profile),
              },
              {
                rating: team1Player2Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team1Player2Profile),
              },
              {
                rating: team2Player1Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team2Player1Profile),
              },
              {
                rating: team2Player2Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team2Player2Profile),
              },
              isTeam1Winner,
              multiplier
            );

            eloChanges[match.team1Player1Email] = {
              oldRating: team1Player1Profile.doublesElo || INITIAL_ELO,
              newRating: eloData.team1Player1.newRating,
              change: eloData.team1Player1.change,
            };

            eloChanges[match.team1Player2Email] = {
              oldRating: team1Player2Profile.doublesElo || INITIAL_ELO,
              newRating: eloData.team1Player2.newRating,
              change: eloData.team1Player2.change,
            };

            eloChanges[match.team2Player1Email] = {
              oldRating: team2Player1Profile.doublesElo || INITIAL_ELO,
              newRating: eloData.team2Player1.newRating,
              change: eloData.team2Player1.change,
            };

            eloChanges[match.team2Player2Email] = {
              oldRating: team2Player2Profile.doublesElo || INITIAL_ELO,
              newRating: eloData.team2Player2.newRating,
              change: eloData.team2Player2.change,
            };
          }
        }
      }

      return eloChanges;
    } catch (error) {
      console.error('Error calculating ELO changes:', error);
      return {};
    }
  }

  // Helper function to update player stats after a match
  async function updatePlayerStats(match: any) {
    try {
      console.log('Updating player stats for match:', match.id);

      if (match.matchType === '1v1') {
        // Update 1v1 stats
        const player1Id =
          (await kv.get(`user:username:${match.player1Email}`)) ||
          (await kv.get(`user:email:${match.player1Email}`));
        const player2Id =
          (await kv.get(`user:username:${match.player2Email}`)) ||
          (await kv.get(`user:email:${match.player2Email}`));

        if (player1Id && player2Id) {
          const player1Profile = await kv.get(`user:${player1Id}`);
          const player2Profile = await kv.get(`user:${player2Id}`);

          if (player1Profile && player2Profile) {
            const isPlayer1Winner = match.winnerEmail === match.player1Email;

            // Check if this is a Best of 3 sweep for 1.2x ELO multiplier
            const multiplier = match.seriesType === 'bo3' && match.isSweep ? 1.2 : 1;

            // Calculate new ELO ratings
            const eloChanges = calculateELOChanges(
              player1Profile.singlesElo || INITIAL_ELO,
              player2Profile.singlesElo || INITIAL_ELO,
              isPlayer1Winner,
              multiplier
            );

            // Update player 1
            const updatedPlayer1 = {
              ...player1Profile,
              singlesWins: (player1Profile.singlesWins || 0) + (isPlayer1Winner ? 1 : 0),
              singlesLosses: (player1Profile.singlesLosses || 0) + (isPlayer1Winner ? 0 : 1),
              singlesElo: eloChanges.player1.newRating,
              // Legacy fields
              wins: (player1Profile.wins || 0) + (isPlayer1Winner ? 1 : 0),
              losses: (player1Profile.losses || 0) + (isPlayer1Winner ? 0 : 1),
              elo: eloChanges.player1.newRating,
            };

            // Update player 2
            const updatedPlayer2 = {
              ...player2Profile,
              singlesWins: (player2Profile.singlesWins || 0) + (isPlayer1Winner ? 0 : 1),
              singlesLosses: (player2Profile.singlesLosses || 0) + (isPlayer1Winner ? 1 : 0),
              singlesElo: eloChanges.player2.newRating,
              // Legacy fields
              wins: (player2Profile.wins || 0) + (isPlayer1Winner ? 0 : 1),
              losses: (player2Profile.losses || 0) + (isPlayer1Winner ? 1 : 0),
              elo: eloChanges.player2.newRating,
            };

            await kv.set(`user:${player1Id}`, updatedPlayer1);
            await kv.set(`user:${player2Id}`, updatedPlayer2);

            console.log('1v1 stats updated successfully');
          }
        }
      } else if (match.matchType === '2v2') {
        // Update 2v2 stats
        const team1Player1Id =
          (await kv.get(`user:username:${match.team1Player1Email}`)) ||
          (await kv.get(`user:email:${match.team1Player1Email}`));
        const team1Player2Id =
          (await kv.get(`user:username:${match.team1Player2Email}`)) ||
          (await kv.get(`user:email:${match.team1Player2Email}`));
        const team2Player1Id =
          (await kv.get(`user:username:${match.team2Player1Email}`)) ||
          (await kv.get(`user:email:${match.team2Player1Email}`));
        const team2Player2Id =
          (await kv.get(`user:username:${match.team2Player2Email}`)) ||
          (await kv.get(`user:email:${match.team2Player2Email}`));

        if (team1Player1Id && team1Player2Id && team2Player1Id && team2Player2Id) {
          const team1Player1Profile = await kv.get(`user:${team1Player1Id}`);
          const team1Player2Profile = await kv.get(`user:${team1Player2Id}`);
          const team2Player1Profile = await kv.get(`user:${team2Player1Id}`);
          const team2Player2Profile = await kv.get(`user:${team2Player2Id}`);

          if (
            team1Player1Profile &&
            team1Player2Profile &&
            team2Player1Profile &&
            team2Player2Profile
          ) {
            const isTeam1Winner = match.winningTeam === 'team1';

            // Check if this is a Best of 3 sweep for 1.2x ELO multiplier
            const multiplier = match.seriesType === 'bo3' && match.isSweep ? 1.2 : 1;

            // Calculate total games played for each player (singles + doubles)
            const getGamesPlayed = profile => {
              const singlesGames = (profile.singlesWins || 0) + (profile.singlesLosses || 0);
              const doublesGames = (profile.doublesWins || 0) + (profile.doublesLosses || 0);
              return singlesGames + doublesGames;
            };

            // Calculate new ELO ratings for 2v2 using simplified win/loss algorithm
            const eloChanges = calculate2v2FoosballEloSimple(
              {
                rating: team1Player1Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team1Player1Profile),
              },
              {
                rating: team1Player2Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team1Player2Profile),
              },
              {
                rating: team2Player1Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team2Player1Profile),
              },
              {
                rating: team2Player2Profile.doublesElo || INITIAL_ELO,
                gamesPlayed: getGamesPlayed(team2Player2Profile),
              },
              isTeam1Winner,
              multiplier
            );

            // Update team 1 player 1
            const updatedTeam1Player1 = {
              ...team1Player1Profile,
              doublesWins: (team1Player1Profile.doublesWins || 0) + (isTeam1Winner ? 1 : 0),
              doublesLosses: (team1Player1Profile.doublesLosses || 0) + (isTeam1Winner ? 0 : 1),
              doublesElo: eloChanges.team1Player1.newRating,
            };

            // Update team 1 player 2
            const updatedTeam1Player2 = {
              ...team1Player2Profile,
              doublesWins: (team1Player2Profile.doublesWins || 0) + (isTeam1Winner ? 1 : 0),
              doublesLosses: (team1Player2Profile.doublesLosses || 0) + (isTeam1Winner ? 0 : 1),
              doublesElo: eloChanges.team1Player2.newRating,
            };

            // Update team 2 player 1
            const updatedTeam2Player1 = {
              ...team2Player1Profile,
              doublesWins: (team2Player1Profile.doublesWins || 0) + (isTeam1Winner ? 0 : 1),
              doublesLosses: (team2Player1Profile.doublesLosses || 0) + (isTeam1Winner ? 1 : 0),
              doublesElo: eloChanges.team2Player1.newRating,
            };

            // Update team 2 player 2
            const updatedTeam2Player2 = {
              ...team2Player2Profile,
              doublesWins: (team2Player2Profile.doublesWins || 0) + (isTeam1Winner ? 0 : 1),
              doublesLosses: (team2Player2Profile.doublesLosses || 0) + (isTeam1Winner ? 1 : 0),
              doublesElo: eloChanges.team2Player2.newRating,
            };

            await kv.set(`user:${team1Player1Id}`, updatedTeam1Player1);
            await kv.set(`user:${team1Player2Id}`, updatedTeam1Player2);
            await kv.set(`user:${team2Player1Id}`, updatedTeam2Player1);
            await kv.set(`user:${team2Player2Id}`, updatedTeam2Player2);

            console.log('2v2 stats and ELO updated successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  // Delete a match (used for corrections)
  app.delete('/matches/:matchId', async c => {
    try {
      console.log('=== Delete match request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userProfile.currentGroup) {
        return c.json({ error: 'User must be in a group to delete matches' }, 400);
      }

      const matchId = c.req.param('matchId');
      const matchKey = `match:${userProfile.currentGroup}:${matchId}`;

      // Get the match to verify it exists and get ELO changes
      const match = await kv.get(matchKey);
      if (!match) {
        return c.json({ error: 'Match not found' }, 404);
      }

      console.log('Found match to delete:', matchId);

      // Check if user is admin or if they recorded this match
      const groupData = await kv.get(`group:${userProfile.currentGroup}`);
      const isAdmin =
        groupData && groupData.admins && groupData.admins.includes(authResult.user.id);
      const isRecorder = match.recordedBy === authResult.user.id;

      if (!isAdmin && !isRecorder) {
        return c.json({ error: 'Only admins or the match recorder can delete matches' }, 403);
      }

      // Reverse the ELO and stats changes
      await reverseMatchStats(match);

      // Delete the match
      await kv.del(matchKey);

      console.log('Match deleted successfully:', matchId);
      return c.json({
        message: 'Match deleted successfully',
        matchId,
      });
    } catch (error) {
      console.error('=== Delete match error ===', error);
      return c.json({ error: 'Internal server error while deleting match' }, 500);
    }
  });

  // Helper function to reverse match stats and ELO changes
  async function reverseMatchStats(match: any) {
    try {
      console.log('Reversing stats for match:', match.id);

      if (match.matchType === '1v1') {
        // Reverse 1v1 stats
        const player1Id =
          (await kv.get(`user:username:${match.player1Email}`)) ||
          (await kv.get(`user:email:${match.player1Email}`));
        const player2Id =
          (await kv.get(`user:username:${match.player2Email}`)) ||
          (await kv.get(`user:email:${match.player2Email}`));

        if (player1Id && player2Id) {
          const player1Profile = await kv.get(`user:${player1Id}`);
          const player2Profile = await kv.get(`user:${player2Id}`);

          if (player1Profile && player2Profile) {
            const isPlayer1Winner = match.winnerEmail === match.player1Email;

            // Get ELO changes from match record
            const player1EloChange = match.eloChanges?.[match.player1Email];
            const player2EloChange = match.eloChanges?.[match.player2Email];

            // Reverse player 1 stats
            const updatedPlayer1 = {
              ...player1Profile,
              singlesWins: Math.max(
                0,
                (player1Profile.singlesWins || 0) - (isPlayer1Winner ? 1 : 0)
              ),
              singlesLosses: Math.max(
                0,
                (player1Profile.singlesLosses || 0) - (isPlayer1Winner ? 0 : 1)
              ),
              singlesElo: player1EloChange
                ? player1EloChange.oldRating
                : player1Profile.singlesElo || INITIAL_ELO,
              // Legacy fields
              wins: Math.max(0, (player1Profile.wins || 0) - (isPlayer1Winner ? 1 : 0)),
              losses: Math.max(0, (player1Profile.losses || 0) - (isPlayer1Winner ? 0 : 1)),
              elo: player1EloChange
                ? player1EloChange.oldRating
                : player1Profile.elo || INITIAL_ELO,
            };

            // Reverse player 2 stats
            const updatedPlayer2 = {
              ...player2Profile,
              singlesWins: Math.max(
                0,
                (player2Profile.singlesWins || 0) - (isPlayer1Winner ? 0 : 1)
              ),
              singlesLosses: Math.max(
                0,
                (player2Profile.singlesLosses || 0) - (isPlayer1Winner ? 1 : 0)
              ),
              singlesElo: player2EloChange
                ? player2EloChange.oldRating
                : player2Profile.singlesElo || INITIAL_ELO,
              // Legacy fields
              wins: Math.max(0, (player2Profile.wins || 0) - (isPlayer1Winner ? 0 : 1)),
              losses: Math.max(0, (player2Profile.losses || 0) - (isPlayer1Winner ? 1 : 0)),
              elo: player2EloChange
                ? player2EloChange.oldRating
                : player2Profile.elo || INITIAL_ELO,
            };

            await kv.set(`user:${player1Id}`, updatedPlayer1);
            await kv.set(`user:${player2Id}`, updatedPlayer2);

            console.log('1v1 stats reversed successfully');
          }
        }
      } else if (match.matchType === '2v2') {
        // Reverse 2v2 stats
        const team1Player1Id =
          (await kv.get(`user:username:${match.team1Player1Email}`)) ||
          (await kv.get(`user:email:${match.team1Player1Email}`));
        const team1Player2Id =
          (await kv.get(`user:username:${match.team1Player2Email}`)) ||
          (await kv.get(`user:email:${match.team1Player2Email}`));
        const team2Player1Id =
          (await kv.get(`user:username:${match.team2Player1Email}`)) ||
          (await kv.get(`user:email:${match.team2Player1Email}`));
        const team2Player2Id =
          (await kv.get(`user:username:${match.team2Player2Email}`)) ||
          (await kv.get(`user:email:${match.team2Player2Email}`));

        if (team1Player1Id && team1Player2Id && team2Player1Id && team2Player2Id) {
          const team1Player1Profile = await kv.get(`user:${team1Player1Id}`);
          const team1Player2Profile = await kv.get(`user:${team1Player2Id}`);
          const team2Player1Profile = await kv.get(`user:${team2Player1Id}`);
          const team2Player2Profile = await kv.get(`user:${team2Player2Id}`);

          if (
            team1Player1Profile &&
            team1Player2Profile &&
            team2Player1Profile &&
            team2Player2Profile
          ) {
            const isTeam1Winner = match.winningTeam === 'team1';

            // Get ELO changes from match record
            const team1Player1EloChange = match.eloChanges?.[match.team1Player1Email];
            const team1Player2EloChange = match.eloChanges?.[match.team1Player2Email];
            const team2Player1EloChange = match.eloChanges?.[match.team2Player1Email];
            const team2Player2EloChange = match.eloChanges?.[match.team2Player2Email];

            // Reverse team 1 player 1
            const updatedTeam1Player1 = {
              ...team1Player1Profile,
              doublesWins: Math.max(
                0,
                (team1Player1Profile.doublesWins || 0) - (isTeam1Winner ? 1 : 0)
              ),
              doublesLosses: Math.max(
                0,
                (team1Player1Profile.doublesLosses || 0) - (isTeam1Winner ? 0 : 1)
              ),
              doublesElo: team1Player1EloChange
                ? team1Player1EloChange.oldRating
                : team1Player1Profile.doublesElo || INITIAL_ELO,
            };

            // Reverse team 1 player 2
            const updatedTeam1Player2 = {
              ...team1Player2Profile,
              doublesWins: Math.max(
                0,
                (team1Player2Profile.doublesWins || 0) - (isTeam1Winner ? 1 : 0)
              ),
              doublesLosses: Math.max(
                0,
                (team1Player2Profile.doublesLosses || 0) - (isTeam1Winner ? 0 : 1)
              ),
              doublesElo: team1Player2EloChange
                ? team1Player2EloChange.oldRating
                : team1Player2Profile.doublesElo || INITIAL_ELO,
            };

            // Reverse team 2 player 1
            const updatedTeam2Player1 = {
              ...team2Player1Profile,
              doublesWins: Math.max(
                0,
                (team2Player1Profile.doublesWins || 0) - (isTeam1Winner ? 0 : 1)
              ),
              doublesLosses: Math.max(
                0,
                (team2Player1Profile.doublesLosses || 0) - (isTeam1Winner ? 1 : 0)
              ),
              doublesElo: team2Player1EloChange
                ? team2Player1EloChange.oldRating
                : team2Player1Profile.doublesElo || INITIAL_ELO,
            };

            // Reverse team 2 player 2
            const updatedTeam2Player2 = {
              ...team2Player2Profile,
              doublesWins: Math.max(
                0,
                (team2Player2Profile.doublesWins || 0) - (isTeam1Winner ? 0 : 1)
              ),
              doublesLosses: Math.max(
                0,
                (team2Player2Profile.doublesLosses || 0) - (isTeam1Winner ? 1 : 0)
              ),
              doublesElo: team2Player2EloChange
                ? team2Player2EloChange.oldRating
                : team2Player2Profile.doublesElo || INITIAL_ELO,
            };

            await kv.set(`user:${team1Player1Id}`, updatedTeam1Player1);
            await kv.set(`user:${team1Player2Id}`, updatedTeam1Player2);
            await kv.set(`user:${team2Player1Id}`, updatedTeam2Player1);
            await kv.set(`user:${team2Player2Id}`, updatedTeam2Player2);

            console.log('2v2 stats reversed successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error reversing match stats:', error);
    }
  }

  return app;
}
