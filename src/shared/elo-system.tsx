// Consolidated ELO system for both client and server environments
// Platform-aware implementation that works in browser and Deno

// Environment detection
const isServer = typeof Deno !== 'undefined';
const isBrowser = typeof window !== 'undefined';

// Constants - use fallback values for now, can be configured per environment
const INITIAL_ELO = 1000;
const K_FACTOR = 32;

// Original function for 1v1 matches (unchanged)
function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

// New function for foosball with divisor of 500
function calculateExpectedScoreFoosball(
  playerRating: number,
  opponent1Rating: number,
  opponent2Rating: number
): number {
  const e1 = 1 / (1 + Math.pow(10, (opponent1Rating - playerRating) / 500));
  const e2 = 1 / (1 + Math.pow(10, (opponent2Rating - playerRating) / 500));
  return (e1 + e2) / 2;
}

// Dynamic K-factor based on games played
function getKFactor(gamesPlayed: number): number {
  return 50 / (1 + gamesPlayed / 300);
}

function calculateNewELO(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  multiplier: number = 1
): number {
  const newRating = currentRating + K_FACTOR * (actualScore - expectedScore) * multiplier;
  return Math.round(newRating);
}

// For 1v1 matches (keeping the original implementation)
export function calculateELOChanges(
  player1Rating: number,
  player2Rating: number,
  player1Won: boolean,
  multiplier: number = 1
) {
  const player1Expected = calculateExpectedScore(player1Rating, player2Rating);
  const player2Expected = calculateExpectedScore(player2Rating, player1Rating);

  const player1Actual = player1Won ? 1 : 0;
  const player2Actual = player1Won ? 0 : 1;

  const newPlayer1Rating = calculateNewELO(
    player1Rating,
    player1Expected,
    player1Actual,
    multiplier
  );
  const newPlayer2Rating = calculateNewELO(
    player2Rating,
    player2Expected,
    player2Actual,
    multiplier
  );

  return {
    player1: {
      oldRating: player1Rating,
      newRating: newPlayer1Rating,
      change: newPlayer1Rating - player1Rating,
    },
    player2: {
      oldRating: player2Rating,
      newRating: newPlayer2Rating,
      change: newPlayer2Rating - player2Rating,
    },
  };
}

// Type definitions for the new system
export interface ELOResult {
  oldRating: number;
  newRating: number;
  change: number;
}

export interface MatchELOResult {
  player1: ELOResult;
  player2: ELOResult;
}

export interface TeamELOResult {
  team1Player1: ELOResult;
  team1Player2: ELOResult;
  team2Player1: ELOResult;
  team2Player2: ELOResult;
}

// For 2v2 matches - team ELO is average of both players
export function calculateTeamELOChanges(
  team1Player1Rating: number,
  team1Player2Rating: number,
  team2Player1Rating: number,
  team2Player2Rating: number,
  team1Won: boolean,
  multiplier: number = 1
): TeamELOResult {
  const team1AvgRating = (team1Player1Rating + team1Player2Rating) / 2;
  const team2AvgRating = (team2Player1Rating + team2Player2Rating) / 2;

  const team1Expected = calculateExpectedScore(team1AvgRating, team2AvgRating);
  const team2Expected = calculateExpectedScore(team2AvgRating, team1AvgRating);

  const team1Actual = team1Won ? 1 : 0;
  const team2Actual = team1Won ? 0 : 1;

  // Calculate changes for each player based on team performance
  const team1Player1Change = K_FACTOR * (team1Actual - team1Expected) * multiplier;
  const team1Player2Change = K_FACTOR * (team1Actual - team1Expected) * multiplier;
  const team2Player1Change = K_FACTOR * (team2Actual - team2Expected) * multiplier;
  const team2Player2Change = K_FACTOR * (team2Actual - team2Expected) * multiplier;

  return {
    team1Player1: {
      oldRating: team1Player1Rating,
      newRating: Math.round(team1Player1Rating + team1Player1Change),
      change: Math.round(team1Player1Change),
    },
    team1Player2: {
      oldRating: team1Player2Rating,
      newRating: Math.round(team1Player2Rating + team1Player2Change),
      change: Math.round(team1Player2Change),
    },
    team2Player1: {
      oldRating: team2Player1Rating,
      newRating: Math.round(team2Player1Rating + team2Player1Change),
      change: Math.round(team2Player1Change),
    },
    team2Player2: {
      oldRating: team2Player2Rating,
      newRating: Math.round(team2Player2Rating + team2Player2Change),
      change: Math.round(team2Player2Change),
    },
  };
}

// Advanced ELO calculation for foosball (from server version)
export function calculateFoosballELOChanges(
  player1Rating: number,
  player2Rating: number,
  player3Rating: number,
  player4Rating: number,
  team1Won: boolean,
  gamesPlayed1: number = 0,
  gamesPlayed2: number = 0,
  gamesPlayed3: number = 0,
  gamesPlayed4: number = 0
): TeamELOResult {
  // Use dynamic K-factor based on games played
  const kFactor1 = getKFactor(gamesPlayed1);
  const kFactor2 = getKFactor(gamesPlayed2);
  const kFactor3 = getKFactor(gamesPlayed3);
  const kFactor4 = getKFactor(gamesPlayed4);

  // Calculate expected scores using foosball-specific function
  const player1Expected = calculateExpectedScoreFoosball(
    player1Rating,
    player3Rating,
    player4Rating
  );
  const player2Expected = calculateExpectedScoreFoosball(
    player2Rating,
    player3Rating,
    player4Rating
  );
  const player3Expected = calculateExpectedScoreFoosball(
    player3Rating,
    player1Rating,
    player2Rating
  );
  const player4Expected = calculateExpectedScoreFoosball(
    player4Rating,
    player1Rating,
    player2Rating
  );

  const team1Actual = team1Won ? 1 : 0;
  const team2Actual = team1Won ? 0 : 1;

  // Calculate changes with individual K-factors
  const player1Change = kFactor1 * (team1Actual - player1Expected);
  const player2Change = kFactor2 * (team1Actual - player2Expected);
  const player3Change = kFactor3 * (team2Actual - player3Expected);
  const player4Change = kFactor4 * (team2Actual - player4Expected);

  return {
    team1Player1: {
      oldRating: player1Rating,
      newRating: Math.round(player1Rating + player1Change),
      change: Math.round(player1Change),
    },
    team1Player2: {
      oldRating: player2Rating,
      newRating: Math.round(player2Rating + player2Change),
      change: Math.round(player2Change),
    },
    team2Player1: {
      oldRating: player3Rating,
      newRating: Math.round(player3Rating + player3Change),
      change: Math.round(player3Change),
    },
    team2Player2: {
      oldRating: player4Rating,
      newRating: Math.round(player4Rating + player4Change),
      change: Math.round(player4Change),
    },
  };
}

// Export constants for external use
export { INITIAL_ELO, K_FACTOR };
