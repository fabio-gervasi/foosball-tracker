/**
 * Match Helper Utilities
 *
 * Utility functions for working with match data in the new relational structure
 */

import type { Match, MatchPlayer, User } from '../types';

/**
 * Get the display name for a match player
 */
export function getPlayerDisplayName(player: MatchPlayer): string {
  if (player.users) {
    return player.users.name;
  }
  if (player.guest_name) {
    return `${player.guest_name} (Guest)`;
  }
  return 'Unknown Player';
}

/**
 * Get the user ID for a match player (or null for guests)
 */
export function getPlayerUserId(player: MatchPlayer): string | null {
  return player.users?.id || null;
}

/**
 * Check if a user participated in a match
 */
export function isUserInMatch(match: Match, userId: string): boolean {
  if (!match.players) return false;

  return match.players.some(player => getPlayerUserId(player) === userId);
}

/**
 * Get all players for a specific team
 */
export function getTeamPlayers(match: Match, team: 'team1' | 'team2'): MatchPlayer[] {
  if (!match.players) return [];

  return match.players.filter(player => player.team === team);
}

/**
 * Get opponent players for a user in a match
 */
export function getOpponentPlayers(match: Match, userId: string): MatchPlayer[] {
  if (!match.players) return [];

  const userTeam = match.players.find(player => getPlayerUserId(player) === userId)?.team;
  if (!userTeam) return [];

  const opponentTeam = userTeam === 'team1' ? 'team2' : 'team1';
  return getTeamPlayers(match, opponentTeam);
}

/**
 * Determine if a user won a match
 */
export function didUserWinMatch(match: Match, userId: string): boolean {
  if (!match.players || !match.winner_email) return false;

  // Find the user in the match
  const userPlayer = match.players.find(player => getPlayerUserId(player) === userId);
  if (!userPlayer) return false;

  // Check if the winner email matches any player in the user's team
  const userTeam = userPlayer.team;
  const userTeamPlayers = getTeamPlayers(match, userTeam);

  return userTeamPlayers.some(player =>
    (player.users?.email === match.winner_email) ||
    (player.is_guest && player.guest_name === match.winner_email)
  );
}

/**
 * Get the match description (e.g., "Tsubasa vs fabrizio")
 */
export function getMatchDescription(match: Match): string {
  if (!match.players || match.players.length === 0) {
    return 'Unknown match';
  }

  if (match.match_type === '2v2') {
    const team1Players = getTeamPlayers(match, 'team1');
    const team2Players = getTeamPlayers(match, 'team2');

    const team1Names = team1Players.map(p => getPlayerDisplayName(p)).join(' & ');
    const team2Names = team2Players.map(p => getPlayerDisplayName(p)).join(' & ');

    return `${team1Names} vs ${team2Names}`;
  } else {
    // 1v1 match
    const team1Players = getTeamPlayers(match, 'team1');
    const team2Players = getTeamPlayers(match, 'team2');

    const player1Name = team1Players.length > 0 ? getPlayerDisplayName(team1Players[0]) : 'Unknown';
    const player2Name = team2Players.length > 0 ? getPlayerDisplayName(team2Players[0]) : 'Unknown';

    return `${player1Name} vs ${player2Name}`;
  }
}

/**
 * Get user's team in a match
 */
export function getUserTeam(match: Match, userId: string): 'team1' | 'team2' | null {
  if (!match.players) return null;

  const player = match.players.find(p => getPlayerUserId(p) === userId);
  return player?.team || null;
}

/**
 * Check if a match has guest players
 */
export function hasGuestPlayers(match: Match): boolean {
  if (!match.players) return false;

  return match.players.some(player => player.is_guest);
}

/**
 * Get all players in a match with their display names
 */
export function getMatchPlayersWithNames(match: Match): Array<{
  userId: string | null;
  name: string;
  team: 'team1' | 'team2';
  isGuest: boolean;
}> {
  if (!match.players) return [];

  return match.players.map(player => ({
    userId: getPlayerUserId(player),
    name: getPlayerDisplayName(player),
    team: player.team,
    isGuest: player.is_guest
  }));
}

/**
 * Calculate wins and losses for a user from match data
 */
export function calculateUserStatsFromMatches(matches: Match[], userId: string): {
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
} {
  let wins = 0;
  let losses = 0;

  matches.forEach(match => {
    if (isUserInMatch(match, userId)) {
      if (didUserWinMatch(match, userId)) {
        wins++;
      } else {
        losses++;
      }
    }
  });

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  return {
    wins,
    losses,
    totalGames,
    winRate
  };
}

/**
 * Get opponent information for head-to-head statistics
 */
export function getOpponentStats(matches: Match[], userId: string, users: User[]): Array<{
  opponentId: string | null;
  opponentName: string;
  wins: number;
  losses: number;
  total: number;
  isGuest: boolean;
}> {
  const opponentMap = new Map<string, {
    opponentId: string | null;
    opponentName: string;
    wins: number;
    losses: number;
    total: number;
    isGuest: boolean;
  }>();

  matches.forEach(match => {
    if (!isUserInMatch(match, userId) || !match.players) return;

    const opponents = getOpponentPlayers(match, userId);
    const userWon = didUserWinMatch(match, userId);

    opponents.forEach(opponent => {
      const opponentId = getPlayerUserId(opponent);
      const opponentName = getPlayerDisplayName(opponent);
      const key = opponentId || `guest-${opponentName}`;

      if (!opponentMap.has(key)) {
        opponentMap.set(key, {
          opponentId,
          opponentName,
          wins: 0,
          losses: 0,
          total: 0,
          isGuest: opponent.is_guest
        });
      }

      const stats = opponentMap.get(key)!;
      stats.total++;

      if (userWon) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    });
  });

  return Array.from(opponentMap.values()).sort((a, b) => b.total - a.total);
}
