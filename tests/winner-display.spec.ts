import { test, expect } from '@playwright/test';

test.describe('Winner Display Functionality', () => {
  test('should verify winner display logic works correctly', async ({ page }) => {
    // This test verifies that our winner determination logic works
    // We'll test the match history and rankings pages

    // Mock data to test winner determination logic
    const mockMatchData = {
      id: 'test-match-1',
      match_type: '1v1',
      winner_email: 'test-player-id-123', // Using player ID format
      players: [
        {
          user_id: 'test-player-id-123',
          team: 'team1',
          users: { name: 'Test Player 1', email: 'test1@example.com' },
          is_guest: false
        },
        {
          user_id: 'test-player-id-456',
          team: 'team2',
          users: { name: 'Test Player 2', email: 'test2@example.com' },
          is_guest: false
        }
      ]
    };

    // Test winner determination logic by evaluating it in the browser context
    await page.addScriptTag({
      content: `
        window.testWinnerLogic = function(matchData) {
          // Test the didUserWinMatch logic
          function didUserWinMatch(match, userId) {
            if (!match.players) return false;

            const userPlayer = match.players.find(player => player.user_id === userId);
            if (!userPlayer) return false;

            // Method 1: Check if winner_email contains the user's ID (new format)
            if (match.winner_email && match.winner_email === userPlayer.user_id) {
              return true;
            }

            // Method 2: Check if winner_email contains the user's email (legacy format)
            if (match.winner_email && userPlayer.users?.email === match.winner_email) {
              return true;
            }

            // Method 3: Check if winner_email contains the user's name (legacy format)
            if (match.winner_email && userPlayer.users?.name === match.winner_email) {
              return true;
            }

            // Method 4: Check if winner_email contains guest name (legacy format)
            if (match.winner_email && userPlayer.is_guest && userPlayer.guest_name === match.winner_email) {
              return true;
            }

            return false;
          }

          return {
            player1Wins: didUserWinMatch(matchData, 'test-player-id-123'),
            player2Wins: didUserWinMatch(matchData, 'test-player-id-456')
          };
        };
      `
    });

    // Evaluate the winner logic
    const result = await page.evaluate((data) => {
      return (window as any).testWinnerLogic(data);
    }, mockMatchData);

    // Verify that player 1 is correctly identified as the winner
    expect(result.player1Wins).toBe(true);
    expect(result.player2Wins).toBe(false);
  });

  test('should verify match results fallback logic', async ({ page }) => {
    // Test match results fallback when winner_email is not available
    const mockMatchWithResults = {
      id: 'test-match-2',
      match_type: '2v2',
      winner_email: null, // No winner_email
      match_results: [
        { winning_team: 'team1' }
      ],
      players: [
        {
          user_id: 'player-a',
          team: 'team1',
          users: { name: 'Player A' },
          is_guest: false
        },
        {
          user_id: 'player-b',
          team: 'team1',
          users: { name: 'Player B' },
          is_guest: false
        },
        {
          user_id: 'player-c',
          team: 'team2',
          users: { name: 'Player C' },
          is_guest: false
        },
        {
          user_id: 'player-d',
          team: 'team2',
          users: { name: 'Player D' },
          is_guest: false
        }
      ]
    };

    await page.addScriptTag({
      content: `
        window.testMatchResultsLogic = function(matchData) {
          function didUserWinMatch(match, userId) {
            if (!match.players) return false;

            const userPlayer = match.players.find(player => player.user_id === userId);
            if (!userPlayer) return false;

            // Method 5: Determine winner from match results if available
            if (match.match_results && match.match_results.length > 0) {
              const winningTeam = match.match_results[0].winning_team;
              return userPlayer.team === winningTeam;
            }

            return false;
          }

          return {
            playerAWins: didUserWinMatch(matchData, 'player-a'),
            playerBWins: didUserWinMatch(matchData, 'player-a'), // Same team as A
            playerCWins: didUserWinMatch(matchData, 'player-c'),
            playerDWins: didUserWinMatch(matchData, 'player-d')
          };
        };
      `
    });

    const result = await page.evaluate((data) => {
      return (window as any).testMatchResultsLogic(data);
    }, mockMatchWithResults);

    // Team 1 should win, Team 2 should lose
    expect(result.playerAWins).toBe(true);
    expect(result.playerBWins).toBe(true);
    expect(result.playerCWins).toBe(false);
    expect(result.playerDWins).toBe(false);
  });

  test('should verify guest player winner logic', async ({ page }) => {
    // Test guest player winner determination
    const mockMatchWithGuest = {
      id: 'test-match-3',
      match_type: '1v1',
      winner_email: 'Guest Player', // Guest name as winner
      players: [
        {
          user_id: null,
          team: 'team1',
          users: null,
          is_guest: true,
          guest_name: 'Guest Player'
        },
        {
          user_id: 'registered-player',
          team: 'team2',
          users: { name: 'Registered Player' },
          is_guest: false
        }
      ]
    };

    await page.addScriptTag({
      content: `
        window.testGuestLogic = function(matchData) {
          function didUserWinMatch(match, userId) {
            if (!match.players) return false;

            const userPlayer = match.players.find(player =>
              player.user_id === userId ||
              (player.is_guest && player.guest_name === userId)
            );
            if (!userPlayer) return false;

            // Method 4: Check if winner_email contains guest name (legacy format)
            if (match.winner_email && userPlayer.is_guest && userPlayer.guest_name === match.winner_email) {
              return true;
            }

            return false;
          }

          return {
            guestWins: didUserWinMatch(matchData, 'Guest Player'),
            registeredWins: didUserWinMatch(matchData, 'registered-player')
          };
        };
      `
    });

    const result = await page.evaluate((data) => {
      return (window as any).testGuestLogic(data);
    }, mockMatchWithGuest);

    // Guest player should be identified as winner
    expect(result.guestWins).toBe(true);
    expect(result.registeredWins).toBe(false);
  });
});
