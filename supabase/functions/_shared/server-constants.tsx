// Server-only constants - DO NOT import in client-side code
// These constants are only accessible in the Deno server environment

// ELO Rating System constants
export const INITIAL_ELO = 1200;
export const K_FACTOR = 32;

// Admin configuration - SERVER ONLY
export const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET');

// API route prefix
export const API_PREFIX = '';

// Environment validation - made non-fatal for debugging
if (!ADMIN_SECRET) {
  console.warn('⚠️ ADMIN_SECRET is not defined in environment variables.');
  console.warn('Some admin features may not work without ADMIN_SECRET.');
  console.warn('Please set the ADMIN_SECRET environment variable for full functionality.');
} else {
  console.log('✅ ADMIN_SECRET loaded from environment variables');
}
