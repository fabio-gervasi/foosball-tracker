import React, { createContext, useContext, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';
import { useAppDataQueries } from '../hooks/useQueries';
import {
  useSubmitMatchMutation,
  useUpdateProfileMutation,
  useGroupSwitchMutation,
  useRefreshDataMutation,
} from '../hooks/useMutations';
import type { User, Group, Match, MatchSubmissionData, ProfileUpdateData } from '../types';

interface AppDataContextType {
  // Data state (maintained for backward compatibility)
  users: User[];
  matches: Match[];
  currentGroup: Group | null;
  currentUser: User | undefined;
  isLoadingData: boolean;
  error: string | null;

  // Additional React Query states
  isFetching: boolean;
  isLoadingInitial: boolean;

  // Data actions (maintained for backward compatibility)
  refreshData: () => Promise<void>;
  updateUser: (user: User) => void;
  addMatch: (match: Match) => void;
  setCurrentGroup: (group: Group | null) => void;
  handleGroupSelected: () => Promise<void>;
  handleGroupChanged: () => Promise<void>;
  handleMatchSubmit: (matchData: MatchSubmissionData) => Promise<Match>;
  handleProfileUpdate: (updatedProfile: ProfileUpdateData) => Promise<void>;
  clearError: () => void;

  // New React Query-powered actions
  refetchAll: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  // Get auth context
  const { isLoggedIn, accessToken, currentUser, signOut } = useAuth();

  // Use React Query hooks for data fetching
  const {
    currentUser: reactQueryUser,
    currentGroup,
    users,
    matches,
    isLoading,
    isLoadingInitial,
    isFetching,
    error,
    refetchAll,
  } = useAppDataQueries(accessToken);

  // Handle authentication errors by signing out
  React.useEffect(() => {
    if (error && error.includes('Authentication failed')) {
      logger.warn('Authentication error detected, signing out user');
      signOut();
    }
  }, [error, signOut]);

  // Use mutation hooks
  const submitMatchMutation = useSubmitMatchMutation(accessToken);
  const updateProfileMutation = useUpdateProfileMutation(accessToken);
  const groupSwitchMutation = useGroupSwitchMutation(accessToken);
  const refreshDataMutation = useRefreshDataMutation();

  // Backward compatibility functions
  const refreshData = async (): Promise<void> => {
    logger.debug('Manual refresh triggered');
    refreshDataMutation.mutate();
  };

  const updateUser = (user: User) => {
    // With React Query, we don't need manual state updates
    // The cache will be updated through mutations or refetches
    logger.debug('updateUser called - React Query will handle updates automatically');
  };

  const addMatch = (match: Match) => {
    // With React Query, we don't need manual state updates
    // The optimistic updates in mutations handle this
    logger.debug('addMatch called - React Query optimistic updates will handle this');
  };

  const setCurrentGroup = (group: Group | null) => {
    // This would typically trigger a group switch mutation
    // For now, we'll log it - components should use the mutation directly
    logger.debug('setCurrentGroup called', { group: group?.name });
  };

  const handleGroupSelected = async (): Promise<void> => {
    // After joining/selecting a group, we need to refetch all data
    logger.debug('Group selected - triggering full data refresh');
    refetchAll();
  };

  const handleGroupChanged = async (): Promise<void> => {
    // Trigger a full data refresh
    logger.debug('Group changed - triggering full refresh');
    refetchAll();
  };

  const handleMatchSubmit = async (matchData: MatchSubmissionData): Promise<Match> => {
    try {
      logger.debug('Submitting match via React Query mutation');

      // Use the React Query mutation which includes optimistic updates
      const result = await submitMatchMutation.mutateAsync(matchData);

      return result;
    } catch (error) {
      logger.error('Failed to submit match', error);
      throw error;
    }
  };

  const handleProfileUpdate = async (updatedProfile: ProfileUpdateData): Promise<void> => {
    try {
      logger.debug('Updating profile via React Query mutation');

      // Use the React Query mutation which includes optimistic updates
      const result = await updateProfileMutation.mutateAsync(updatedProfile);

      return result;
    } catch (error) {
      logger.error('Failed to update profile', error);
      throw error;
    }
  };

  const clearError = () => {
    // With React Query, errors are managed by the query state
    // We could potentially reset error boundaries here if needed
    logger.debug('clearError called - React Query manages error states');
  };

  // Create the context value with backward compatibility
  const value: AppDataContextType = {
    // Data state (from React Query)
    users,
    matches,
    currentGroup: currentGroup || null,
    isLoadingData: isLoading, // Map React Query loading to legacy name
    error,
    // Add currentUser from React Query (more up-to-date than AuthContext)
    currentUser,

    // Additional React Query states
    isFetching,
    isLoadingInitial,

    // Backward compatible actions
    refreshData,
    updateUser,
    addMatch,
    setCurrentGroup,
    handleGroupSelected,
    handleGroupChanged,
    handleMatchSubmit,
    handleProfileUpdate,
    clearError,

    // New React Query actions
    refetchAll,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};

// Export types for use in other files
export type { AppDataContextType };
export { AppDataContext };
