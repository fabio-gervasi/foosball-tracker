import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';
import { logger } from '../logger';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    // Enable automatic session refresh and persist sessions in localStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    // Session will be refreshed automatically when it expires
    storageKey: 'foosball-tracker-auth',
    // Improved flow type for better JWT handling with signing keys
    flowType: 'pkce',
  },
});

// API base URL for our server functions
export const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/api`;

// Helper function to construct avatar URL from filename
export function getAvatarUrl(avatar: string | null): string | null {
  if (!avatar || avatar.length <= 1 || avatar.includes('/')) {
    // This is initials or already a URL, return null to use fallback
    return null;
  }

  // Construct Supabase storage URL
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/storage/v1/object/public/make-171cbf6f-avatars/${avatar}`;
}

// Helper function to make authenticated requests
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  // Relational endpoints are already mounted under /api prefix
  // No need to add prefix again - just use the endpoint as-is
  const fullEndpoint = endpoint;

  logger.apiRequest(fullEndpoint, options.method || 'GET');

  // All Supabase Edge Functions require either the anon key or a user access token
  const headers: Record<string, string> = {
    // Default to public anon key for Supabase Edge Functions
    Authorization: `Bearer ${publicAnonKey}`,
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type for non-FormData requests
  // FormData requests need the browser to set the Content-Type with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // For authenticated endpoints, use the user's access token instead
  const authenticatedEndpoints = [
    '/user',
    '/profile',
    '/groups',
    '/groups/current',
    '/groups/join',
    '/users',
    '/matches',
    '/promote-admin',
    '/admin',
    // Admin operations that require authentication
    '/admin/users',
    '/admin/matches',
    '/admin/groups',
    // Relational endpoints that require authentication
    '/user-relational',
    '/users-relational',
    '/groups/current-relational',
    '/groups/user-relational',
    '/matches-relational',
  ];
  const needsUserAuth = authenticatedEndpoints.some(
    authEndpoint => fullEndpoint === authEndpoint || fullEndpoint.startsWith(`${authEndpoint}/`)
  );

  if (needsUserAuth) {
    logger.debug(`Endpoint ${fullEndpoint} requires user authentication`);

    // Check if Authorization header was explicitly provided
    const providedAuth = (options.headers as Record<string, string>)?.Authorization;
    if (providedAuth) {
      logger.debug('Using provided Authorization header');
      headers.Authorization = providedAuth;
    } else {
      // Get current session with improved error handling
      logger.debug('Getting current session for auth token');

      try {
        logger.debug('Getting current session for auth token');
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        logger.debug('Session retrieval result:', {
          hasSession: !!session,
          hasError: !!sessionError,
          sessionError: sessionError?.message,
        });

        if (sessionError) {
          logger.error('Session error', sessionError);

          // Try to refresh the session if it's a token issue
          if (sessionError.message.includes('JWT') || sessionError.message.includes('token')) {
            logger.info('Attempting to refresh session due to token error');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError || !refreshData.session) {
              logger.error('Session refresh failed', refreshError);
              throw new Error(`Authentication session error: ${sessionError.message}`);
            }

            logger.sessionEvent('refreshed');
            headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          } else {
            throw new Error(`Authentication session error: ${sessionError.message}`);
          }
        } else if (!session) {
          logger.error('No session available');
          throw new Error('No authentication session available');
        } else if (!session.access_token) {
          logger.error('No access token in session');
          logger.debug('Session missing access token', {
            hasUser: !!session.user?.id,
            hasExpiry: !!session.expires_at,
          });
          throw new Error('No access token in session');
        } else {
          // Check if token is expired and attempt refresh if needed
          if (session.expires_at && session.expires_at * 1000 < Date.now()) {
            logger.info('Token expired, attempting refresh');

            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError || !refreshData.session) {
              logger.error('Token refresh failed', refreshError);
              throw new Error('Session token has expired and refresh failed');
            }

            logger.sessionEvent('refreshed');
            headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          } else {
            logger.sessionEvent('validated', session.user?.id);
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        }
      } catch (sessionError) {
        logger.error('Failed to get session', sessionError);
        throw new Error(
          `Failed to get authentication session: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`
        );
      }
    }
  }

  logger.debug(`Making request to ${fullEndpoint}`, {
    needsUserAuth,
    hasAuth: !!headers.Authorization,
    authType: headers.Authorization?.split(' ')[0] || 'none',
    method: options.method || 'GET',
    hasBody: !!options.body,
    bodyType: options.body
      ? options.body instanceof FormData
        ? 'FormData'
        : typeof options.body
      : 'none',
  });

  try {
    logger.debug(`Making actual fetch request to: ${API_BASE_URL}${fullEndpoint}`, {
      method: options.method || 'GET',
      hasAuth: !!headers.Authorization,
      authType: headers.Authorization?.split(' ')[0] || 'none',
    });

    const response = await fetch(`${API_BASE_URL}${fullEndpoint}`, {
      ...options,
      headers,
    });

    logger.debug(`Request completed with status: ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    logger.apiResponse(fullEndpoint, response.status, response.ok);

    if (!response.ok) {
      let errorData;
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            errorData = JSON.parse(responseText);
          } catch (jsonError) {
            logger.error('Failed to parse JSON error response', jsonError);
            logger.debug('Raw response text preview', { preview: responseText.substring(0, 100) });

            // Check if it's a common server error format
            if (responseText.includes('404 Not Found')) {
              errorData = { error: `Endpoint not found: ${fullEndpoint}` };
            } else if (
              responseText.includes('500') ||
              responseText.includes('Internal Server Error')
            ) {
              errorData = { error: 'Internal server error - please try again later' };
            } else if (
              responseText.includes('503') ||
              responseText.includes('Service Unavailable')
            ) {
              errorData = {
                error: 'Service temporarily unavailable - please try again in a moment',
              };
            } else {
              errorData = { error: `Server error: ${responseText.substring(0, 100)}` };
            }
          }
        } else {
          errorData = { error: 'Empty response from server' };
        }
      } catch (parseError) {
        logger.error('API Failed to read error response', parseError);
        errorData = { error: 'Network error or invalid response' };
      }

      logger.error(`API Error ${response.status} for ${fullEndpoint}`, errorData);

      // Handle specific error cases
      if (response.status === 401 && needsUserAuth) {
        // Authentication failed - might need to refresh or re-login
        const errorMessage = errorData.error || 'Authentication failed';
        if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
          throw new Error('Invalid or expired token');
        }
        throw new Error('Authentication required');
      }

      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    const responseData = await response.json();
    logger.debug(`Successful response for ${fullEndpoint}`);
    return responseData;
  } catch (fetchError) {
    logger.error(`Fetch error for ${fullEndpoint}`, fetchError);
    throw fetchError;
  }
}
