export const formatMatchDisplay = (match: any, users: any[]) => {
  if (!match) {
    return {
      participants: 'Unknown match',
      winner: 'Unknown',
      type: 'Unknown',
    };
  }

  // Helper function to get display name from email/username
  const getPlayerDisplayName = (email: string) => {
    if (!email) return 'Unknown';

    // Find user by email or username
    const user = users.find(u => u.email === email || u.username === email);
    if (user) {
      return user.username || user.name || user.email;
    }

    // If not found in users list, check if it's a guest player
    if (email.startsWith('guest')) {
      return email.replace('guest-', 'Guest ');
    }

    return email;
  };

  if (match.matchType === '2v2') {
    // Check for 2v2 match fields
    if (
      !match.team1Player1Email ||
      !match.team1Player2Email ||
      !match.team2Player1Email ||
      !match.team2Player2Email
    ) {
      return {
        participants: 'Invalid 2v2 match data',
        winner: 'Unknown',
        type: '2v2',
      };
    }

    const team1Player1 = getPlayerDisplayName(match.team1Player1Email);
    const team1Player2 = getPlayerDisplayName(match.team1Player2Email);
    const team2Player1 = getPlayerDisplayName(match.team2Player1Email);
    const team2Player2 = getPlayerDisplayName(match.team2Player2Email);

    const team1Names = `${team1Player1} & ${team1Player2}`;
    const team2Names = `${team2Player1} & ${team2Player2}`;
    const winnerNames = match.winningTeam === 'team1' ? team1Names : team2Names;

    return {
      participants: `${team1Names} vs ${team2Names}`,
      winner: `${winnerNames}`,
      type: '2v2',
    };
  } else {
    // 1v1 match
    if (!match.player1Email || !match.player2Email) {
      return {
        participants: 'Invalid 1v1 match data',
        winner: 'Unknown',
        type: '1v1',
      };
    }

    const player1Name = getPlayerDisplayName(match.player1Email);
    const player2Name = getPlayerDisplayName(match.player2Email);
    const winnerName = match.winnerEmail ? getPlayerDisplayName(match.winnerEmail) : 'Unknown';

    return {
      participants: `${player1Name} vs ${player2Name}`,
      winner: winnerName,
      type: '1v1',
    };
  }
};
