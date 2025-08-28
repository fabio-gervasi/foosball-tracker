import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { AppDataContext, AppDataContextType } from '@/contexts/AppDataContext';
import { DialogProvider } from '@/components/common/DialogProvider';
import { mockUser } from '../__mocks__/supabase';
import type { User, Group, Match } from '@/types';

// Mock data
const mockGroup: Group = {
  id: 'test-group-id',
  name: 'Test Group',
  code: 'TEST123',
  adminIds: ['test-user-id'],
  createdAt: '2024-01-01T00:00:00.000Z'
};

const mockUsers: User[] = [
  {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    currentGroup: 'TEST123',
    rating: 1200,
    avatar: null,
    isAdmin: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }
];

const mockMatches: Match[] = [
  {
    id: 'test-match-id',
    matchType: '1v1',
    player1: { id: 'test-user-id', name: 'Test User' },
    player2: { id: 'other-user', name: 'Other User' },
    score1: 10,
    score2: 8,
    groupId: 'test-group-id',
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

// Default mock contexts
const defaultAuthContext: AuthContextType = {
  isLoggedIn: true,
  currentUser: mockUsers[0],
  accessToken: 'mock-access-token',
  isLoading: false,
  error: null,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  checkSession: vi.fn().mockResolvedValue(undefined),
  clearError: vi.fn()
};

const defaultAppDataContext: AppDataContextType = {
  users: mockUsers,
  matches: mockMatches,
  currentGroup: mockGroup,
  isLoadingData: false,
  error: null,
  refreshData: vi.fn().mockResolvedValue(undefined),
  clearError: vi.fn()
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: Partial<AuthContextType>;
  appDataContext?: Partial<AppDataContextType>;
  queryClient?: QueryClient;
}

// Custom render function with providers
function customRender(
  ui: ReactElement,
  {
    authContext = {},
    appDataContext = {},
    queryClient,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Create a fresh query client for each test if not provided
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const mergedAuthContext = { ...defaultAuthContext, ...authContext };
  const mergedAppDataContext = { ...defaultAppDataContext, ...appDataContext };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <AuthContext.Provider value={mergedAuthContext}>
          <AppDataContext.Provider value={mergedAppDataContext}>
            <DialogProvider>
              {children}
            </DialogProvider>
          </AppDataContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Helper function to create a test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Helper function to wait for async operations
export function waitForLoadingToFinish() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Export everything
export * from '@testing-library/react';
export { customRender as render };
export { mockUser, mockUsers, mockGroup, mockMatches };
export { defaultAuthContext, defaultAppDataContext };
