import React, { useState, useEffect, memo, useMemo } from 'react';
import {
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  RefreshCw,
  Users,
  Code,
  History,
  BarChart3,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { logger } from '../../utils/logger';
import type { User, Match, Group } from '../../types';

interface DashboardProps {
  user: User;
  matches: Match[];
  users: User[];
  group: Group | null;
  error?: string;
  accessToken?: string;
}

export const Dashboard = memo(function Dashboard({
  user,
  matches,
  users,
  group,
  error,
  accessToken,
}: DashboardProps) {
  // Add debugging logs
  logger.debug('Dashboard Data - Start');
  logger.debug('Dashboard User Data', {
    userId: user.id,
    hasUsername: !!user.username,
    wins: user.wins,
    losses: user.losses,
    currentGroup: user.currentGroup,
  });
  logger.debug('Dashboard matches', { count: matches.length });
  logger.debug('Dashboard users', { count: users.length });
  logger.debug('Dashboard group', { hasGroup: !!group });

  const userIdentifier = user.username || user.email;

  // Memoized expensive match filtering calculation
  const userMatches = useMemo(() => {
    return matches.filter(match => {
      // Handle 1v1 matches
      if (match.matchType === '1v1' || !match.matchType) {
        // New format
        if (match.player1?.id && match.player2?.id) {
          return match.player1.id === user.id || match.player2.id === user.id;
        }
        // Legacy format
        return (
          match.player1Email === userIdentifier ||
          match.player2Email === userIdentifier ||
          match.player1Email === user.email ||
          match.player2Email === user.email
        );
      }
      // Handle 2v2 matches
      else if (match.matchType === '2v2') {
        // New format
        if (
          match.team1?.player1?.id &&
          match.team1?.player2?.id &&
          match.team2?.player1?.id &&
          match.team2?.player2?.id
        ) {
          return (
            match.team1.player1.id === user.id ||
            match.team1.player2.id === user.id ||
            match.team2.player1.id === user.id ||
            match.team2.player2.id === user.id
          );
        }
        // Legacy format
        return (
          match.team1Player1Email === userIdentifier ||
          match.team1Player2Email === userIdentifier ||
          match.team2Player1Email === userIdentifier ||
          match.team2Player2Email === userIdentifier ||
          match.team1Player1Email === user.email ||
          match.team1Player2Email === user.email ||
          match.team2Player1Email === user.email ||
          match.team2Player2Email === user.email
        );
      }
      return false;
    });
  }, [matches, user.id, user.email, userIdentifier]);

  logger.debug('User match filtering', {
    hasUserIdentifier: !!userIdentifier,
    userMatchesFound: userMatches.length,
    profileStats: user.wins + user.losses,
    actualMatches: userMatches.length,
  });

  // Memoized expensive statistics calculations
  const { actualWins, actualLosses } = useMemo(() => {
    let wins = 0;
    let losses = 0;

    userMatches.forEach(match => {
      if (match.matchType === '1v1' || !match.matchType) {
        // For 1v1 matches - check both new and legacy formats
        let isWinner = false;

        // New format
        if (match.winner?.id) {
          isWinner = match.winner.id === user.id;
        }
        // Legacy format
        else {
          isWinner = match.winnerEmail === user.email || match.winnerEmail === userIdentifier;
        }

        if (isWinner) {
          wins++;
        } else {
          losses++;
        }
      } else if (match.matchType === '2v2') {
        // For 2v2 matches - check both new and legacy formats
        let isInTeam1 = false;
        let isInTeam2 = false;

        // New format
        if (
          match.team1?.player1?.id &&
          match.team1?.player2?.id &&
          match.team2?.player1?.id &&
          match.team2?.player2?.id
        ) {
          isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
          isInTeam2 = match.team2.player1.id === user.id || match.team2.player2.id === user.id;
        }
        // Legacy format
        else {
          isInTeam1 =
            match.team1Player1Email === userIdentifier ||
            match.team1Player2Email === userIdentifier ||
            match.team1Player1Email === user.email ||
            match.team1Player2Email === user.email;
          isInTeam2 =
            match.team2Player1Email === userIdentifier ||
            match.team2Player2Email === userIdentifier ||
            match.team2Player1Email === user.email ||
            match.team2Player2Email === user.email;
        }

        if (isInTeam1 && match.winningTeam === 'team1') {
          wins++;
        } else if (isInTeam2 && match.winningTeam === 'team2') {
          wins++;
        } else if (isInTeam1 || isInTeam2) {
          losses++;
        }
      }
    });

    return { actualWins: wins, actualLosses: losses };
  }, [userMatches, user.id, user.email, userIdentifier]);

  // Use actual calculated stats instead of user profile stats
  const totalGames = actualWins + actualLosses;
  const winRate = totalGames > 0 ? ((actualWins / totalGames) * 100).toFixed(1) : '0';

  logger.debug('Match calculations', { actualWins, actualLosses, totalGames });

  // Calculate total group games (all matches in the group)
  const totalGroupGames = matches.length;
  logger.debug('Group statistics', { totalGroupGames });

  const recentMatches = userMatches.slice(0, 5);

  // Calculate user rank (now by ELO)
  const sortedUsers = [...users].sort((a, b) => {
    return (b.elo || 1200) - (a.elo || 1200);
  });
  const userRank = sortedUsers.findIndex(u => u.id === user.id) + 1;

  const handleRefresh = () => {
    window.location.reload();
  };

  // Helper function to resolve player name from identifier (email/username)
  const resolvePlayerName = (identifier: string) => {
    if (!identifier) return 'Unknown';

    // Try to find user by email first
    let foundUser = users.find(u => u.email === identifier);

    // If not found by email, try by username
    if (!foundUser) {
      foundUser = users.find(u => u.username === identifier);
    }

    // If still not found, try by name
    if (!foundUser) {
      foundUser = users.find(u => u.name === identifier);
    }

    // Return the user's display name or fallback to identifier
    if (foundUser) {
      return foundUser.username || foundUser.name || foundUser.email;
    }

    // As a last resort, try to extract a readable name from the identifier
    if (identifier.includes('@')) {
      // If it's an email, use the part before @
      return identifier.split('@')[0];
    }

    return identifier;
  };

  // Helper function to format match description
  const formatMatchDescription = (match: any) => {
    if (match.matchType === '1v1' || !match.matchType) {
      // New format
      if (match.player1?.id && match.player2?.id) {
        const opponent = match.player1.id === user.id ? match.player2 : match.player1;
        return `${user.username || user.name} vs ${opponent.name}${opponent.isGuest ? ' (Guest)' : ''}`;
      }
      // Legacy format
      const isPlayer1 = match.player1Email === userIdentifier || match.player1Email === user.email;
      const opponentEmail = isPlayer1 ? match.player2Email : match.player1Email;
      const opponentName = resolvePlayerName(opponentEmail);
      return `${user.username || user.name} vs ${opponentName}`;
    } else if (match.matchType === '2v2') {
      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        const isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
        if (isInTeam1) {
          const partner =
            match.team1.player1.id === user.id ? match.team1.player2 : match.team1.player1;
          return `Team with ${partner.name}${partner.isGuest ? ' (Guest)' : ''}`;
        } else {
          const partner =
            match.team2.player1.id === user.id ? match.team2.player2 : match.team2.player1;
          return `Team with ${partner.name}${partner.isGuest ? ' (Guest)' : ''}`;
        }
      }
      // Legacy format
      const isInTeam1 =
        match.team1Player1Email === userIdentifier ||
        match.team1Player2Email === userIdentifier ||
        match.team1Player1Email === user.email ||
        match.team1Player2Email === user.email;
      const isInTeam2 =
        match.team2Player1Email === userIdentifier ||
        match.team2Player2Email === userIdentifier ||
        match.team2Player1Email === user.email ||
        match.team2Player2Email === user.email;

      if (isInTeam1) {
        const partnerEmail =
          match.team1Player1Email === userIdentifier || match.team1Player1Email === user.email
            ? match.team1Player2Email
            : match.team1Player1Email;
        const partnerName = resolvePlayerName(partnerEmail);
        return `Team with ${partnerName}`;
      } else if (isInTeam2) {
        const partnerEmail =
          match.team2Player1Email === userIdentifier || match.team2Player1Email === user.email
            ? match.team2Player2Email
            : match.team2Player1Email;
        const partnerName = resolvePlayerName(partnerEmail);
        return `Team with ${partnerName}`;
      }
    }
    return 'Unknown match';
  };

  // Helper function to check if user won a match
  const isMatchWinner = (match: any) => {
    if (match.matchType === '1v1' || !match.matchType) {
      // New format
      if (match.winner?.id) {
        return match.winner.id === user.id;
      }
      // Legacy format
      return match.winnerEmail === user.email || match.winnerEmail === userIdentifier;
    } else if (match.matchType === '2v2') {
      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        const isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
        const isInTeam2 = match.team2.player1.id === user.id || match.team2.player2.id === user.id;
        return (
          (isInTeam1 && match.winningTeam === 'team1') ||
          (isInTeam2 && match.winningTeam === 'team2')
        );
      }
      // Legacy format
      const isInTeam1 =
        match.team1Player1Email === userIdentifier ||
        match.team1Player2Email === userIdentifier ||
        match.team1Player1Email === user.email ||
        match.team1Player2Email === user.email;
      const isInTeam2 =
        match.team2Player1Email === userIdentifier ||
        match.team2Player2Email === userIdentifier ||
        match.team2Player1Email === user.email ||
        match.team2Player2Email === user.email;
      return (
        (isInTeam1 && match.winningTeam === 'team1') || (isInTeam2 && match.winningTeam === 'team2')
      );
    }
    return false;
  };

  return (
    <div className='p-4 space-y-6'>
      {/* Welcome */}
      <div className='text-center py-6'>
        <div className='w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4'>
          <Avatar
            src={user.avatarUrl}
            fallback={user.avatar}
            className='w-full h-full rounded-full'
            textClassName='text-2xl text-blue-600'
          />
        </div>
        <h2 className='text-2xl text-gray-800'>Welcome back, {user.username || user.name}!</h2>
        <p className='text-gray-600'>Ready for your next match?</p>

        {error && (
          <button
            onClick={handleRefresh}
            className='mt-2 flex items-center space-x-2 text-blue-600 hover:text-blue-700 mx-auto'
          >
            <RefreshCw className='w-4 h-4' />
            <span className='text-sm'>Refresh Data</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-orange-50 border border-orange-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <Calendar className='w-8 h-8 text-orange-600 mr-3' />
            <div>
              <p className='text-2xl text-orange-800'>{totalGames}</p>
              <p className='text-sm text-orange-600'>My Games</p>
            </div>
          </div>
        </div>

        <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <Trophy className='w-8 h-8 text-green-600 mr-3' />
            <div>
              <p className='text-2xl text-green-800'>{actualWins}</p>
              <p className='text-sm text-green-600'>Wins</p>
            </div>
          </div>
        </div>

        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <Target className='w-8 h-8 text-blue-600 mr-3' />
            <div>
              <p className='text-2xl text-blue-800'>{winRate}%</p>
              <p className='text-sm text-blue-600'>Win Rate</p>
            </div>
          </div>
        </div>

        <div className='bg-purple-50 border border-purple-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <TrendingUp className='w-8 h-8 text-purple-600 mr-3' />
            <div>
              <p className='text-2xl text-purple-800'>{user.elo || 1200}</p>
              <p className='text-sm text-purple-600'>ELO Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      <div className='bg-white rounded-lg border border-gray-200'>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='text-lg text-gray-800'>Recent Matches</h3>
        </div>

        {recentMatches.length > 0 ? (
          <div className='divide-y divide-gray-200'>
            {recentMatches.map(match => {
              const matchDescription = formatMatchDescription(match);
              const isWinner = isMatchWinner(match);

              // Get ELO change for this user
              const userEloChange =
                match.eloChanges?.[userIdentifier] ||
                match.eloChanges?.[user.email] ||
                match.eloChanges?.[user.id];
              const eloChangeText = userEloChange
                ? `${userEloChange.change > 0 ? '+' : ''}${userEloChange.change}`
                : '';

              // Format date
              const matchDate = new Date(match.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div key={match.id} className='p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-3'>
                      <div
                        className={`w-3 h-3 rounded-full ${isWinner ? 'bg-green-500' : 'bg-red-500'}`}
                      ></div>
                      <div>
                        <p className='text-gray-800'>{matchDescription}</p>
                        <p className='text-sm text-gray-500'>
                          {match.matchType || '1v1'} • {matchDate}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className={`${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                        {isWinner ? 'Won' : 'Lost'}
                      </p>
                      {eloChangeText && (
                        <p
                          className={`text-xs ${userEloChange.change > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {eloChangeText} ELO
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className='p-8 text-center text-gray-500'>
            <Trophy className='w-12 h-12 mx-auto mb-4 text-gray-300' />
            <p>No matches yet</p>
            <p className='text-sm'>Start playing to see your match history!</p>
          </div>
        )}
      </div>

      {/* Group Stats Summary */}
      {users.length > 0 && (
        <div className='bg-white rounded-lg border border-gray-200 p-4'>
          <h3 className='text-lg text-gray-800 mb-3'>Group Overview</h3>
          <div className='grid grid-cols-3 gap-4 text-center'>
            <div>
              <p className='text-2xl text-blue-600'>{users.length}</p>
              <p className='text-sm text-gray-600'>Active Players</p>
            </div>
            <div>
              <p className='text-2xl text-green-600'>{totalGroupGames}</p>
              <p className='text-sm text-gray-600'>Total Games</p>
            </div>
            <div>
              <p className='text-2xl text-purple-600'>
                {Math.round(
                  (users.reduce((total, user) => {
                    const userWinRate =
                      user.wins + user.losses > 0 ? user.wins / (user.wins + user.losses) : 0;
                    return total + userWinRate;
                  }, 0) /
                    users.length) *
                    100
                ) || 0}
                %
              </p>
              <p className='text-sm text-gray-600'>Avg Win Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
