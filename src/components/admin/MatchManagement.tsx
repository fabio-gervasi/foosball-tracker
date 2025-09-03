import React, { useState } from 'react';
import { Trophy, Calendar, Trash2 } from 'lucide-react';
import { apiRequest } from '../../utils/supabase/client';
import { useDialogContext } from '../common/DialogProvider';
import { formatMatchDisplay } from '../../utils/admin-format-helpers';
import { logger } from '../../utils/logger';
import type { Match, User } from '../../types';

interface MatchManagementProps {
  matches: Match[];
  users: User[];
  accessToken: string;
  loading: boolean;
  onDataChange: () => void;
  onError: (error: string) => void;
  onLoadAdminData: () => void;
}

export function MatchManagement({
  matches,
  users,
  accessToken,
  loading,
  onDataChange,
  onError,
  onLoadAdminData,
}: MatchManagementProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { showSuccess } = useDialogContext();

  const handleDeleteMatch = async (matchId: string) => {
    try {
      onError('');

      logger.info('Deleting match:', { matchId });
      await apiRequest(`/admin/matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Reload data
      await onLoadAdminData();
      onDataChange(); // Refresh main app data
      setDeleteConfirm(null);

      await showSuccess('Match deleted successfully!');
    } catch (error) {
      console.error('Failed to delete match:', error);
      onError(
        `Failed to delete match: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  if (loading) {
    return (
      <div className='text-center py-8'>
        <div className='w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
        <p className='text-gray-600'>Loading admin data...</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='bg-white rounded-lg border border-gray-200 p-4'>
        <h3 className='text-lg text-gray-800 mb-4 flex items-center'>
          <Trophy className='w-5 h-5 mr-2 text-purple-600' />
          Match Management
        </h3>

        {matches.length === 0 ? (
          <div className='text-center py-8'>
            <p className='text-gray-500'>No matches found in this group.</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {matches
              .filter(match => match && match.id)
              .map(match => {
                const matchDisplay = formatMatchDisplay(match);

                return (
                  <div key={match.id} className='border border-gray-200 rounded-lg p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center space-x-2 mb-2'>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              matchDisplay.type === '2v2'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {matchDisplay.type}
                          </span>
                          <span className='text-xs text-gray-500 flex items-center'>
                            <Calendar className='w-3 h-3 mr-1' />
                            {match.date || 'Unknown date'}
                          </span>
                        </div>

                        <p className='text-sm text-gray-700 mb-1'>
                          <strong>Players:</strong> {matchDisplay.participants}
                        </p>
                        <p className='text-sm text-gray-700 mb-2'>
                          <strong>Winner:</strong> {matchDisplay.winner}
                        </p>

                        {match.eloChanges && Object.keys(match.eloChanges).length > 0 && (
                          <div className='text-xs text-gray-600'>
                            <strong>ELO Changes:</strong>{' '}
                            {Object.entries(match.eloChanges).map(
                              ([userId, change]: [string, any]) => {
                                // Find player name using the new relational structure
                                let playerName = userId; // Default to userId if not found

                                // Look through match.players array to find the player
                                if (match.players && Array.isArray(match.players)) {
                                  const player = match.players.find(p => p.user_id === userId);
                                  if (player) {
                                    // Use guest name if it's a guest, otherwise use user name
                                    playerName = player.is_guest ? player.guest_name : (player.users?.name || userId);
                                  }
                                }

                                // Fallback: try to find by email in users array
                                if (playerName === userId) {
                                  const user = users.find(u => u.id === userId);
                                  if (user) playerName = user.name;
                                }

                                return (
                                  <span
                                    key={userId}
                                    className={`ml-2 ${change.change > 0 ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    {playerName}: {change.change > 0 ? '+' : ''}
                                    {change.change}
                                  </span>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>

                      <div className='ml-4'>
                        {deleteConfirm === match.id ? (
                          <div className='flex flex-col space-y-2'>
                            <button
                              onClick={() => handleDeleteMatch(match.id)}
                              className='px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700'
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className='px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400'
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(match.id)}
                            className='p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                            title='Delete Match'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
