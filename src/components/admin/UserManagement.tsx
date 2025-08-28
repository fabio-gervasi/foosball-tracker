import React from 'react';
import { Users, Crown, Trash2 } from 'lucide-react';
import { apiRequest } from '../../utils/supabase/client';
import { useDialogContext } from '../common/DialogProvider';
import type { User } from '../../types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  accessToken: string;
  onDataChange: () => void;
  onError: (error: string) => void;
}

export function UserManagement({
  users,
  currentUser,
  accessToken,
  onDataChange,
  onError
}: UserManagementProps) {
  const { showSuccess, showError } = useDialogContext();

  const handleToggleAdminStatus = async (userId: string, currentAdminStatus: boolean) => {
    try {
      onError('');

      console.log('Toggling admin status for user:', userId, 'to', !currentAdminStatus);
      await apiRequest(`/admin/users/${userId}/admin`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ isAdmin: !currentAdminStatus }),
      });

      onDataChange(); // Refresh main app data
      await showSuccess(`User admin status ${!currentAdminStatus ? 'granted' : 'revoked'} successfully!`);
    } catch (error) {
      console.error('Failed to update admin status:', error);
      onError(`Failed to update admin status: ${  error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      onError('');

      console.log('Deleting user:', userId);
      await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Refresh main app data
      onDataChange();

      await showSuccess('User deleted successfully!');
    } catch (error) {
      console.error('Failed to delete user:', error);
      onError(`Failed to delete user: ${  error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg text-gray-800 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-purple-600" />
          User Management
        </h3>

        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No users found in this group.</p>
            <p className="text-xs text-gray-400 mt-2">
              If you expected to see users here, try refreshing the page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                      {user.avatar || user.name[0]}
                    </div>
                    <div>
                      <p className="text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-600 mt-1">
                        <span>Singles: {user.singlesWins || 0}W-{user.singlesLosses || 0}L</span>
                        <span>Doubles: {user.doublesWins || 0}W-{user.doublesLosses || 0}L</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {user.isAdmin && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full flex items-center">
                        <Crown className="w-3 h-3 mr-1" />
                        Admin
                      </span>
                    )}

                    {user.id !== currentUser.id && (
                      <>
                        <button
                          onClick={() => handleToggleAdminStatus(user.id, user.isAdmin)}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            user.isAdmin
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
                                <br /><br />
                                The user will be removed from player selection, but their match history and rankings will be preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                              >
                                Delete User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
