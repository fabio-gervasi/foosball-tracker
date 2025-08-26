import { INITIAL_ELO, K_FACTOR } from './constants.tsx';

function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function calculateNewELO(currentRating: number, expectedScore: number, actualScore: number): number {
  const newRating = currentRating + K_FACTOR * (actualScore - expectedScore);
  return Math.round(newRating);
}

// For 1v1 matches
export function calculateELOChanges(player1Rating: number, player2Rating: number, player1Won: boolean) {
  const player1Expected = calculateExpectedScore(player1Rating, player2Rating);
  const player2Expected = calculateExpectedScore(player2Rating, player1Rating);

  const player1Actual = player1Won ? 1 : 0;
  const player2Actual = player1Won ? 0 : 1;

  const newPlayer1Rating = calculateNewELO(player1Rating, player1Expected, player1Actual);
  const newPlayer2Rating = calculateNewELO(player2Rating, player2Expected, player2Actual);

  return {
    player1: {
      oldRating: player1Rating,
      newRating: newPlayer1Rating,
      change: newPlayer1Rating - player1Rating
    },
    player2: {
      oldRating: player2Rating,
      newRating: newPlayer2Rating,
      change: newPlayer2Rating - player2Rating
    }
  };
}

// For 2v2 matches - team ELO is average of both players
export function calculateTeamELOChanges(
  team1Player1Rating: number,
  team1Player2Rating: number,
  team2Player1Rating: number,
  team2Player2Rating: number,
  team1Won: boolean
) {
  const team1AvgRating = (team1Player1Rating + team1Player2Rating) / 2;
  const team2AvgRating = (team2Player1Rating + team2Player2Rating) / 2;

  const team1Expected = calculateExpectedScore(team1AvgRating, team2AvgRating);
  const team2Expected = calculateExpectedScore(team2AvgRating, team1AvgRating);

  const team1Actual = team1Won ? 1 : 0;
  const team2Actual = team1Won ? 0 : 1;

  const newTeam1Rating = calculateNewELO(team1AvgRating, team1Expected, team1Actual);
  const newTeam2Rating = calculateNewELO(team2AvgRating, team2Expected, team2Actual);

  const team1Change = newTeam1Rating - team1AvgRating;
  const team2Change = newTeam2Rating - team2AvgRating;

  return {
    team1Player1: {
      oldRating: team1Player1Rating,
      newRating: team1Player1Rating + team1Change,
      change: team1Change
    },
    team1Player2: {
      oldRating: team1Player2Rating,
      newRating: team1Player2Rating + team1Change,
      change: team1Change
    },
    team2Player1: {
      oldRating: team2Player1Rating,
      newRating: team2Player1Rating + team2Change,
      change: team2Change
    },
    team2Player2: {
      oldRating: team2Player2Rating,
      newRating: team2Player2Rating + team2Change,
      change: team2Change
    }
  };
}
