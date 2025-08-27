import React, { useState } from 'react';
import { Trophy, Calendar, User, ArrowLeft, Trash2, CheckCircle, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiRequest } from '../utils/supabase/client';
import { useDialogContext } from './common/DialogProvider';
import type { User as UserType } from '../types';

interface MatchConfirmationProps {
  matchResult: {
    match: {
      id: string;
      matchType: string;
      date: string;
      seriesType?: string;
      // 1v1 format
      player1?: { id: string; name: string; isGuest?: boolean };
      player2?: { id: string; name: string; isGuest?: boolean };
      winner?: { id: string; name: string; isGuest?: boolean };
      // 2v2 format
      team1?: {
        player1: { id: string; name: string; isGuest?: boolean };
        player2: { id: string; name: string; isGuest?: boolean };
      };
      team2?: {
        player1: { id: string; name: string; isGuest?: boolean };
        player2: { id: string; name: string; isGuest?: boolean };
      };
      winningTeam?: string;
      // Score info
      seriesScore?: string;
      isSweep?: boolean;
    };
    eloChanges: {
      [key: string]: {
        oldRating: number;
        newRating: number;
        change: number;
      };
    };
  };
  currentUser: UserType;
  accessToken: string;
  onBack: () => void;
  onDataChange: () => void;
}

