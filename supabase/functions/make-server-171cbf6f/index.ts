// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';

console.log('🚀 Starting make-server-171cbf6f function...');

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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

// Basic test endpoint
app.get('/test', c => {
  console.log('🎯 Test endpoint called');
  return c.json({
    message: 'make-server-171cbf6f working',
    timestamp: new Date().toISOString(),
  });
});

// Username lookup endpoint (bypasses JWT requirement)
app.post('/username-lookup', async (c) => {
  console.log('🎯 Username lookup endpoint called');

  try {
    const body = await c.req.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return c.json({
        error: 'Username is required and must be a string'
      }, 400);
    }

    // Query the users table to find the user by username
    const { data: user, error } = await supabase
      .from('users')
      .select('email')
      .eq('username', username.trim())
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      console.error('Database error during username lookup:', error);
      return c.json({
        error: 'Database error occurred during lookup'
      }, 500);
    }

    if (!user) {
      return c.json({
        error: 'Username not found'
      }, 404);
    }

    console.log(`✅ Found email for username: ${username} -> ${user.email}`);

    return c.json({
      email: user.email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in username lookup endpoint:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});



// Relational endpoints
app.get('/user-relational', async (c) => {
  console.log('🎯 User relational endpoint called');
  return c.json({
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      current_group_code: 'DEMO01'
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/users-relational', async (c) => {
  console.log('🎯 Users relational endpoint called');
  return c.json({
    users: [
      {
        id: 'test-user-1',
        name: 'Test User 1',
        email: 'test1@example.com'
      },
      {
        id: 'test-user-2',
        name: 'Test User 2',
        email: 'test2@example.com'
      }
    ],
    timestamp: new Date().toISOString(),
  });
});

app.get('/groups/current-relational', async (c) => {
  console.log('🎯 Groups current relational endpoint called');
  return c.json({
    group: {
      code: 'DEMO01',
      name: 'Demo Group',
      memberCount: 2
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/groups/user-relational', async (c) => {
  console.log('🎯 Groups user relational endpoint called');
  return c.json({
    groups: [
      {
        code: 'DEMO01',
        name: 'Demo Group',
        memberCount: 2
      }
    ],
    timestamp: new Date().toISOString(),
  });
});

app.get('/matches-relational', async (c) => {
  console.log('🎯 Matches relational endpoint called');
  return c.json({
    matches: [
      {
        id: 'match-1',
        matchType: '1v1',
        date: new Date().toISOString(),
        groupCode: 'DEMO01'
      }
    ],
    timestamp: new Date().toISOString(),
  });
});

// Group creation endpoint
app.post('/groups', async (c) => {
  console.log('🎯 Group creation endpoint called');

  try {
    const body = await c.req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({
        error: 'Group name is required and must be a non-empty string'
      }, 400);
    }

    // Get authenticated user
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Authorization required'
      }, 401);
    }

    const token = authHeader.substring(7);
    // In a real implementation, you'd verify the JWT and get the user ID
    // For now, we'll create a mock user ID
    const userId = 'current-user-id';

    // Generate a unique group code (6 characters)
    const groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create group in database (mock implementation)
    const newGroup = {
      code: groupCode,
      name: name.trim(),
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log(`✅ Group created: ${name} (${groupCode})`);

    return c.json({
      group: newGroup,
      message: 'Group created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in group creation endpoint:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Group join endpoint
app.post('/groups/join', async (c) => {
  console.log('🎯 Group join endpoint called');

  try {
    const body = await c.req.json();
    const { groupCode } = body;

    if (!groupCode || typeof groupCode !== 'string' || groupCode.trim().length === 0) {
      return c.json({
        error: 'Group code is required and must be a non-empty string'
      }, 400);
    }

    // Get authenticated user
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Authorization required'
      }, 401);
    }

    const token = authHeader.substring(7);
    // In a real implementation, you'd verify the JWT and get the user ID
    const userId = 'current-user-id';

    // Check if group exists (mock implementation - accept any 6-letter code)
    if (groupCode.trim().length !== 6) {
      return c.json({
        error: 'Invalid group code. Group codes are 6 characters long.'
      }, 404);
    }

    // Mock group data
    const group = {
      code: groupCode.trim().toUpperCase(),
      name: `Group ${groupCode.trim().toUpperCase()}`,
      memberCount: 1
    };

    console.log(`✅ User joined group: ${groupCode} (${group.name})`);

    return c.json({
      group: group,
      message: 'Successfully joined group',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in group join endpoint:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

console.log('✅ make-server-171cbf6f initialized');

Deno.serve(app.fetch);