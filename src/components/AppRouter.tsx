import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { User } from 'lucide-react';
import { Navigation } from './common/Navigation';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { LoadingScreen } from './common/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import foosballIcon from '../assets/foosball-icon.png';

// Lazy load components for better performance
const Dashboard = lazy(() =>
  import('./dashboard/Dashboard').then(module => ({ default: module.Dashboard }))
);
const Profile = lazy(() => import('./Profile').then(module => ({ default: module.Profile })));
const MatchEntry = lazy(() =>
  import('./dashboard/MatchEntry').then(module => ({ default: module.MatchEntry }))
);
const MatchConfirmation = lazy(() =>
  import('./MatchConfirmation').then(module => ({ default: module.MatchConfirmation }))
);
const Statistics = lazy(() =>
  import('./dashboard/Statistics').then(module => ({ default: module.Statistics }))
);
const Leaderboard = lazy(() =>
  import('./dashboard/Leaderboard').then(module => ({ default: module.Leaderboard }))
);
const MatchHistory = lazy(() =>
  import('./MatchHistory').then(module => ({ default: module.MatchHistory }))
);
const AdminPanel = lazy(() =>
  import('./AdminPanel').then(module => ({ default: module.AdminPanel }))
);
const PlayerProfile = lazy(() =>
  import('./PlayerProfile').then(module => ({ default: module.PlayerProfile }))
);

