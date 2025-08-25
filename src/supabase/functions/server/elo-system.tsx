import { INITIAL_ELO, K_FACTOR } from './server-constants.tsx';

// Original function for 1v1 matches (unchanged)
function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

// New function for foosball with divisor of 500
function calculateExpectedScoreFoosball(playerRating: number, opponent1Rating: number, opponent2Rating: number): number {
  const e1 = 1 / (1 + Math.pow(10, (opponent1Rating - playerRating) / 500));
  const e2 = 1 / (1 + Math.pow(10, (opponent2Rating - playerRating) / 500));
  return (e1 + e2) / 2;
}

// Dynamic K-factor based on games played
function getKFactor(gamesPlayed: number): number {
  return 50 / (1 + gamesPlayed / 300);
}

function calculateNewELO(currentRating: number, expectedScore: number, actualScore: number, multiplier: number = 1): number {
  const newRating = currentRating + K_FACTOR * (actualScore - expectedScore) * multiplier;
  return Math.round(newRating);
}

// For 1v1 matches (keeping the original implementation)
export function calculateELOChanges(player1Rating: number, player2Rating: number, player1Won: boolean, multiplier: number = 1) {
  const player1Expected = calculateExpectedScore(player1Rating, player2Rating);
  const player2Expected = calculateExpectedScore(player2Rating, player1Rating);
  
  const player1Actual = player1Won ? 1 : 0;
  const player2Actual = player1Won ? 0 : 1;
  
  const newPlayer1Rating = calculateNewELO(player1Rating, player1Expected, player1Actual, multiplier);
  const newPlayer2Rating = calculateNewELO(player2Rating, player2Expected, player2Actual, multiplier);
  
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

// Type definitions for the new system
type PlayerInfo = {
  rating: number;
  gamesPlayed: number;
};

type EloChange = {
  oldRating: number;
  newRating: number;
  change: number;
};

// Simplified 2v2 foosball ELO calculation for win/loss only
export function calculate2v2FoosballEloSimple(
  team1Player1: PlayerInfo,
  team1Player2: PlayerInfo,
  team2Player1: PlayerInfo,
  team2Player2: PlayerInfo,
  team1Won: boolean,
  multiplier: number = 1
): { [key: string]: EloChange } {
  // Actual result for each team
  const actualTeam1 = team1Won ? 1 : 0;
  const actualTeam2 = team1Won ? 0 : 1;

  // Get player ratings
  const t1p1 = team1Player1.rating;
  const t1p2 = team1Player2.rating;
  const t2p1 = team2Player1.rating;
  const t2p2 = team2Player2.rating;

  // Expected scores for each player (average vs both opponents)
  const t1p1Expected = calculateExpectedScoreFoosball(t1p1, t2p1, t2p2);
  const t1p2Expected = calculateExpectedScoreFoosball(t1p2, t2p1, t2p2);
  const t2p1Expected = calculateExpectedScoreFoosball(t2p1, t1p1, t1p2);
  const t2p2Expected = calculateExpectedScoreFoosball(t2p2, t1p1, t1p2);

  // K-factor for each player
  const t1p1K = getKFactor(team1Player1.gamesPlayed);
  const t1p2K = getKFactor(team1Player2.gamesPlayed);
  const t2p1K = getKFactor(team2Player1.gamesPlayed);
  const t2p2K = getKFactor(team2Player2.gamesPlayed);

  // ELO update (no point factor, just win/loss)
  const t1p1New = Math.round(t1p1 + (t1p1K * multiplier) * (actualTeam1 - t1p1Expected));
  const t1p2New = Math.round(t1p2 + (t1p2K * multiplier) * (actualTeam1 - t1p2Expected));
  const t2p1New = Math.round(t2p1 + (t2p1K * multiplier) * (actualTeam2 - t2p1Expected));
  const t2p2New = Math.round(t2p2 + (t2p2K * multiplier) * (actualTeam2 - t2p2Expected));

  return {
    team1Player1: { oldRating: t1p1, newRating: t1p1New, change: t1p1New - t1p1 },
    team1Player2: { oldRating: t1p2, newRating: t1p2New, change: t1p2New - t1p2 },
    team2Player1: { oldRating: t2p1, newRating: t2p1New, change: t2p1New - t2p1 },
    team2Player2: { oldRating: t2p2, newRating: t2p2New, change: t2p2New - t2p2 }
  };
}

// Legacy function for backward compatibility (still used for old matches)
export function calculateTeamELOChanges(
  team1Player1Rating: number, 
  team1Player2Rating: number,
  team2Player1Rating: number, 
  team2Player2Rating: number,
  team1Won: boolean,
  multiplier: number = 1
) {
  const team1AvgRating = (team1Player1Rating + team1Player2Rating) / 2;
  const team2AvgRating = (team2Player1Rating + team2Player2Rating) / 2;
  
  const team1Expected = calculateExpectedScore(team1AvgRating, team2AvgRating);
  const team2Expected = calculateExpectedScore(team2AvgRating, team1AvgRating);
  
  const team1Actual = team1Won ? 1 : 0;
  const team2Actual = team1Won ? 0 : 1;
  
  const newTeam1Rating = calculateNewELO(team1AvgRating, team1Expected, team1Actual, multiplier);
  const newTeam2Rating = calculateNewELO(team2AvgRating, team2Expected, team2Actual, multiplier);
  
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