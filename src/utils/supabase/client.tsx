import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

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
  }
});

// API base URL for our server functions
export const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-171cbf6f`;

// Helper function to make authenticated requests
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  console.log(`[API] Starting request to ${endpoint}`);
  
  // All Supabase Edge Functions require either the anon key or a user access token
  let headers = {
    // Default to public anon key for Supabase Edge Functions
    'Authorization': `Bearer ${publicAnonKey}`,
    ...options.headers,
  };

  // Only set Content-Type for non-FormData requests
  // FormData requests need the browser to set the Content-Type with boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // For authenticated endpoints, use the user's access token instead
  const authenticatedEndpoints = ['/user', '/profile', '/groups', '/groups/current', '/groups/join', '/users', '/matches', '/promote-admin', '/admin'];
  const needsUserAuth = authenticatedEndpoints.some(authEndpoint => 
    endpoint === authEndpoint || endpoint.startsWith(authEndpoint + '/')
  );

  if (needsUserAuth) {
    console.log(`[API] Endpoint ${endpoint} requires user authentication`);
    
    // Check if Authorization header was explicitly provided
    const providedAuth = options.headers?.Authorization;
    if (providedAuth) {
      console.log('[API] Using provided Authorization header');
      headers.Authorization = providedAuth;
    } else {
      // Get current session with improved error handling
      console.log('[API] Getting current session for auth token');
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[API] Session error:', sessionError.message);
          
          // Try to refresh the session if it's a token issue
          if (sessionError.message.includes('JWT') || sessionError.message.includes('token')) {
            console.log('[API] Attempting to refresh session...');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              console.error('[API] Session refresh failed:', refreshError?.message);
              throw new Error(`Authentication session error: ${sessionError.message}`);
            }
            
            console.log('[API] Session refreshed successfully');
            headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          } else {
            throw new Error(`Authentication session error: ${sessionError.message}`);
          }
        } else if (!session) {
          console.error('[API] No session available');
          throw new Error('No authentication session available');
        } else if (!session.access_token) {
          console.error('[API] No access token in session');
          console.error('[API] Session data:', { 
            user: session.user?.id || 'no user', 
            expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'no expiry'
          });
          throw new Error('No access token in session');
        } else {
          // Check if token is expired and attempt refresh if needed
          if (session.expires_at && session.expires_at * 1000 < Date.now()) {
            console.log('[API] Token expired, attempting refresh...');
            
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              console.error('[API] Token refresh failed:', refreshError?.message);
              throw new Error('Session token has expired and refresh failed');
            }
            
            console.log('[API] Token refreshed successfully');
            headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          } else {
            console.log('[API] Using session access token');
            console.log('[API] Token length:', session.access_token.length);
            console.log('[API] Token preview:', session.access_token.substring(0, 20) + '...');
            console.log('[API] Session expires:', new Date(session.expires_at * 1000).toISOString());
            console.log('[API] Session user:', session.user?.id);
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        }
        
      } catch (sessionError) {
        console.error('[API] Failed to get session:', sessionError.message);
        throw new Error(`Failed to get authentication session: ${sessionError.message}`);
      }
    }
  }

  console.log(`[API] Making request to ${endpoint}`, {
    needsUserAuth,
    authHeaderPresent: !!headers.Authorization,
    authHeaderType: headers.Authorization?.split(' ')[0] || 'none',
    method: options.method || 'GET',
    url: `${API_BASE_URL}${endpoint}`,
    bodyType: options.body ? (options.body instanceof FormData ? 'FormData' : typeof options.body) : 'none',
    hasContentType: !!headers['Content-Type'],
    contentType: headers['Content-Type'] || 'not set'
  });

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    console.log(`[API] Response ${response.status} for ${endpoint}`);

    if (!response.ok) {
      let errorData;
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            errorData = JSON.parse(responseText);
          } catch (jsonError) {
            console.error('[API] Failed to parse JSON error response:', jsonError);
            console.error('[API] Raw response text:', responseText.substring(0, 200));
            
            // Check if it's a common server error format
            if (responseText.includes('404 Not Found')) {
              errorData = { error: `Endpoint not found: ${endpoint}` };
            } else if (responseText.includes('500') || responseText.includes('Internal Server Error')) {
              errorData = { error: 'Internal server error - please try again later' };
            } else if (responseText.includes('503') || responseText.includes('Service Unavailable')) {
              errorData = { error: 'Service temporarily unavailable - please try again in a moment' };
            } else {
              errorData = { error: `Server error: ${responseText.substring(0, 100)}` };
            }
          }
        } else {
          errorData = { error: 'Empty response from server' };
        }
      } catch (parseError) {
        console.error('[API] Failed to read error response:', parseError);
        errorData = { error: 'Network error or invalid response' };
      }
      
      console.error(`[API] Error ${response.status} for ${endpoint}:`, errorData);
      
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
    console.log(`[API] Successful response for ${endpoint}`);
    return responseData;

  } catch (fetchError) {
    console.error(`[API] Fetch error for ${endpoint}:`, fetchError.message);
    throw fetchError;
  }
}