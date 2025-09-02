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
import {
  getMatchDescription,
  isUserInMatch,
  didUserWinMatch,
  calculateUserStatsFromMatches,
  getUserTeam
} from '../../utils/match-helpers';

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
    currentGroup: user.current_group_code,
  });
  logger.debug('Dashboard matches', { count: matches.length });
  logger.debug('Dashboard users', { count: users.length });
  logger.debug('Dashboard group', { hasGroup: !!group });
  logger.debug('Dashboard error', { error });

  // Show error state if authentication failed
  if (error && error.includes('Authentication failed')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Authentication Required
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your session has expired. Please sign in again to view your match data and statistics.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userIdentifier = user.username || user.email;

  // Memoized expensive match filtering calculation
  const userMatches = useMemo(() => {
    return matches.filter(match => isUserInMatch(match, user.id));
  }, [matches, user.id]);

  logger.debug('User match filtering', {
    hasUserIdentifier: !!userIdentifier,
    userMatchesFound: userMatches.length,
    profileStats: (user.wins || 0) + (user.losses || 0),
    actualMatches: userMatches.length,
  });

  // Memoized expensive statistics calculations
  const { actualWins, actualLosses } = useMemo(() => {
    const stats = calculateUserStatsFromMatches(userMatches, user.id);
    return { actualWins: stats.wins, actualLosses: stats.losses };
  }, [userMatches, user.id]);

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

  // Calculate average ELO for the group
  const averageElo =
    users.length > 0
      ? Math.round(users.reduce((total, user) => total + (user.elo || 1200), 0) / users.length)
      : 1200;

  const handleRefresh = () => {
    window.location.reload();
  };

  // Helper function to format match description
  const formatMatchDescription = (match: Match) => {
    return getMatchDescription(match);
  };

  // Helper function to check if user won a match
  const isMatchWinner = (match: Match) => {
    return didUserWinMatch(match, user.id);
  };

  return (
    <div className='p-4 space-y-6'>
      {/* Welcome */}
      <div className='text-center py-6'>
        <div className='w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4'>
          <Avatar
            src={user.avatarUrl}
            fallback={user.avatar || user.username?.charAt(0) || user.name?.charAt(0) || 'U'}
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
                      {eloChangeText && userEloChange && (
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
              <p className='text-2xl text-purple-600'>{averageElo}</p>
              <p className='text-sm text-gray-600'>Average ELO</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
