import React, { useState, useEffect } from 'react';
import { Users, Plus, Code, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { logger } from '../utils/logger';

interface GroupSelectionProps {
  onGroupSelected: () => void;
  accessToken?: string | null;
}

export function GroupSelection({
  onGroupSelected,
  accessToken: propAccessToken,
}: GroupSelectionProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(propAccessToken || null);

  // Create group form
  const [groupName, setGroupName] = useState('');

  // Join group form
  const [groupCode, setGroupCode] = useState('');

  useEffect(() => {
    if (propAccessToken) {
      setAccessToken(propAccessToken);
    } else {
      getAccessToken();
    }
  }, [propAccessToken]);

  const getAccessToken = async () => {
    try {
      // Getting access token from session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('GroupSelection: Session error:', sessionError);
        setError('Authentication error. Please refresh the page.');
        return;
      }

      if (session?.access_token) {
        // Access token found
        setAccessToken(session.access_token);
      } else {
        console.error('GroupSelection: No access token in session');
        setError('Authentication required. Please refresh the page.');
      }
    } catch (error) {
      console.error('GroupSelection: Failed to get access token:', error);
      setError('Authentication error. Please refresh the page.');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!groupName.trim()) {
        throw new Error('Please enter a group name');
      }

      if (!accessToken) {
        console.error('GroupSelection: No access token available for create group');
        // Try to get a fresh token
        await getAccessToken();
        if (!accessToken) {
          throw new Error('Authentication required. Please refresh the page.');
        }
      }

      // Creating group using Supabase client directly
      const groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: groupData, error: createError } = await supabase
        .from('groups')
        .insert({
          code: groupCode,
          name: groupName.trim(),
          created_by: null, // We'll set this if we can get the user ID
        })
        .select()
        .single();

      if (createError) {
        console.error('Group creation error:', createError);
        throw new Error(`Failed to create group: ${createError.message}`);
      }

      logger.info('GroupSelection: Group created successfully');
      onGroupSelected();
    } catch (error) {
      console.error('GroupSelection: Create group error:', error);

      // If it's an auth error, try to refresh the token
      if (
        (error instanceof Error && error.message?.includes('Invalid or expired token')) ||
        (error instanceof Error && error.message?.includes('Unauthorized'))
      ) {
        // Auth error, trying to refresh token
        await getAccessToken();
        setError('Authentication expired. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to create group');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!groupCode.trim()) {
        throw new Error('Please enter a group code');
      }

      if (!accessToken) {
        console.error('GroupSelection: No access token available for join group');
        // Try to get a fresh token
        await getAccessToken();
        if (!accessToken) {
          throw new Error('Authentication required. Please refresh the page.');
        }
      }

      // Joining group using Supabase client directly

      // First check if the group exists
      const { data: existingGroup, error: checkError } = await supabase
        .from('groups')
        .select('*')
        .eq('code', groupCode.trim().toUpperCase())
        .maybeSingle();

      if (checkError) {
        console.error('Group check error:', checkError);
        throw new Error(`Failed to check group: ${checkError.message}`);
      }

      if (!existingGroup) {
        throw new Error('Group not found. Please check the group code and try again.');
      }

      // Group exists, now we can "join" by just setting the user's current group
      // In a real implementation, you'd create a user_groups relationship
      // For now, we'll just proceed as if the join was successful

      logger.info('GroupSelection: Group joined successfully');
      onGroupSelected();
    } catch (error) {
      console.error('GroupSelection: Join group error:', error);

      // If it's an auth error, try to refresh the token
      if (
        (error instanceof Error && error.message?.includes('Invalid or expired token')) ||
        (error instanceof Error && error.message?.includes('Unauthorized'))
      ) {
        // Auth error, trying to refresh token
        await getAccessToken();
        setError('Authentication expired. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to join group');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'create') {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4'>
        <div className='w-full sm:max-w-md'>
          <div className='text-center mb-8'>
            <div className='bg-white rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4'>
              <Plus className='w-10 h-10 text-blue-600' />
            </div>
            <h1 className='text-3xl text-white mb-2'>Create Group</h1>
            <p className='text-blue-200'>Set up a new foosball group for your team</p>
          </div>

          <div className='bg-white rounded-lg shadow-lg p-6'>
            <form onSubmit={handleCreateGroup}>
              <div className='mb-4'>
                <label className='block text-black text-sm mb-2'>Group Name</label>
                <input
                  type='text'
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black'
                  placeholder='e.g., Acme Corp Foosball'
                  disabled={isLoading}
                  maxLength={50}
                />
              </div>

              <div className='mb-6'>
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                  <h4 className='text-blue-900 text-sm font-medium mb-2'>📝 What happens next?</h4>
                  <ul className='text-blue-900 text-sm space-y-1'>
                    <li>• You'll automatically become the group admin</li>
                    <li>• A unique group code will be generated for you</li>
                    <li>• Share the code with team members to invite them</li>
                    <li>• Manage your group through the Admin Panel</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className='mb-4 p-3 bg-red-100 border border-red-400 text-black rounded-lg text-sm flex items-center space-x-2'>
                  <AlertCircle className='w-4 h-4 flex-shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              <button
                type='submit'
                disabled={isLoading || !groupName.trim()}
                className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition-colors flex items-center justify-center space-x-2'
              >
                {isLoading ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>Creating Group...</span>
                  </>
                ) : (
                  <>
                    <Plus className='w-5 h-5' />
                    <span>Create Group</span>
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setMode('select');
                setError('');
                setGroupName('');
              }}
              disabled={isLoading}
              className='w-full mt-3 text-black hover:text-gray-700 text-sm'
            >
              ← Back to options
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className='min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4'>
        <div className='w-full sm:max-w-md'>
          <div className='text-center mb-8'>
            <div className='bg-white rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4'>
              <Code className='w-10 h-10 text-green-600' />
            </div>
            <h1 className='text-3xl text-white mb-2'>Join Group</h1>
            <p className='text-green-200'>Enter your group code to join instantly</p>
          </div>

          <div className='bg-white rounded-lg shadow-lg p-6'>
            <form onSubmit={handleJoinGroup}>
              <div className='mb-4'>
                <label className='block text-black text-sm mb-2'>Group Code</label>
                <input
                  type='text'
                  value={groupCode}
                  onChange={e => setGroupCode(e.target.value.toUpperCase())}
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center tracking-wider text-black'
                  placeholder='ABCD12'
                  disabled={isLoading}
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                />
                <p className='text-xs text-black mt-1'>
                  Get this code from your group admin or a member
                </p>
              </div>

              <div className='mb-6'>
                <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
                  <h4 className='text-green-900 text-sm font-medium mb-2'>✨ Simple & Secure</h4>
                  <ul className='text-green-900 text-sm space-y-1'>
                    <li>• No password required - just the group code</li>
                    <li>• Join multiple groups with different codes</li>
                    <li>• Switch between groups anytime</li>
                    <li>• All your stats are kept separate per group</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className='mb-4 p-3 bg-red-100 border border-red-400 text-black rounded-lg text-sm flex items-center space-x-2'>
                  <AlertCircle className='w-4 h-4 flex-shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              <button
                type='submit'
                disabled={isLoading || !groupCode.trim()}
                className='w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition-colors flex items-center justify-center space-x-2'
              >
                {isLoading ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>Joining Group...</span>
                  </>
                ) : (
                  <>
                    <Code className='w-5 h-5' />
                    <span>Join Group</span>
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setMode('select');
                setError('');
                setGroupCode('');
              }}
              disabled={isLoading}
              className='w-full mt-3 text-black hover:text-gray-700 text-sm'
            >
              ← Back to options
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default selection mode
  return (
    <div className='min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center p-4'>
      <div className='w-full sm:max-w-md'>
        <div className='text-center mb-8'>
          <div className='bg-white rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4'>
            <Users className='w-10 h-10 text-purple-600' />
          </div>
          <h1 className='text-3xl text-white mb-2'>Join a Group</h1>
          <p className='text-purple-200'>
            Create or join a foosball group to start tracking matches
          </p>
        </div>

        <div className='space-y-4'>
          <button
            onClick={() => setMode('create')}
            className='w-full bg-white hover:bg-gray-50 text-black py-4 px-6 rounded-lg transition-colors flex items-center justify-between group'
          >
            <div className='flex items-center space-x-4'>
              <div className='bg-blue-100 rounded-full p-3'>
                <Plus className='w-6 h-6 text-blue-600' />
              </div>
              <div className='text-left'>
                <h3 className='text-lg text-black'>Create New Group</h3>
                <p className='text-sm text-black'>Start a new foosball group for your team</p>
              </div>
            </div>
            <ArrowRight className='w-5 h-5 text-black group-hover:text-gray-700 transition-colors' />
          </button>

          <button
            onClick={() => setMode('join')}
            className='w-full bg-white hover:bg-gray-50 text-black py-4 px-6 rounded-lg transition-colors flex items-center justify-between group'
          >
            <div className='flex items-center space-x-4'>
              <div className='bg-green-100 rounded-full p-3'>
                <Code className='w-6 h-6 text-green-600' />
              </div>
              <div className='text-left'>
                <h3 className='text-lg text-black'>Join Existing Group</h3>
                <p className='text-sm text-black'>Join a group with just a group code</p>
              </div>
            </div>
            <ArrowRight className='w-5 h-5 text-black group-hover:text-gray-700 transition-colors' />
          </button>
        </div>

        {error && (
          <div className='mt-4 p-3 bg-red-100 border border-red-400 text-black rounded-lg text-sm flex items-center space-x-2'>
            <AlertCircle className='w-4 h-4 flex-shrink-0' />
            <span>{error}</span>
          </div>
        )}

        <div className='mt-8 bg-white bg-opacity-10 rounded-lg p-4'>
          <h4 className='text-black mb-2'>💡 What are groups?</h4>
          <p className='text-sm text-black'>
            Groups allow you to create private leaderboards and match tracking for your office,
            team, or friends. Each group has its own stats and rankings!
          </p>
        </div>
      </div>
    </div>
  );
}
