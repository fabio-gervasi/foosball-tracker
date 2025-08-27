import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import type {
  User,
  Group,
  Match,
  UserResponse,
  GroupResponse,
  UsersResponse,
  MatchesResponse,
  GroupsResponse
} from '../types';

// Query key factory for consistent cache keys
export const queryKeys = {
  user: () => ['user'] as const,
  currentGroup: () => ['group', 'current'] as const,
  users: () => ['users'] as const,
  matches: () => ['matches'] as const,
  userGroups: () => ['groups', 'user'] as const,
} as const;

// API Response interfaces are now imported from types

/**
 * Hook to fetch current user data
 */
export const useUserQuery = (accessToken: string | null): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: queryKeys.user(),
    queryFn: async (): Promise<User> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current user data');

      const response = await apiRequest('/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }) as UserResponse;

      return response.user;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch current group data
 */
export const useCurrentGroupQuery = (accessToken: string | null): UseQueryResult<Group, Error> => {
  return useQuery({
    queryKey: queryKeys.currentGroup(),
    queryFn: async (): Promise<Group> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current group data');

      const response = await apiRequest('/groups/current', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }) as GroupResponse;

      return response.group;
    },
    enabled: !!accessToken,
    staleTime: 3 * 60 * 1000, // 3 minutes - groups change less frequently
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch all users in current group
 */
export const useUsersQuery = (accessToken: string | null): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: async (): Promise<User[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching users data');

      const response = await apiRequest('/users', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }) as UsersResponse;

      return response.users || [];
    },
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000, // 2 minutes - user stats change frequently
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch matches in current group
 */
export const useMatchesQuery = (accessToken: string | null): UseQueryResult<Match[], Error> => {
  return useQuery({
    queryKey: queryKeys.matches(),
    queryFn: async (): Promise<Match[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching matches data');

      const response = await apiRequest('/matches', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }) as MatchesResponse;

      return response.matches || [];
    },
    enabled: !!accessToken,
    staleTime: 1 * 60 * 1000, // 1 minute - matches change frequently
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch user's groups
 */
export const useUserGroupsQuery = (accessToken: string | null): UseQueryResult<Group[], Error> => {
  return useQuery({
    queryKey: queryKeys.userGroups(),
    queryFn: async (): Promise<Group[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching user groups data');

      const response = await apiRequest('/groups/user-groups', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }) as GroupsResponse;

      return response.groups || [];
    },
    enabled: !!accessToken,
    staleTime: 10 * 60 * 1000, // 10 minutes - groups change rarely
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Combined hook for all app data - provides a simple interface similar to current AppDataContext
 */
export const useAppDataQueries = (accessToken: string | null) => {
  const userQuery = useUserQuery(accessToken);
  const currentGroupQuery = useCurrentGroupQuery(accessToken);
  const usersQuery = useUsersQuery(accessToken);
  const matchesQuery = useMatchesQuery(accessToken);

  // Determine overall loading state
  const isLoading = userQuery.isLoading || currentGroupQuery.isLoading ||
                   usersQuery.isLoading || matchesQuery.isLoading;

  // Determine if any initial load is pending
  const isLoadingInitial = userQuery.isLoading || currentGroupQuery.isLoading ||
                          usersQuery.isLoading || matchesQuery.isLoading;

  // Determine if any data is being fetched (including background)
  const isFetching = userQuery.isFetching || currentGroupQuery.isFetching ||
                    usersQuery.isFetching || matchesQuery.isFetching;

  // Collect any errors
  const errors = [
    userQuery.error,
    currentGroupQuery.error,
    usersQuery.error,
    matchesQuery.error,
  ].filter(Boolean);

  // Get the most relevant error
  const error = errors.length > 0 ? errors[0] : null;

  return {
    // Individual query results
    userQuery,
    currentGroupQuery,
    usersQuery,
    matchesQuery,

    // Extracted data (with defaults)
    currentUser: userQuery.data || null,
    currentGroup: currentGroupQuery.data || null,
    users: usersQuery.data || [],
    matches: matchesQuery.data || [],

    // Loading states
    isLoading,
    isLoadingInitial,
    isFetching,

    // Error state
    error: error?.message || null,

    // Utility functions
    refetchAll: () => {
      userQuery.refetch();
      currentGroupQuery.refetch();
      usersQuery.refetch();
      matchesQuery.refetch();
    },
  };
};
