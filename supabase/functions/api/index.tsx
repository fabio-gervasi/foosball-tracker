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

      // Construct avatar URL if avatar is a filename (using signed URL for security)
      let avatarUrl = null;
      if (userData.avatar && userData.avatar.length > 1 && !userData.avatar.includes('/')) {
        try {
          // Generate a signed URL that expires in 1 hour for security
          const { data: signedUrlData } = await supabase.storage
            .from('make-171cbf6f-avatars')
            .createSignedUrl(userData.avatar, 3600); // 1 hour expiry

          if (signedUrlData?.signedUrl) {
            avatarUrl = signedUrlData.signedUrl;
          }
        } catch (error) {
          console.error('Failed to generate signed URL for avatar:', error);
          // Fallback to null - component will show initials
        }
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
          avatarUrl: avatarUrl,
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

      // Process users with signed URLs for avatars
      const usersPromises = groupUsers.map(async (ug) => {
        const user = ug.users;
        if (!user) return null;

        // Construct avatar URL if avatar is a filename (using signed URL for security)
        let avatarUrl = null;
        if (user.avatar && user.avatar.length > 1 && !user.avatar.includes('/')) {
          try {
            const { data: signedUrlData } = await supabase.storage
              .from('make-171cbf6f-avatars')
              .createSignedUrl(user.avatar, 3600); // 1 hour expiry

            if (signedUrlData?.signedUrl) {
              avatarUrl = signedUrlData.signedUrl;
            }
          } catch (error) {
            console.error(`Failed to generate signed URL for user ${user.id}:`, error);
            // Continue without avatar URL - component will show initials
          }
        }

        return {
          ...user,
          avatarUrl: avatarUrl
        };
      });

      const users = (await Promise.all(usersPromises)).filter(user => user !== null);

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

    // Matches relational endpoint
    if (path === '/matches-relational' && req.method === 'GET') {
      console.log('🎯 Matches relational endpoint called');

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

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          group_code,
          match_type,
          series_type,
          recorded_by,
          winner_email,
          winner_is_guest,
          created_at,
          match_players (
            user_id,
            team,
            position,
            is_guest,
            guest_name,
            users (
              id,
              name,
              email,
              username
            )
          ),
          match_results (
            game_number,
            winning_team
          )
        `)
        .eq('group_code', userData.current_group_code)
        .order('created_at', { ascending: false });

      if (matchesError) {
        console.error('Database error getting matches:', matchesError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Transform the data to match the expected format
      const matches = (matchesData || []).map(match => ({
        id: match.id,
        date: match.date,
        group_code: match.group_code,
        match_type: match.match_type,
        series_type: match.series_type,
        recorded_by: match.recorded_by,
        winner_email: match.winner_email,
        winner_is_guest: match.winner_is_guest,
        created_at: match.created_at,
        players: match.match_players?.map(mp => ({
          user_id: mp.user_id,
          team: mp.team,
          position: mp.position,
          is_guest: mp.is_guest,
          guest_name: mp.guest_name,
          users: mp.users
        })) || [],
        match_results: match.match_results || []
      }));

      return new Response(JSON.stringify({
        matches,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Profile avatar endpoint
    if (path === '/profile/avatar' && (req.method === 'POST' || req.method === 'DELETE')) {
      console.log('🎯 Profile avatar endpoint called');

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

      if (req.method === 'DELETE') {
        // Delete avatar
        console.log('Deleting avatar for user:', user.id);

        try {
          // Get current user data to find the avatar filename
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('avatar')
            .eq('id', user.id)
            .single();

          if (userError) {
            console.error('Database error getting user:', userError);
            return new Response(JSON.stringify({ error: 'Database error' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          if (userData?.avatar && !userData.avatar.includes('/') && userData.avatar.length > 1) {
            // This looks like a filename, try to delete from storage
            const { error: deleteError } = await supabase.storage
              .from('make-171cbf6f-avatars')
              .remove([userData.avatar]);

            if (deleteError) {
              console.error('Storage delete error:', deleteError);
              // Don't fail the request if storage delete fails, just log it
            }
          }

          // Update user avatar to initials
          const initials = userData?.avatar || user.user_metadata?.name?.[0]?.toUpperCase() || 'U';
          const { error: updateError } = await supabase
            .from('users')
            .update({ avatar: initials })
            .eq('id', user.id);

          if (updateError) {
            console.error('Database update error:', updateError);
            return new Response(JSON.stringify({ error: 'Failed to update avatar' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          return new Response(JSON.stringify({
            message: 'Avatar deleted successfully',
            timestamp: new Date().toISOString(),
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        } catch (error) {
          console.error('Avatar delete error:', error);
          return new Response(JSON.stringify({ error: 'Failed to delete avatar' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } else if (req.method === 'POST') {
        // Upload avatar
        console.log('Uploading avatar for user:', user.id);

        try {
          const contentType = req.headers.get('content-type') || '';
          if (!contentType.includes('multipart/form-data')) {
            return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Parse multipart form data
          const formData = await req.formData();
          const file = formData.get('avatar') as File;

          if (!file) {
            return new Response(JSON.stringify({ error: 'No avatar file provided' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Validate file type
          if (!file.type.startsWith('image/')) {
            return new Response(JSON.stringify({ error: 'File must be an image' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Validate file size (5MB)
          if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'File must be smaller than 5MB' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Generate unique filename
          const fileExt = file.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}_${Date.now()}.${fileExt}`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('make-171cbf6f-avatars')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return new Response(JSON.stringify({ error: 'Failed to upload image' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Update user avatar in database
          const { error: updateError } = await supabase
            .from('users')
            .update({ avatar: fileName })
            .eq('id', user.id);

          if (updateError) {
            console.error('Database update error:', updateError);
            // Try to clean up the uploaded file
            await supabase.storage
              .from('make-171cbf6f-avatars')
              .remove([fileName]);

            return new Response(JSON.stringify({ error: 'Failed to update avatar' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          return new Response(JSON.stringify({
            message: 'Avatar uploaded successfully',
            avatar: fileName,
            timestamp: new Date().toISOString(),
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        } catch (error) {
          console.error('Avatar upload error:', error);
          return new Response(JSON.stringify({ error: 'Failed to upload avatar' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
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