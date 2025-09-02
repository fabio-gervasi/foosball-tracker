import { Hono } from 'npm:hono';

export function createDebugRoutes(supabase: any) {
  const app = new Hono();

  // Health check with environment info (public endpoint)
  app.get('/health', async c => {
    console.log('Health check endpoint called');
    
    // Test service role connection
    let serviceRoleStatus = 'not tested';
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) {
        serviceRoleStatus = `error: ${error.message}`;
      } else {
        serviceRoleStatus = 'working';
      }
    } catch (testError) {
      serviceRoleStatus = `exception: ${testError.message}`;
    }

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'foosball-tracker',
      env: {
        supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'configured' : 'missing',
        anonKey: Deno.env.get('SUPABASE_ANON_KEY') ? 'configured' : 'missing',
      },
      services: {
        serviceRole: serviceRoleStatus,
        database: 'migrated to relational tables',
      },
      note: 'KV store has been deprecated and migrated to relational database'
    });
  });

  // Simple status endpoint
  app.get('/debug/status', async c => {
    return c.json({
      message: 'Debug routes working',
      timestamp: new Date().toISOString(),
      note: 'KV store endpoints disabled - use relational database endpoints instead'
    });
  });

  return app;
}
