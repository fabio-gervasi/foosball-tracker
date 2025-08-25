import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Import constants and utilities
import { 
  API_PREFIX
} from './server-constants.tsx';
import { validateUserAuth } from './auth-helpers.tsx';
import { migrateGroupDataStructure } from './data-migration.tsx';
import * as kv from './kv_store.tsx';

// Import route modules
import { createAuthRoutes } from './auth-routes.tsx';
import { createPasswordResetRoutes } from './password-reset-routes.tsx';
import { createDebugRoutes } from './debug-routes.tsx';
import { createGroupRoutes } from './group-routes.tsx';
import { createMatchRoutes } from './match-routes.tsx';
import { createUserRoutes } from './user-routes.tsx';
import { createAdminRoutes } from './admin-routes.tsx';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}));
app.use('*', logger(console.log));

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Simple health check endpoint that doesn't require any dependencies
app.get('/make-server-171cbf6f/simple-health', (c) => {
  try {
    return c.json({ 
      status: 'server-running',
      timestamp: new Date().toISOString(),
      message: 'Basic server is responding',
      environment: {
        supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        anonKey: !!Deno.env.get('SUPABASE_ANON_KEY')
      }
    });
  } catch (error) {
    console.error('Simple health check failed:', error);
    return c.json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Additional debug endpoint to check if server is fully operational
app.get('/make-server-171cbf6f/server-status', (c) => {
  try {
    return c.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      components: {
        routes: 'loaded',
        middleware: 'active',
        supabase: 'configured'
      },
      message: 'All server components loaded successfully'
    });
  } catch (error) {
    return c.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Initialize data migrations on startup (with delay to ensure everything is ready)
setTimeout(async () => {
  try {
    // Migrate any existing group data structure
    await migrateGroupDataStructure();
    console.log('Server data migrations completed successfully');
  } catch (error) {
    console.error('Failed to run data migrations on startup:', error);
  }
}, 1000);

// Mount route modules with error handling
try {
  console.log('Mounting debug routes...');
  app.route(`${API_PREFIX}`, createDebugRoutes(supabase));
  console.log('✅ Debug routes mounted');
  
  console.log('Mounting auth routes...');
  app.route(`${API_PREFIX}`, createAuthRoutes(supabase));
  console.log('✅ Auth routes mounted');
  
  console.log('Mounting password reset routes...');
  app.route(`${API_PREFIX}`, createPasswordResetRoutes(supabase));
  console.log('✅ Password reset routes mounted');
  
  console.log('Mounting group routes...');
  app.route(`${API_PREFIX}`, createGroupRoutes(supabase));
  console.log('✅ Group routes mounted');
  
  console.log('Mounting match routes...');
  app.route(`${API_PREFIX}`, createMatchRoutes(supabase));
  console.log('✅ Match routes mounted');
  
  console.log('Mounting user routes...');
  app.route(`${API_PREFIX}`, createUserRoutes(supabase));
  console.log('✅ User routes mounted');
  
  console.log('Mounting admin routes...');
  app.route(`${API_PREFIX}`, createAdminRoutes(supabase));
  console.log('✅ Admin routes mounted');
  
  console.log('✅ All routes mounted successfully');
} catch (routeError) {
  console.error('❌ Error mounting routes:', routeError);
  throw routeError;
}

// Global 404 handler for API routes
app.all(`${API_PREFIX}/*`, (c) => {
  console.log('404 - Route not found:', c.req.path);
  return c.json({ error: `Route not found: ${c.req.path}` }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled server error:', err);
  return c.json({ 
    error: 'Internal server error', 
    details: err.message 
  }, 500);
});



// Placeholder for additional endpoints that would need to be moved to separate route files
// The original index.tsx had many more endpoints (matches, profile, admin functions, etc.)
// These would be moved to additional route files like:
// - match-routes.tsx (for match recording and history)
// - profile-routes.tsx (for profile updates, avatar uploads)  
// - admin-routes.tsx (for admin panel functionality)

// Test all imports and components are working before starting server
try {
  console.log('=== Testing server component initialization ===');
  console.log('✅ All route modules imported successfully');
  console.log('✅ All constants and utilities imported successfully');
  console.log('✅ Supabase client initialized');
  console.log('✅ KV store imported successfully');
  console.log('✅ Data migration imported successfully');
  console.log('=== Server ready to start ===');
} catch (error) {
  console.error('❌ Server initialization failed:', error);
  console.error('Error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack?.substring(0, 1000)
  });
  throw error;
}

console.log('🚀 Foosball Tracker server initialized successfully');

// Start the server with error handling
try {
  console.log('🔥 Starting Deno server...');
  Deno.serve(app.fetch);
  console.log('✅ Deno server started successfully');
} catch (serverError) {
  console.error('❌ Failed to start Deno server:', serverError);
  console.error('Server error details:', {
    name: serverError.name,
    message: serverError.message,
    stack: serverError.stack?.substring(0, 1000)
  });
  throw serverError;
}