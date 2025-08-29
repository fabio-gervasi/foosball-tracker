import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useAppDataQueries } from './useQueries';
import {
  useSubmitMatchMutation,
  useUpdateProfileMutation,
  useGroupSwitchMutation,
  useJoinGroupMutation,
  useCreateGroupMutation,
  useRefreshDataMutation,
} from './useMutations';
import { logger } from '../utils/logger';
import type {
  User,
  Group,
  Match,
  MatchSubmissionData,
  ProfileUpdateData,
  GroupCreationData,
} from '../types';

// Enhanced app data hook interface
export interface UseAppDataReturn {
  // Core data
  users: User[];
  matches: Match[];
  currentGroup: Group | null;
  userGroups: Group[];

  // Loading states
  isLoading: boolean;
  isLoadingUsers: boolean;
  isLoadingMatches: boolean;
  isLoadingGroups: boolean;
  isFetching: boolean;
  isLoadingInitial: boolean;

  // Error states
  error: string | null;
  usersError: string | null;
  matchesError: string | null;
  groupsError: string | null;

  // Data actions
  refreshData: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  refetchAll: () => void;

  // Mutations
  submitMatch: (matchData: MatchSubmissionData) => Promise<any>;
  updateUserProfile: (profileData: ProfileUpdateData) => Promise<void>;
  switchGroup: (groupCode: string) => Promise<void>;
  joinGroup: (groupCode: string) => Promise<void>;
  createGroup: (groupData: GroupCreationData) => Promise<void>;

  // Mutation states
  isSubmittingMatch: boolean;
  isUpdatingProfile: boolean;
  isSwitchingGroup: boolean;
  isJoiningGroup: boolean;
  isCreatingGroup: boolean;

  // Utilities
  getUserById: (id: string) => User | undefined;
  getMatchById: (id: string) => Match | undefined;
  getUserStats: (userId: string) => UserStats;
  isUserInCurrentGroup: (userId: string) => boolean;
  getCurrentUserStats: () => UserStats;
}

// Data interfaces
// Interfaces now imported from types

export interface UserStats {
  wins: number;
  losses: number;
  winRate: number;
  totalGames: number;
  elo: number;
  singlesWins: number;
  singlesLosses: number;
  doublesWins: number;
  doublesLosses: number;
  singlesElo: number;
  doublesElo: number;
  singlesWinRate: number;
  doublesWinRate: number;
  rank: number;
}

/**
 * Comprehensive app data management hook
 * Consolidates all data fetching, mutations, and business logic
 * Built on React Query foundation for optimal performance
 */
