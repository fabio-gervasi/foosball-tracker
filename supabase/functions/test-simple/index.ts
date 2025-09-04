// Simple test function to verify basic functionality
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.log("🚀 Starting test-simple function...");

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

    console.log(`Processing path: ${path}`);

    if (path === '/test-simple' && req.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'test-simple function working',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: path,
        env_vars: {
          SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
          SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
          SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      path: path,
      method: req.method
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in test-simple function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
