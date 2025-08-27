import React, { useState } from 'react';
import { Trophy, TrendingUp, Users, User } from 'lucide-react';
import { Avatar } from '../Avatar';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import type { User as UserType, Group } from '../../types';

interface LeaderboardProps {
  users: UserType[];
  group: Group | null;
  currentUser?: UserType;
  accessToken?: string;
}

export function Leaderboard({ users, group, currentUser, accessToken }: LeaderboardProps) {
  const [gameMode, setGameMode] = useState<'singles' | 'doubles'>('singles');
  const [sortBy, setSortBy] = useState<'elo' | 'winRate' | 'totalWins' | 'totalGames'>('elo');

  const getSortedUsers = () => {
    return [...users].sort((a, b) => {
      const aWins = gameMode === 'singles' ? (a.singlesWins || 0) : (a.doublesWins || 0);
      const aLosses = gameMode === 'singles' ? (a.singlesLosses || 0) : (a.doublesLosses || 0);
      const aElo = gameMode === 'singles' ? (a.singlesElo || 1200) : (a.doublesElo || 1200);

      const bWins = gameMode === 'singles' ? (b.singlesWins || 0) : (b.doublesWins || 0);
      const bLosses = gameMode === 'singles' ? (b.singlesLosses || 0) : (b.doublesLosses || 0);
      const bElo = gameMode === 'singles' ? (b.singlesElo || 1200) : (b.doublesElo || 1200);

      switch (sortBy) {
        case 'elo':
          return bElo - aElo;
        case 'winRate':
          const aWinRate = aWins + aLosses > 0 ? aWins / (aWins + aLosses) : 0;
          const bWinRate = bWins + bLosses > 0 ? bWins / (bWins + bLosses) : 0;
          if (aWinRate === bWinRate) {
            return bElo - aElo; // Tie-breaker: ELO
          }
          return bWinRate - aWinRate;
        case 'totalWins':
          return bWins - aWins;
        case 'totalGames':
          return (bWins + bLosses) - (aWins + aLosses);
        default:
          return bElo - aElo;
      }
    });
  };

  const sortedUsers = getSortedUsers();

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg border-2 border-yellow-300">
            <span className="text-white text-sm font-bold">1</span>
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg border-2 border-gray-200">
            <span className="text-white text-sm font-bold">2</span>
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg border-2 border-amber-400">
            <span className="text-white text-sm font-bold">3</span>
          </div>
        );
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 text-sm">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
          {group?.icon ? (
            <ImageWithFallback
              src={group.icon}
              alt="Group Logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <Trophy className="w-8 h-8 text-yellow-500" />
          )}
        </div>
        <h2 className="text-2xl text-gray-800">Group Rankings</h2>
        <p className="text-gray-600">See how you rank in {group?.name || 'your group'}</p>
      </div>

      {/* Game Mode and Sorting Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg text-gray-800 mb-3">Game Mode & Sorting</h3>

        {/* Game Mode Selection */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setGameMode('singles')}
            className={`px-4 py-3 rounded-lg text-center transition-colors ${
              gameMode === 'singles'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <User className="w-5 h-5" />
              <span className="text-sm">Singles (1v1)</span>
            </div>
          </button>
          <button
            onClick={() => setGameMode('doubles')}
            className={`px-4 py-3 rounded-lg text-center transition-colors ${
              gameMode === 'doubles'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <Users className="w-5 h-5" />
              <span className="text-sm">Doubles (2v2)</span>
            </div>
          </button>
        </div>

        {/* Sorting Control */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-600 mb-2">Sort by:</p>
          <div className="inline-flex bg-gray-100 rounded-lg p-1 w-full">
            <button
              onClick={() => setSortBy('elo')}
              className={`flex-1 px-3 py-2 text-xs transition-all duration-200 rounded-md ${
                sortBy === 'elo'
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              ELO Rating
            </button>
            <button
              onClick={() => setSortBy('winRate')}
              className={`flex-1 px-3 py-2 text-xs transition-all duration-200 rounded-md ${
                sortBy === 'winRate'
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Win Rate
            </button>
            <button
              onClick={() => setSortBy('totalWins')}
              className={`flex-1 px-3 py-2 text-xs transition-all duration-200 rounded-md ${
                sortBy === 'totalWins'
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Total Wins
            </button>
            <button
              onClick={() => setSortBy('totalGames')}
              className={`flex-1 px-3 py-2 text-xs transition-all duration-200 rounded-md ${
                sortBy === 'totalGames'
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Games Played
            </button>
          </div>
        </div>
      </div>



      {/* Full Rankings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg text-gray-800">Complete Rankings</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {sortedUsers.map((user, index) => {
            const rank = index + 1;
            const wins = gameMode === 'singles' ? (user.singlesWins || 0) : (user.doublesWins || 0);
            const losses = gameMode === 'singles' ? (user.singlesLosses || 0) : (user.doublesLosses || 0);
            const elo = gameMode === 'singles' ? (user.singlesElo || 1200) : (user.doublesElo || 1200);
            const totalGames = wins + losses;
            const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : '0';

            return (
              <div key={user.id} className="p-4">
                <div className="flex items-center space-x-4">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    {getRankIcon(rank)}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gray-100">
                    <Avatar
                      src={user.avatarUrl}
                      fallback={user.avatar}
                      className="w-full h-full rounded-full"
                      textClassName="text-lg text-gray-600"
                    />
                  </div>

                  {/* Player Info */}
                  <div className="flex-1">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('showPlayerProfile', {
                          detail: { playerId: user.id }
                        }));
                      }}
                      className="text-left hover:underline transition-colors text-gray-800 hover:text-blue-600"
                    >
                      {user.username || user.name}
                    </button>
                    <div className="space-y-0.5">
                      <p className="text-sm text-gray-500">
                        ELO: {elo}
                      </p>
                      <p className="text-sm text-gray-500">
                        {wins}W / {losses}L
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <p className="text-lg">{elo}</p>
                        <p className="text-xs text-gray-500">
                          ELO
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-lg">{winRate}%</p>
                        <p className="text-xs text-gray-500">
                          Win Rate
                        </p>
                      </div>
                    </div>
                  </div>
                </div>


              </div>
            );
          })}
        </div>
      </div>

      {/* Group Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg text-gray-800 mb-4">Group Statistics</h3>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl text-gray-800">{users.length}</p>
            <p className="text-sm text-gray-600">Active Players</p>
          </div>

          <div>
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl text-gray-800">
              {users.reduce((total, user) => total + user.wins + user.losses, 0)}
            </p>
            <p className="text-sm text-gray-600">Total Matches</p>
          </div>
        </div>
      </div>

      {/* Encourage participation for small groups */}
      {users.length < 5 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg text-yellow-800 mb-2">🎯 Grow Your Competition</h3>
          <p className="text-sm text-yellow-700 mb-2">
            Invite more colleagues to join <strong>{group?.name}</strong> for a more competitive leaderboard!
          </p>
          <p className="text-xs text-yellow-600">
            Share group code: <span className="font-mono bg-yellow-100 px-1 rounded">{group?.code}</span>
          </p>
        </div>
      )}
    </div>
  );
}
