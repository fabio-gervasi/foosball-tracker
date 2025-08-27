import React from 'react';
import { useAuth, useAppData, usePermissions, useMatchValidation } from '../../hooks';
import { logger } from '../../utils/logger';

/**
 * Example component demonstrating the use of custom hooks
 * This shows how components become simpler and more focused on UI
 * when business logic is extracted to hooks
 */
export function HookExample() {
  // Authentication state and actions
  const {
    currentUser,
    isLoggedIn,
    isLoading: authLoading,
    logout,
    isAdmin
  } = useAuth();

  // App data state and actions
  const {
    users,
    matches,
    currentGroup,
    isLoading: dataLoading,
    submitMatch,
    isSubmittingMatch,
    getUserStats,
    getCurrentUserStats
  } = useAppData();

  // Permission checking
  const {
    canSubmitMatches,
    canViewAdminPanel,
    hasPermission,
    checkPermission
  } = usePermissions();

  // Match validation
  const {
    validateMatch,
    isValidEmail,
    rules: validationRules
  } = useMatchValidation();

  // Loading state
  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Required</h3>
        <p className="text-gray-600">Please log in to view this content.</p>
      </div>
    );
  }

  // Get current user stats using the hook utility
  const userStats = getCurrentUserStats();

  // Handle match submission with validation
  const handleSubmitExampleMatch = async () => {
    if (!canSubmitMatches) {
      logger.warn('User cannot submit matches');
      return;
    }

    // Example match data
    const matchData = {
      matchType: '1v1' as const,
      player1Email: currentUser?.email || '',
      player2Email: users[0]?.email || '',
      score1: 10,
      score2: 8,
    };

    // Validate before submitting
    const validation = validateMatch(matchData);
    if (!validation.isValid) {
      logger.error('Match validation failed', validation.errors);
      return;
    }

    try {
      await submitMatch(matchData);
      logger.info('Match submitted successfully');
    } catch (error) {
      logger.error('Failed to submit match', error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout failed', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Custom Hooks Demo</h2>

        {/* User Information */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">User Information</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p><strong>Name:</strong> {currentUser?.name}</p>
            <p><strong>Email:</strong> {currentUser?.email}</p>
            <p><strong>Current Group:</strong> {currentGroup?.name || 'None'}</p>
            <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* User Statistics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Statistics</h3>
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Wins</p>
                <p className="text-xl font-bold text-green-600">{userStats.wins}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Losses</p>
                <p className="text-xl font-bold text-red-600">{userStats.losses}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-xl font-bold text-blue-600">{userStats.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ELO</p>
                <p className="text-xl font-bold text-purple-600">{userStats.elo}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Permissions Demo */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Permissions</h3>
          <div className="bg-gray-50 p-4 rounded">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Can Submit Matches:</span>
                <span className={`px-2 py-1 rounded text-sm ${canSubmitMatches ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {canSubmitMatches ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Can View Admin Panel:</span>
                <span className={`px-2 py-1 rounded text-sm ${canViewAdminPanel ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {canViewAdminPanel ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Can Manage Users:</span>
                <span className={`px-2 py-1 rounded text-sm ${hasPermission('manage_users') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {hasPermission('manage_users') ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Data Summary</h3>
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-xl font-bold">{users.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Matches</p>
                <p className="text-xl font-bold">{matches.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Your Rank</p>
                <p className="text-xl font-bold">#{userStats.rank}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Rules */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Match Validation Rules</h3>
          <div className="bg-gray-50 p-4 rounded">
            <div className="space-y-2">
              <p><strong>Min Score:</strong> {validationRules.minScore}</p>
              <p><strong>Max Score:</strong> {validationRules.maxScore}</p>
              <p><strong>Max Score Difference:</strong> {validationRules.maxScoreDifference}</p>
              <p><strong>Requires Winner:</strong> {validationRules.requiresWinner ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          {canSubmitMatches && (
            <button
              onClick={handleSubmitExampleMatch}
              disabled={isSubmittingMatch}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingMatch ? 'Submitting...' : 'Submit Example Match'}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>

          {canViewAdminPanel && (
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              onClick={() => logger.info('Admin panel would open here')}
            >
              Open Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* Permission Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Permission Details</h3>
        <div className="space-y-3">
          {(['admin', 'manage_users', 'submit_matches', 'view_statistics'] as const).map(permission => {
            const permissionCheck = checkPermission(permission);
            return (
              <div key={permission} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{permission.replace('_', ' ').toUpperCase()}</p>
                  {!permissionCheck.allowed && permissionCheck.reason && (
                    <p className="text-sm text-gray-600">{permissionCheck.reason}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  permissionCheck.allowed
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {permissionCheck.allowed ? 'Allowed' : 'Denied'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
