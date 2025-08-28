import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
import { queryKeys } from './useQueries';
import type {
  User,
  Match,
  Group,
  MatchSubmissionData,
  ProfileUpdateData,
  GroupSwitchData,
} from '../types';

/**
 * Hook for submitting matches with optimistic updates
 */
export const useSubmitMatchMutation = (
  accessToken: string | null
): UseMutationResult<any, Error, MatchSubmissionData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchData: MatchSubmissionData) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Submitting match', { matchType: matchData.matchType });

      const response = await apiRequest('/matches', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchData),
      });

      return response;
    },
    onMutate: async matchData => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.matches() });
      await queryClient.cancelQueries({ queryKey: queryKeys.users() });

      // Snapshot the previous values
      const previousMatches = queryClient.getQueryData<Match[]>(queryKeys.matches());
      const previousUsers = queryClient.getQueryData<User[]>(queryKeys.users());

      // Optimistically add the new match to the beginning of the list
      if (previousMatches) {
        const optimisticMatch: Match = {
          id: `temp-${Date.now()}`, // Temporary ID
          matchType: matchData.matchType,
          player1: matchData.player1Email ? { email: matchData.player1Email } : undefined,
          player2: matchData.player2Email ? { email: matchData.player2Email } : undefined,
          team1: matchData.team1Player1Email
            ? {
                player1: { email: matchData.team1Player1Email },
                player2: { email: matchData.team1Player2Email },
              }
            : undefined,
          team2: matchData.team2Player1Email
            ? {
                player1: { email: matchData.team2Player1Email },
                player2: { email: matchData.team2Player2Email },
              }
            : undefined,
          score1: matchData.score1,
          score2: matchData.score2,
          groupId: 'current', // Will be updated by server response
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Match[]>(queryKeys.matches(), [
          optimisticMatch,
          ...previousMatches,
        ]);
      }

      return { previousMatches, previousUsers };
    },
    onError: (error, matchData, context) => {
      // Rollback to previous state on error
      if (context?.previousMatches) {
        queryClient.setQueryData(queryKeys.matches(), context.previousMatches);
      }
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users(), context.previousUsers);
      }

      const processedError = handleApiError(error, { matchData });
      logger.error('Failed to submit match', processedError);
    },
    onSuccess: (data, matchData) => {
      logger.info('Match submitted successfully');

      // Invalidate and refetch to get the real data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.matches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });

      // Also invalidate current user data as their stats may have changed
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
    },
    onSettled: () => {
      // Always refetch matches and users after mutation settles
      queryClient.invalidateQueries({ queryKey: queryKeys.matches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
};

/**
 * Hook for updating user profile with optimistic updates
 */
export const useUpdateProfileMutation = (
  accessToken: string | null
): UseMutationResult<any, Error, ProfileUpdateData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: ProfileUpdateData) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Updating profile', { fields: Object.keys(profileData) });

      const response = await apiRequest('/user', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      return response;
    },
    onMutate: async profileData => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user() });

      // Snapshot the previous user data
      const previousUser = queryClient.getQueryData<User>(queryKeys.user());

      // Optimistically update the user data
      if (previousUser) {
        queryClient.setQueryData<User>(queryKeys.user(), {
          ...previousUser,
          ...profileData,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousUser };
    },
    onError: (error, profileData, context) => {
      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(queryKeys.user(), context.previousUser);
      }

      const processedError = handleApiError(error, { profileData });
      logger.error('Failed to update profile', processedError);
    },
    onSuccess: (data, profileData) => {
      logger.info('Profile updated successfully');
    },
    onSettled: () => {
      // Refetch user data to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
};

/**
 * Hook for switching groups
 */
export const useGroupSwitchMutation = (
  accessToken: string | null
): UseMutationResult<any, Error, GroupSwitchData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupData: GroupSwitchData) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Switching group', { groupCode: groupData.groupCode });

      const response = await apiRequest('/groups/switch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      return response;
    },
    onSuccess: (data, groupData) => {
      logger.info('Group switched successfully', { groupCode: groupData.groupCode });

      // Invalidate all data since we're switching groups
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentGroup() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches() });
    },
    onError: (error, groupData) => {
      const processedError = handleApiError(error, { groupData });
      logger.error('Failed to switch group', processedError);
    },
  });
};

/**
 * Hook for creating a new group
 */
export const useCreateGroupMutation = (
  accessToken: string | null
): UseMutationResult<any, Error, { name: string; code: string }> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupData: { name: string; code: string }) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Creating group', { name: groupData.name, code: groupData.code });

      const response = await apiRequest('/groups', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      return response;
    },
    onSuccess: (data, groupData) => {
      logger.info('Group created successfully', { name: groupData.name });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentGroup() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
    },
    onError: (error, groupData) => {
      const processedError = handleApiError(error, { groupData });
      logger.error('Failed to create group', processedError);
    },
  });
};

/**
 * Hook for joining a group
 */
export const useJoinGroupMutation = (
  accessToken: string | null
): UseMutationResult<any, Error, { code: string }> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupData: { code: string }) => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Joining group', { code: groupData.code });

      const response = await apiRequest('/groups/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });

      return response;
    },
    onSuccess: (data, groupData) => {
      logger.info('Joined group successfully', { code: groupData.code });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentGroup() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches() });
    },
    onError: (error, groupData) => {
      const processedError = handleApiError(error, { groupData });
      logger.error('Failed to join group', processedError);
    },
  });
};

/**
 * General data refresh mutation for manual refresh operations
 */
export const useRefreshDataMutation = (): UseMutationResult<void, Error, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // This is just a trigger for invalidation, no actual API call
      logger.debug('Manually refreshing all data');
    },
    onSuccess: () => {
      // Invalidate all queries to trigger fresh fetches
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentGroup() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });

      logger.info('Data refresh triggered');
    },
  });
};
