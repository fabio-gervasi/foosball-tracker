import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { logger } from '../utils/logger';

// Create a client with production-ready configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry configuration with auth-aware logic
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) {
          logger.warn('Authentication error detected, not retrying', { error });
          return false;
        }
        // Don't retry client errors (4xx)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry server errors up to 3 times
        return failureCount < 3;
      },
      // Retry delay with exponential backoff
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Refetch when coming back online
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: 'always',
    },
    mutations: {
      // Retry mutations once for server errors
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      // Log mutation errors
      onError: error => {
        logger.error('Mutation error', error);
      },
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} position='bottom-right' />}
    </QueryClientProvider>
  );
}

// Export the client for direct access when needed
export { queryClient };
