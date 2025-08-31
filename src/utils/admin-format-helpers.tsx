import type { Match } from '../../types';

export const formatMatchDisplay = (match: Match | null) => {
  if (!match) {
    return {
      participants: 'Unknown match',
      winner: 'Unknown',
      type: 'Unknown',
    };
  }

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
