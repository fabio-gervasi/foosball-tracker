import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

// Type definitions
export interface Group {
  id: string;
  name: string;
  code: string;
  icon?: string;
  createdAt: string;
  adminIds: string[];
}

export interface Match {
  id: string;
  matchType: '1v1' | '2v2';
  player1?: any;
  player2?: any;
  team1?: any;
  team2?: any;
  score1: number;
  score2: number;
  groupId: string;
  createdAt: string;
}

interface AppDataContextType {
  // Data state
  users: any[];
  matches: Match[];
  currentGroup: Group | null;
  isLoadingData: boolean;
  error: string | null;

  // Data actions
  refreshData: () => Promise<void>;
  updateUser: (user: any) => void;
  addMatch: (match: Match) => void;
  setCurrentGroup: (group: Group | null) => void;
  handleGroupSelected: () => Promise<void>;
  handleGroupChanged: () => Promise<void>;
  handleMatchSubmit: (matchData: any) => Promise<any>;
  handleProfileUpdate: (updatedProfile: any) => Promise<void>;
  clearError: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  // Data state
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for preventing duplicate requests
  const loadingRef = useRef(false);

  // Get auth context
  const { isLoggedIn, accessToken, currentUser } = useAuth();

  // Load data when user is authenticated and has a group
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoggedIn && accessToken && currentUser?.currentGroup) {
      // Add a small delay to prevent rapid-fire requests during auth state changes
      timeoutId = setTimeout(() => {
        if (isLoggedIn && accessToken && currentUser?.currentGroup) {
          logger.debug('Triggering data load from useEffect', {
            isLoggedIn,
            hasToken: !!accessToken,
            hasGroup: !!currentUser?.currentGroup,
            isLoading: loadingRef.current
          });
          refreshData();
        }
      }, 100);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoggedIn, accessToken, currentUser?.currentGroup]);

  const loadCurrentGroup = async (token = accessToken) => {
    try {
      const groupResponse = await apiRequest('/groups/current', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCurrentGroup(groupResponse.group);
    } catch (error) {
      logger.error('Failed to load current group', error);
    }
  };

  const refreshData = async () => {
    // Prevent overlapping requests
    if (loadingRef.current) {
      logger.debug('Data loading already in progress, skipping');
      return;
    }

    try {
      loadingRef.current = true;
      setError(null);

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Make all API calls in parallel for better performance
      const requests = [
        apiRequest('/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        apiRequest('/groups/current', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        apiRequest('/users', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        apiRequest('/matches', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ];

      const [userResponse, groupResponse, usersResponse, matchesResponse] = await Promise.allSettled(requests);

      // Handle group data
      if (groupResponse.status === 'fulfilled') {
        setCurrentGroup(groupResponse.value.group);
      } else {
        logger.error('Failed to refresh group data', groupResponse.reason);
      }

      // Handle users data
      if (usersResponse.status === 'fulfilled') {
        setUsers(usersResponse.value.users || []);
      } else {
        logger.error('Failed to load users', usersResponse.reason);
        setUsers([]);
      }

      // Handle matches data
      if (matchesResponse.status === 'fulfilled') {
        setMatches(matchesResponse.value.matches || []);
      } else {
        logger.error('Failed to load matches', matchesResponse.reason);
        setMatches([]);
      }

    } catch (error) {
      logger.error('Failed to load app data', error);

      // Check for authentication errors and handle gracefully
      if (error.message.includes('expired') || error.message.includes('JWT') ||
          error.message.includes('401') || error.message.includes('Unauthorized')) {
        logger.info('Authentication error detected during data loading');
        // Don't set error for auth issues - let AuthContext handle it
        return;
      }

      // For non-auth errors, provide more specific guidance
      if (error.message.includes('Internal server error while getting users')) {
        setError('Server is having issues loading user data. This may be temporary - try refreshing the page in a few moments.');
      } else if (error.message.includes('521') || error.message.includes('Web server is down')) {
        setError('The server is starting up. Please wait a moment and refresh the page.');
      } else {
        setError('Failed to load data. Please check your connection and try refreshing the page.');
      }
    } finally {
      loadingRef.current = false;
    }
  };

  const handleGroupSelected = async () => {
    // Prevent multiple simultaneous group selections
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      // The main useEffect will automatically trigger refreshData when currentUser updates
    } catch (error) {
      logger.error('Failed to refresh user data after group selection', error);
      setError('Failed to load group data. Please try refreshing the page.');
    } finally {
      loadingRef.current = false;
    }
  };

  const handleGroupChanged = async () => {
    // Called when user switches groups - reload all data
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setError(null);

      // The useEffect will automatically trigger refreshData when currentUser updates
    } catch (error) {
      logger.error('Failed to refresh data after group change', error);
      setError('Failed to load group data. Please try refreshing the page.');
    } finally {
      loadingRef.current = false;
    }
  };

  const handleMatchSubmit = async (matchData: any) => {
    try {
      setError(null);

      // Handle both legacy 1v1 format and new format
      let requestData;
      if (matchData.player1Email && matchData.player2Email) {
        // Legacy format from existing components
        requestData = matchData;
      } else {
        // New format from updated MatchEntry component
        requestData = matchData;
      }

      const response = await apiRequest('/matches', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestData),
      });

      // Optimized data reload - only reload what's necessary
      const currentUserIdentifier = currentUser?.username || currentUser?.email;
      const userParticipated = matchData.player1Email === currentUserIdentifier ||
                             matchData.player2Email === currentUserIdentifier ||
                             matchData.team1Player1Email === currentUserIdentifier ||
                             matchData.team1Player2Email === currentUserIdentifier ||
                             matchData.team2Player1Email === currentUserIdentifier ||
                             matchData.team2Player2Email === currentUserIdentifier;

      // Make parallel requests for faster loading
      const refreshPromises = [];

      // Always refresh users (for leaderboard) and matches
      refreshPromises.push(
        apiRequest('/users', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiRequest('/matches', { headers: { Authorization: `Bearer ${accessToken}` } })
      );

      const results = await Promise.allSettled(refreshPromises);

      // Handle users
      if (results[0].status === 'fulfilled') {
        setUsers(results[0].value.users || []);
      }

      // Handle matches
      if (results[1].status === 'fulfilled') {
        setMatches(results[1].value.matches || []);
      }

      return response;
    } catch (error) {
      logger.error('Failed to record match', error);
      throw error;
    }
  };

  const handleProfileUpdate = async (updatedProfile: any) => {
    try {
      setError(null);

      const response = await apiRequest('/user', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updatedProfile),
      });

      // Refresh data to get updated information
      await refreshData();

      return response;
    } catch (error) {
      logger.error('Failed to update profile', error);
      throw error;
    }
  };

  const updateUser = (user: any) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  const addMatch = (match: Match) => {
    setMatches(prev => [match, ...prev]);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AppDataContextType = {
    // State
    users,
    matches,
    currentGroup,
    isLoadingData,
    error,

    // Actions
    refreshData,
    updateUser,
    addMatch,
    setCurrentGroup,
    handleGroupSelected,
    handleGroupChanged,
    handleMatchSubmit,
    handleProfileUpdate,
    clearError,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
