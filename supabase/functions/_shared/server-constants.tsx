// Server-only constants - DO NOT import in client-side code
// These constants are only accessible in the Deno server environment

// ELO Rating System constants
export const INITIAL_ELO = 1200;
export const K_FACTOR = 32;

// Admin configuration - SERVER ONLY
export const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET');

// API route prefix
export const API_PREFIX = '/make-server-171cbf6f';

// Environment validation
if (!ADMIN_SECRET) {
  console.error('FATAL: ADMIN_SECRET is not defined in environment variables.');
  console.error('The application cannot start without a valid ADMIN_SECRET.');
  console.error('Please set the ADMIN_SECRET environment variable and restart the server.');
  Deno.exit(1);
} else {
  console.log('✅ ADMIN_SECRET loaded from environment variables');
}
