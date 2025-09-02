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
  GroupsResponse,
} from '../types';

// Query key factory for consistent cache keys
export const queryKeys = {
  user: () => ['user'] as const,
  currentGroup: () => ['group', 'current'] as const,
  users: () => ['users'] as const,
  matches: () => ['matches'] as const,
  userGroups: () => ['groups', 'user'] as const,
} as const;

/**
 * Hook to fetch current user data from relational database
 */
export const useUserQuery = (accessToken: string | null): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: queryKeys.user(),
    queryFn: async (): Promise<User> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current user data (relational)');

      const response = (await apiRequest('/user-relational', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })) as UserResponse;
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
 * Hook to fetch current group data from relational database
 */
export const useCurrentGroupQuery = (accessToken: string | null): UseQueryResult<Group, Error> => {
  return useQuery({
    queryKey: queryKeys.currentGroup(),
    queryFn: async (): Promise<Group> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current group data (relational)');

      const response = (await apiRequest('/groups/current-relational', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })) as GroupResponse;
      return response.group;
    },
    enabled: !!accessToken,
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch all users in current group from relational database
 */
export const useUsersQuery = (accessToken: string | null): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: async (): Promise<User[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching users data (relational)');

      const response = (await apiRequest('/users-relational', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })) as UsersResponse;
      return response.users || [];
    },
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch matches in current group from relational database
 */
export const useMatchesQuery = (accessToken: string | null): UseQueryResult<Match[], Error> => {
  return useQuery({
    queryKey: queryKeys.matches(),
    queryFn: async (): Promise<Match[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching matches data (relational)');

      const response = (await apiRequest('/matches-relational', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })) as MatchesResponse;
      return response.matches || [];
    },
    enabled: !!accessToken,
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch user's groups from relational database
 */
export const useUserGroupsQuery = (accessToken: string | null): UseQueryResult<Group[], Error> => {
  return useQuery({
    queryKey: queryKeys.userGroups(),
    queryFn: async (): Promise<Group[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching user groups data (relational)');

      const response = (await apiRequest('/groups/user-relational', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })) as GroupsResponse;
      return response.groups || [];
    },
    enabled: !!accessToken,
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Combined hook for all app data queries
 * Provides a unified interface for accessing all data
 */
export const useAppDataQueries = (accessToken: string | null) => {
  const userQuery = useUserQuery(accessToken);
  const currentGroupQuery = useCurrentGroupQuery(accessToken);
  const usersQuery = useUsersQuery(accessToken);
  const matchesQuery = useMatchesQuery(accessToken);
  const userGroupsQuery = useUserGroupsQuery(accessToken);

  // Extract data
  const currentUser = userQuery.data;
  const currentGroup = currentGroupQuery.data;
  const users = usersQuery.data || [];
  const matches = matchesQuery.data || [];

  // Combined loading states
  const isLoading =
    userQuery.isLoading ||
    currentGroupQuery.isLoading ||
    usersQuery.isLoading ||
    matchesQuery.isLoading;
  const isFetching =
    userQuery.isFetching ||
    currentGroupQuery.isFetching ||
    usersQuery.isFetching ||
    matchesQuery.isFetching;
  const isLoadingInitial =
    userQuery.isLoading || (currentGroupQuery.isLoading && !currentGroupQuery.data);

  // Combined error state
  const error =
    userQuery.error?.message ||
    currentGroupQuery.error?.message ||
    usersQuery.error?.message ||
    matchesQuery.error?.message ||
    null;

  // Refetch all function
  const refetchAll = () => {
    userQuery.refetch();
    currentGroupQuery.refetch();
    usersQuery.refetch();
    matchesQuery.refetch();
    userGroupsQuery.refetch();
  };

  return {
    // Data
    currentUser,
    currentGroup,
    users,
    matches,
    userGroups: userGroupsQuery.data || [],

    // Individual queries for advanced usage
    userQuery,
    currentGroupQuery,
    usersQuery,
    matchesQuery,
    userGroupsQuery,

    // Combined states
    isLoading,
    isFetching,
    isLoadingInitial,
    error,

    // Actions
    refetchAll,
  };
};
