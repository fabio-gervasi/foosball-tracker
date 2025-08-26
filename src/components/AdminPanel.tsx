import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Trophy, Users, Building2 } from 'lucide-react';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import { MatchManagement } from './admin/MatchManagement';
import { UserManagement } from './admin/UserManagement';
import { GroupManagement } from './admin/GroupManagement';

interface AdminPanelProps {
  currentUser: any;
  accessToken: string;
  group: any;
  users: any[];
  onDataChange: () => void;
  onGroupDeleted?: () => void;
}

export function AdminPanel({
  currentUser,
  accessToken,
  group,
  users,
  onDataChange,
  onGroupDeleted
}: AdminPanelProps) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'matches' | 'users' | 'group'>('matches');

  // Debug logging for users prop
  logger.debug('AdminPanel initialized', {
    usersCount: users?.length || 0,
    currentUserName: currentUser?.name,
    groupName: group?.name
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setError('');
      setLoading(true);

      logger.info('Loading admin matches');
      const matchesResponse = await apiRequest('/admin/matches', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setMatches(matchesResponse.matches || []);
      logger.info('Admin matches loaded', { matchCount: matchesResponse.matches?.length || 0 });
    } catch (error) {
      logger.error('Failed to load admin data', error);
      setError('Failed to load admin data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser?.isAdmin) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Access Denied: Admin privileges required</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center py-4">
        <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl text-gray-800">Admin Panel</h2>
        <p className="text-gray-600">Manage matches and users for {group?.name || 'your group'}</p>
      </div>

      {/* Tab Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-3 rounded-lg text-center transition-colors ${
              activeTab === 'matches'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <Trophy className="w-5 h-5" />
              <span className="text-sm">Matches ({matches.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 rounded-lg text-center transition-colors ${
              activeTab === 'users'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <Users className="w-5 h-5" />
              <span className="text-sm">Users ({users.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`px-4 py-3 rounded-lg text-center transition-colors ${
              activeTab === 'group'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <Building2 className="w-5 h-5" />
              <span className="text-sm">Group</span>
            </div>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 text-xs mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'matches' && (
        <MatchManagement
          matches={matches}
          users={users}
          accessToken={accessToken}
          loading={loading}
          onDataChange={onDataChange}
          onError={setError}
          onLoadAdminData={loadAdminData}
        />
      )}

      {activeTab === 'users' && (
        <UserManagement
          users={users}
          currentUser={currentUser}
          accessToken={accessToken}
          onDataChange={onDataChange}
          onError={setError}
        />
      )}

      {activeTab === 'group' && (
        <GroupManagement
          group={group}
          accessToken={accessToken}
          onDataChange={onDataChange}
          onError={setError}
          onGroupDeleted={onGroupDeleted}
        />
      )}
    </div>
  );
}
