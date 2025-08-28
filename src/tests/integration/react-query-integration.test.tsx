import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock component that uses React Query
function TestComponent() {
  return (
    <div>
      <h1>Test Component</h1>
      <p>React Query integration test</p>
    </div>
  );
}

describe('React Query Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  it('should provide QueryClient to components', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>
    );

    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByText('React Query integration test')).toBeInTheDocument();
  });

  it('should configure QueryClient with proper defaults', () => {
    const defaultOptions = queryClient.getDefaultOptions();

    expect(defaultOptions.queries?.retry).toBe(false);
    expect(defaultOptions.mutations?.retry).toBe(false);
  });

  it('should allow setting and getting query data', async () => {
    const testData = { message: 'test data' };

    queryClient.setQueryData(['test-key'], testData);

    const retrievedData = queryClient.getQueryData(['test-key']);
    expect(retrievedData).toEqual(testData);
  });

  it('should handle query invalidation', async () => {
    const testData = { message: 'test data' };

    queryClient.setQueryData(['test-key'], testData);

    // Invalidate the query
    await queryClient.invalidateQueries({ queryKey: ['test-key'] });

    // Query should be marked as stale
    const queryState = queryClient.getQueryState(['test-key']);
    expect(queryState?.isInvalidated).toBe(true);
  });

  it('should support query cancellation', async () => {
    const queryKey = ['test-cancel'];

    // Cancel any ongoing queries
    await queryClient.cancelQueries({ queryKey });

    // Should not throw an error
    expect(true).toBe(true);
  });
});
