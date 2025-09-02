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

// Configuration for migration mode
const MIGRATION_MODE = process.env.REACT_APP_MIGRATION_MODE || 'kv'; // 'kv' or 'relational'

// Query key factory for consistent cache keys
export const hybridQueryKeys = {
  user: () => ['user'] as const,
  currentGroup: () => ['group', 'current'] as const,
  users: () => ['users'] as const,
  matches: () => ['matches'] as const,
  userGroups: () => ['groups', 'user'] as const,
} as const;

/**
 * Hybrid hook to fetch current user data
 * Works with both KV store and relational database
 */
export const useHybridUserQuery = (accessToken: string | null): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: hybridQueryKeys.user(),
    queryFn: async (): Promise<User> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current user data (hybrid mode)');

      try {
        // Try relational database first (if in relational mode)
        if (MIGRATION_MODE === 'relational') {
          const response = (await apiRequest('/user-relational', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as UserResponse;
          return response.user;
        } else {
          // Fall back to KV store
          const response = (await apiRequest('/user', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as UserResponse;
          return response.user;
        }
      } catch (error) {
        // If relational fails, try KV store as fallback
        logger.warn('Relational query failed, falling back to KV store', error);
        const response = (await apiRequest('/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })) as UserResponse;
        return response.user;
      }
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
 * Hybrid hook to fetch current group data
 */
export const useHybridCurrentGroupQuery = (accessToken: string | null): UseQueryResult<Group, Error> => {
  return useQuery({
    queryKey: hybridQueryKeys.currentGroup(),
    queryFn: async (): Promise<Group> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching current group data (hybrid mode)');

      try {
        if (MIGRATION_MODE === 'relational') {
          const response = (await apiRequest('/groups/current-relational', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as GroupResponse;
          return response.group;
        } else {
          const response = (await apiRequest('/groups/current', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as GroupResponse;
          return response.group;
        }
      } catch (error) {
        logger.warn('Relational group query failed, falling back to KV store', error);
        const response = (await apiRequest('/groups/current', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })) as GroupResponse;
        return response.group;
      }
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
 * Hybrid hook to fetch all users in current group
 */
export const useHybridUsersQuery = (accessToken: string | null): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: hybridQueryKeys.users(),
    queryFn: async (): Promise<User[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching users data (hybrid mode)');

      try {
        if (MIGRATION_MODE === 'relational') {
          const response = (await apiRequest('/users-relational', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as UsersResponse;
          return response.users || [];
        } else {
          const response = (await apiRequest('/users', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as UsersResponse;
          return response.users || [];
        }
      } catch (error) {
        logger.warn('Relational users query failed, falling back to KV store', error);
        const response = (await apiRequest('/users', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })) as UsersResponse;
        return response.users || [];
      }
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
 * Hybrid hook to fetch matches in current group
 */
export const useHybridMatchesQuery = (accessToken: string | null): UseQueryResult<Match[], Error> => {
  return useQuery({
    queryKey: hybridQueryKeys.matches(),
    queryFn: async (): Promise<Match[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching matches data (hybrid mode)');

      try {
        if (MIGRATION_MODE === 'relational') {
          const response = (await apiRequest('/matches-relational', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as MatchesResponse;
          return response.matches || [];
        } else {
          const response = (await apiRequest('/matches', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as MatchesResponse;
          return response.matches || [];
        }
      } catch (error) {
        logger.warn('Relational matches query failed, falling back to KV store', error);
        const response = (await apiRequest('/matches', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })) as MatchesResponse;
        return response.matches || [];
      }
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
 * Hybrid hook to fetch user's groups
 */
export const useHybridUserGroupsQuery = (accessToken: string | null): UseQueryResult<Group[], Error> => {
  return useQuery({
    queryKey: hybridQueryKeys.userGroups(),
    queryFn: async (): Promise<Group[]> => {
      if (!accessToken) {
        throw new Error('No access token available');
      }

      logger.debug('Fetching user groups data (hybrid mode)');

      try {
        if (MIGRATION_MODE === 'relational') {
          const response = (await apiRequest('/groups/user-relational', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as GroupsResponse;
          return response.groups || [];
        } else {
          const response = (await apiRequest('/groups/user', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })) as GroupsResponse;
          return response.groups || [];
        }
      } catch (error) {
        logger.warn('Relational user groups query failed, falling back to KV store', error);
        const response = (await apiRequest('/groups/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })) as GroupsResponse;
        return response.groups || [];
      }
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
 * Utility function to check migration status
 */
export const getMigrationStatus = () => ({
  mode: MIGRATION_MODE,
  isRelational: MIGRATION_MODE === 'relational',
  isKV: MIGRATION_MODE === 'kv',
});

/**
 * Utility function to switch migration mode (for testing)
 */
export const setMigrationMode = (mode: 'kv' | 'relational') => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('migration_mode', mode);
    window.location.reload(); // Force reload to apply new mode
  }
};
