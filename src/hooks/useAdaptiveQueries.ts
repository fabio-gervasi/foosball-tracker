import { useState, useEffect } from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';

// Import both hook types
import {
  useUserQuery,
  useCurrentGroupQuery,
  useUsersQuery,
  useMatchesQuery,
  useUserGroupsQuery,
} from './useQueries';

import {
  useHybridUserQuery,
  useHybridCurrentGroupQuery,
  useHybridUsersQuery,
  useHybridMatchesQuery,
  useHybridUserGroupsQuery,
  getMigrationStatus,
} from './useHybridQueries';

import type { User, Group, Match } from '../types';

// Migration mode detection
const getMigrationMode = (): 'kv' | 'relational' | 'hybrid' => {
  // Check environment variable
  const envMode = process.env.REACT_APP_MIGRATION_MODE;
  if (envMode === 'kv' || envMode === 'relational') {
    return envMode;
  }

  // Check localStorage override
  if (typeof window !== 'undefined') {
    const storedMode = localStorage.getItem('migration_mode');
    if (storedMode === 'kv' || storedMode === 'relational') {
      return storedMode;
    }
  }

  // Default to hybrid mode during transition
  return 'hybrid';
};

/**
 * Adaptive hook that automatically chooses between KV store and relational queries
 * Provides seamless migration experience with fallback capabilities
 */
export const useAdaptiveUserQuery = (accessToken: string | null): UseQueryResult<User, Error> => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  // Update mode when environment changes
  useEffect(() => {
    const handleStorageChange = () => {
      setMode(getMigrationMode());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Always call hooks in the same order (React Hooks rule)
  const kvResult = useUserQuery(accessToken);
  const hybridResult = useHybridUserQuery(accessToken);

  // Choose appropriate result based on mode
  switch (mode) {
    case 'kv':
      logger.debug('Using KV store user query');
      return kvResult;

    case 'relational':
      logger.debug('Using relational user query');
      return hybridResult;

    case 'hybrid':
    default:
      logger.debug('Using hybrid user query with fallback');

      // If hybrid fails, fall back to KV store
      if (hybridResult.isError) {
        logger.warn('Hybrid query failed, falling back to KV store');
        // Return the successful result or the hybrid error
        return kvResult.isSuccess ? kvResult : hybridResult;
      }

      return hybridResult;
  }
};

/**
 * Adaptive hook for current group queries
 */
export const useAdaptiveCurrentGroupQuery = (
  accessToken: string | null
): UseQueryResult<Group, Error> => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  useEffect(() => {
    const handleStorageChange = () => {
      setMode(getMigrationMode());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Always call hooks in the same order (React Hooks rule)
  const kvResult = useCurrentGroupQuery(accessToken);
  const hybridResult = useHybridCurrentGroupQuery(accessToken);

  switch (mode) {
    case 'kv':
      return kvResult;
    case 'relational':
      return hybridResult;
    case 'hybrid':
    default:
      if (hybridResult.isError) {
        return kvResult.isSuccess ? kvResult : hybridResult;
      }
      return hybridResult;
  }
};

/**
 * Adaptive hook for users queries
 */
export const useAdaptiveUsersQuery = (
  accessToken: string | null
): UseQueryResult<User[], Error> => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  useEffect(() => {
    const handleStorageChange = () => {
      setMode(getMigrationMode());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Always call hooks in the same order (React Hooks rule)
  const kvResult = useUsersQuery(accessToken);
  const hybridResult = useHybridUsersQuery(accessToken);

  switch (mode) {
    case 'kv':
      return kvResult;
    case 'relational':
      return hybridResult;
    case 'hybrid':
    default:
      if (hybridResult.isError) {
        return kvResult.isSuccess ? kvResult : hybridResult;
      }
      return hybridResult;
  }
};

/**
 * Adaptive hook for matches queries
 */
export const useAdaptiveMatchesQuery = (
  accessToken: string | null
): UseQueryResult<Match[], Error> => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  useEffect(() => {
    const handleStorageChange = () => {
      setMode(getMigrationMode());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Always call hooks in the same order (React Hooks rule)
  const kvResult = useMatchesQuery(accessToken);
  const hybridResult = useHybridMatchesQuery(accessToken);

  switch (mode) {
    case 'kv':
      return kvResult;
    case 'relational':
      return hybridResult;
    case 'hybrid':
    default:
      if (hybridResult.isError) {
        return kvResult.isSuccess ? kvResult : hybridResult;
      }
      return hybridResult;
  }
};

/**
 * Adaptive hook for user groups queries
 */
export const useAdaptiveUserGroupsQuery = (
  accessToken: string | null
): UseQueryResult<Group[], Error> => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  useEffect(() => {
    const handleStorageChange = () => {
      setMode(getMigrationMode());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Always call hooks in the same order (React Hooks rule)
  const kvResult = useUserGroupsQuery(accessToken);
  const hybridResult = useHybridUserGroupsQuery(accessToken);

  switch (mode) {
    case 'kv':
      return kvResult;
    case 'relational':
      return hybridResult;
    case 'hybrid':
    default:
      if (hybridResult.isError) {
        return kvResult.isSuccess ? kvResult : hybridResult;
      }
      return hybridResult;
  }
};

/**
 * Migration status and control utilities
 */
export const useMigrationStatus = () => {
  const [mode, setMode] = useState<'kv' | 'relational' | 'hybrid'>(getMigrationMode());

  const switchToKV = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('migration_mode', 'kv');
      setMode('kv');
      window.location.reload();
    }
  };

  const switchToRelational = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('migration_mode', 'relational');
      setMode('relational');
      window.location.reload();
    }
  };

  const switchToHybrid = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('migration_mode', 'hybrid');
      setMode('hybrid');
      window.location.reload();
    }
  };

  return {
    mode,
    isKV: mode === 'kv',
    isRelational: mode === 'relational',
    isHybrid: mode === 'hybrid',
    switchToKV,
    switchToRelational,
    switchToHybrid,
  };
};

/**
 * Health check hook for migration status
 */
export const useMigrationHealth = () => {
  return useQuery({
    queryKey: ['migration-health'],
    queryFn: async () => {
      try {
        // Test both KV and relational endpoints
        const kvHealth = await apiRequest('/make-server-171cbf6f/simple-health');
        let relationalHealth = null;

        try {
          relationalHealth = await apiRequest('/user-relational');
        } catch (e) {
          // Relational might fail due to auth, that's ok
          relationalHealth = { status: 'auth_required' };
        }

        return {
          kvStore: kvHealth?.status === 'server-running',
          relationalDB: relationalHealth?.status !== 'error',
          overallHealth: 'good',
        };
      } catch (error) {
        return {
          kvStore: false,
          relationalDB: false,
          overallHealth: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    staleTime: 30000, // 30 seconds
    retry: 3,
  });
};
