// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("🚀 Starting Foosball Tracker API function...");

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

console.log('🔧 Initializing Supabase client...');
console.log('SUPABASE_URL available:', !!supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY available:', !!serviceRoleKey);
console.log('SUPABASE_ANON_KEY available:', !!anonKey);

let supabase;
if (supabaseUrl && serviceRoleKey) {
  console.log('✅ Using SERVICE_ROLE_KEY');
  supabase = createClient(supabaseUrl, serviceRoleKey);
} else if (supabaseUrl && anonKey) {
  console.log('⚠️ Using ANON_KEY (limited permissions)');
  supabase = createClient(supabaseUrl, anonKey);
} else {
  console.error('❌ No Supabase credentials available');
  supabase = createClient('', ''); // Fallback to prevent errors
}

console.log('✅ Supabase client initialized');

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
    const path = url.pathname.replace('/api', ''); // Remove /api prefix

    console.log(`Processing path: ${path}`);

    // Test endpoint
    if (path === '/test' && req.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'API working',
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // User relational endpoint
    if (path === '/user-relational' && req.method === 'GET') {
      console.log('🎯 User relational endpoint called');

      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const token = authHeader.substring(7);

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.error('Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      console.log('Authenticated user:', user.id);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError) {
        console.error('Database error:', userError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          current_group_code: userData.current_group_code,
          is_admin: userData.is_admin,
          avatar: userData.avatar,
          singles_elo: userData.singles_elo,
          doubles_elo: userData.doubles_elo,
          singles_wins: userData.singles_wins,
          singles_losses: userData.singles_losses,
          doubles_wins: userData.doubles_wins,
          doubles_losses: userData.doubles_losses,
          created_at: userData.created_at,
          updated_at: userData.updated_at
        },
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Users relational endpoint
    if (path === '/users-relational' && req.method === 'GET') {
      console.log('🎯 Users relational endpoint called');

      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const token = authHeader.substring(7);

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.error('Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError) {
        console.error('Database error getting user:', userError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!userData?.current_group_code) {
        return new Response(JSON.stringify({ error: 'User is not in any group' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const { data: groupUsers, error: groupUsersError } = await supabase
        .from('user_groups')
        .select(`
          user_id,
          users (
            id,
            name,
            email,
            username,
            avatar,
            is_admin,
            singles_elo,
            doubles_elo,
            singles_wins,
            singles_losses,
            doubles_wins,
            doubles_losses,
            created_at,
            updated_at
          )
        `)
        .eq('group_code', userData.current_group_code);

      if (groupUsersError) {
        console.error('Database error getting group users:', groupUsersError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const users = groupUsers
        .map(ug => ug.users)
        .filter(user => user !== null);

      return new Response(JSON.stringify({
        users,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Groups current relational endpoint
    if (path === '/groups/current-relational' && req.method === 'GET') {
      console.log('🎯 Groups current relational endpoint called');

      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const token = authHeader.substring(7);

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.error('Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError) {
        console.error('Database error getting user:', userError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!userData?.current_group_code) {
        return new Response(JSON.stringify({ error: 'User is not in any group' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('code', userData.current_group_code)
        .single();

      if (groupError) {
        console.error('Database error getting group:', groupError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!groupData) {
        return new Response(JSON.stringify({ error: 'Group not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const { count: memberCount } = await supabase
        .from('user_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_code', userData.current_group_code);

      return new Response(JSON.stringify({
        group: {
          code: groupData.code,
          name: groupData.name,
          icon: groupData.icon,
          memberCount: memberCount || 0,
          created_at: groupData.created_at,
          updated_at: groupData.updated_at
        },
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
    console.error('API error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});