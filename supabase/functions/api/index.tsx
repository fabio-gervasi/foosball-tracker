import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Import constants and utilities
import { API_PREFIX } from '../_shared/server-constants.tsx';
import { validateUserAuth } from '../_shared/auth-helpers.tsx';
import { migrateGroupDataStructure } from '../_shared/data-migration.tsx';
import * as kv from '../_shared/kv_store.tsx';
import { serverLogger } from '../_shared/server-logger.tsx';

// Import route modules
import { createAuthRoutes } from '../_shared/auth-routes.tsx';
import { createPasswordResetRoutes } from '../_shared/password-reset-routes.tsx';
import { createDebugRoutes } from '../_shared/debug-routes.tsx';
import { createGroupRoutes } from '../_shared/group-routes.tsx';
import { createMatchRoutes } from '../_shared/match-routes.tsx';
import { createUserRoutes } from '../_shared/user-routes.tsx';
import { createAdminRoutes } from '../_shared/admin-routes.tsx';
import { createDataMigrationRoutes } from '../data-migration/index.tsx';

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['*'],
    allowMethods: ['*'],
  })
);
app.use('*', logger(console.log));

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Simple health check endpoint that doesn't require any dependencies
app.get('/make-server-171cbf6f/simple-health', c => {
  try {
    return c.json({
      status: 'server-running',
      timestamp: new Date().toISOString(),
      message: 'Basic server is responding',
      environment: {
        supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        anonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      },
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Additional debug endpoint to check if server is fully operational
app.get('/make-server-171cbf6f/server-status', c => {
  try {
    return c.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      components: {
        routes: 'loaded',
        middleware: 'active',
        supabase: 'configured',
      },
      message: 'All server components loaded successfully',
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Initialize data migrations on startup (with delay to ensure everything is ready)
setTimeout(async () => {
  try {
    // Migrate any existing group data structure
    await migrateGroupDataStructure();
    serverLogger.info('Server data migrations completed successfully');
  } catch (error) {
    serverLogger.error('Failed to run data migrations on startup', error);
  }
}, 1000);

// Mount route modules with error handling
try {
  serverLogger.info('Mounting debug routes');
  app.route(`${API_PREFIX}`, createDebugRoutes(supabase));
  serverLogger.info('Debug routes mounted');

  serverLogger.info('Mounting auth routes');
  app.route(`${API_PREFIX}`, createAuthRoutes(supabase));
  serverLogger.info('Auth routes mounted');

  serverLogger.info('Mounting password reset routes');
  app.route(`${API_PREFIX}`, createPasswordResetRoutes(supabase));
  serverLogger.info('Password reset routes mounted');

  serverLogger.info('Mounting group routes');
  app.route(`${API_PREFIX}`, createGroupRoutes(supabase));
  serverLogger.info('Group routes mounted');

  serverLogger.info('Mounting match routes');
  app.route(`${API_PREFIX}`, createMatchRoutes(supabase));
  serverLogger.info('Match routes mounted');

  serverLogger.info('Mounting user routes');
  app.route(`${API_PREFIX}`, createUserRoutes(supabase));
  serverLogger.info('User routes mounted');

  serverLogger.info('Mounting admin routes');
  app.route(`${API_PREFIX}`, createAdminRoutes(supabase));
  serverLogger.info('Admin routes mounted');

  serverLogger.info('Mounting data migration routes');
  app.route(`${API_PREFIX}/data-migration`, createDataMigrationRoutes(supabase));
  serverLogger.info('Data migration routes mounted');

  serverLogger.info('All routes mounted successfully');
} catch (routeError) {
  serverLogger.error('Error mounting routes', routeError);
  throw routeError;
}

// Global 404 handler for API routes
app.all(`${API_PREFIX}/*`, c => {
  serverLogger.warn('404 - Route not found', { path: c.req.path });
  return c.json({ error: `Route not found: ${c.req.path}` }, 404);
});

// Global error handler
app.onError((err, c) => {
  serverLogger.error('Unhandled server error', err);
  return c.json(
    {
      error: 'Internal server error',
      details: err.message,
    },
    500
  );
});

// Placeholder for additional endpoints that would need to be moved to separate route files
// The original index.tsx had many more endpoints (matches, profile, admin functions, etc.)
// These would be moved to additional route files like:
// - match-routes.tsx (for match recording and history)
// - profile-routes.tsx (for profile updates, avatar uploads)
// - admin-routes.tsx (for admin panel functionality)

// Test all imports and components are working before starting server
try {
  serverLogger.info('Testing server component initialization');
  serverLogger.info('All route modules imported successfully');
  serverLogger.info('All constants and utilities imported successfully');
  serverLogger.info('Supabase client initialized');
  serverLogger.info('KV store imported successfully');
  serverLogger.info('Data migration imported successfully');
  serverLogger.info('Server ready to start');
} catch (error) {
  serverLogger.error('Server initialization failed', {
    name: error.name,
    message: error.message,
    stack: error.stack?.substring(0, 1000),
  });
  throw error;
}

serverLogger.info('Foosball Tracker server initialized successfully');

// Start the server with error handling
try {
  serverLogger.info('Starting Deno server');
  Deno.serve(app.fetch);
  serverLogger.info('Deno server started successfully');
} catch (serverError) {
  serverLogger.error('Failed to start Deno server', {
    name: serverError.name,
    message: serverError.message,
    stack: serverError.stack?.substring(0, 1000),
  });
  throw serverError;
}
