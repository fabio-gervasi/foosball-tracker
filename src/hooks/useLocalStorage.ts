import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

// Local storage hook interface
export interface UseLocalStorageReturn<T> {
  value: T | null;
  setValue: (value: T) => void;
  removeValue: () => void;
  isLoading: boolean;
  error: string | null;
  
  // Additional utilities
  hasValue: boolean;
  getValueWithDefault: (defaultValue: T) => T;
  updateValue: (updater: (current: T | null) => T) => void;
}

// Storage options
export interface LocalStorageOptions {
  serializer?: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
  syncAcrossTabs?: boolean;
  onError?: (error: Error) => void;
}

// Default serializer
const defaultSerializer = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
};

/**
 * Enhanced local storage hook with error handling and type safety
 * Provides a React-friendly interface for localStorage operations
 */
export const useLocalStorage = <T>(
  key: string,
  options: LocalStorageOptions = {}
): UseLocalStorageReturn<T> => {
  const {
    serializer = defaultSerializer,
    syncAcrossTabs = false,
    onError,
  } = options;

  // State
  const [value, setValue] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to handle errors
  const handleError = useCallback((error: Error, operation: string) => {
    const errorMessage = `LocalStorage ${operation} failed: ${error.message}`;
    logger.error(errorMessage, error);
    setError(errorMessage);
    onError?.(error);
  }, [onError]);

  // Read value from localStorage
  const readValue = useCallback((): T | null => {
    if (typeof window === 'undefined') {
      return null; // SSR safety
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return null;
      }
      
      return serializer.deserialize(item);
    } catch (error) {
      handleError(error as Error, 'read');
      return null;
    }
  }, [key, serializer, handleError]);

  // Write value to localStorage
  const writeValue = useCallback((newValue: T) => {
    if (typeof window === 'undefined') {
      return; // SSR safety
    }

    try {
      const serializedValue = serializer.serialize(newValue);
      window.localStorage.setItem(key, serializedValue);
      setValue(newValue);
      setError(null);
      
      logger.debug('LocalStorage write successful', { key, hasValue: true });
    } catch (error) {
      handleError(error as Error, 'write');
    }
  }, [key, serializer, handleError]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return; // SSR safety
    }

    try {
      window.localStorage.removeItem(key);
      setValue(null);
      setError(null);
      
      logger.debug('LocalStorage remove successful', { key });
    } catch (error) {
      handleError(error as Error, 'remove');
    }
  }, [key, handleError]);

  // Update value with function
  const updateValue = useCallback((updater: (current: T | null) => T) => {
    const currentValue = readValue();
    const newValue = updater(currentValue);
    writeValue(newValue);
  }, [readValue, writeValue]);

  // Get value with default
  const getValueWithDefault = useCallback((defaultValue: T): T => {
    return value ?? defaultValue;
  }, [value]);

  // Initialize value on mount
  useEffect(() => {
    try {
      const initialValue = readValue();
      setValue(initialValue);
      setError(null);
    } catch (error) {
      handleError(error as Error, 'initialize');
    } finally {
      setIsLoading(false);
    }
  }, [readValue, handleError]);

  // Listen for storage changes across tabs (if enabled)
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = serializer.deserialize(e.newValue);
          setValue(newValue);
          setError(null);
          
          logger.debug('LocalStorage sync from other tab', { key });
        } catch (error) {
          handleError(error as Error, 'sync');
        }
      } else if (e.key === key && e.newValue === null) {
        setValue(null);
        setError(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, serializer, syncAcrossTabs, handleError]);

  // Computed properties
  const hasValue = value !== null;

  return {
    value,
    setValue: writeValue,
    removeValue,
    isLoading,
    error,
    
    // Additional utilities
    hasValue,
    getValueWithDefault,
    updateValue,
  };
};

// Specialized hooks for common use cases

/**
 * Hook for storing user preferences
 */
export const useUserPreferences = <T extends Record<string, any>>() => {
  return useLocalStorage<T>('user-preferences', {
    syncAcrossTabs: true,
  });
};

/**
 * Hook for storing theme preferences
 */
export const useThemePreferences = () => {
  return useLocalStorage<'light' | 'dark' | 'system'>('theme-preference', {
    syncAcrossTabs: true,
  });
};

/**
 * Hook for storing form data temporarily
 */
export const useFormStorage = <T extends Record<string, any>>(formId: string) => {
  return useLocalStorage<T>(`form-data-${formId}`, {
    syncAcrossTabs: false, // Form data is usually session-specific
  });
};

/**
 * Hook for storing recently viewed items
 */
export const useRecentItems = <T>(maxItems: number = 10) => {
  const storage = useLocalStorage<T[]>('recent-items');
  
  const addItem = useCallback((item: T) => {
    storage.updateValue((current) => {
      const items = current || [];
      const filtered = items.filter(i => JSON.stringify(i) !== JSON.stringify(item));
      return [item, ...filtered].slice(0, maxItems);
    });
  }, [storage, maxItems]);

  const removeItem = useCallback((item: T) => {
    storage.updateValue((current) => {
      const items = current || [];
      return items.filter(i => JSON.stringify(i) !== JSON.stringify(item));
    });
  }, [storage]);

  return {
    ...storage,
    items: storage.value || [],
    addItem,
    removeItem,
  };
};
