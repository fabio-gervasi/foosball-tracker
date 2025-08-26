import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { Profile } from './Profile';
import { MatchEntry } from './MatchEntry';
import { MatchConfirmation } from './MatchConfirmation';
import { Statistics } from './Statistics';
import { Leaderboard } from './Leaderboard';
import { MatchHistory } from './MatchHistory';
import { AdminPanel } from './AdminPanel';
import { PlayerProfile } from './PlayerProfile';
import { Navigation } from './Navigation';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import foosballIcon from '../assets/foosball-icon.png';

export const AppRouter: React.FC = () => {
  // Router state
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lastMatchResult, setLastMatchResult] = useState<any | null>(null);

  // Get contexts
  const { currentUser, accessToken } = useAuth();
  const { users, matches, currentGroup, error, handleMatchSubmit, handleProfileUpdate, handleGroupChanged, refreshData } = useAppData();

  // Listen for navigation events from components
  useEffect(() => {
    const handleNavigate = (event: any) => {
      setCurrentView(event.detail);
    };

    const handlePlayerSelect = (event: any) => {
      setSelectedPlayerId(event.detail);
      setCurrentView('playerProfile');
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('selectPlayer', handlePlayerSelect);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('selectPlayer', handlePlayerSelect);
    };
  }, []);

  const handleMatchSubmitWithNavigation = async (matchData: any) => {
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
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            user={currentUser}
            matches={matches}
            users={users}
            group={currentGroup}
            error={error}
            accessToken={accessToken}
          />
        );

      case 'profile':
        return (
          <Profile
            user={currentUser}
            group={currentGroup}
            accessToken={accessToken}
            onUpdateProfile={handleProfileUpdate}
            onDataChange={refreshData}
            onGroupChanged={handleGroupChanged}
          />
        );

      case 'match':
        return (
          <MatchEntry
            users={users}
            onMatchSubmit={handleMatchSubmitWithNavigation}
          />
        );

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
            onDataChange={refreshData}
          />
        ) : (
          <Dashboard
            user={currentUser}
            matches={matches}
            users={users}
            group={currentGroup}
            error={error}
            accessToken={accessToken}
          />
        );

      case 'statistics':
        return (
          <Statistics
            user={currentUser}
            matches={matches}
            group={currentGroup}
          />
        );

      case 'leaderboard':
        return (
          <Leaderboard
            users={users}
            group={currentGroup}
            currentUser={currentUser}
            accessToken={accessToken}
          />
        );

      case 'history':
        return (
          <MatchHistory
            currentUser={currentUser}
            accessToken={accessToken}
            group={currentGroup}
            users={users}
          />
        );

      case 'admin':
        return (
          <AdminPanel
            currentUser={currentUser}
            accessToken={accessToken}
            group={currentGroup}
            users={users}
            onDataChange={refreshData}
          />
        );

      case 'playerProfile':
        return selectedPlayerId ? (
          <PlayerProfile
            playerId={selectedPlayerId}
            users={users}
            matches={matches}
            group={currentGroup}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : (
          <Dashboard
            user={currentUser}
            matches={matches}
            users={users}
            group={currentGroup}
            error={error}
            accessToken={accessToken}
          />
        );

      default:
        return (
          <Dashboard
            user={currentUser}
            matches={matches}
            users={users}
            group={currentGroup}
            error={error}
            accessToken={accessToken}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <ImageWithFallback
                src={currentGroup?.icon || foosballIcon}
                alt={`${currentGroup?.name || "Foosball"} Logo`}
                className="w-9 h-9 md:w-11 md:h-11 object-cover rounded-full"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {currentGroup?.name || 'Foosball Tracker'}
                </h1>
                {currentGroup?.code && (
                  <p className="text-sm text-gray-500">Code: {currentGroup.code}</p>
                )}
              </div>
            </div>

            {/* User Info - Clickable to go to profile */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('profile')}
                className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
              >
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
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
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pb-20">
        {renderCurrentView()}
      </main>
    </div>
  );
};
