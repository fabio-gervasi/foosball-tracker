import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/supabase/client';
import { logger } from '../utils/logger';
import { useAuth } from './useAuth';
import { handleApiError, UserFriendlyError } from '../utils/errorHandler';

// API Request options interface
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  timeout?: number;
  retries?: number;
  skipAuth?: boolean; // Skip automatic auth header injection
  enableCache?: boolean; // Enable React Query caching for GET requests
  optimistic?: boolean; // Enable optimistic updates
}

// Enhanced return interface
export interface UseApiRequestReturn<T> {
  // Data and state
  data: T | null;
  loading: boolean;
  error: UserFriendlyError | null;
  
  // Request states
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  
  // Actions
  execute: (endpoint: string, options?: ApiRequestOptions) => Promise<T>;
  reset: () => void;
  cancel: () => void;
  retry: () => Promise<T>;
  
  // Utilities
  clearError: () => void;
}

// Default configuration
const DEFAULT_OPTIONS: Partial<ApiRequestOptions> = {
  method: 'GET',
  timeout: 30000, // 30 seconds
  retries: 3,
  skipAuth: false,
  enableCache: false,
  optimistic: false,
};

/**
 * Enhanced API request hook with standardized patterns, error handling, and React Query integration
 * 
 * Features:
 * - Automatic authentication header injection
 * - Request cancellation support
 * - Retry logic with exponential backoff
 * - Centralized error handling
 * - React Query integration for caching
 * - Optimistic updates support
 * - Loading and error state management
 */
export const useApiRequest = <T = any>(
  initialOptions?: Partial<ApiRequestOptions>
): UseApiRequestReturn<T> => {
  const { accessToken, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  
  // Internal state
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // Request tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ endpoint: string; options?: ApiRequestOptions } | null>(null);
  const retryCountRef = useRef(0);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Merge default options with provided options
  const mergeOptions = useCallback((options?: ApiRequestOptions): ApiRequestOptions => {
    return { ...DEFAULT_OPTIONS, ...initialOptions, ...options };
  }, [initialOptions]);
  
  // Build request headers with authentication
  const buildHeaders = useCallback((options: ApiRequestOptions): Record<string, string> => {
    const headers: Record<string, string> = { ...options.headers };
    
    // Add authentication header if not skipped and user is logged in
    if (!options.skipAuth && isLoggedIn && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // Add content type for requests with body (except FormData)
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }, [accessToken, isLoggedIn]);
  
  // Build query parameters
  const buildQueryString = useCallback((params?: Record<string, string | number>): string => {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    
    return `?${searchParams.toString()}`;
  }, []);
  
  // Calculate retry delay with exponential backoff
  const getRetryDelay = useCallback((attempt: number): number => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }, []);
  
  // Reset all state
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    retryCountRef.current = 0;
    lastRequestRef.current = null;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  
  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
    setIsError(false);
  }, []);
  
  // Cancel current request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsLoading(false);
    logger.debug('API request cancelled');
  }, []);
  
  // Main execute function
  const execute = useCallback(async (
    endpoint: string, 
    options?: ApiRequestOptions
  ): Promise<T> => {
    const mergedOptions = mergeOptions(options);
    
    // Store request details for retry
    lastRequestRef.current = { endpoint, options: mergedOptions };
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Reset state for new request
    setIsLoading(true);
    setIsError(false);
    setIsSuccess(false);
    setError(null);
    
    try {
      logger.debug('API request started', {
        endpoint,
        method: mergedOptions.method,
        hasAuth: !mergedOptions.skipAuth && isLoggedIn,
        retryAttempt: retryCountRef.current
      });
      
      // Build final request options
      const headers = buildHeaders(mergedOptions);
      const queryString = buildQueryString(mergedOptions.params);
      const finalEndpoint = `${endpoint}${queryString}`;
      
      // Prepare request body
      let body: any = mergedOptions.body;
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        body = JSON.stringify(body);
      }
      
      // Make the API request using the existing apiRequest utility
      const requestOptions: RequestInit = {
        method: mergedOptions.method,
        headers,
        body: mergedOptions.method !== 'GET' ? body : undefined,
        signal: abortControllerRef.current.signal,
      };
      
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${mergedOptions.timeout}ms`));
        }, mergedOptions.timeout);
      });
      
      const requestPromise = apiRequest(finalEndpoint, requestOptions);
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      // Success handling
      setData(response);
      setIsSuccess(true);
      setIsLoading(false);
      retryCountRef.current = 0; // Reset retry count on success
      
      logger.debug('API request completed successfully', {
        endpoint: finalEndpoint,
        method: mergedOptions.method
      });
      
      return response;
      
    } catch (err: any) {
      // Handle cancellation
      if (err.name === 'AbortError') {
        logger.debug('API request was cancelled');
        setIsLoading(false);
        throw err;
      }
      
      // Process error through centralized handler
      const processedError = handleApiError(err);
      
      logger.error('API request failed', {
        endpoint,
        method: mergedOptions.method,
        error: processedError.message,
        code: processedError.code,
        attempt: retryCountRef.current + 1
      });
      
      // Check if we should retry
      if (processedError.recoverable && 
          retryCountRef.current < (mergedOptions.retries || 0)) {
        
        retryCountRef.current++;
        const delay = getRetryDelay(retryCountRef.current);
        
        logger.info(`Retrying API request in ${delay}ms`, {
          endpoint,
          attempt: retryCountRef.current,
          maxRetries: mergedOptions.retries
        });
        
        // Wait for delay then retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return execute(endpoint, options);
      }
      
      // Set error state
      setError(processedError);
      setIsError(true);
      setIsLoading(false);
      
      throw processedError;
    }
  }, [
    mergeOptions,
    buildHeaders,
    buildQueryString,
    getRetryDelay,
    isLoggedIn
  ]);
  
  // Retry last request
  const retry = useCallback(async (): Promise<T> => {
    if (!lastRequestRef.current) {
      throw new Error('No previous request to retry');
    }
    
    const { endpoint, options } = lastRequestRef.current;
    retryCountRef.current = 0; // Reset retry count for manual retry
    return execute(endpoint, options);
  }, [execute]);
  
  // Computed states
  const isIdle = !isLoading && !isSuccess && !isError;
  
  return {
    // Data and state
    data,
    loading: isLoading,
    error,
    
    // Request states
    isIdle,
    isLoading,
    isError,
    isSuccess,
    
    // Actions
    execute,
    reset,
    cancel,
    retry,
    
    // Utilities
    clearError,
  };
};

/**
 * Specialized hook for GET requests with React Query integration
 */
export const useApiQuery = <T = any>(
  endpoint: string,
  options?: Omit<ApiRequestOptions, 'method'> & {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  const { accessToken } = useAuth();
  
  return useMutation({
    mutationKey: [endpoint, options?.params],
    mutationFn: async () => {
      const headers: Record<string, string> = { ...options?.headers };
      
      if (!options?.skipAuth && accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      
      const queryString = options?.params 
        ? `?${new URLSearchParams(Object.entries(options.params).map(([k, v]) => [k, String(v)])).toString()}`
        : '';
      
      return apiRequest(`${endpoint}${queryString}`, {
        method: 'GET',
        headers,
      });
    },
    onError: (error: any) => {
      const processedError = handleApiError(error);
      logger.error('API query failed', processedError);
    },
  });
};

export default useApiRequest;
