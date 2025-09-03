import React, { useState, useEffect, useCallback } from 'react';
import { User, Users, Shield, ArrowLeft, Trophy, Award } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import type { User as UserType, Group, Match } from '../types';

interface PlayerProfileProps {
  playerId: string;
  currentUser: UserType;
  group: Group | null;
  accessToken: string;
  onBack: () => void;
}

// Helper function to extract username from email for backward compatibility
const emailToUsername = (email: string): string => {
  if (email.endsWith('@foosball.local')) {
    return email.replace('@foosball.local', '');
  }
  return email;
};

export function PlayerProfile({
  playerId,
  currentUser: _currentUser,
  group,
  accessToken,
  onBack,
}: PlayerProfileProps) {
  const [player, setPlayer] = useState<UserType | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Load player data
      const playerResponse = await apiRequest(`/users/${playerId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setPlayer(playerResponse.user);

      // Load player's matches
      const matchesResponse = await apiRequest(`/users/${playerId}/matches`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setMatches(matchesResponse.matches || []);
    } catch (error) {
      logger.error('Failed to load player data', error);
      setError('Failed to load player profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [playerId, accessToken]);

  useEffect(() => {
    loadPlayerData();
  }, [loadPlayerData]);

  if (loading) {
    return (
      <div className='p-4 space-y-6'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={onBack}
            className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>
          <h2 className='text-lg text-gray-800'>Loading Profile...</h2>
        </div>
        <div className='flex items-center justify-center py-12'>
          <div className='w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className='p-4 space-y-6'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={onBack}
            className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>
          <h2 className='text-lg text-gray-800'>Player Profile</h2>
        </div>
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
          {error || 'Player not found'}
        </div>
      </div>
    );
  }

  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const singlesWins = player.singles_wins || 0;
  const singlesLosses = player.singles_losses || 0;
  const doublesWins = player.doubles_wins || 0;
  const doublesLosses = player.doubles_losses || 0;

  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';
  const singlesWinRate =
    singlesWins + singlesLosses > 0
      ? ((singlesWins / (singlesWins + singlesLosses)) * 100).toFixed(1)
      : '0';
  const doublesWinRate =
    doublesWins + doublesLosses > 0
      ? ((doublesWins / (doublesWins + doublesLosses)) * 100).toFixed(1)
      : '0';

  // Get recent matches (last 5)
  const recentMatches = matches.slice(0, 5);

  // Check if this player participates in a match
  const playerParticipatesInMatch = (match: Match): boolean => {
    if (match.matchType === '1v1' || !match.matchType) {
      return match.player1?.id === player.id || match.player2?.id === player.id;
    } else {
      return (
        match.team1?.player1?.id === player.id ||
        match.team1?.player2?.id === player.id ||
        match.team2?.player1?.id === player.id ||
        match.team2?.player2?.id === player.id
      );
    }
  };

  // Determine if player won a match
  const didPlayerWin = (match: Match): boolean => {
    if (match.matchType === '1v1' || !match.matchType) {
      return match.winner?.id === player.id;
    } else {
      const isInTeam1 =
        match.team1?.player1?.id === player.id || match.team1?.player2?.id === player.id;
      if (isInTeam1) {
        return match.winningTeam === 'team1';
      }
      const isInTeam2 =
        match.team2?.player1?.id === player.id || match.team2?.player2?.id === player.id;
      if (isInTeam2) {
        return match.winningTeam === 'team2';
      }
    }
    return false;
  };

  return (
    <div className='p-4 space-y-6'>
      {/* Header with Back Button */}
      <div className='flex items-center space-x-4'>
        <button
          onClick={onBack}
          className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
        </button>
        <h2 className='text-lg text-gray-800'>Player Profile</h2>
      </div>

      {/* Profile Header */}
      <div className='text-center py-6'>
        <div className='w-24 h-24 bg-blue-100 rounded-full mb-4 mx-auto'>
          <Avatar
            src={player.avatarUrl}
            fallback={player.avatar || 'P'}
            className='w-full h-full rounded-full'
            textClassName='text-3xl text-blue-600'
          />
        </div>

        <h2 className='text-2xl text-gray-800'>{player.username || player.name}</h2>
        <p className='text-gray-600 text-sm'>@{player.username || emailToUsername(player.email)}</p>
        {player.isAdmin && (
          <div className='inline-flex items-center space-x-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm mt-2'>
            <Shield className='w-3 h-3' />
            <span>Admin</span>
          </div>
        )}
      </div>

      {/* Overall Stats */}
      <div className='bg-white rounded-lg border border-gray-200'>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='text-lg text-gray-800'>Overall Performance</h3>
        </div>

        <div className='p-4 space-y-4'>
          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>Overall ELO Rating</span>
            <span className='text-purple-600'>{player.elo || 1200}</span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>Total Wins</span>
            <span className='text-green-600'>{player.wins}</span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>Total Losses</span>
            <span className='text-red-600'>{player.losses}</span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>Overall Win Rate</span>
            <span className='text-blue-600'>{winRate}%</span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>Total Games</span>
            <span className='text-gray-800'>{wins + losses}</span>
          </div>

          {/* Win Rate Progress Bar */}
          <div className='mt-4'>
            <div className='flex justify-between text-sm text-gray-600 mb-2'>
              <span>Overall Win Rate</span>
              <span>{winRate}%</span>
            </div>
            <div className='w-full bg-gray-200 rounded-full h-2'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${winRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Mode Stats */}
      <div className='grid grid-cols-1 gap-4'>
        {/* Singles Stats */}
        <div className='bg-white rounded-lg border border-gray-200'>
          <div className='p-4 border-b border-gray-200'>
            <div className='flex items-center space-x-2'>
              <User className='w-5 h-5 text-blue-600' />
              <h3 className='text-lg text-gray-800'>Singles (1v1)</h3>
            </div>
          </div>

          <div className='p-4 space-y-3'>
            <div className='flex justify-between'>
              <span className='text-gray-600'>ELO Rating</span>
              <span className='text-blue-600'>{player.singlesElo || 1200}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-600'>Wins / Losses</span>
              <span className='text-gray-800'>
                {player.singles_wins || 0}W / {player.singles_losses || 0}L
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-600'>Win Rate</span>
              <span className='text-green-600'>{singlesWinRate}%</span>
            </div>
          </div>
        </div>

        {/* Doubles Stats */}
        <div className='bg-white rounded-lg border border-gray-200'>
          <div className='p-4 border-b border-gray-200'>
            <div className='flex items-center space-x-2'>
              <Users className='w-5 h-5 text-purple-600' />
              <h3 className='text-lg text-gray-800'>Doubles (2v2)</h3>
            </div>
          </div>

          <div className='p-4 space-y-3'>
            <div className='flex justify-between'>
              <span className='text-gray-600'>ELO Rating</span>
              <span className='text-purple-600'>{player.doublesElo || 1200}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-600'>Wins / Losses</span>
              <span className='text-gray-800'>
                {player.doubles_wins || 0}W / {player.doubles_losses || 0}L
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-gray-600'>Win Rate</span>
              <span className='text-green-600'>{doublesWinRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className='bg-white rounded-lg border border-gray-200'>
          <div className='p-4 border-b border-gray-200'>
            <h3 className='text-lg text-gray-800'>Recent Matches</h3>
          </div>

          <div className='divide-y divide-gray-200'>
            {recentMatches.filter(playerParticipatesInMatch).map(match => {
              const isWin = didPlayerWin(match);

              return (
                <div key={match.id} className='p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-3'>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isWin ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        {isWin ? (
                          <Trophy className='w-4 h-4 text-green-600' />
                        ) : (
                          <Award className='w-4 h-4 text-red-600' />
                        )}
                      </div>

                      <div>
                        <div className='flex items-center space-x-1'>
                          {match.matchType === '1v1' || !match.matchType ? (
                            <User className='w-4 h-4 text-gray-500' />
                          ) : (
                            <Users className='w-4 h-4 text-gray-500' />
                          )}
                          <span className='text-sm text-gray-600 capitalize'>
                            {match.matchType || '1v1'}
                          </span>
                        </div>
                        <p className={`text-sm ${isWin ? 'text-green-600' : 'text-red-600'}`}>
                          {isWin ? 'Victory' : 'Defeat'}
                        </p>
                      </div>
                    </div>

                    <div className='text-right'>
                      <p className='text-sm text-gray-800'>
                        {match.score1} - {match.score2}
                      </p>
                      <p className='text-xs text-gray-500'>
                        {new Date(match.createdAt || new Date()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group Info */}
      {group && (
        <div className='bg-white rounded-lg border border-gray-200'>
          <div className='p-4 border-b border-gray-200'>
            <h3 className='text-lg text-gray-800'>Group Information</h3>
          </div>

          <div className='p-4'>
            <div className='flex items-center space-x-3'>
              <Users className='w-8 h-8 text-purple-600' />
              <div>
                <h4 className='text-gray-800'>{group.name}</h4>
                <p className='text-sm text-gray-500'>
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
