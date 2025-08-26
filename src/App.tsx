import React, { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { Login } from './components/Login';
import { GroupSelection } from './components/GroupSelection';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { MatchEntry } from './components/MatchEntry';
import { MatchConfirmation } from './components/MatchConfirmation';
import { Statistics } from './components/Statistics';
import { Leaderboard } from './components/Leaderboard';
import { MatchHistory } from './components/MatchHistory';
import { AdminPanel } from './components/AdminPanel';
import { PlayerProfile } from './components/PlayerProfile';
import { Navigation } from './components/Navigation';
import { FoosballIcon } from './components/FoosballIcon';
import { ImageWithFallback } from './components/figma/ImageWithFallback';

import { supabase, apiRequest } from './utils/supabase/client';
import { logger } from './utils/logger';
import foosballIcon from './assets/foosball-icon.png';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lastMatchResult, setLastMatchResult] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const loadingRef = useRef(false); // Track loading state to prevent overlaps

  // Check for password reset callback on app load
  useEffect(() => {
    checkPasswordResetCallback();
  }, []);

  // Check for existing session on app load
  useEffect(() => {
    checkSession();
  }, []);

  // Listen for auth state changes - FIXED: Remove dependencies to prevent listener recreation
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
          setCurrentGroup(null);
          setAccessToken(null);
          setCurrentView('dashboard');
          setUsers([]);
          setMatches([]);
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
  }, []); // NO DEPENDENCIES - prevents listener recreation

  // Listen for navigation events from components
  useEffect(() => {
    const handleNavigate = (event: any) => {
      setCurrentView(event.detail);
    };

    const handlePlayerProfile = (event: any) => {
      setSelectedPlayerId(event.detail.playerId);
      setCurrentView('playerProfile');
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('showPlayerProfile', handlePlayerProfile);
    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('showPlayerProfile', handlePlayerProfile);
    };
  }, []);

  // Load data when user logs in and has a group - FIXED: Removed isLoadingData dependency
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoggedIn && accessToken && currentUser?.currentGroup && !loadingRef.current) {
      // Debounce data loading to prevent rapid-fire calls
      timeoutId = setTimeout(() => {
        setIsLoadingData(true);
        loadAppData().finally(() => setIsLoadingData(false));
      }, 200); // 200ms debounce for better stability
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoggedIn, accessToken, currentUser?.currentGroup]); // Removed isLoadingData dependency

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

            // Prompt user to set new password
            const newPassword = prompt('Please enter your new password (minimum 6 characters):');
            if (!newPassword || newPassword.length < 6) {
              setError('Password reset cancelled or invalid password. Please request a new reset.');
              window.history.replaceState({}, document.title, '/');
              return;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser({
              password: newPassword
            });

            if (updateError) {
              logger.error('Failed to update password', updateError);
              setError('Failed to update password. Please try again.');
              window.history.replaceState({}, document.title, '/');
              return;
            }

            logger.info('Password updated successfully');
            alert('Password updated successfully! You can now log in with your new password.');
            setError('');

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

            // Prompt user to set new password
            const newPassword = prompt('Please enter your new password (minimum 6 characters):');
            if (!newPassword || newPassword.length < 6) {
              setError('Password reset cancelled or invalid password. Please request a new reset.');
              await supabase.auth.signOut();
              window.history.replaceState({}, document.title, '/');
              return;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser({
              password: newPassword
            });

            if (updateError) {
              logger.error('Failed to update password', updateError);
              setError('Failed to update password. Please try again.');
              await supabase.auth.signOut();
              window.history.replaceState({}, document.title, '/');
              return;
            }

            logger.info('Password updated successfully');
            alert('Password updated successfully! You can now log in with your new password.');
            setError('');

            // Sign out after password reset
            await supabase.auth.signOut();
            window.history.replaceState({}, document.title, '/');
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

          // Don't load group data here - let the main useEffect handle data loading
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
                // Don't call loadCurrentGroup here - let the main flow handle it
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

  const loadAppData = async () => {
    // Prevent overlapping requests
    if (loadingRef.current) {
      logger.debug('Data loading already in progress, skipping');
      return;
    }

    try {
      loadingRef.current = true;
      setError('');

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

      // Handle user data
      if (userResponse.status === 'fulfilled') {
        setCurrentUser(userResponse.value.user);
      } else {
        logger.error('Failed to refresh user data', userResponse.reason);
      }

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

      // Handle authentication errors specifically
      if (error.message.includes('Invalid or expired token') || error.message.includes('JWT') || error.message.includes('Authentication')) {
        logger.info('Authentication error detected, attempting session refresh');
        try {
          // Try to refresh the session - but prevent multiple simultaneous refreshes
          if (loadingRef.current) {
            logger.debug('Already refreshing, skipping duplicate refresh attempt');
            return;
          }

          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError || !refreshData.session?.access_token) {
            logger.error('Session refresh failed', refreshError);
            logger.info('Logging out user due to authentication failure');
            handleLogout();
            return;
          }

          logger.sessionEvent('refreshed');
          // Only update if token actually changed to prevent loops
          if (refreshData.session.access_token !== accessToken) {
            setAccessToken(refreshData.session.access_token);
          }
          return;

        } catch (refreshError) {
          logger.error('Session refresh failed', refreshError);
          logger.info('Logging out user due to refresh failure');
          handleLogout();
          return;
        }
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

  const loadAppDataWithToken = async (token) => {
    // Prevent overlapping requests
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    // Make all API calls in parallel for better performance
    const requests = [
      apiRequest('/user', { headers: { Authorization: `Bearer ${token}` } }),
      apiRequest('/groups/current', { headers: { Authorization: `Bearer ${token}` } }),
      apiRequest('/users', { headers: { Authorization: `Bearer ${token}` } }),
      apiRequest('/matches', { headers: { Authorization: `Bearer ${token}` } }),
    ];

    const [userResponse, groupResponse, usersResponse, matchesResponse] = await Promise.allSettled(requests);

    // Handle user data
          if (userResponse.status === 'fulfilled') {
        setCurrentUser(userResponse.value.user);
      } else {
        logger.error('Failed to refresh user data with token', userResponse.reason);
      }

    // Handle group data
          if (groupResponse.status === 'fulfilled') {
        setCurrentGroup(groupResponse.value.group);
      } else {
        logger.error('Failed to refresh group data with token', groupResponse.reason);
      }

    // Handle users and matches
    if (usersResponse.status === 'fulfilled') {
      setUsers(usersResponse.value.users || []);
    } else {
      setUsers([]);
    }

    if (matchesResponse.status === 'fulfilled') {
      setMatches(matchesResponse.value.matches || []);
    } else {
      setMatches([]);
    }

    loadingRef.current = false;
  };

  const handleLogin = async (user, token) => {
    setCurrentUser(user);
    setAccessToken(token);
    setIsLoggedIn(true);

    // Load current group if user has one
    if (user.currentGroup) {
      await loadCurrentGroup(token);
    }
  };

  const handleGroupSelected = async () => {
    // Prevent multiple simultaneous group selections
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      // Only refresh user data - the main useEffect will handle full data loading
      const userResponse = await apiRequest('/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setCurrentUser(userResponse.user);
      // The useEffect will automatically trigger loadAppData when currentUser updates
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
      setError('');

      // Refresh user data first to get new current group
      const userResponse = await apiRequest('/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setCurrentUser(userResponse.user);

      // The useEffect will automatically trigger loadAppData when currentUser updates
    } catch (error) {
      logger.error('Failed to refresh data after group change', error);
      setError('Failed to load group data. Please try refreshing the page.');
    } finally {
      loadingRef.current = false;
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('Logout error', error);
    } finally {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setCurrentGroup(null);
      setAccessToken(null);
      setCurrentView('dashboard');
      setUsers([]);
      setMatches([]);
    }
  };



  const handleMatchSubmit = async (matchData) => {
    try {
      setError('');

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

      // Store the match result for confirmation screen
      setLastMatchResult(response);

      // Optimized data reload - only reload what's necessary
      const currentUserIdentifier = currentUser.username || currentUser.email;
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

      // Only refresh user data if they participated
      if (userParticipated) {
        refreshPromises.push(
          apiRequest('/user', { headers: { Authorization: `Bearer ${accessToken}` } })
        );
      }

      const results = await Promise.allSettled(refreshPromises);

      // Handle users
      if (results[0].status === 'fulfilled') {
        setUsers(results[0].value.users || []);
      }

      // Handle matches
      if (results[1].status === 'fulfilled') {
        setMatches(results[1].value.matches || []);
      }

      // Handle user data if requested
      if (userParticipated && results[2]?.status === 'fulfilled') {
        setCurrentUser(results[2].value.user);
      }

      // Navigate to confirmation screen
      setCurrentView('matchConfirmation');

      return response;
    } catch (error) {
      logger.error('Failed to record match', error);
      throw error;
    }
  };

  const handleProfileUpdate = async (updatedProfile) => {
    try {
      setError('');

      const response = await apiRequest('/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: updatedProfile.name }),
      });

      setCurrentUser(response.user);

      // Only reload users for leaderboard update, not all data
      try {
        const usersResponse = await apiRequest('/users', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setUsers(usersResponse.users || []);
      } catch (error) {
        logger.error('Failed to refresh users after profile update', error);
      }

      return response.user;
    } catch (error) {
      logger.error('Failed to update profile', error);
      throw error;
    }
  };

  const handleGroupDeleted = async () => {
    try {
      logger.info('Group deleted, refreshing user data');

      // Refresh user data to get updated group status
      const userResponse = await apiRequest('/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Update current user to reflect no group
      setCurrentUser(userResponse.user);
      setCurrentGroup(null);

      // Clear app data
      setUsers([]);
      setMatches([]);

      // User will now be redirected to group selection via the normal flow
    } catch (error) {
      logger.error('Failed to refresh user data after group deletion', error);
      // If we can't refresh user data, just force a logout
      logger.info('Forcing logout due to group deletion error');
      handleLogout();
    }
  };

  // Loading state during initial session check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-3 md:space-x-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
              <ImageWithFallback
                src={currentGroup?.icon || foosballIcon}
                alt={`${currentGroup?.name || "Foosball"} Logo`}
                className="w-14 h-14 md:w-18 md:h-18 object-cover rounded-full"
                fallbackSrc={foosballIcon}
              />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl text-gray-800">Foosball Tracker</h1>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 md:text-lg">Loading...</p>
        </div>
      </div>
    );
  }



  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Show group selection if user doesn't have a group
  if (!currentUser?.currentGroup) {
    return <GroupSelection onGroupSelected={handleGroupSelected} accessToken={accessToken} />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={currentUser} matches={matches} users={users} group={currentGroup} error={error} accessToken={accessToken} />;
      case 'profile':
        return <Profile user={currentUser} group={currentGroup} accessToken={accessToken} onUpdateProfile={handleProfileUpdate} onDataChange={loadAppData} onGroupChanged={handleGroupChanged} />;
      case 'match':
        return <MatchEntry users={users} onMatchSubmit={handleMatchSubmit} />;
      case 'matchConfirmation':
        return lastMatchResult ? (
          <MatchConfirmation
            matchResult={lastMatchResult}
            currentUser={currentUser}
            accessToken={accessToken}
            onBack={() => {
              setLastMatchResult(null);
              setCurrentView('dashboard');
            }}
            onDataChange={loadAppData}
          />
        ) : <Dashboard user={currentUser} matches={matches} users={users} group={currentGroup} error={error} accessToken={accessToken} />;
      case 'statistics':
        return <Statistics user={currentUser} matches={matches} group={currentGroup} />;
      case 'leaderboard':
        return <Leaderboard users={users} group={currentGroup} currentUser={currentUser} accessToken={accessToken} />;
      case 'history':
        return <MatchHistory
          currentUser={currentUser}
          accessToken={accessToken}
          group={currentGroup}
          users={users}
        />;
      case 'admin':
        return <AdminPanel
          currentUser={currentUser}
          accessToken={accessToken}
          group={currentGroup}
          users={users}
          onDataChange={loadAppData}
          onGroupDeleted={handleGroupDeleted}
        />;
      case 'playerProfile':
        return selectedPlayerId ? (
          <PlayerProfile
            playerId={selectedPlayerId}
            currentUser={currentUser}
            group={currentGroup}
            accessToken={accessToken}
            onBack={() => {
              setSelectedPlayerId(null);
              setCurrentView('leaderboard');
            }}
          />
        ) : <Leaderboard users={users} group={currentGroup} currentUser={currentUser} accessToken={accessToken} />;
      default:
        return <Dashboard user={currentUser} matches={matches} users={users} group={currentGroup} error={error} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-screen sm:w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto bg-white min-h-screen">
        {/* Header */}
        <header className="bg-blue-600 text-white p-4 md:p-6">
          <div className="flex items-center justify-between max-w-full">
            {/* Logo */}
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                <ImageWithFallback
                  src={currentGroup?.icon || foosballIcon}
                  alt={`${currentGroup?.name || "Foosball"} Logo`}
                  className="w-9 h-9 md:w-11 md:h-11 object-cover rounded-full"
                  fallbackSrc={foosballIcon}
                />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl text-white">Foosball Tracker</h1>
                {currentGroup && (
                  <p className="text-blue-100 text-sm md:text-base">{currentGroup.name}</p>
                )}
              </div>
            </div>

            {/* Profile Button */}
            <button
              onClick={() => setCurrentView('profile')}
              className={`bg-white/10 hover:bg-white/20 text-white p-2 md:p-3 rounded-lg transition-all duration-200 border border-white/20 hover:border-white/30 ${
                currentView === 'profile' ? 'bg-white/20' : ''
              }`}
            >
              <User className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 md:p-6">
            <p className="text-sm md:text-base">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 text-xs md:text-sm mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content */}
        <main className="pb-20 md:pb-24">
          <div className="md:px-2 lg:px-4">
            {renderCurrentView()}
          </div>
        </main>

        {/* Bottom Navigation */}
        <Navigation currentView={currentView} onViewChange={setCurrentView} currentUser={currentUser} />
      </div>
    </div>
  );
}