export const useAppData = (): UseAppDataReturn => {
  // Get authentication state
  const { accessToken, currentUser } = useAuth();

  // Use React Query hooks for data fetching
  const {
    currentUser: queryUser,
    currentGroup,
    users,
    matches,
    isLoading,
    isLoadingInitial,
    isFetching,
    error,
    refetchAll,
    userQuery,
    currentGroupQuery,
    usersQuery,
    matchesQuery,
  } = useAppDataQueries(accessToken);

  // Get user groups separately (not included in main queries)
  // This would need to be added to useAppDataQueries or created separately
  const userGroups: Group[] = []; // TODO: Implement user groups query

  // Use mutation hooks
  const submitMatchMutation = useSubmitMatchMutation(accessToken);
  const updateProfileMutation = useUpdateProfileMutation(accessToken);
  const groupSwitchMutation = useGroupSwitchMutation(accessToken);
  const joinGroupMutation = useJoinGroupMutation(accessToken);
  const createGroupMutation = useCreateGroupMutation(accessToken);
  const refreshDataMutation = useRefreshDataMutation();

  // Data refresh functions
  const refreshData = useCallback(async (): Promise<void> => {
    logger.debug('Manual data refresh triggered');
    await refreshDataMutation.mutateAsync();
  }, [refreshDataMutation]);

  const refreshUsers = useCallback(async (): Promise<void> => {
    logger.debug('Manual users refresh triggered');
    await usersQuery.refetch();
  }, [usersQuery]);

  const refreshMatches = useCallback(async (): Promise<void> => {
    logger.debug('Manual matches refresh triggered');
    await matchesQuery.refetch();
  }, [matchesQuery]);

  const refreshGroups = useCallback(async (): Promise<void> => {
    logger.debug('Manual groups refresh triggered');
    await currentGroupQuery.refetch();
    // TODO: Also refetch user groups when implemented
  }, [currentGroupQuery]);

  // Mutation wrapper functions
  const submitMatch = useCallback(
    async (matchData: MatchSubmissionData): Promise<any> => {
      try {
        logger.debug('Submitting match via useAppData hook');
        const result = await submitMatchMutation.mutateAsync(matchData);
        return result;
      } catch (error) {
        logger.error('Failed to submit match in useAppData', error);
        throw error;
      }
    },
    [submitMatchMutation]
  );

  const updateUserProfile = useCallback(
    async (profileData: ProfileUpdateData): Promise<void> => {
      try {
        logger.debug('Updating profile via useAppData hook');
        await updateProfileMutation.mutateAsync(profileData);
      } catch (error) {
        logger.error('Failed to update profile in useAppData', error);
        throw error;
      }
    },
    [updateProfileMutation]
  );

  const switchGroup = useCallback(
    async (groupCode: string): Promise<void> => {
      try {
        logger.debug('Switching group via useAppData hook', { groupCode });
        await groupSwitchMutation.mutateAsync({ groupCode });
      } catch (error) {
        logger.error('Failed to switch group in useAppData', error);
        throw error;
      }
    },
    [groupSwitchMutation]
  );

  const joinGroup = useCallback(
    async (groupCode: string): Promise<void> => {
      try {
        logger.debug('Joining group via useAppData hook', { code: groupCode });
        await joinGroupMutation.mutateAsync({ code: groupCode });
      } catch (error) {
        logger.error('Failed to join group in useAppData', error);
        throw error;
      }
    },
    [joinGroupMutation]
  );

  const createGroup = useCallback(
    async (groupData: GroupCreationData): Promise<void> => {
      try {
        logger.debug('Creating group via useAppData hook', { name: groupData.name });
        await createGroupMutation.mutateAsync({
          name: groupData.name,
          code: groupData.code || '',
        });
      } catch (error) {
        logger.error('Failed to create group in useAppData', error);
        throw error;
      }
    },
    [createGroupMutation]
  );

  // Utility functions
  const getUserById = useCallback(
    (id: string): User | undefined => {
      return users.find(user => user.id === id);
    },
    [users]
  );

  const getMatchById = useCallback(
    (id: string): Match | undefined => {
      return matches.find(match => match.id === id);
    },
    [matches]
  );

  const getUserStats = useCallback(
    (userId: string): UserStats => {
      const user = getUserById(userId);
      if (!user) {
        return {
          wins: 0,
          losses: 0,
          winRate: 0,
          totalGames: 0,
          elo: 1000,
          singlesWins: 0,
          singlesLosses: 0,
          doublesWins: 0,
          doublesLosses: 0,
          singlesElo: 1000,
          doublesElo: 1000,
          singlesWinRate: 0,
          doublesWinRate: 0,
          rank: users.length + 1,
        };
      }

      const wins = user.wins || 0;
      const losses = user.losses || 0;
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      const singlesWins = user.singlesWins || 0;
      const singlesLosses = user.singlesLosses || 0;
      const singlesTotalGames = singlesWins + singlesLosses;
      const singlesWinRate = singlesTotalGames > 0 ? (singlesWins / singlesTotalGames) * 100 : 0;

      const doublesWins = user.doublesWins || 0;
      const doublesLosses = user.doublesLosses || 0;
      const doublesTotalGames = doublesWins + doublesLosses;
      const doublesWinRate = doublesTotalGames > 0 ? (doublesWins / doublesTotalGames) * 100 : 0;

      // Calculate rank based on ELO
      const sortedUsers = [...users].sort((a, b) => (b.elo || 1000) - (a.elo || 1000));
      const rank = sortedUsers.findIndex(u => u.id === userId) + 1;

      return {
        wins,
        losses,
        winRate,
        totalGames,
        elo: user.elo || 1000,
        singlesWins,
        singlesLosses,
        doublesWins,
        doublesLosses,
        singlesElo: user.singlesElo || 1000,
        doublesElo: user.doublesElo || 1000,
        singlesWinRate,
        doublesWinRate,
        rank,
      };
    },
    [users, getUserById]
  );

  const isUserInCurrentGroup = useCallback(
    (userId: string): boolean => {
      if (!currentGroup) return false;
      const user = getUserById(userId);
      return user?.currentGroup === currentGroup.code;
    },
    [currentGroup, getUserById]
  );

  const getCurrentUserStats = useCallback((): UserStats => {
    if (!currentUser) {
      return {
        wins: 0,
        losses: 0,
        winRate: 0,
        totalGames: 0,
        elo: 1000,
        singlesWins: 0,
        singlesLosses: 0,
        doublesWins: 0,
        doublesLosses: 0,
        singlesElo: 1000,
        doublesElo: 1000,
        singlesWinRate: 0,
        doublesWinRate: 0,
        rank: 1,
      };
    }
    return getUserStats(currentUser.id);
  }, [currentUser, getUserStats]);

  // Extract granular loading states
  const isLoadingUsers = usersQuery?.isLoading || false;
  const isLoadingMatches = matchesQuery?.isLoading || false;
  const isLoadingGroups = currentGroupQuery?.isLoading || false;

  // Extract granular error states
  const usersError = usersQuery?.error?.message || null;
  const matchesError = matchesQuery?.error?.message || null;
  const groupsError = currentGroupQuery?.error?.message || null;

  // Mutation loading states
  const isSubmittingMatch = submitMatchMutation.isPending;
  const isUpdatingProfile = updateProfileMutation.isPending;
  const isSwitchingGroup = groupSwitchMutation.isPending;
  const isJoiningGroup = joinGroupMutation.isPending;
  const isCreatingGroup = createGroupMutation.isPending;

  return {
    // Core data
    users,
    matches,
    currentGroup,
    userGroups,

    // Loading states
    isLoading,
    isLoadingUsers,
    isLoadingMatches,
    isLoadingGroups,
    isFetching,
    isLoadingInitial,

    // Error states
    error,
    usersError,
    matchesError,
    groupsError,

    // Data actions
    refreshData,
    refreshUsers,
    refreshMatches,
    refreshGroups,
    refetchAll,

    // Mutations
    submitMatch,
    updateUserProfile,
    switchGroup,
    joinGroup,
    createGroup,

    // Mutation states
    isSubmittingMatch,
    isUpdatingProfile,
    isSwitchingGroup,
    isJoiningGroup,
    isCreatingGroup,

    // Utilities
    getUserById,
    getMatchById,
    getUserStats,
    isUserInCurrentGroup,
    getCurrentUserStats,
  };
};
