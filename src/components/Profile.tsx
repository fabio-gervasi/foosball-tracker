import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Users,
  Code,
  LogOut,
  Shield,
  Camera,
  Upload,
  X,
  Loader2,
  Lock,
  Key,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { apiRequest, supabase } from '../utils/supabase/client';
import { projectId } from '../utils/supabase/info';
import { Avatar } from './Avatar';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { logger } from '../utils/logger';
import { useUserGroupsQuery } from '../hooks/useQueries';
import {
  useGroupSwitchMutation,
  useJoinGroupMutation,
  useCreateGroupMutation,
} from '../hooks/useMutations';
import { useDialogContext } from './common/DialogProvider';
import type { User as UserType, Group, ProfileUpdateData } from '../types';

interface ProfileProps {
  user: UserType;
  group: Group | null;
  accessToken: string;
  onUpdateProfile: (updatedUser: ProfileUpdateData) => Promise<any>;
  onDataChange?: () => void;
  onGroupChanged?: () => void;
}

// Helper function to extract username from email for backward compatibility
const emailToUsername = (email: string): string => {
  if (email.endsWith('@foosball.local')) {
    return email.replace('@foosball.local', '');
  }
  return email;
};

export function Profile({
  user,
  group,
  accessToken,
  onUpdateProfile,
  onDataChange,
  onGroupChanged,
}: ProfileProps) {
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { showSuccess, showError, showConfirmDialog } = useDialogContext();
  const [avatarError, setAvatarError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Multi-group state with React Query
  const {
    data: userGroups = [],
    isLoading: isLoadingGroups,
    refetch: loadUserGroups,
  } = useUserGroupsQuery(accessToken);

  const groupSwitchMutation = useGroupSwitchMutation(accessToken);
  const joinGroupMutation = useJoinGroupMutation(accessToken);
  const createGroupMutation = useCreateGroupMutation(accessToken);

  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [joinGroupForm, setJoinGroupForm] = useState({
    groupCode: '',
  });
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
  });
  const [joinGroupError, setJoinGroupError] = useState('');
  const [joinGroupSuccess, setJoinGroupSuccess] = useState('');
  const [createGroupError, setCreateGroupError] = useState('');
  const [createGroupSuccess, setCreateGroupSuccess] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isSwitchingGroup, setIsSwitchingGroup] = useState(false);

  // React Query automatically loads user groups, no manual loading needed

  // Close group selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showGroupSelector && !(event.target as Element)?.closest('.group-selector')) {
        setShowGroupSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGroupSelector]);

  // loadUserGroups is now handled by React Query hook

  const handleSwitchGroup = async (groupCode: string) => {
    if (groupCode === user.currentGroup) return;

    setIsSwitchingGroup(true);
    try {
      await groupSwitchMutation.mutateAsync({ groupCode });

      setShowGroupSelector(false);

      // Notify parent component to reload data
      if (onGroupChanged) {
        onGroupChanged();
      }
    } catch (error) {
      logger.error('Failed to switch group', error);
      await showError('Failed to switch group. Please try again.');
    } finally {
      setIsSwitchingGroup(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinGroupError('');
    setJoinGroupSuccess('');

    if (!joinGroupForm.groupCode) {
      setJoinGroupError('Group code is required');
      return;
    }

    setIsJoiningGroup(true);

    try {
      const response = await joinGroupMutation.mutateAsync({
        code: joinGroupForm.groupCode,
      });

      setJoinGroupSuccess(
        response.isNewMember
          ? 'Successfully joined group!'
          : 'You are already a member of this group'
      );
      setJoinGroupForm({ groupCode: '' });

      // React Query will automatically refetch user groups

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowJoinGroup(false);
        setJoinGroupSuccess('');
      }, 2000);
    } catch (error) {
      logger.error('Failed to join group', error);
      setJoinGroupError(error instanceof Error ? error.message : 'Failed to join group');
    } finally {
      setIsJoiningGroup(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateGroupError('');
    setCreateGroupSuccess('');

    if (!createGroupForm.name) {
      setCreateGroupError('Group name is required');
      return;
    }

    if (createGroupForm.name.length < 3) {
      setCreateGroupError('Group name must be at least 3 characters');
      return;
    }

    setIsCreatingGroup(true);

    try {
      const response = await createGroupMutation.mutateAsync({
        name: createGroupForm.name,
        code: '', // Let server generate code
      });

      setCreateGroupSuccess(`Successfully created group! Code: ${response.group.code}`);
      setCreateGroupForm({ name: '' });

      // React Query will automatically refetch user groups

      // Notify parent component to reload data since user switched to new group
      if (onGroupChanged) {
        onGroupChanged();
      }

      // Close modal after 3 seconds (longer to show the group code)
      setTimeout(() => {
        setShowCreateGroup(false);
        setCreateGroupSuccess('');
      }, 3000);
    } catch (error) {
      logger.error('Failed to create group', error);
      setCreateGroupError(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const resetJoinGroupForm = () => {
    setJoinGroupForm({ groupCode: '' });
    setJoinGroupError('');
    setJoinGroupSuccess('');
    setShowJoinGroup(false);
  };

  const resetCreateGroupForm = () => {
    setCreateGroupForm({ name: '' });
    setCreateGroupError('');
    setCreateGroupSuccess('');
    setShowCreateGroup(false);
  };

  const handleLeaveGroup = async () => {
    const confirmed = await showConfirmDialog({
      title: 'Leave Group',
      description:
        'Are you sure you want to leave this group? You will lose all your match history and stats.',
      variant: 'destructive',
      confirmText: 'Leave Group',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      // This would require a new API endpoint - for now just show a message
      await showError('Group leaving feature coming soon! For now, please contact your admin.');
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirmDialog({
      title: 'Logout',
      description: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        logger.error('Logout error', error);
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be smaller than 5MB');
      return;
    }

    setAvatarError('');

    // Show preview
    const reader = new FileReader();
    reader.onload = e => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    setAvatarError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-171cbf6f/profile/avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Update local user state
      if (onDataChange) {
        onDataChange();
      }

      setPreviewUrl(null);
      await showSuccess('Profile picture updated successfully!');
    } catch (error) {
      logger.error('Avatar upload error', error);
      setAvatarError(error instanceof Error ? error.message : 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user.avatarUrl) return;

    const confirmed = await showConfirmDialog({
      title: 'Delete Profile Picture',
      description: 'Are you sure you want to delete your profile picture?',
      variant: 'destructive',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    setIsUploadingAvatar(true);
    setAvatarError('');

    try {
      const response = await apiRequest('/profile/avatar', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Update local user state
      if (onDataChange) {
        onDataChange();
      }

      await showSuccess('Profile picture deleted successfully!');
    } catch (error) {
      logger.error('Avatar delete error', error);
      setAvatarError(error instanceof Error ? error.message : 'Failed to delete image');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validate passwords
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // First verify current password by attempting to sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      });

      if (authError) {
        setPasswordError('Current password is incorrect');
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || 'Failed to update password');
        return;
      }

      // Success
      setPasswordSuccess('Password updated successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      logger.error('Password change error', error);
      setPasswordError('Failed to update password. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordError('');
    setPasswordSuccess('');
    setShowPasswordChange(false);
  };

  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';

  return (
    <div className='p-4 space-y-6'>
      {/* Profile Header */}
      <div className='text-center py-6'>
        <div className='relative inline-block'>
          <div className='w-24 h-24 bg-blue-100 rounded-full mb-4 relative'>
            <Avatar
              src={previewUrl || user.avatarUrl}
              fallback={user.avatar || 'U'}
              className='w-full h-full rounded-full'
              textClassName='text-3xl text-blue-600'
            />
            {isUploadingAvatar && (
              <div className='absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full'>
                <Loader2 className='w-6 h-6 text-white animate-spin' />
              </div>
            )}
          </div>

          {/* Avatar Actions */}
          <div className='flex justify-center space-x-2 mb-4'>
            <button
              onClick={triggerFileSelect}
              disabled={isUploadingAvatar}
              className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-full transition-colors'
              title='Upload new profile picture'
            >
              <Camera className='w-4 h-4' />
            </button>

            {user.avatarUrl && (
              <button
                onClick={handleDeleteAvatar}
                disabled={isUploadingAvatar}
                className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white p-2 rounded-full transition-colors'
                title='Delete profile picture'
              >
                <X className='w-4 h-4' />
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            onChange={handleFileSelect}
            className='hidden'
          />

          {/* Avatar Error */}
          {avatarError && (
            <div className='bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-4 max-w-xs mx-auto'>
              {avatarError}
            </div>
          )}
        </div>

        <>
          <h2 className='text-2xl text-gray-800'>{user.username || user.name}</h2>
          <p className='text-gray-600 text-sm'>@{user.username || emailToUsername(user.email)}</p>
          {user.isAdmin && (
            <div className='inline-flex items-center space-x-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm mt-2'>
              <Shield className='w-3 h-3' />
              <span>Admin</span>
            </div>
          )}
        </>
      </div>

      {/* Groups Section */}
      <div className='bg-white rounded-lg border border-gray-200'>
        <div className='p-4 border-b border-gray-200'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg text-gray-800'>Groups</h3>
            <div className='flex space-x-2'>
              <button
                onClick={() => setShowCreateGroup(true)}
                className='bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-lg flex items-center space-x-1 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span>Create</span>
              </button>
              <button
                onClick={() => setShowJoinGroup(true)}
                className='bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-lg flex items-center space-x-1 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span>Join</span>
              </button>
            </div>
          </div>
        </div>

        <div className='p-4'>
          {/* Current Group Selector */}
          {group && (
            <div className='relative group-selector'>
              <button
                onClick={() => setShowGroupSelector(!showGroupSelector)}
                disabled={isSwitchingGroup}
                className='w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors'
              >
                <div className='flex items-center space-x-3'>
                  <div className='w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden'>
                    {group.icon ? (
                      <ImageWithFallback
                        src={group.icon}
                        alt='Group Logo'
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <Users className='w-5 h-5 text-purple-600' />
                    )}
                  </div>
                  <div className='text-left'>
                    <h4 className='text-gray-800'>{group.name}</h4>
                    <p className='text-sm text-gray-500'>
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='text-right'>
                    <div className='flex items-center space-x-2 bg-gray-100 rounded-lg px-2 py-1'>
                      <Code className='w-3 h-3 text-gray-600' />
                      <span className='text-gray-800 tracking-wider text-sm'>{group.code}</span>
                    </div>
                  </div>
                  {isSwitchingGroup ? (
                    <Loader2 className='w-4 h-4 animate-spin text-gray-400' />
                  ) : (
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${showGroupSelector ? 'rotate-180' : ''}`}
                    />
                  )}
                </div>
              </button>

              {/* Group Dropdown */}
              {showGroupSelector && (
                <div className='absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto'>
                  {isLoadingGroups ? (
                    <div className='p-4 text-center'>
                      <Loader2 className='w-5 h-5 animate-spin mx-auto mb-2 text-gray-400' />
                      <p className='text-sm text-gray-500'>Loading groups...</p>
                    </div>
                  ) : userGroups.length > 0 ? (
                    userGroups.map(userGroup => (
                      <button
                        key={userGroup.code}
                        onClick={() => handleSwitchGroup(userGroup.code)}
                        disabled={isSwitchingGroup || userGroup.code === currentGroup?.code}
                        className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          userGroup.code === currentGroup?.code ? 'bg-blue-50 cursor-default' : ''
                        }`}
                      >
                        <div className='flex items-center space-x-3'>
                          <div className='w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden'>
                            {userGroup.icon ? (
                              <ImageWithFallback
                                src={userGroup.icon}
                                alt='Group Logo'
                                className='w-full h-full object-cover'
                              />
                            ) : (
                              <Users className='w-4 h-4 text-purple-600' />
                            )}
                          </div>
                          <div className='text-left'>
                            <h5 className='text-gray-800 text-sm'>{userGroup.name}</h5>
                            <p className='text-xs text-gray-500'>{userGroup.memberCount} members</p>
                          </div>
                        </div>
                        <div className='flex items-center space-x-2'>
                          <span className='text-xs text-gray-600 tracking-wider'>
                            {userGroup.code}
                          </span>
                          {userGroup.code === currentGroup?.code && (
                            <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className='p-4 text-center'>
                      <p className='text-sm text-gray-500'>No groups found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Leave Group Option */}
          {group && (
            <div className='text-center mt-4 pt-4 border-t border-gray-200'>
              <button
                onClick={handleLeaveGroup}
                className='text-red-600 hover:text-red-700 text-sm flex items-center space-x-2 mx-auto'
              >
                <LogOut className='w-4 h-4' />
                <span>Leave Current Group</span>
              </button>
              <p className='text-xs text-gray-500 mt-1'>Warning: You'll lose all match history</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Information */}
      <div className='bg-white rounded-lg border border-gray-200'>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='text-lg text-gray-800'>Account Information</h3>
        </div>

        <div className='p-4 space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <User className='w-5 h-5 text-gray-400' />
              <span className='text-gray-700'>Username</span>
            </div>
            <span className='text-gray-600 text-sm'>{user.username || user.email}</span>
          </div>

          {user.email && !user.email.endsWith('@foosball.app') && (
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <User className='w-5 h-5 text-gray-400' />
                <span className='text-gray-700'>Email</span>
              </div>
              <span className='text-gray-600 text-sm'>{user.email}</span>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <User className='w-5 h-5 text-gray-400' />
              <span className='text-gray-700'>User ID</span>
            </div>
            <span className='text-gray-600 text-sm font-mono'>{user.id.substring(0, 8)}...</span>
          </div>

          {/* Change Password Section */}
          <div className='pt-3 border-t border-gray-200'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <Key className='w-5 h-5 text-blue-600' />
                <span className='text-gray-700'>Password</span>
              </div>
              <button
                onClick={() => setShowPasswordChange(true)}
                className='text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1'
              >
                <Lock className='w-4 h-4' />
                <span>Change Password</span>
              </button>
            </div>
            <p className='text-xs text-gray-500 mt-1 ml-8'>
              Update your account password for security
            </p>
          </div>

          {/* Admin Section */}
          {user.isAdmin && (
            <div className='pt-3 border-t border-gray-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-3'>
                  <Shield className='w-5 h-5 text-purple-600' />
                  <span className='text-gray-700'>Admin Panel</span>
                </div>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' }))
                  }
                  className='bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1 rounded-lg flex items-center space-x-1 transition-colors'
                >
                  <Shield className='w-4 h-4' />
                  <span>Admin</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Section */}
      <div className='bg-white rounded-lg border border-gray-200'>
        <div className='p-4'>
          <div className='text-center'>
            <button
              onClick={handleLogout}
              className='bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto transition-colors'
            >
              <LogOut className='w-5 h-5' />
              <span>Logout</span>
            </button>
            <p className='text-xs text-gray-500 mt-2'>
              You'll need to sign in again to access your account
            </p>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-md w-full'>
            <div className='p-4 border-b border-gray-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <Plus className='w-5 h-5 text-green-600' />
                  <h3 className='text-lg text-gray-800'>Create New Group</h3>
                </div>
                <button
                  onClick={resetCreateGroupForm}
                  className='text-gray-400 hover:text-gray-600'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className='p-4 space-y-4'>
              {/* Group Name */}
              <div>
                <label className='block text-gray-700 text-sm mb-2'>Group Name</label>
                <div className='relative'>
                  <Users className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
                  <input
                    type='text'
                    value={createGroupForm.name}
                    onChange={e => setCreateGroupForm(prev => ({ ...prev, name: e.target.value }))}
                    className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent'
                    placeholder='Enter group name'
                    disabled={isCreatingGroup}
                    required
                  />
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  Choose a name for your foosball group (min. 3 characters)
                </p>
              </div>

              {/* Error Message */}
              {createGroupError && (
                <div className='bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm'>
                  {createGroupError}
                </div>
              )}

              {/* Success Message */}
              {createGroupSuccess && (
                <div className='bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm'>
                  {createGroupSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div className='flex space-x-3 pt-4'>
                <button
                  type='button'
                  onClick={resetCreateGroupForm}
                  className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  disabled={isCreatingGroup}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isCreatingGroup}
                  className='flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2'
                >
                  {isCreatingGroup ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Group</span>
                  )}
                </button>
              </div>
            </form>

            {/* Instructions */}
            <div className='p-4 bg-gray-50 rounded-b-lg'>
              <p className='text-sm text-gray-600 mb-2'>Create your own group:</p>
              <ul className='text-xs text-gray-500 space-y-1'>
                <li>• You'll automatically become the group admin</li>
                <li>• A unique group code will be generated</li>
                <li>• Share the code with others to invite them</li>
                <li>• Manage your group through the Admin Panel</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinGroup && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-md w-full'>
            <div className='p-4 border-b border-gray-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <Plus className='w-5 h-5 text-blue-600' />
                  <h3 className='text-lg text-gray-800'>Join Another Group</h3>
                </div>
                <button onClick={resetJoinGroupForm} className='text-gray-400 hover:text-gray-600'>
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form onSubmit={handleJoinGroup} className='p-4 space-y-4'>
              {/* Group Code */}
              <div>
                <label className='block text-gray-700 text-sm mb-2'>Group Code</label>
                <div className='relative'>
                  <Code className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
                  <input
                    type='text'
                    value={joinGroupForm.groupCode}
                    onChange={e =>
                      setJoinGroupForm(prev => ({
                        ...prev,
                        groupCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase tracking-wider'
                    placeholder='Enter group code'
                    disabled={isJoiningGroup}
                    required
                  />
                </div>
                <p className='text-xs text-gray-500 mt-1'>Get this code from a group member</p>
              </div>

              {/* Error Message */}
              {joinGroupError && (
                <div className='bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm'>
                  {joinGroupError}
                </div>
              )}

              {/* Success Message */}
              {joinGroupSuccess && (
                <div className='bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm'>
                  {joinGroupSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div className='flex space-x-3 pt-4'>
                <button
                  type='button'
                  onClick={resetJoinGroupForm}
                  className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  disabled={isJoiningGroup}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isJoiningGroup}
                  className='flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2'
                >
                  {isJoiningGroup ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <span>Join Group</span>
                  )}
                </button>
              </div>
            </form>

            {/* Instructions */}
            <div className='p-4 bg-gray-50 rounded-b-lg'>
              <p className='text-sm text-gray-600 mb-2'>How to join a group:</p>
              <ul className='text-xs text-gray-500 space-y-1'>
                <li>• Get the group code from a group member or admin</li>
                <li>• Enter the code above to join instantly</li>
                <li>• You can be a member of multiple groups</li>
                <li>• Use the group selector to switch between groups</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-4 border-b border-gray-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <Lock className='w-5 h-5 text-blue-600' />
                  <h3 className='text-lg text-gray-800'>Change Password</h3>
                </div>
                <button onClick={resetPasswordForm} className='text-gray-400 hover:text-gray-600'>
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className='p-4 space-y-4'>
              {/* Current Password */}
              <div>
                <label className='block text-gray-700 text-sm mb-2'>Current Password</label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
                  <input
                    type='password'
                    value={passwordForm.currentPassword}
                    onChange={e =>
                      setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))
                    }
                    className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    placeholder='Enter your current password'
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className='block text-gray-700 text-sm mb-2'>New Password</label>
                <div className='relative'>
                  <Key className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
                  <input
                    type='password'
                    value={passwordForm.newPassword}
                    onChange={e =>
                      setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))
                    }
                    className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    placeholder='Enter your new password'
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className='block text-gray-700 text-sm mb-2'>Confirm New Password</label>
                <div className='relative'>
                  <Key className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
                  <input
                    type='password'
                    value={passwordForm.confirmPassword}
                    onChange={e =>
                      setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    placeholder='Confirm your new password'
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className='bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm'>
                  {passwordError}
                </div>
              )}

              {/* Success Message */}
              {passwordSuccess && (
                <div className='bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm'>
                  {passwordSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div className='flex space-x-3 pt-4'>
                <button
                  type='button'
                  onClick={resetPasswordForm}
                  className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  disabled={isUpdatingPassword}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isUpdatingPassword}
                  className='flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2'
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>

            {/* Password Requirements */}
            <div className='p-4 bg-gray-50 rounded-b-lg'>
              <p className='text-sm text-gray-600 mb-2'>Password Requirements:</p>
              <ul className='text-xs text-gray-500 space-y-1'>
                <li>• Minimum 4 characters (keep it secure!)</li>
                <li>• Must be different from your current password</li>
                <li>• New password and confirmation must match</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Instructions */}
      <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
        <h3 className='text-lg text-green-800 mb-2'>📷 Profile Picture</h3>
        <ul className='text-sm text-green-700 space-y-1'>
          <li>• Click the camera button to upload a new profile picture</li>
          <li>• Supported formats: JPG, PNG, GIF, WebP</li>
          <li>• Maximum file size: 5MB</li>
          <li>• Square images work best for profile pictures</li>
        </ul>
      </div>
    </div>
  );
}