export const AppRouter: React.FC = () => {
  // Router state
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lastMatchResult, setLastMatchResult] = useState<any | null>(null);

  // Get contexts
  const { currentUser, accessToken } = useAuth();
  const {
    users,
    matches,
    currentGroup,
    error,
    handleMatchSubmit,
    handleProfileUpdate,
    handleGroupChanged,
    refreshData,
  } = useAppData();

  // Memoized navigation handlers for better performance
  const handleNavigate = useCallback((event: any) => {
    setCurrentView(event.detail);
  }, []);

  const handlePlayerSelect = useCallback((event: any) => {
    setSelectedPlayerId(event.detail.playerId);
    setCurrentView('playerProfile');
  }, []);

  // Listen for navigation events from components
  useEffect(() => {
    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('showPlayerProfile', handlePlayerSelect);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('showPlayerProfile', handlePlayerSelect);
    };
  }, [handleNavigate, handlePlayerSelect]);

  const handleMatchSubmitWithNavigation = useCallback(
    async (matchData: any) => {
      try {
        const response = await handleMatchSubmit(matchData);

        // Store the match result for confirmation screen
        setLastMatchResult(response);

        // Navigate to confirmation screen
        setCurrentView('matchConfirmation');

        return response;
      } catch (error) {
        throw error;
      }
    },
    [handleMatchSubmit]
  );

  const renderCurrentView = useMemo(() => {
    switch (currentView) {
      case 'dashboard':
        if (!currentUser) {
          return <LoadingScreen message='Loading user data...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Dashboard...' />}>
            <Dashboard
              user={currentUser}
              matches={matches}
              users={users}
              group={currentGroup}
              error={error || undefined}
              accessToken={accessToken || undefined}
            />
          </Suspense>
        );

      case 'profile':
        if (!currentUser || !accessToken) {
          return <LoadingScreen message='Loading profile data...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Profile...' />}>
            <Profile
              user={currentUser}
              group={currentGroup}
              accessToken={accessToken}
              onUpdateProfile={handleProfileUpdate}
              onDataChange={refreshData}
              onGroupChanged={handleGroupChanged}
            />
          </Suspense>
        );

      case 'match':
        return (
          <Suspense fallback={<LoadingScreen message='Loading Match Entry...' />}>
            <MatchEntry users={users} onMatchSubmit={handleMatchSubmitWithNavigation} />
          </Suspense>
        );

      case 'matchConfirmation':
        if (!currentUser || !accessToken || !lastMatchResult) {
          return <LoadingScreen message='Loading match confirmation...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Match Confirmation...' />}>
            <MatchConfirmation
              matchResult={lastMatchResult}
              currentUser={currentUser}
              accessToken={accessToken}
              onBack={() => {
                setLastMatchResult(null);
                setCurrentView('dashboard');
              }}
              onDataChange={refreshData}
            />
          </Suspense>
        );

      case 'statistics':
        if (!currentUser) {
          return <LoadingScreen message='Loading statistics...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Statistics...' />}>
            <Statistics user={currentUser} matches={matches} group={currentGroup} />
          </Suspense>
        );

      case 'leaderboard':
        return (
          <Suspense fallback={<LoadingScreen message='Loading Leaderboard...' />}>
            <Leaderboard
              users={users}
              group={currentGroup}
              currentUser={currentUser || undefined}
              accessToken={accessToken || undefined}
            />
          </Suspense>
        );

      case 'history':
        if (!currentUser || !accessToken) {
          return <LoadingScreen message='Loading match history...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Match History...' />}>
            <MatchHistory
              currentUser={currentUser}
              accessToken={accessToken}
              group={currentGroup}
              users={users}
            />
          </Suspense>
        );

      case 'admin':
        if (!currentUser || !accessToken) {
          return <LoadingScreen message='Loading admin panel...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Admin Panel...' />}>
            <AdminPanel
              currentUser={currentUser}
              accessToken={accessToken}
              group={currentGroup}
              users={users}
              onDataChange={refreshData}
            />
          </Suspense>
        );

      case 'playerProfile':
        if (!selectedPlayerId || !currentUser || !accessToken) {
          return <LoadingScreen message='Loading Player Profile...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Player Profile...' />}>
            <PlayerProfile
              playerId={selectedPlayerId}
              currentUser={currentUser}
              group={currentGroup}
              accessToken={accessToken}
              onBack={() => window.history.back()}
            />
          </Suspense>
        );

      case 'fallback':
        if (!currentUser) {
          return <LoadingScreen message='Loading user data...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Dashboard...' />}>
            <Dashboard
              user={currentUser}
              matches={matches}
              users={users}
              group={currentGroup}
              error={error || undefined}
              accessToken={accessToken || undefined}
            />
          </Suspense>
        );

      default:
        if (!currentUser) {
          return <LoadingScreen message='Loading user data...' />;
        }
        return (
          <Suspense fallback={<LoadingScreen message='Loading Dashboard...' />}>
            <Dashboard
              user={currentUser}
              matches={matches}
              users={users}
              group={currentGroup}
              error={error || undefined}
              accessToken={accessToken || undefined}
            />
          </Suspense>
        );
    }
  }, [
    currentView,
    currentUser,
    matches,
    users,
    currentGroup,
    error,
    accessToken,
    lastMatchResult,
    handleMatchSubmitWithNavigation,
    handleProfileUpdate,
    refreshData,
    handleGroupChanged,
    selectedPlayerId,
  ]);

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            {/* Logo and Title */}
            <div className='flex items-center space-x-4'>
              <ImageWithFallback
                src={currentGroup?.icon || foosballIcon}
                alt={`${currentGroup?.name || 'Foosball'} Logo`}
                className='w-9 h-9 md:w-11 md:h-11 object-cover rounded-full'
              />
              <div>
                <h1 className='text-xl font-semibold text-gray-900'>
                  {currentGroup?.name || 'Foosball Tracker'}
                </h1>
                {currentGroup?.code && (
                  <p className='text-sm text-gray-500'>Code: {currentGroup.code}</p>
                )}
              </div>
            </div>

            {/* User Info - Clickable to go to profile */}
            <div className='flex items-center space-x-4'>
              <button
                onClick={() => setCurrentView('profile')}
                className='flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors'
              >
                <User className='w-5 h-5 text-gray-400' />
                <span className='text-sm font-medium text-gray-900'>
                  {currentUser?.name || currentUser?.username}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUser={currentUser}
      />

      {/* Main Content */}
      <main className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pb-20'>{renderCurrentView}</main>
    </div>
  );
};