export function MatchConfirmation({ matchResult, currentUser, accessToken, onBack, onDataChange }: MatchConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { showConfirmDialog } = useDialogContext();

  const handleDeleteMatch = async () => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Match',
      description: 'Are you sure you want to delete this match? This action cannot be undone.',
      variant: 'destructive',
      confirmText: 'Delete Match',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await apiRequest(`/matches/${matchResult.match.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Refresh data and go back
      await onDataChange();
      onBack();
    } catch (error) {
      console.error('Failed to delete match:', error);
      setDeleteError(error.message || 'Failed to delete match. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  const getMatchSummary = () => {
    const { match } = matchResult;

    if (match.matchType === '1v1') {
      const winner = match.winner;
      const loser = match.player1?.id === winner?.id ? match.player2 : match.player1;

      const winnerName = winner?.name || winner?.id || 'Unknown Player';
      const loserName = loser?.name || loser?.id || 'Unknown Player';

      return {
        winningTeam: `${winnerName}${winner?.isGuest ? ' (Guest)' : ''}`,
        losingTeam: `${loserName}${loser?.isGuest ? ' (Guest)' : ''}`,
        score: match.seriesScore || '1-0'
      };
    } else {
      // 2v2
      const isTeam1Winner = match.winningTeam === 'team1';
      const winningTeam = isTeam1Winner ? match.team1 : match.team2;
      const losingTeam = isTeam1Winner ? match.team2 : match.team1;

      const winningPlayer1Name = winningTeam?.player1?.name || winningTeam?.player1?.id || 'Unknown';
      const winningPlayer2Name = winningTeam?.player2?.name || winningTeam?.player2?.id || 'Unknown';
      const losingPlayer1Name = losingTeam?.player1?.name || losingTeam?.player1?.id || 'Unknown';
      const losingPlayer2Name = losingTeam?.player2?.name || losingTeam?.player2?.id || 'Unknown';

      return {
        winningTeam: `${winningPlayer1Name}${winningTeam?.player1?.isGuest ? ' (Guest)' : ''} & ${winningPlayer2Name}${winningTeam?.player2?.isGuest ? ' (Guest)' : ''}`,
        losingTeam: `${losingPlayer1Name}${losingTeam?.player1?.isGuest ? ' (Guest)' : ''} & ${losingPlayer2Name}${losingTeam?.player2?.isGuest ? ' (Guest)' : ''}`,
        score: match.seriesScore || '1-0'
      };
    }
  };

  const getAllPlayers = () => {
    const { match } = matchResult;
    const players = [];

    if (match.matchType === '1v1') {
      // Fallback to email-based player info if player objects don't exist
      if (match.player1) {
        players.push(match.player1);
      } else if (match.player1Email) {
        players.push({
          id: match.player1Email,
          name: match.player1Email,
          isGuest: match.player1IsGuest || false
        });
      }

      if (match.player2) {
        players.push(match.player2);
      } else if (match.player2Email) {
        players.push({
          id: match.player2Email,
          name: match.player2Email,
          isGuest: match.player2IsGuest || false
        });
      }
    } else {
      // 2v2 - fallback to email-based info
      if (match.team1?.player1) {
        players.push(match.team1.player1);
      } else if (match.team1Player1Email) {
        players.push({
          id: match.team1Player1Email,
          name: match.team1Player1Email,
          isGuest: match.team1Player1IsGuest || false
        });
      }

      if (match.team1?.player2) {
        players.push(match.team1.player2);
      } else if (match.team1Player2Email) {
        players.push({
          id: match.team1Player2Email,
          name: match.team1Player2Email,
          isGuest: match.team1Player2IsGuest || false
        });
      }

      if (match.team2?.player1) {
        players.push(match.team2.player1);
      } else if (match.team2Player1Email) {
        players.push({
          id: match.team2Player1Email,
          name: match.team2Player1Email,
          isGuest: match.team2Player1IsGuest || false
        });
      }

      if (match.team2?.player2) {
        players.push(match.team2.player2);
      } else if (match.team2Player2Email) {
        players.push({
          id: match.team2Player2Email,
          name: match.team2Player2Email,
          isGuest: match.team2Player2IsGuest || false
        });
      }
    }

    return players;
  };

  const matchSummary = getMatchSummary();
  const allPlayers = getAllPlayers();

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header */}
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl text-blue-600 font-bold mb-2">Match Uploaded!</h2>
        <p className="text-gray-600">Thank you for uploading the match details.<br />Here is a summary of the match:</p>
      </div>

      {/* Match Summary Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Attribute</div>
          <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Value</div>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="px-4 py-3 text-sm text-gray-900">Match ID:</div>
            <div className="px-4 py-3 text-sm text-gray-900">{matchResult.match.id.substring(0, 8)}</div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="px-4 py-3 text-sm text-gray-900">Date:</div>
            <div className="px-4 py-3 text-sm text-gray-900">{formatDate(matchResult.match.date)}</div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="px-4 py-3 text-sm text-gray-900">Winning Team:</div>
            <div className="px-4 py-3 text-sm text-gray-900">
              {matchSummary.winningTeam} (score: {matchSummary.score})
              {matchResult.match.isSweep && <span className="text-green-600 ml-2 font-medium">2-0 Sweep!</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="px-4 py-3 text-sm text-gray-900">Losing Team:</div>
            <div className="px-4 py-3 text-sm text-gray-900">{matchSummary.losingTeam} (score: {matchSummary.score.split('-').reverse().join('-')})</div>
          </div>
        </div>
      </div>

      {/* ELO Changes Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 divide-x divide-gray-200">
          <div className="col-span-7 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Players</div>
          <div className="col-span-2 px-2 py-3 bg-gray-50 text-sm font-medium text-gray-700 text-center">Change</div>
          <div className="col-span-3 px-3 py-3 bg-gray-50 text-sm font-medium text-gray-700 text-center">New Rating</div>
        </div>

        <div className="divide-y divide-gray-200">
          {allPlayers.map((player, index) => {
            // Find ELO change for this player - use simple email matching
            let eloChange = null;

            // Get all possible emails for this player
            const playerEmails = [];
            if (matchResult.match.matchType === '1v1') {
              playerEmails.push(matchResult.match.player1Email, matchResult.match.player2Email);
            } else {
              playerEmails.push(
                matchResult.match.team1Player1Email,
                matchResult.match.team1Player2Email,
                matchResult.match.team2Player1Email,
                matchResult.match.team2Player2Email
              );
            }

            // Find ELO change by matching player email/id
            for (const email of playerEmails) {
              if (email && matchResult.eloChanges[email]) {
                // Direct match by email/id
                if (email === player.id) {
                  eloChange = matchResult.eloChanges[email];
                  break;
                }
              }
            }

            // If no direct match found, try by index (as fallback)
            if (!eloChange) {
              const allEloKeys = Object.keys(matchResult.eloChanges);
              if (allEloKeys[index]) {
                eloChange = matchResult.eloChanges[allEloKeys[index]];
              }
            }

            const change = eloChange?.change || 0;
            const newRating = eloChange?.newRating || 1200;

            return (
              <div key={player.id} className="grid grid-cols-12 divide-x divide-gray-200">
                <div className="col-span-7 px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <Avatar
                      fallback={player.name.charAt(0).toUpperCase()}
                      className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex-shrink-0"
                      textClassName="text-xs"
                    />
                    <span className="text-sm text-gray-900 truncate">
                      {player.name}
                      {player.isGuest && <span className="text-xs text-gray-500 ml-1">(Guest)</span>}
                    </span>
                  </div>
                </div>
                <div className={`col-span-2 px-2 py-3 text-sm text-center font-medium whitespace-nowrap ${
                  change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {change > 0 ? '+' : ''}{change}
                </div>
                <div className="col-span-3 px-3 py-3 text-sm text-gray-900 text-center font-medium">{newRating}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sweep Bonus Info */}
      {matchResult.match.isSweep && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-800 font-medium">
              2-0 Sweep Bonus Applied! ELO changes multiplied by 1.2x
            </span>
          </div>
        </div>
      )}

      {/* Delete Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-600 text-center mb-4">
          If you need to make any corrections, you can delete the match by clicking the button below:
        </p>

        {deleteError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{deleteError}</p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleDeleteMatch}
            disabled={isDeleting}
            className="px-6 py-3 bg-white border-2 border-red-500 text-red-600 rounded-full hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Last Match'}</span>
          </button>
        </div>
      </div>

      {/* Back Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
