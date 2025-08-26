import React from 'react';
import { Login } from './components/Login';
import { GroupSelection } from './components/GroupSelection';
import { AppRouter } from './components/AppRouter';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppDataProvider, useAppData } from './contexts/AppDataContext';

// Main App Content Component (uses contexts)
const AppContent: React.FC = () => {
  const { isLoggedIn, currentUser, accessToken, isLoading, error } = useAuth();
  const { handleGroupSelected } = useAppData();

  // Show loading screen during initial auth check
  if (isLoading) {
    return (
      <LoadingScreen
        message="Checking authentication..."
        showLogo={true}
        variant="full"
      />
    );
  }

  // Show error if there's an auth error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-lg font-semibold mb-2">
              Authentication Error
            </div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isLoggedIn) {
    return <Login onLogin={() => {}} />; // Login component handles auth via context
  }

  // Show group selection if user doesn't have a group
  if (!currentUser?.currentGroup) {
    return (
      <GroupSelection
        onGroupSelected={handleGroupSelected}
        accessToken={accessToken}
      />
    );
  }

  // Show main app router
  return <AppRouter />;
};

// Root App Component (provides contexts)
export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <AppContent />
      </AppDataProvider>
    </AuthProvider>
  );
}
