// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log('🚀 Starting username-lookup function...');

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

console.log('🔧 Username-lookup: Initializing Supabase client...');
console.log('SUPABASE_URL available:', !!supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY available:', !!serviceRoleKey);
console.log('SUPABASE_ANON_KEY available:', !!anonKey);

let supabase;
if (supabaseUrl && serviceRoleKey) {
  console.log('✅ Using SERVICE_ROLE_KEY for username lookup');
  supabase = createClient(supabaseUrl, serviceRoleKey);
} else if (supabaseUrl && anonKey) {
  console.log('⚠️ Using ANON_KEY (limited permissions) - this may fail due to RLS');
  supabase = createClient(supabaseUrl, anonKey);
} else {
  console.error('❌ No credentials available');
  supabase = createClient('', ''); // Fallback to prevent errors
}

console.log('✅ Username-lookup client initialized');

Deno.serve(async (req) => {
  console.log(`📨 ${req.method} ${req.url}`);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`Processing request:`);
    console.log(`- URL: ${req.url}`);
    console.log(`- Path: ${path}`);
    console.log(`- Method: ${req.method}`);
    console.log(`- Full URL: ${url.href}`);

    // Username lookup endpoint - handle any POST request
    if (req.method === 'POST') {
      console.log('🎯 Username lookup endpoint called');

      const body = await req.json();
      const { username } = body;

      if (!username || typeof username !== 'string') {
        return new Response(JSON.stringify({
          error: 'Username is required and must be a string'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // TEMPORARY: Use direct users table query with existing RLS policy
      // TODO: Replace with secure username_lookup table once migration is applied
      const { data: user, error } = await supabase
        .from('users')
        .select('email')
        .eq('username', username.trim())
        .eq('is_deleted', false)
        .maybeSingle();

      if (error) {
        console.error('Database error during username lookup:', error);
        return new Response(JSON.stringify({
          error: 'Database error occurred during lookup'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!user) {
        return new Response(JSON.stringify({
          error: 'Username not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      console.log(`✅ Found email for username: ${username} -> ${user.email}`);

      return new Response(JSON.stringify({
        email: user.email,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Test endpoint - handle GET requests to /test
    if (path === '/test' && req.method === 'GET') {
      console.log('🎯 Test endpoint called');
      return new Response(JSON.stringify({
        message: 'username-lookup function working',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Not found
    return new Response(JSON.stringify({
      error: 'Endpoint not found',
      path: path,
      method: req.method
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('Username-lookup error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
