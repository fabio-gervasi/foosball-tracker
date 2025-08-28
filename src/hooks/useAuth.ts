import { useState, useCallback, useMemo } from 'react';
import { useAuth as useAuthContext } from '../contexts/AuthContext';
import { supabase, apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import type { User } from '../contexts/AuthContext';

// Enhanced auth hook interface
export interface UseAuthReturn {
  // State
  isLoggedIn: boolean;
  currentUser: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;

  // Session management
  checkSession: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Utilities
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  clearError: () => void;
}

// Profile update interface
export interface ProfileUpdateData {
  name?: string;
  username?: string;
  avatar?: string;
  [key: string]: any;
}

// Permission types
export type Permission = 'admin' | 'manage_users' | 'manage_groups' | 'view_admin_panel';

/**
 * Enhanced authentication hook that provides a comprehensive interface for auth operations
 * Built on top of the existing AuthContext for backward compatibility
 */
export const useAuth = (): UseAuthReturn => {
  // Get base auth state from context
  const authContext = useAuthContext();

  // Additional local state for enhanced functionality
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Enhanced login function with email/password
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        logger.authEvent('Login attempt started', { email });

        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          logger.error('Supabase login failed', error);
          throw new Error(error.message);
        }

        if (!data.session?.access_token) {
          throw new Error('No access token received from login');
        }

        // Validate session with our server
        const response = await apiRequest('/user', {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });

        logger.authEvent('Login successful', {
          userId: response.user.id,
          userName: response.user.name,
        });

        // Use the context's login method to update state
        await authContext.login(response.user, data.session.access_token);
      } catch (error) {
        logger.error('Login failed', error);
        throw error;
      }
    },
    [authContext]
  );

  // Enhanced logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      logger.authEvent('Logout initiated');
      await authContext.logout();
      logger.authEvent('Logout completed');
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  }, [authContext]);

  // Password reset function
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      logger.authEvent('Password reset requested', { email });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset-callback`,
      });

      if (error) {
        logger.error('Password reset failed', error);
        throw new Error(error.message);
      }

      logger.authEvent('Password reset email sent', { email });
    } catch (error) {
      logger.error('Password reset failed', error);
      throw error;
    }
  }, []);

  // Profile update function
  const updateProfile = useCallback(
    async (data: ProfileUpdateData): Promise<void> => {
      if (!authContext.accessToken) {
        throw new Error('No access token available');
      }

      setIsUpdatingProfile(true);
      try {
        logger.debug('Updating user profile', { fields: Object.keys(data) });

        const response = await apiRequest('/user', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authContext.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        logger.info('Profile updated successfully');

        // Update the current user in context
        if (authContext.currentUser && response.user) {
          await authContext.login(response.user, authContext.accessToken);
        }
      } catch (error) {
        logger.error('Profile update failed', error);
        throw error;
      } finally {
        setIsUpdatingProfile(false);
      }
    },
    [authContext]
  );

  // Session management functions
  const checkSession = useCallback(async (): Promise<void> => {
    await authContext.checkSession();
  }, [authContext]);

  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      logger.sessionEvent('Token refresh initiated');

      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        logger.error('Token refresh failed', error);
        throw new Error(error?.message || 'Token refresh failed');
      }

      logger.sessionEvent('Token refreshed successfully');

      // Update context with new token
      if (authContext.currentUser && data.session.access_token !== authContext.accessToken) {
        await authContext.login(authContext.currentUser, data.session.access_token);
      }
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }, [authContext]);

  // Permission checking utilities
  const isAdmin = useMemo((): boolean => {
    return authContext.currentUser?.isAdmin === true;
  }, [authContext.currentUser]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!authContext.currentUser) return false;

      switch (permission) {
        case 'admin':
        case 'manage_users':
        case 'manage_groups':
        case 'view_admin_panel':
          return isAdmin;
        default:
          logger.warn('Unknown permission requested', { permission });
          return false;
      }
    },
    [isAdmin]
  );

  // Clear error function
  const clearError = useCallback((): void => {
    authContext.clearError();
  }, [authContext]);

  // Combine loading states
  const combinedLoading = authContext.isLoading || isUpdatingProfile;

  return {
    // State from context
    isLoggedIn: authContext.isLoggedIn,
    currentUser: authContext.currentUser,
    accessToken: authContext.accessToken,
    isLoading: combinedLoading,
    error: authContext.error,

    // Enhanced actions
    login,
    logout,
    resetPassword,
    updateProfile,

    // Session management
    checkSession,
    refreshToken,

    // Utilities
    isAdmin,
    hasPermission,
    clearError,
  };
};

// Export types for external use
export type { Permission };
