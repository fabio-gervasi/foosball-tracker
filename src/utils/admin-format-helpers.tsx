import type { Match, MatchPlayer } from '../types';

export const formatMatchDisplay = (match: Match | null) => {
  if (!match) {
    return {
      participants: 'Unknown match',
      winner: 'Unknown',
      type: 'Unknown',
    };
  }

  // Handle relational database structure (new format)
  if (match.players && Array.isArray(match.players)) {
    return formatRelationalMatchDisplay(match);
  }

  // Handle legacy structure (old format)
  if (match.matchType === '2v2') {
    if (!match.team1 || !match.team2) {
      return {
        participants: 'Invalid 2v2 match data',
        winner: 'Unknown',
        type: '2v2',
      };
    }

    const team1Player1Name = match.team1.player1?.name || 'Unknown';
    const team1Player2Name = match.team1.player2?.name || 'Unknown';
    const team2Player1Name = match.team2.player1?.name || 'Unknown';
    const team2Player2Name = match.team2.player2?.name || 'Unknown';

    const team1Names = `${team1Player1Name} & ${team1Player2Name}`;
    const team2Names = `${team2Player1Name} & ${team2Player2Name}`;
    const winnerNames = match.winningTeam === 'team1' ? team1Names : team2Names;

    return {
      participants: `${team1Names} vs ${team2Names}`,
      winner: winnerNames,
      type: '2v2',
    };
  } else {
    // 1v1 match
    if (!match.player1 || !match.player2) {
      return {
        participants: 'Invalid 1v1 match data',
        winner: 'Unknown',
        type: '1v1',
      };
    }

    const player1Name = match.player1.name || 'Unknown';
    const player2Name = match.player2.name || 'Unknown';
    const winnerName = match.winner?.name || 'Unknown';

    return {
      participants: `${player1Name} vs ${player2Name}`,
      winner: winnerName,
      type: '1v1',
    };
  }
};

/**
 * Format match display for relational database structure
 */
