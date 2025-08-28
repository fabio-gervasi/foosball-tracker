import { apiRequest, API_BASE_URL } from './supabase/client';
import { publicAnonKey } from './supabase/info';
import { logger } from './logger';

export const validateUsername = (username: string): string | null => {
  if (!username || username.trim().length === 0) {
    return 'Username is required';
  }

  if (username.trim().length < 3) {
    return 'Username must be at least 3 characters long';
  }

  if (username.length > 30) {
    return 'Username must be 30 characters or less';
  }

  // Allow letters, numbers, spaces, dots, underscores, hyphens, and apostrophes for real names
  const validUsernameRegex = /^[a-zA-Z0-9._\-'\s]+$/;
  if (!validUsernameRegex.test(username)) {
    return 'Username can only contain letters, numbers, spaces, dots, underscores, hyphens, and apostrophes.';
  }

  // Don't allow usernames that are only spaces
  if (username.trim().length === 0) {
    return 'Username cannot be only spaces';
  }

  return null; // Valid username
};

export const validateEmail = (email: string): string | null => {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }

  return null; // Valid email
};

export const checkServerStatus = async (): Promise<{ isHealthy: boolean; isLoading: boolean }> => {
  try {
    logger.debug('Starting Server Status Check', { baseUrl: API_BASE_URL });

    // Try the health endpoint with apiRequest (should include anon key now)
    try {
      logger.debug('Testing health endpoint with apiRequest');
      const response = await apiRequest('/health');
      logger.info('Health check successful', { hasResponse: !!response });

      return { isHealthy: true, isLoading: false };
    } catch (apiError) {
      logger.warn('apiRequest health check failed', apiError);

      // Try direct fetch with anon key
      try {
        logger.debug('Trying direct fetch with anon key');
        const directResponse = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
        });
        logger.debug('Direct health check completed', { status: directResponse.status });

        if (directResponse.ok) {
          const healthData = await directResponse.json();
          logger.info('Direct health check successful', { hasData: !!healthData });
          return { isHealthy: true, isLoading: false };
        } else {
          const errorData = await directResponse
            .json()
            .catch(() => ({ error: 'Unable to parse error' }));
          logger.error('Direct health check failed', {
            status: directResponse.status,
            error: errorData,
          });
        }
      } catch (directError) {
        logger.error('Direct fetch also failed', directError);
      }

      throw apiError;
    }
  } catch (error) {
    logger.error('All server checks failed', error);
    return { isHealthy: false, isLoading: false };
  }
};

export const transformErrorMessage = (errorMessage: string, isSignup: boolean): string => {
  // Transform server errors to user-friendly messages
  if (errorMessage.includes('Unable to validate email address')) {
    return 'Username format issue. Please use only letters, numbers, spaces, dots, underscores, hyphens, and apostrophes.';
  } else if (errorMessage.includes('Invalid login credentials')) {
    return isSignup
      ? 'Failed to create account. Please try a different username.'
      : 'Invalid username or password. Please check your credentials.';
  } else if (
    errorMessage.includes('User already registered') ||
    errorMessage.includes('Username already exists')
  ) {
    return 'This username is already taken. Try signing in or choose a different username.';
  } else if (errorMessage.includes('validation_failed')) {
    return 'Invalid username format. Use only letters, numbers, spaces, dots, underscores, hyphens, and apostrophes.';
  }

  return errorMessage;
};
