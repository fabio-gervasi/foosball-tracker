// Server-only constants - DO NOT import in client-side code
// These constants are only accessible in the Deno server environment

// ELO Rating System constants
export const INITIAL_ELO = 1200;
export const K_FACTOR = 32;

// Admin configuration - SERVER ONLY
// This secret should be moved to environment variables in production
export const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'foosball-admin-2024';

// API route prefix
export const API_PREFIX = '/make-server-171cbf6f';

// Environment validation
if (!Deno.env.get('ADMIN_SECRET')) {
  console.warn(
    'WARNING: ADMIN_SECRET not found in environment variables, using default value. Set ADMIN_SECRET environment variable for production.'
  );
} else {
  console.log('✅ ADMIN_SECRET loaded from environment variables');
}
