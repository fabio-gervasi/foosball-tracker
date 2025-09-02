// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';

console.log('🚀 Starting make-server-171cbf6f function...');

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

console.log('✅ make-server-171cbf6f initialized');

Deno.serve(app.fetch);