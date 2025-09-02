import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { API_PREFIX } from '../_shared/server-constants.tsx';
import { createRelationalRoutes } from '../_shared/relational-routes.tsx';

console.log('🚀 Starting Foosball Tracker API function (relational routes enabled)...');

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

// Add request logging middleware
app.use('*', async (c, next) => {
  console.log(`📨 ${c.req.method} ${c.req.path}`);
  await next();
});

// Initialize Supabase client (service role) for server-side operations
let supabase: any;
try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  console.log('🔧 Initializing Supabase client...');
  console.log('SUPABASE_URL present:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseServiceKey);

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
  throw error;
}

// Simple health endpoints
app.get('/make-server-171cbf6f/health', c => {
  return c.json({
    status: 'ok',
    message: 'Minimal health check working',
    timestamp: new Date().toISOString(),
  });
});

// Health at API prefix for client checks
app.get(`${API_PREFIX}/simple-health`, c => {
  return c.json({
    status: 'server-running',
    timestamp: new Date().toISOString(),
    message: 'API prefix health check working',
  });
});

// Basic test
app.get('/test', c => {
  return c.json({
    message: 'API working',
    timestamp: new Date().toISOString(),
  });
});

// Test relational endpoint
app.get(`${API_PREFIX}/user-relational-test`, (c)=>{
  console.log('🎯 Test relational endpoint called');
  return c.json({
    status: 'test-working',
    timestamp: new Date().toISOString(),
    message: 'Test relational endpoint working',
    apiPrefix: API_PREFIX
  });
});

// Mount relational routes at root level for make-server-171cbf6f function
try {
  console.log('Mounting relational routes at root level');
  const relationalRoutes = createRelationalRoutes(supabase);
  console.log('Created relational routes:', typeof relationalRoutes);

  app.route('/', relationalRoutes);
  console.log('✅ Relational routes mounted at root level');

  // Debug: Log all registered routes
  console.log('📋 Available routes:');
  if (app.routes && Array.isArray(app.routes)) {
    app.routes.forEach((route: any, index: number) => {
      console.log(`  ${index + 1}. ${route.method} ${route.path}`);
    });
  } else {
    console.log('  No routes array found on app');
  }

} catch (routeError) {
  console.error('❌ Error mounting relational routes:', routeError);
  throw routeError;
}

console.log('✅ API initialized');

Deno.serve(app.fetch);