const formatRelationalMatchDisplay = (match: Match) => {
  const matchType = match.match_type || match.matchType || '1v1';

  // Debug logging
  console.info('🔍 Formatting match:', {
    id: match.id,
    matchType,
    winnerEmail: match.winner_email,
    playersCount: match.players?.length || 0,
    players: match.players?.map(p => ({
      team: p.team,
      position: p.position,
      isGuest: p.is_guest,
      guestName: p.guest_name,
      userEmail: p.users?.email,
      userName: p.users?.name,
    })),
  });

  if (matchType === '2v2') {
    // Group players by team
    const team1Players = match.players?.filter(p => p.team === 'team1') || [];
    const team2Players = match.players?.filter(p => p.team === 'team2') || [];

    console.info('🔍 Team players:', {
      team1Count: team1Players.length,
      team2Count: team2Players.length,
      team1Players: team1Players.map(p => ({ position: p.position, name: getPlayerName(p) })),
      team2Players: team2Players.map(p => ({ position: p.position, name: getPlayerName(p) })),
    });

    // Handle incomplete data more gracefully - show what we have
    if (team1Players.length === 0 && team2Players.length === 0) {
      return {
        participants: 'Incomplete Match Data',
        winner: 'Cannot determine winner',
        type: '2v2',
        status: 'incomplete',
      };
    }

    // Get player names - collect all players from each team, regardless of position
    const team1Names =
      team1Players.length > 0
        ? team1Players
            .map(p => getPlayerName(p))
            .filter(name => name !== 'Unknown')
            .join(' & ')
        : 'Unknown Team';
    const team2Names =
      team2Players.length > 0
        ? team2Players
            .map(p => getPlayerName(p))
            .filter(name => name !== 'Unknown')
            .join(' & ')
        : 'Unknown Team';

    console.info('🔍 Player names:', {
      team1Names,
      team2Names,
    });

    // Determine winner based on winner_email, winner_player_id, or match results
    let winnerNames = 'Unknown';

    // First try winner_email (could be player ID or email)
    if (match.winner_email) {
      // Check if winner_email contains a player ID (UUID format) or guest identifier
      const isPlayerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        match.winner_email
      );
      const isGuestIdentifier = match.winner_email.startsWith('guest:');

      if (isPlayerId) {
        // winner_email contains a player ID - find player by ID
        const winnerPlayer = [...team1Players, ...team2Players].find(
          p => p.user_id === match.winner_email
        );
        if (winnerPlayer) {
          if (team1Players.some(p => p.user_id === match.winner_email)) {
            winnerNames = team1Names;
          } else if (team2Players.some(p => p.user_id === match.winner_email)) {
            winnerNames = team2Names;
          }
        }
      } else if (isGuestIdentifier) {
        // winner_email contains guest identifier - find guest by name
        const guestName = match.winner_email.substring(6); // Remove 'guest:' prefix
        const winnerPlayer = [...team1Players, ...team2Players].find(
          p => p.is_guest && p.guest_name === guestName
        );
        if (winnerPlayer) {
          if (team1Players.some(p => p.is_guest && p.guest_name === guestName)) {
            winnerNames = team1Names;
          } else if (team2Players.some(p => p.is_guest && p.guest_name === guestName)) {
            winnerNames = team2Names;
          }
        }
      } else {
        // Fallback to email matching (legacy support)
        const team1Emails = team1Players
          .map(p => p.users?.email || (p.is_guest ? `guest:${p.guest_name}` : ''))
          .filter(email => email);
        const team2Emails = team2Players
          .map(p => p.users?.email || (p.is_guest ? `guest:${p.guest_name}` : ''))
          .filter(email => email);

        if (team1Emails.includes(match.winner_email)) {
          winnerNames = team1Names;
        } else if (team2Emails.includes(match.winner_email)) {
          winnerNames = team2Names;
        }
      }

      console.info('🔍 Winner determination (winner_email):', {
        winnerEmail: match.winner_email,
        isPlayerId,
        isGuestIdentifier,
        winnerNames,
      });
    } else if (match.results && match.results.length > 0) {
      // Fallback to match results if winner_email is not available
      const winningTeam = match.results[0].winning_team;
      console.info('🔍 Winner determination (match results):', {
        winningTeam,
        availableResults: match.results.length,
      });

      if (winningTeam === 'team1') {
        winnerNames = team1Names;
      } else if (winningTeam === 'team2') {
        winnerNames = team2Names;
      }
    }

    return {
      participants: `${team1Names} vs ${team2Names}`,
      winner: winnerNames,
      type: '2v2',
    };
  } else {
    // 1v1 match - collect all players, don't rely on position
    const allPlayers = match.players || [];

    console.info('🔍 1v1 players:', {
      totalPlayers: allPlayers.length,
      players: allPlayers.map(p => ({
        position: p.position,
        team: p.team,
        name: getPlayerName(p),
      })),
    });

    if (allPlayers.length === 0) {
      return {
        participants: 'Incomplete Match Data',
        winner: 'Cannot determine winner',
        type: '1v1',
        status: 'incomplete',
      };
    }

    // For 1v1, just take the first two players regardless of position/team
    const player1 = allPlayers[0];
    const player2 = allPlayers[1];

    if (!player1) {
      return {
        participants: 'Incomplete Match Data',
        winner: 'Cannot determine winner',
        type: '1v1',
        status: 'incomplete',
      };
    }

    const player1Name = getPlayerName(player1);
    const player2Name = player2 ? getPlayerName(player2) : 'Unknown';

    // Determine winner based on winner_email, winner_player_id, or match results
    let winnerName = 'Unknown';

    // First try winner_email (could be player ID or email)
    if (match.winner_email) {
      // Check if winner_email contains a player ID (UUID format) or guest identifier
      const isPlayerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        match.winner_email
      );
      const isGuestIdentifier = match.winner_email.startsWith('guest:');

      if (isPlayerId) {
        // winner_email contains a player ID - find player by ID
        if (player1.user_id === match.winner_email) {
          winnerName = player1Name;
        } else if (player2 && player2.user_id === match.winner_email) {
          winnerName = player2Name;
        }
      } else if (isGuestIdentifier) {
        // winner_email contains guest identifier - find guest by name
        const guestName = match.winner_email.substring(6); // Remove 'guest:' prefix
        if (player1.is_guest && player1.guest_name === guestName) {
          winnerName = player1Name;
        } else if (player2 && player2.is_guest && player2.guest_name === guestName) {
          winnerName = player2Name;
        }
      } else {
        // Fallback to email matching (legacy support)
        const player1Email =
          player1.users?.email || (player1.is_guest ? `guest:${player1.guest_name}` : '');
        const player2Email = player2
          ? player2.users?.email || (player2.is_guest ? `guest:${player2.guest_name}` : '')
          : '';

        if (player1Email === match.winner_email) {
          winnerName = player1Name;
        } else if (player2Email === match.winner_email) {
          winnerName = player2Name;
        }
      }

      console.info('🔍 1v1 winner determination (winner_email):', {
        winnerEmail: match.winner_email,
        isPlayerId,
        isGuestIdentifier,
        winnerName,
      });
    } else if (match.results && match.results.length > 0) {
      // Fallback to match results if winner_email is not available
      // For 1v1, winner is determined by who won the game (player1 if team1 won, player2 if team2 won)
      const winningTeam = match.results[0].winning_team;
      console.info('🔍 1v1 winner determination (match results):', {
        winningTeam,
        availableResults: match.results.length,
      });

      if (winningTeam === 'team1') {
        winnerName = player1Name;
      } else if (winningTeam === 'team2' && player2) {
        winnerName = player2Name;
      }
    }

    const participants = player2 ? `${player1Name} vs ${player2Name}` : `${player1Name} vs Unknown`;

    return {
      participants,
      winner: winnerName,
      type: '1v1',
    };
  }
};

/**
 * Get player name from MatchPlayer, handling both registered users and guests
 */
const getPlayerName = (player: MatchPlayer | undefined): string => {
  if (!player) return 'Unknown';

  if (player.is_guest && player.guest_name) {
    return player.guest_name;
  }

  if (player.users?.name) {
    return player.users.name;
  }

  return 'Unknown';
};
