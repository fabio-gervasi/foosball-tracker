import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import type { User } from '../types';

interface AuthContextType {
  // Auth state
  isLoggedIn: boolean;
  currentUser: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Auth actions
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for password reset callback on app load
  useEffect(() => {
    checkPasswordResetCallback();
  }, []);

  // Check for existing session on app load
  useEffect(() => {
    checkSession();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let isSubscriptionActive = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignore if subscription is no longer active
        if (!isSubscriptionActive) return;

        logger.authEvent(`Auth state change: ${event}`);

        if (event === 'SIGNED_OUT') {
          logger.authEvent('User signed out');
          setIsLoggedIn(false);
          setCurrentUser(null);
          setAccessToken(null);
        } else if (event === 'SIGNED_IN' && session?.access_token) {
          logger.authEvent('User signed in via auth state change');
          // Use functional updates to avoid stale closures
          setAccessToken(prevToken => {
            if (prevToken !== session.access_token) {
              logger.sessionEvent('created', session.user?.id);
              setIsLoggedIn(prev => prev || true);
              return session.access_token;
            }
            return prevToken;
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          logger.sessionEvent('refreshed', session.user?.id);
          setAccessToken(prevToken => {
            if (prevToken !== session.access_token) {
              return session.access_token;
            }
            return prevToken;
          });
        }
      }
    );

    return () => {
      isSubscriptionActive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const checkPasswordResetCallback = async () => {
    try {
      logger.debug('Checking for password reset callback', {
        pathname: window.location.pathname,
        hasHash: !!window.location.hash,
        hasSearch: !!window.location.search
      });

      // Check if we're on the password reset callback path
      const isPasswordResetCallback = window.location.pathname.includes('/password-reset-callback') ||
                                     window.location.pathname.includes('/auth/confirm');

      if (isPasswordResetCallback) {
        logger.info('Password reset callback path detected');

        // Check for hash-based parameters (Supabase auth callback)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlParams = new URLSearchParams(window.location.search);

        // Check both hash and query parameters
        const error = hashParams.get('error') || urlParams.get('error');
        const errorDescription = hashParams.get('error_description') || urlParams.get('error_description');
        const errorCode = hashParams.get('error_code') || urlParams.get('error_code');
        const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
        const type = hashParams.get('type') || urlParams.get('type');
        const tokenHash = urlParams.get('token_hash');

        logger.debug('Callback params received', {
          hasError: !!error,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasTokenHash: !!tokenHash,
          type
        });

        // If we have an error in the callback
        if (error) {
          logger.error('Password reset callback error', { error, errorDescription });

          let errorMsg = 'Password reset link is invalid or expired. Please request a new password reset.';

          if (errorCode === 'otp_expired') {
            errorMsg = 'The password reset link has expired. Please request a new password reset.';
          } else if (error === 'access_denied') {
            errorMsg = 'The password reset link is invalid. Please request a new password reset.';
          }

          setError(errorMsg);
          window.history.replaceState({}, document.title, '/');
          return;
        }

        // Handle PKCE flow with token_hash (new Supabase format)
        if (tokenHash && type === 'recovery') {
          logger.info('PKCE recovery token hash detected');

          try {
            // Verify the OTP with Supabase
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            });

            if (verifyError) {
              logger.error('Failed to verify recovery token hash', verifyError);
              throw verifyError;
            }

            logger.info('Recovery token verified successfully');

            // Get the session after verification
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
              logger.error('Failed to get session after verification', sessionError);
              throw sessionError || new Error('No session after verification');
            }

            // Navigate to password reset form instead of using prompt
            logger.info('Navigating to password reset form');

            // Store the token in URL parameters for the password reset form
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('token', accessToken);
            currentUrl.searchParams.set('type', 'recovery');

            // Update the URL without causing a page reload
            window.history.replaceState({}, document.title, currentUrl.toString());

            // The App component will detect this change and show the password reset form
            setError(null);

            // Sign out after password reset
            await supabase.auth.signOut();
            window.history.replaceState({}, document.title, '/');
            return;

          } catch (tokenError) {
            logger.error('Error verifying recovery token', tokenError);
            setError('There was an issue with the password reset link. Please request a new password reset.');
            window.history.replaceState({}, document.title, '/');
            return;
          }
        }

        // Handle implicit flow with access_token and refresh_token
        if (accessToken && refreshToken && type === 'recovery') {
          logger.info('Implicit recovery session detected');

          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              logger.error('Failed to set recovery session', sessionError);
              throw sessionError;
            }

            logger.info('Recovery session set successfully');

            // Navigate to password reset form instead of using prompt
            logger.info('Navigating to password reset form for token hash flow');

            // Store the token hash in URL parameters for the password reset form
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('token', tokenHash);
            currentUrl.searchParams.set('type', 'recovery');

            // Update the URL without causing a page reload
            window.history.replaceState({}, document.title, currentUrl.toString());

            // The App component will detect this change and show the password reset form
            setError(null);
            return;

          } catch (sessionError) {
            logger.error('Error handling recovery session', sessionError);
            setError('There was an issue with the password reset link. Please request a new password reset.');
            window.history.replaceState({}, document.title, '/');
            return;
          }
        }

        // If we're on the callback path but don't have valid parameters
        logger.warn('On callback path but no valid parameters found');
        setError('Password reset link appears to be incomplete. Please request a new password reset.');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      logger.debug('No password reset callback detected');

    } catch (error) {
      logger.error('Error checking password reset callback', error);
      setError('An error occurred while processing the password reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      logger.debug('Checking existing session');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error('Session retrieval error', sessionError);
        setIsLoading(false);
        return;
      }

      if (session?.access_token) {
        logger.sessionEvent('validated', session.user?.id);

        try {
          // Validate session with our server
          const response = await apiRequest('/user', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          logger.info('Session validated successfully', {
            userName: response.user.name || response.user.username,
            hasGroup: !!response.user.currentGroup
          });
          setCurrentUser(response.user);
          setAccessToken(session.access_token);
          setIsLoggedIn(true);

          logger.debug('User validation complete');
        } catch (validationError) {
          logger.error('Session validation failed', validationError);

          // Check if this is a token expiration issue - but only try refresh ONCE
          if (validationError.message.includes('expired') || validationError.message.includes('JWT')) {
            logger.info('Token appears expired or invalid, attempting refresh');
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError || !refreshData.session) {
                logger.error('Session refresh failed', refreshError);
                throw refreshError || new Error('Session refresh failed');
              }

              logger.sessionEvent('refreshed');
              // Only set the token if it's actually different to avoid loops
              if (refreshData.session.access_token !== accessToken) {
                setAccessToken(refreshData.session.access_token);
                setIsLoggedIn(true);
              }
              return;
            } catch (refreshError) {
              logger.error('Session refresh and retry failed', refreshError);
            }
          }

          // Session is invalid and couldn't be refreshed, clear it
          logger.info('Clearing invalid session');
          await supabase.auth.signOut();
        }
      } else {
        logger.debug('No existing session found');
      }
    } catch (error) {
      logger.error('Session check error', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (user: User, token: string) => {
    setCurrentUser(user);
    setAccessToken(token);
    setIsLoggedIn(true);
    setError(null);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('Logout error', error);
    } finally {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setAccessToken(null);
      setError(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    // State
    isLoggedIn,
    currentUser,
    accessToken,
    isLoading,
    error,

    // Actions
    login,
    logout,
    checkSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
