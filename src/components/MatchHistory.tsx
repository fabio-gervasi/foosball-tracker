import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  User,
  Users,
  Search,
  Trophy,
  Crown,
  X,
  RefreshCw,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useMatchesQuery } from '../hooks/useQueries';
import { logger } from '../utils/logger';
import type { User as UserType, Group, Match } from '../types';
import _exampleImage from 'figma:asset/b116ece610e7864347e2bdd75f97d694d0ba8cab.png';

interface MatchHistoryProps {
  currentUser: UserType;
  accessToken: string;
  group: Group | null;
  users: UserType[];
}

export function MatchHistory({ currentUser, accessToken, group, users }: MatchHistoryProps) {
  // Use React Query for data fetching
  const {
    data: matches = [],
    isLoading: loading,
    error: queryError,
    refetch: loadMatchHistory,
    isFetching,
  } = useMatchesQuery(accessToken);

  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [localError, setLocalError] = useState('');
  const error = localError || queryError?.message || '';

  // Filter states
  const [showMyGamesOnly, setShowMyGamesOnly] = useState(false);
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | '1v1' | '2v2'>('all');
  const [playerSearchFilter, setPlayerSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    applyFilters();
  }, [matches, showMyGamesOnly, gameTypeFilter, playerSearchFilter, dateFilter]);

  // Log when matches data changes
  useEffect(() => {
    if (matches.length > 0) {
      logger.info('Match history updated via React Query', { count: matches.length });
    }
  }, [matches]);

  // Helper function to check if current user participated in match
  const isCurrentUserInMatch = (match: any) => {
    const userIdentifier = currentUser.username || currentUser.email;

    if (match.matchType === '2v2') {
      return (
        match.team1?.player1?.email === userIdentifier ||
        match.team1?.player1?.id === userIdentifier ||
        match.team1?.player2?.email === userIdentifier ||
        match.team1?.player2?.id === userIdentifier ||
        match.team2?.player1?.email === userIdentifier ||
        match.team2?.player1?.id === userIdentifier ||
        match.team2?.player2?.email === userIdentifier ||
        match.team2?.player2?.id === userIdentifier
      );
    } else {
      return (
        match.player1?.email === userIdentifier ||
        match.player1?.id === userIdentifier ||
        match.player2?.email === userIdentifier ||
        match.player2?.id === userIdentifier
      );
    }
  };

  const applyFilters = () => {
    let filtered = [...matches];

    // Filter by user participation
    if (showMyGamesOnly) {
      filtered = filtered.filter(match => isCurrentUserInMatch(match));
    }

    // Filter by game type
    if (gameTypeFilter !== 'all') {
      filtered = filtered.filter(match =>
        gameTypeFilter === '1v1'
          ? !match.matchType || match.matchType === '1v1'
          : match.matchType === '2v2'
      );
    }

    // Filter by player search
    if (playerSearchFilter.trim()) {
      const searchTerm = playerSearchFilter.toLowerCase().trim();
      filtered = filtered.filter(match => {
        if (match.matchType === '2v2') {
          return (
            (match.team1?.player1?.name &&
              match.team1.player1.name.toLowerCase().includes(searchTerm)) ||
            (match.team1?.player2?.name &&
              match.team1.player2.name.toLowerCase().includes(searchTerm)) ||
            (match.team2?.player1?.name &&
              match.team2.player1.name.toLowerCase().includes(searchTerm)) ||
            (match.team2?.player2?.name &&
              match.team2.player2.name.toLowerCase().includes(searchTerm))
          );
        } else {
          return (
            (match.player1?.name && match.player1.name.toLowerCase().includes(searchTerm)) ||
            (match.player2?.name && match.player2.name.toLowerCase().includes(searchTerm))
          );
        }
      });
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

      filtered = filtered.filter(match => {
        const matchDate = new Date(match.date || match.createdAt);
        switch (dateFilter) {
          case 'today':
            return matchDate >= today;
          case 'week':
            return matchDate >= weekAgo;
          case 'month':
            return matchDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredMatches(filtered);
  };

  const clearFilters = () => {
    setShowMyGamesOnly(false);
    setGameTypeFilter('all');
    setPlayerSearchFilter('');
    setDateFilter('all');
  };

  // Helper function to resolve player name from email/username identifier
  const resolvePlayerName = (identifier: string) => {
    if (!identifier) return 'Unknown';

    // Check if it's a guest player
    if (identifier.startsWith('guest')) {
      const guestNumber = identifier.replace('guest', '');
      return `Guest ${guestNumber}`;
    }

    // Find user by username first, then by email
    let user = users.find(u => u.username === identifier);
    if (!user) {
      user = users.find(u => u.email === identifier);
    }

    return user?.name || user?.username || identifier;
  };

  // Helper function to get user avatar info from email/username identifier
  const getUserAvatarInfo = (identifier: string) => {
    if (!identifier) return { avatar: 'U', avatarUrl: null };

    // Check if it's a guest player
    if (identifier.startsWith('guest')) {
      const guestNumber = identifier.replace('guest', '');
      return { avatar: 'G', avatarUrl: null };
    }

    // Find user by username first, then by email
    let user = users.find(u => u.username === identifier);
    if (!user) {
      user = users.find(u => u.email === identifier);
    }

    return {
      avatar:
        user?.avatar || user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U',
      avatarUrl: user?.avatarUrl,
    };
  };

  // Helper function to get ELO change for a specific player
  const getPlayerEloChange = (match: any, playerIdentifier: string) => {
    if (!match.eloChanges) return null;

    // Try to find ELO change by the specific identifier first
    const change = match.eloChanges[playerIdentifier];

    return change ? change.change : null;
  };

  const formatMatchDisplay = (match: any) => {
    if (match.matchType === '2v2') {
      // Get player names from structured player objects
      const team1Player1Name = match.team1?.player1?.name || 'Unknown';
      const team1Player2Name = match.team1?.player2?.name || 'Unknown';
      const team2Player1Name = match.team2?.player1?.name || 'Unknown';
      const team2Player2Name = match.team2?.player2?.name || 'Unknown';

      const team1Names = `${team1Player1Name} & ${team1Player2Name}`;
      const team2Names = `${team2Player1Name} & ${team2Player2Name}`;
      const winnerNames = match.winningTeam === 'team1' ? team1Names : team2Names;

      // Check for guest players
      const hasGuests = [
        match.team1?.player1?.isGuest,
        match.team1?.player2?.isGuest,
        match.team2?.player1?.isGuest,
        match.team2?.player2?.isGuest,
      ].some(Boolean);

      const currentUserWon = (() => {
        const userIdentifier = currentUser.username || currentUser.email;
        return (
          (match.winningTeam === 'team1' &&
            (match.team1?.player1?.email === userIdentifier ||
              match.team1?.player1?.id === userIdentifier ||
              match.team1?.player2?.email === userIdentifier ||
              match.team1?.player2?.id === userIdentifier)) ||
          (match.winningTeam === 'team2' &&
            (match.team2?.player1?.email === userIdentifier ||
              match.team2?.player1?.id === userIdentifier ||
              match.team2?.player2?.email === userIdentifier ||
              match.team2?.player2?.id === userIdentifier))
        );
      })();

      return {
        participants: `${team1Names} vs ${team2Names}`,
        winner: `${match.winningTeam === 'team1' ? 'Team 1' : 'Team 2'}: ${winnerNames}`,
        type: '2v2',
        hasGuests,
        isCurrentUserInvolved: isCurrentUserInMatch(match),
        currentUserWon,
      };
    } else {
      // Get player names from structured player objects for 1v1
      const player1Name = match.player1?.name || 'Unknown';
      const player2Name = match.player2?.name || 'Unknown';
      const winnerName = match.winner?.name || 'Unknown';

      // Check for guest players
      const hasGuests = match.player1?.isGuest || match.player2?.isGuest;

      const currentUserWon = (() => {
        const userIdentifier = currentUser.username || currentUser.email;
        return match.winner?.email === userIdentifier || match.winner?.id === userIdentifier;
      })();

      return {
        participants: `${player1Name} vs ${player2Name}`,
        winner: winnerName,
        type: '1v1',
        hasGuests,
        isCurrentUserInvolved: isCurrentUserInMatch(match),
        currentUserWon,
      };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch {
      return dateString;
    }
  };

  const activeFiltersCount = [
    showMyGamesOnly,
    gameTypeFilter !== 'all',
    playerSearchFilter.trim() !== '',
    dateFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div className='p-4 space-y-6'>
      <div className='text-center py-4'>
        <History className='w-16 h-16 text-blue-600 mx-auto mb-4' />
        <h2 className='text-2xl text-gray-800'>Match History</h2>
        <p className='text-gray-600'>Complete match history for {group?.name || 'your group'}</p>
      </div>

      {/* Top Search and Quick Filter Section */}
      <div className='bg-white rounded-lg border border-gray-200 p-4 space-y-4'>
        {/* Player Search */}
        <div>
          <label className='block text-sm text-gray-700 mb-2'>Search by Player</label>
          <div className='relative'>
            <Search className='w-4 h-4 absolute left-3 top-3 text-gray-400' />
            <input
              type='text'
              placeholder='Search player names...'
              value={playerSearchFilter}
              onChange={e => setPlayerSearchFilter(e.target.value)}
              className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm'
            />
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className='flex items-center justify-between'>
          {/* Show My Games Toggle */}
          <button
            onClick={() => setShowMyGamesOnly(!showMyGamesOnly)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${
              showMyGamesOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <UserCheck className='w-4 h-4' />
            <span>My Games Only</span>
          </button>

          {/* Advanced Filters Toggle */}
          <div className='flex items-center space-x-2'>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className='text-gray-500 hover:text-gray-700 text-sm flex items-center'
              >
                <X className='w-4 h-4 mr-1' />
                Clear
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1'
            >
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className='px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full'>
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? (
                <ChevronUp className='w-4 h-4' />
              ) : (
                <ChevronDown className='w-4 h-4' />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Controls */}
      {showFilters && (
        <div className='bg-white rounded-lg border border-gray-200 p-4'>
          <div className='space-y-4'>
            {/* Game Type Filter */}
            <div>
              <label className='block text-sm text-gray-700 mb-2'>Game Type</label>
              <div className='grid grid-cols-3 gap-2'>
                <button
                  onClick={() => setGameTypeFilter('all')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    gameTypeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Games
                </button>
                <button
                  onClick={() => setGameTypeFilter('1v1')}
                  className={`px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                    gameTypeFilter === '1v1'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <User className='w-4 h-4 mr-1' />
                  1v1
                </button>
                <button
                  onClick={() => setGameTypeFilter('2v2')}
                  className={`px-3 py-2 rounded text-sm transition-colors flex items-center justify-center ${
                    gameTypeFilter === '2v2'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Users className='w-4 h-4 mr-1' />
                  2v2
                </button>
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className='block text-sm text-gray-700 mb-2'>Date Range</label>
              <div className='grid grid-cols-2 gap-2'>
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    dateFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    dateFilter === 'today'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    dateFilter === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Past Week
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    dateFilter === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Past Month
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className='bg-white rounded-lg border border-gray-200 p-4'>
        <h3 className='text-lg text-gray-800 mb-4'>Summary</h3>
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div>
            <p className='text-2xl text-gray-800'>{filteredMatches.length}</p>
            <p className='text-sm text-gray-600'>
              {filteredMatches.length === matches.length ? 'Total' : 'Filtered'} Matches
            </p>
          </div>
          <div>
            <p className='text-2xl text-green-600'>
              {filteredMatches.filter(m => m.matchType === '1v1' || !m.matchType).length}
            </p>
            <p className='text-sm text-gray-600'>1v1 Games</p>
          </div>
          <div>
            <p className='text-2xl text-blue-600'>
              {filteredMatches.filter(m => m.matchType === '2v2').length}
            </p>
            <p className='text-sm text-gray-600'>2v2 Games</p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg'>
          <p className='text-sm'>{error}</p>
          <button
            onClick={() => setLocalError('')}
            className='text-red-500 hover:text-red-700 text-xs mt-1'
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className='text-center py-8'>
          <div className='w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading match history...</p>
        </div>
      )}

      {/* Refresh Button */}
      {!loading && (
        <div className='text-center'>
          <button
            onClick={() => loadMatchHistory()}
            disabled={isFetching}
            className='inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors text-sm'
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Match List */}
      {!loading && (
        <div className='bg-white rounded-lg border border-gray-200'>
          <div className='p-4 border-b border-gray-200'>
            <h3 className='text-lg text-gray-800'>
              {filteredMatches.length === matches.length
                ? `All Matches (${filteredMatches.length})`
                : `Filtered Matches (${filteredMatches.length} of ${matches.length})`}
            </h3>
          </div>

          {filteredMatches.length === 0 ? (
            <div className='text-center py-8'>
              <Trophy className='w-12 h-12 text-gray-400 mx-auto mb-4' />
              <p className='text-gray-500'>
                {matches.length === 0
                  ? 'No matches found in this group yet.'
                  : 'No matches found with the current filters.'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className='text-blue-600 hover:text-blue-700 text-sm mt-2'
                >
                  Clear filters to see all matches
                </button>
              )}
            </div>
          ) : (
            <div className='space-y-4 p-4'>
              {filteredMatches.map(match => {
                const matchDisplay = formatMatchDisplay(match);

                if (matchDisplay.type === '2v2') {
                  // Team-based layout for 2v2 matches
                  const team1Player1Info = getUserAvatarInfo(
                    match.team1?.player1?.email || match.team1?.player1?.id || 'unknown'
                  );
                  const team1Player2Info = getUserAvatarInfo(
                    match.team1?.player2?.email || match.team1?.player2?.id || 'unknown'
                  );
                  const team2Player1Info = getUserAvatarInfo(
                    match.team2?.player1?.email || match.team2?.player1?.id || 'unknown'
                  );
                  const team2Player2Info = getUserAvatarInfo(
                    match.team2?.player2?.email || match.team2?.player2?.id || 'unknown'
                  );

                  const team1Player1Name = match.team1?.player1?.name || 'Unknown';
                  const team1Player2Name = match.team1?.player2?.name || 'Unknown';
                  const team2Player1Name = match.team2?.player1?.name || 'Unknown';
                  const team2Player2Name = match.team2?.player2?.name || 'Unknown';

                  const team1Won = match.winningTeam === 'team1';
                  const team2Won = match.winningTeam === 'team2';

                  return (
                    <div
                      key={match.id}
                      className={`${matchDisplay.isCurrentUserInvolved ? 'bg-blue-50' : 'bg-white'} rounded-xl border border-gray-200 hover:border-gray-300 transition-colors`}
                    >
                      <div className='p-4'>
                        {/* Match Header */}
                        <div className='flex items-center justify-between mb-4'>
                          <div className='flex items-center space-x-2'>
                            <span className='px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700'>
                              2v2
                            </span>
                            <span className='text-xs text-gray-500 flex items-center'>
                              <Calendar className='w-3 h-3 mr-1' />
                              {formatDate(match.date || match.createdAt)}
                            </span>
                            {matchDisplay.hasGuests && (
                              <span className='px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-600 flex items-center'>
                                <UserCheck className='w-3 h-3 mr-1' />
                                Guest
                              </span>
                            )}
                          </div>
                          {matchDisplay.isCurrentUserInvolved && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                matchDisplay.currentUserWon
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {matchDisplay.currentUserWon ? 'Won' : 'Lost'}
                            </span>
                          )}
                        </div>

                        {/* Teams Layout */}
                        <div className='space-y-3'>
                          {/* Team 1 */}
                          <div
                            className={`rounded-lg border-2 p-3 ${
                              team1Won
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className='flex items-center justify-between mb-3'>
                              <span className='text-xs font-medium text-gray-600'>Team 1</span>
                              {team1Won && <Crown className='w-3 h-3 text-yellow-600' />}
                            </div>

                            {/* Team 1 - Avatars and Names */}
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center space-x-3'>
                                {/* Both avatars side by side */}
                                <div className='flex space-x-1'>
                                  <div className='w-8 h-8 bg-blue-100 rounded-full flex-shrink-0'>
                                    <Avatar
                                      src={team1Player1Info.avatarUrl || undefined}
                                      fallback={team1Player1Info.avatar}
                                      className='w-full h-full rounded-full'
                                      textClassName='text-xs text-blue-600'
                                    />
                                  </div>
                                  <div className='w-8 h-8 bg-blue-100 rounded-full flex-shrink-0'>
                                    <Avatar
                                      src={team1Player2Info.avatarUrl || undefined}
                                      fallback={team1Player2Info.avatar}
                                      className='w-full h-full rounded-full'
                                      textClassName='text-xs text-blue-600'
                                    />
                                  </div>
                                </div>
                                {/* Names stacked vertically */}
                                <div className='flex flex-col space-y-0.5'>
                                  <span className='text-sm text-gray-800 leading-tight'>
                                    {team1Player1Name}
                                  </span>
                                  <span className='text-sm text-gray-800 leading-tight'>
                                    {team1Player2Name}
                                  </span>
                                </div>
                              </div>
                              {/* ELO changes stacked vertically */}
                              {match.eloChanges && (
                                <div className='flex flex-col space-y-0.5 items-end'>
                                  {(() => {
                                    const eloChange1 = getPlayerEloChange(
                                      match,
                                      match.team1?.player1?.email ||
                                        match.team1?.player1?.id ||
                                        'unknown'
                                    );
                                    return eloChange1 !== null ? (
                                      <span
                                        className={`px-1 py-0.5 rounded text-xs leading-tight ${
                                          eloChange1 > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {eloChange1 > 0 ? '+' : ''}
                                        {eloChange1}
                                      </span>
                                    ) : (
                                      <div className='text-xs leading-tight'>&nbsp;</div>
                                    );
                                  })()}
                                  {(() => {
                                    const eloChange2 = getPlayerEloChange(
                                      match,
                                      match.team1?.player2?.email ||
                                        match.team1?.player2?.id ||
                                        'unknown'
                                    );
                                    return eloChange2 !== null ? (
                                      <span
                                        className={`px-1 py-0.5 rounded text-xs leading-tight ${
                                          eloChange2 > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {eloChange2 > 0 ? '+' : ''}
                                        {eloChange2}
                                      </span>
                                    ) : (
                                      <div className='text-xs leading-tight'>&nbsp;</div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* VS Divider */}
                          <div className='flex items-center justify-center py-1'>
                            <span className='text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full'>
                              VS
                            </span>
                          </div>

                          {/* Team 2 */}
                          <div
                            className={`rounded-lg border-2 p-3 ${
                              team2Won
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className='flex items-center justify-between mb-3'>
                              <span className='text-xs font-medium text-gray-600'>Team 2</span>
                              {team2Won && <Crown className='w-3 h-3 text-yellow-600' />}
                            </div>

                            {/* Team 2 - Avatars and Names */}
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center space-x-3'>
                                {/* Both avatars side by side */}
                                <div className='flex space-x-1'>
                                  <div className='w-8 h-8 bg-blue-100 rounded-full flex-shrink-0'>
                                    <Avatar
                                      src={team2Player1Info.avatarUrl || undefined}
                                      fallback={team2Player1Info.avatar}
                                      className='w-full h-full rounded-full'
                                      textClassName='text-xs text-blue-600'
                                    />
                                  </div>
                                  <div className='w-8 h-8 bg-blue-100 rounded-full flex-shrink-0'>
                                    <Avatar
                                      src={team2Player2Info.avatarUrl || undefined}
                                      fallback={team2Player2Info.avatar}
                                      className='w-full h-full rounded-full'
                                      textClassName='text-xs text-blue-600'
                                    />
                                  </div>
                                </div>
                                {/* Names stacked vertically */}
                                <div className='flex flex-col space-y-0.5'>
                                  <span className='text-sm text-gray-800 leading-tight'>
                                    {team2Player1Name}
                                  </span>
                                  <span className='text-sm text-gray-800 leading-tight'>
                                    {team2Player2Name}
                                  </span>
                                </div>
                              </div>
                              {/* ELO changes stacked vertically */}
                              {match.eloChanges && (
                                <div className='flex flex-col space-y-0.5 items-end'>
                                  {(() => {
                                    const eloChange1 = getPlayerEloChange(
                                      match,
                                      match.team2?.player1?.email ||
                                        match.team2?.player1?.id ||
                                        'unknown'
                                    );
                                    return eloChange1 !== null ? (
                                      <span
                                        className={`px-1 py-0.5 rounded text-xs leading-tight ${
                                          eloChange1 > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {eloChange1 > 0 ? '+' : ''}
                                        {eloChange1}
                                      </span>
                                    ) : (
                                      <div className='text-xs leading-tight'>&nbsp;</div>
                                    );
                                  })()}
                                  {(() => {
                                    const eloChange2 = getPlayerEloChange(
                                      match,
                                      match.team2?.player2?.email ||
                                        match.team2?.player2?.id ||
                                        'unknown'
                                    );
                                    return eloChange2 !== null ? (
                                      <span
                                        className={`px-1 py-0.5 rounded text-xs leading-tight ${
                                          eloChange2 > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {eloChange2 > 0 ? '+' : ''}
                                        {eloChange2}
                                      </span>
                                    ) : (
                                      <div className='text-xs leading-tight'>&nbsp;</div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {matchDisplay.hasGuests && (
                          <div className='mt-3 text-xs text-orange-600 text-center'>
                            Guest players don't affect ELO ratings
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  // Cleaner layout for 1v1 matches with avatars
                  const player1Info = getUserAvatarInfo(
                    match.player1?.email || match.player1?.id || 'unknown'
                  );
                  const player2Info = getUserAvatarInfo(
                    match.player2?.email || match.player2?.id || 'unknown'
                  );
                  const player1Name = match.player1?.name || 'Unknown';
                  const player2Name = match.player2?.name || 'Unknown';

                  return (
                    <div
                      key={match.id}
                      className={`${matchDisplay.isCurrentUserInvolved ? 'bg-blue-50' : 'bg-white'} rounded-xl border border-gray-200 hover:border-gray-300 transition-colors`}
                    >
                      <div className='p-4'>
                        {/* Match Header */}
                        <div className='flex items-center justify-between mb-3'>
                          <div className='flex items-center space-x-2'>
                            <span className='px-2 py-1 rounded-full text-xs bg-green-100 text-green-700'>
                              1v1
                            </span>
                            <span className='text-xs text-gray-500 flex items-center'>
                              <Calendar className='w-3 h-3 mr-1' />
                              {formatDate(match.date || match.createdAt)}
                            </span>
                            {matchDisplay.hasGuests && (
                              <span className='px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-600 flex items-center'>
                                <UserCheck className='w-3 h-3 mr-1' />
                                Guest
                              </span>
                            )}
                          </div>
                          {matchDisplay.isCurrentUserInvolved && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                matchDisplay.currentUserWon
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {matchDisplay.currentUserWon ? 'Won' : 'Lost'}
                            </span>
                          )}
                        </div>

                        {/* Players Layout */}
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-4 flex-1'>
                            {/* Player 1 */}
                            <div className='flex items-center space-x-2 flex-1'>
                              <div className='w-10 h-10 bg-blue-100 rounded-full flex-shrink-0'>
                                <Avatar
                                  src={player1Info.avatarUrl || undefined}
                                  fallback={player1Info.avatar}
                                  className='w-full h-full rounded-full'
                                  textClassName='text-sm text-blue-600'
                                />
                              </div>
                              <div className='min-w-0 flex-1'>
                                <span className='text-sm text-gray-800 truncate block'>
                                  {player1Name}
                                </span>
                                {match.eloChanges && (
                                  <div className='text-xs'>
                                    {(() => {
                                      const eloChange = getPlayerEloChange(
                                        match,
                                        match.player1?.email || match.player1?.id || 'unknown'
                                      );
                                      if (eloChange !== null) {
                                        return (
                                          <span
                                            className={`${
                                              eloChange > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}
                                          >
                                            {eloChange > 0 ? '+' : ''}
                                            {eloChange} ELO
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                              {(match.winner?.email === match.player1?.email ||
                                match.winner?.id === match.player1?.id) && (
                                <Crown className='w-4 h-4 text-yellow-600 flex-shrink-0' />
                              )}
                            </div>

                            {/* VS Divider */}
                            <span className='text-xs text-gray-500 font-medium px-2'>VS</span>

                            {/* Player 2 */}
                            <div className='flex items-center space-x-2 flex-1'>
                              <div className='w-10 h-10 bg-blue-100 rounded-full flex-shrink-0'>
                                <Avatar
                                  src={player2Info.avatarUrl || undefined}
                                  fallback={player2Info.avatar}
                                  className='w-full h-full rounded-full'
                                  textClassName='text-sm text-blue-600'
                                />
                              </div>
                              <div className='min-w-0 flex-1'>
                                <span className='text-sm text-gray-800 truncate block'>
                                  {player2Name}
                                </span>
                                {match.eloChanges && (
                                  <div className='text-xs'>
                                    {(() => {
                                      const eloChange = getPlayerEloChange(
                                        match,
                                        match.player2?.email || match.player2?.id || 'unknown'
                                      );
                                      if (eloChange !== null) {
                                        return (
                                          <span
                                            className={`${
                                              eloChange > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}
                                          >
                                            {eloChange > 0 ? '+' : ''}
                                            {eloChange} ELO
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                              {(match.winner?.email === match.player2?.email ||
                                match.winner?.id === match.player2?.id) && (
                                <Crown className='w-4 h-4 text-yellow-600 flex-shrink-0' />
                              )}
                            </div>
                          </div>
                        </div>

                        {matchDisplay.hasGuests && (
                          <div className='mt-3 text-xs text-orange-600 text-center'>
                            Guest players don't affect ELO ratings
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
