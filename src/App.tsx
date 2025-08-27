import React, { useEffect, useState } from 'react';
import { Login } from './components/auth/Login';
import { GroupSelection } from './components/GroupSelection';
import { AppRouter } from './components/AppRouter';
import { LoadingScreen } from './components/common/LoadingScreen';
import { PasswordResetForm } from './components/auth/PasswordResetForm';
import { DialogProvider } from './components/common/DialogProvider';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppDataProvider, useAppData } from './contexts/AppDataContext';

// Main App Content Component (uses contexts)
const AppContent: React.FC = () => {
  const { isLoggedIn, currentUser, accessToken, isLoading, error } = useAuth();
  const { handleGroupSelected } = useAppData();
  const [currentRoute, setCurrentRoute] = useState('');

  // Check URL for password reset route
  useEffect(() => {
    const checkRoute = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // Check for password reset token in URL
      const token = searchParams.get('token') || hashParams.get('token') || searchParams.get('token_hash');
      const type = searchParams.get('type') || hashParams.get('type');

      if (token && (type === 'recovery' || window.location.pathname.includes('password-reset'))) {
        setCurrentRoute('password-reset');
      } else {
        setCurrentRoute('');
      }
    };

    checkRoute();

    // Listen for URL changes
    const handlePopState = () => checkRoute();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Show password reset form if we're on the password reset route
  if (currentRoute === 'password-reset') {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = searchParams.get('token') || hashParams.get('token') || searchParams.get('token_hash');

    return (
      <PasswordResetForm
        token={token || undefined}
        onSuccess={() => {
          // Navigate back to login after successful reset
          window.history.replaceState({}, document.title, '/');
          setCurrentRoute('');
        }}
        onCancel={() => {
          // Navigate back to login on cancel
          window.history.replaceState({}, document.title, '/');
          setCurrentRoute('');
        }}
      />
    );
  }

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
    <ErrorBoundary level="page" showErrorDetails={import.meta.env.DEV}>
      <AuthProvider>
        <AppDataProvider>
          <DialogProvider>
            <AppContent />
          </DialogProvider>
        </AppDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
