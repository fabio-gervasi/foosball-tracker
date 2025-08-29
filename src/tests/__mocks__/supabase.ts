import { vi } from 'vitest';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// Mock user data
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: '2024-01-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: {
    name: 'Test User',
    username: 'testuser',
  },
  aud: 'authenticated',
  confirmation_sent_at: '2024-01-01T00:00:00.000Z',
  recovery_sent_at: undefined,
  email_change_sent_at: undefined,
  new_email: undefined,
  invited_at: undefined,
  action_link: undefined,
  phone: undefined,
  phone_confirmed_at: undefined,
  new_phone: undefined,
  role: 'authenticated',
  updated_at: '2024-01-01T00:00:00.000Z',
  identities: [],
  factors: [],
  is_anonymous: false,
};

// Mock session data
export const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: mockUser,
};

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockImplementation(callback => {
      // Simulate auth state change
      setTimeout(() => {
        callback('SIGNED_IN' as AuthChangeEvent, mockSession);
      }, 0);

      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: vi.fn().mockResolvedValue({ data: [], error: null }),
};

// Mock the createClient function
export const createClient = vi.fn().mockReturnValue(mockSupabaseClient);

// Mock API request function
export const mockApiRequest = vi.fn().mockImplementation((endpoint: string, options?: any) => {
  // Mock different endpoints
  if (endpoint === '/user') {
    return Promise.resolve({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.user_metadata?.name,
      username: mockUser.user_metadata?.username,
    });
  }

  if (endpoint === '/groups/current') {
    return Promise.resolve({
      id: 'test-group-id',
      name: 'Test Group',
      code: 'TEST123',
      adminIds: [mockUser.id],
    });
  }

  if (endpoint === '/users') {
    return Promise.resolve([
      {
        id: mockUser.id,
        name: mockUser.user_metadata?.name,
        username: mockUser.user_metadata?.username,
        rating: 1200,
        wins: 10,
        losses: 5,
      },
    ]);
  }

  if (endpoint === '/matches') {
    return Promise.resolve([
      {
        id: 'test-match-id',
        matchType: '1v1',
        player1: { id: mockUser.id, name: 'Test User' },
        player2: { id: 'other-user', name: 'Other User' },
        score1: 10,
        score2: 8,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
  }

  return Promise.resolve({});
});
