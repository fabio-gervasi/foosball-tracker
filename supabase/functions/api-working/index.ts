// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Import ELO calculation functions
import { calculateELOChanges, calculateFoosballELOChanges } from './elo-system.tsx';

console.log('🚀 Starting API Working function...');

// Helper function to get authenticated user from JWT
async function getAuthenticatedUser(authHeader: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Create a Supabase client to verify the JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Error getting user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return null;
  }
}

// Helper function to calculate ELO changes for a match
async function calculateMatchELOChanges(matchData: any, supabase: any, matchId: string) {
  try {
    const eloChanges: Record<string, { oldRating: number; newRating: number; change: number }> = {};

    if (matchData.matchType === '1v1') {
      // Get player ratings
      const player1User = matchData.player1IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, singles_elo')
              .eq('email', matchData.player1Email)
              .maybeSingle()
          ).data;
      const player2User = matchData.player2IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, singles_elo')
              .eq('email', matchData.player2Email)
              .maybeSingle()
          ).data;

      if (player1User && player2User) {
        // Determine winner - winnerEmail now contains player ID, not email
        const isPlayer1Winner = matchData.winnerEmail === player1User.id;

        const eloResult = calculateELOChanges(
          player1User.singles_elo || 1200,
          player2User.singles_elo || 1200,
          isPlayer1Winner
        );

        // Store ELO changes in database
        await supabase.from('elo_changes').insert([
          {
            match_id: matchId,
            user_id: player1User.id,
            old_rating: eloResult.player1.oldRating,
            new_rating: eloResult.player1.newRating,
            rating_type: 'singles',
            change_amount: eloResult.player1.change,
          },
          {
            match_id: matchId,
            user_id: player2User.id,
            old_rating: eloResult.player2.oldRating,
            new_rating: eloResult.player2.newRating,
            rating_type: 'singles',
            change_amount: eloResult.player2.change,
          },
        ]);

        // Update user ELO ratings
        await supabase
          .from('users')
          .update({
            singles_elo: eloResult.player1.newRating,
            singles_wins: isPlayer1Winner ? player1User.singles_wins + 1 : player1User.singles_wins,
            singles_losses: isPlayer1Winner
              ? player1User.singles_losses
              : player1User.singles_losses + 1,
          })
          .eq('id', player1User.id);

        await supabase
          .from('users')
          .update({
            singles_elo: eloResult.player2.newRating,
            singles_wins: isPlayer1Winner ? player2User.singles_wins : player2User.singles_wins + 1,
            singles_losses: isPlayer1Winner
              ? player2User.singles_losses + 1
              : player2User.singles_losses,
          })
          .eq('id', player2User.id);

        eloChanges[player1User.id] = {
          oldRating: eloResult.player1.oldRating,
          newRating: eloResult.player1.newRating,
          change: eloResult.player1.change,
        };

        eloChanges[player2User.id] = {
          oldRating: eloResult.player2.oldRating,
          newRating: eloResult.player2.newRating,
          change: eloResult.player2.change,
        };
      }
    } else if (matchData.matchType === '2v2') {
      // Get player ratings for 2v2
      const team1Player1 = matchData.team1Player1IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, doubles_elo, singles_wins, singles_losses')
              .eq('email', matchData.team1Player1Email)
              .maybeSingle()
          ).data;
      const team1Player2 = matchData.team1Player2IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, doubles_elo, singles_wins, singles_losses')
              .eq('email', matchData.team1Player2Email)
              .maybeSingle()
          ).data;
      const team2Player1 = matchData.team2Player1IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, doubles_elo, singles_wins, singles_losses')
              .eq('email', matchData.team2Player1Email)
              .maybeSingle()
          ).data;
      const team2Player2 = matchData.team2Player2IsGuest
        ? null
        : (
            await supabase
              .from('users')
              .select('id, doubles_elo, singles_wins, singles_losses')
              .eq('email', matchData.team2Player2Email)
              .maybeSingle()
          ).data;

      if (team1Player1 && team1Player2 && team2Player1 && team2Player2) {
        const isTeam1Winner = matchData.winningTeam === 'team1';

        // Calculate games played for K-factor
        const getGamesPlayed = (player: any) =>
          (player.singles_wins || 0) + (player.singles_losses || 0);

        const eloResult = calculateFoosballELOChanges(
          team1Player1.doubles_elo || 1200,
          team1Player2.doubles_elo || 1200,
          team2Player1.doubles_elo || 1200,
          team2Player2.doubles_elo || 1200,
          isTeam1Winner,
          getGamesPlayed(team1Player1),
          getGamesPlayed(team1Player2),
          getGamesPlayed(team2Player1),
          getGamesPlayed(team2Player2)
        );

        // Store ELO changes in database
        await supabase.from('elo_changes').insert([
          {
            match_id: matchId,
            user_id: team1Player1.id,
            old_rating: eloResult.team1Player1.oldRating,
            new_rating: eloResult.team1Player1.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team1Player1.change,
          },
          {
            match_id: matchId,
            user_id: team1Player2.id,
            old_rating: eloResult.team1Player2.oldRating,
            new_rating: eloResult.team1Player2.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team1Player2.change,
          },
          {
            match_id: matchId,
            user_id: team2Player1.id,
            old_rating: eloResult.team2Player1.oldRating,
            new_rating: eloResult.team2Player1.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team2Player1.change,
          },
          {
            match_id: matchId,
            user_id: team2Player2.id,
            old_rating: eloResult.team2Player2.oldRating,
            new_rating: eloResult.team2Player2.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team2Player2.change,
          },
        ]);

        // Update user ELO ratings and stats
        await supabase
          .from('users')
          .update({
            doubles_elo: eloResult.team1Player1.newRating,
            doubles_wins: isTeam1Winner ? team1Player1.doubles_wins + 1 : team1Player1.doubles_wins,
            doubles_losses: isTeam1Winner
              ? team1Player1.doubles_losses
              : team1Player1.doubles_losses + 1,
          })
          .eq('id', team1Player1.id);

        await supabase
          .from('users')
          .update({
            doubles_elo: eloResult.team1Player2.newRating,
            doubles_wins: isTeam1Winner ? team1Player2.doubles_wins + 1 : team1Player2.doubles_wins,
            doubles_losses: isTeam1Winner
              ? team1Player2.doubles_losses
              : team1Player2.doubles_losses + 1,
          })
          .eq('id', team1Player2.id);

        await supabase
          .from('users')
          .update({
            doubles_elo: eloResult.team2Player1.newRating,
            doubles_wins: isTeam1Winner ? team2Player1.doubles_wins : team2Player1.doubles_wins + 1,
            doubles_losses: isTeam1Winner
              ? team2Player1.doubles_losses + 1
              : team2Player1.doubles_losses,
          })
          .eq('id', team2Player1.id);

        await supabase
          .from('users')
          .update({
            doubles_elo: eloResult.team2Player2.newRating,
            doubles_wins: isTeam1Winner ? team2Player2.doubles_wins : team2Player2.doubles_wins + 1,
            doubles_losses: isTeam1Winner
              ? team2Player2.doubles_losses + 1
              : team2Player2.doubles_losses,
          })
          .eq('id', team2Player2.id);

        eloChanges[team1Player1.id] = {
          oldRating: eloResult.team1Player1.oldRating,
          newRating: eloResult.team1Player1.newRating,
          change: eloResult.team1Player1.change,
        };

        eloChanges[team1Player2.id] = {
          oldRating: eloResult.team1Player2.oldRating,
          newRating: eloResult.team1Player2.newRating,
          change: eloResult.team1Player2.change,
        };

        eloChanges[team2Player1.id] = {
          oldRating: eloResult.team2Player1.oldRating,
          newRating: eloResult.team2Player1.newRating,
          change: eloResult.team2Player1.change,
        };

        eloChanges[team2Player2.id] = {
          oldRating: eloResult.team2Player2.oldRating,
          newRating: eloResult.team2Player2.newRating,
          change: eloResult.team2Player2.change,
        };
      }
    }

    return eloChanges;
  } catch (error) {
    console.error('Error calculating ELO changes:', error);
    return {};
  }
}

// MINIMAL TEST FUNCTION - Test DELETE request handling
console.log('STARTING EDGE FUNCTION - VERSION WITH DELETE DEBUG');

Deno.serve(async req => {
  console.log('REQUEST RECEIVED - Method:', req.method, 'URL:', req.url);

  // For non-DELETE requests, continue with original logic
  console.log('=== REQUEST RECEIVED (ORIGINAL LOGIC) ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  const url = new URL(req.url);
  let path = url.pathname;
  console.log('Original pathname:', path);
  console.log('Full URL:', req.url);

  // Strip Supabase function prefix for route matching
  if (path.startsWith('/functions/v1/api-working')) {
    path = path.substring('/functions/v1/api-working'.length);
  }
  console.log('=== END PATH PROCESSING ===');

  // Helper function to add CORS headers
  function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Accept, Origin, X-Requested-With'
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Authorization, Content-Type, Accept, Origin, X-Requested-With',
      },
    });
  }

  // Basic test endpoint
  console.log('Checking route [1/15]: Basic test endpoint');
  console.log('  Path:', path, 'Method:', req.method);
  console.log('  Condition 1:', path === '/test');
  console.log('  Condition 2:', path === '/api-working/test');
  console.log('  Condition 3:', req.method === 'GET');
  console.log(
    '  Combined condition:',
    (path === '/test' || path === '/api-working/test') && req.method === 'GET'
  );

  if ((path === '/test' || path === '/api-working/test') && req.method === 'GET') {
    console.log('🎯 ENTERED: Test endpoint called');
    const data = {
      message: 'API working',
      timestamp: new Date().toISOString(),
    };
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    return addCorsHeaders(response);
  }

  // User relational endpoint
  if (
    (path === '/user-relational' || path === '/api-working/user-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 User relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user data from database including is_admin
      console.log('🔍 Getting user data from database:', user.id);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(
          'id, name, email, username, is_admin, current_group_code, singles_elo, singles_wins, singles_losses, doubles_elo, doubles_wins, doubles_losses, created_at, updated_at'
        )
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user data:', userError);
        const errorData = {
          error: 'User Not Found',
          message: 'User data not found in database',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        user: userData,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning user data for:', user.email);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error fetching user data:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch user data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Users relational endpoint
  if (
    (path === '/users-relational' || path === '/api-working/users-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Users relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${authHeader.substring(7)}`, // Remove "Bearer " prefix
            },
          },
        }
      );

      // First get the user's current group
      console.log('🔍 Getting current group for user:', user.id);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        console.log('❌ No current group found for user:', user.id);
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all users in the same group
      console.log('🔍 Querying users for group:', userData.current_group_code);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(
          'id, name, email, avatar, singles_elo, doubles_elo, singles_wins, singles_losses, doubles_wins, doubles_losses, current_group_code'
        )
        .eq('current_group_code', userData.current_group_code);

      console.log('📊 Users query result:', {
        dataLength: usersData?.length || 0,
        error: usersError,
        groupCode: userData.current_group_code,
      });

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch users data',
          details: usersError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        users: usersData || [],
        timestamp: new Date().toISOString(),
      };

      console.log(
        '✅ Returning real users for group:',
        userData.current_group_code,
        'Count:',
        usersData?.length || 0
      );

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in users-relational endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch users data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups current relational endpoint
  if (
    (path === '/groups/current-relational' || path === '/api-working/groups/current-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Groups current relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${authHeader.substring(7)}`, // Remove "Bearer " prefix
            },
          },
        }
      );

      // Get user's current group by finding their most recent group membership
      console.log('🔍 Querying current group for user:', user.id);
      const { data: userGroupData, error: userGroupError } = await supabase
        .from('user_groups')
        .select(
          `
          group_code,
          joined_at,
          groups (
            code,
            name
          )
        `
        )
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .single();

      console.log('📊 Current group query result:', {
        data: userGroupData,
        error: userGroupError,
        hasGroups: !!userGroupData?.groups,
      });

      if (userGroupError || !userGroupData?.groups) {
        console.log('❌ No group membership found for user:', user.id, 'Error:', userGroupError);
        const errorData = {
          error: 'No Current Group',
          message: 'User is not a member of any group',
          details: userGroupError?.message || 'No group data found',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const groupData = userGroupData.groups;

      if (!groupData) {
        const errorData = {
          error: 'Group Not Found',
          message: `Group data not available`,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get member count
      const { count: memberCount, error: countError } = await supabase
        .from('user_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_code', groupData.code);

      const data = {
        group: {
          code: groupData.code,
          name: groupData.name,
          memberCount: memberCount || 1,
        },
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning current group data for:', groupData.code, groupData.name);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error fetching current group:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch current group data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups user relational endpoint
  if (
    (path === '/groups/user-relational' || path === '/api-working/groups/user-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Groups user relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${authHeader.substring(7)}`, // Remove "Bearer " prefix
            },
          },
        }
      );

      // Get all groups the user is a member of
      console.log('🔍 Querying user_groups for user:', user.id);
      const { data: userGroupsData, error: userGroupsError } = await supabase
        .from('user_groups')
        .select(
          `
          group_code,
          joined_at,
          groups (
            code,
            name
          )
        `
        )
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      console.log('📊 User groups query result:', {
        data: userGroupsData,
        error: userGroupsError,
        dataLength: userGroupsData?.length || 0,
      });

      if (userGroupsError) {
        console.error('❌ Error fetching user groups:', userGroupsError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch user groups',
          details: userGroupsError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data and get member counts for each group
      const groups = await Promise.all(
        (userGroupsData || []).map(async (userGroup: any) => {
          const group = userGroup.groups;
          if (!group) return null;

          // Get member count for this group
          const { count: memberCount } = await supabase
            .from('user_groups')
            .select('*', { count: 'exact', head: true })
            .eq('group_code', group.code);

          return {
            code: group.code,
            name: group.name,
            memberCount: memberCount || 1,
          };
        })
      );

      // Filter out null values
      const validGroups = groups.filter(group => group !== null);

      const data = {
        groups: validGroups,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning user groups for:', user.email, 'Groups:', validGroups.length);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch user groups',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups join endpoint
  if ((path === '/groups/join' || path === '/api-working/groups/join') && req.method === 'POST') {
    console.log('🎯 Groups join endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Parse the request body to get the group code
      const body = await req.json();
      const { groupCode } = body;

      if (!groupCode) {
        const errorData = {
          error: 'Bad Request',
          message: 'Group code is required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // For now, we'll simulate group joining
      // In a real implementation, this would check if the group exists and add the user to it

      // Check if it's the expected group code "ONEAXA"
      if (groupCode === 'ONEAXA') {
        const data = {
          success: true,
          message: 'Successfully joined group',
          group: {
            code: groupCode,
            name: 'AXA Foosball Group',
            memberCount: 15,
            joined: true,
          },
          timestamp: new Date().toISOString(),
        };

        console.log('✅ User joined group:', groupCode);

        const response = new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(response);
      } else {
        // Group not found
        const errorData = {
          error: 'Group Not Found',
          message: `Group with code '${groupCode}' not found`,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }
    } catch (error) {
      console.error('Error processing group join request:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to process group join request',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Matches relational endpoint
  if (
    (path === '/matches-relational' || path === '/api-working/matches-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Matches relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // First get the user's current group
      console.log('🔍 Getting current group for matches:', user.id);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        console.log('❌ No current group found for user:', user.id);
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all matches for the user's group with player details and ELO changes
      console.log('🔍 Querying matches for group:', userData.current_group_code);
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(
          `
          id,
          date,
          match_type,
          group_code,
          recorded_by,
          winner_email,
          match_players (
            user_id,
            team,
            position,
            is_guest,
            guest_name,
            users (
              id,
              name,
              email
            )
          ),
          elo_changes (
            user_id,
            old_rating,
            new_rating,
            rating_type,
            change_amount
          )
        `
        )
        .eq('group_code', userData.current_group_code)
        .order('date', { ascending: false });

      console.log('📊 Matches query result:', {
        dataLength: matchesData?.length || 0,
        error: matchesError,
        groupCode: userData.current_group_code,
      });

      if (matchesError) {
        console.error('❌ Error fetching matches:', matchesError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch matches data',
          details: matchesError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data to match the expected format
      const transformedMatches = (matchesData || []).map(match => {
        // Transform ELO changes into a keyed object by user ID
        const eloChanges: Record<string, { oldRating: number; newRating: number; change: number }> =
          {};
        (match.elo_changes || []).forEach(change => {
          if (change.user_id) {
            eloChanges[change.user_id] = {
              oldRating: change.old_rating,
              newRating: change.new_rating,
              change: change.change_amount,
            };
          }
        });

        return {
          id: match.id,
          date: match.date,
          matchType: match.match_type,
          groupCode: match.group_code,
          recordedBy: match.recorded_by,
          winnerEmail: match.winner_email,
          players:
            match.match_players?.map(player => ({
              match_id: match.id,
              user_id: player.user_id,
              team: player.team,
              position: player.position,
              is_guest: player.is_guest,
              guest_name: player.guest_name,
              users: player.users
                ? {
                    id: player.users.id,
                    name: player.users.name,
                    email: player.users.email,
                  }
                : null,
            })) || [],
          eloChanges,
        };
      });

      const data = {
        matches: transformedMatches,
        timestamp: new Date().toISOString(),
      };

      console.log(
        '✅ Returning real matches for group:',
        userData.current_group_code,
        'Count:',
        transformedMatches.length
      );

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in matches-relational endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch matches data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Submit match endpoint
  if ((path === '/matches' || path === '/api-working/matches') && req.method === 'POST') {
    console.log('🎯 Submit match endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Parse the request body
      const matchData = await req.json();
      console.log('Match data received:', matchData);

      // Create a Supabase client for database operations
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${authHeader.substring(7)}`, // Remove "Bearer " prefix
            },
          },
        }
      );

      // Get user's current group
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Generate match ID
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Insert match into database
      const { data: insertedMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          id: matchId,
          date: matchData.date || new Date().toISOString().split('T')[0],
          group_code: userData.current_group_code,
          match_type: matchData.matchType || '1v1',
          recorded_by: user.id,
          winner_email: matchData.winnerEmail,
          winner_is_guest: matchData.winnerIsGuest || false,
        })
        .select()
        .single();

      if (matchError) {
        console.error('Error inserting match:', matchError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to create match',
          details: matchError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Insert match players
      const matchPlayers = [];

      if (matchData.matchType === '1v1') {
        // Handle 1v1 match players
        if (matchData.player1Email) {
          const player1User = matchData.player1IsGuest
            ? null
            : (
                await supabase
                  .from('users')
                  .select('id')
                  .eq('email', matchData.player1Email)
                  .maybeSingle()
              ).data;

          matchPlayers.push({
            match_id: matchId,
            user_id: player1User?.id || null,
            team: 'team1',
            position: 1,
            is_guest: matchData.player1IsGuest || false,
            guest_name: matchData.player1IsGuest ? matchData.player1Email : null,
          });
        }

        if (matchData.player2Email) {
          const player2User = matchData.player2IsGuest
            ? null
            : (
                await supabase
                  .from('users')
                  .select('id')
                  .eq('email', matchData.player2Email)
                  .maybeSingle()
              ).data;

          matchPlayers.push({
            match_id: matchId,
            user_id: player2User?.id || null,
            team: 'team2',
            position: 1,
            is_guest: matchData.player2IsGuest || false,
            guest_name: matchData.player2IsGuest ? matchData.player2Email : null,
          });
        }
      } else if (matchData.matchType === '2v2') {
        // Handle 2v2 match players
        const teamPlayers = [
          {
            email: matchData.team1Player1Email,
            isGuest: matchData.team1Player1IsGuest,
            team: 'team1',
            position: 1,
          },
          {
            email: matchData.team1Player2Email,
            isGuest: matchData.team1Player2IsGuest,
            team: 'team1',
            position: 2,
          },
          {
            email: matchData.team2Player1Email,
            isGuest: matchData.team2Player1IsGuest,
            team: 'team2',
            position: 1,
          },
          {
            email: matchData.team2Player2Email,
            isGuest: matchData.team2Player2IsGuest,
            team: 'team2',
            position: 2,
          },
        ];

        for (const player of teamPlayers) {
          if (player.email) {
            const playerUser = player.isGuest
              ? null
              : (await supabase.from('users').select('id').eq('email', player.email).maybeSingle())
                  .data;

            matchPlayers.push({
              match_id: matchId,
              user_id: playerUser?.id || null,
              team: player.team,
              position: player.position,
              is_guest: player.isGuest || false,
              guest_name: player.isGuest ? player.email : null,
            });
          }
        }
      }

      // Insert match players
      if (matchPlayers.length > 0) {
        const { error: playersError } = await supabase.from('match_players').insert(matchPlayers);

        if (playersError) {
          console.error('Error inserting match players:', playersError);
        }
      }

      // Calculate and store ELO changes
      const eloChanges = await calculateMatchELOChanges(matchData, supabase, matchId);

      const data = {
        success: true,
        message: 'Match submitted successfully',
        match: {
          id: matchId,
          ...matchData,
          eloChanges,
        },
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Match submitted successfully:', matchId);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in submit match endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to submit match',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Username lookup endpoint (for username login)
  if (
    (path === '/username-lookup' || path === '/api-working/username-lookup') &&
    req.method === 'POST'
  ) {
    try {
      console.log('🔍 Username lookup request received');

      const { username } = await req.json();

      if (!username) {
        const errorData = {
          error: 'Username required',
          message: 'Please provide a username to look up',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('Looking up username:', username);

      // Create Supabase client for database queries
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Look up user by username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, username')
        .eq('username', username)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.log('❌ Username not found:', username);
        const errorData = {
          error: 'Username not found',
          message: `No account found with username '${username}'. Please check your username and try again.`,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('✅ Username found:', userData.email);

      const responseData = {
        email: userData.email,
        userId: userData.id,
        username: userData.username,
        name: userData.name,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Username lookup error:', error);
      const errorData = {
        error: 'Internal server error',
        message: 'Failed to look up username',
        details: error.message,
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin endpoints - require admin privileges
  console.log('Checking route [8/15]: Admin matches GET');
  console.log('  Path:', path, 'Method:', req.method);
  console.log('  Condition 1:', path === '/admin/matches');
  console.log('  Condition 2:', path === '/api-working/admin/matches');
  console.log('  Condition 3:', req.method === 'GET');
  console.log(
    '  Combined condition:',
    (path === '/admin/matches' || path === '/api-working/admin/matches') && req.method === 'GET'
  );

  if (
    (path === '/admin/matches' || path === '/api-working/admin/matches') &&
    req.method === 'GET'
  ) {
    console.log('🎯 ENTERED: Admin matches endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get user's current group
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (currentUserError || !currentUserData?.current_group_code) {
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all matches for the user's group with player details, ELO changes, and match results
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(
          `
          id,
          date,
          match_type,
          group_code,
          recorded_by,
          winner_email,
          match_players (
            user_id,
            team,
            position,
            is_guest,
            guest_name,
            users (
              id,
              name,
              email
            )
          ),
          match_results (
            game_number,
            winning_team
          ),
          elo_changes (
            user_id,
            old_rating,
            new_rating,
            rating_type,
            change_amount
          )
        `
        )
        .eq('group_code', currentUserData.current_group_code)
        .order('date', { ascending: false });

      if (matchesError) {
        console.error('❌ Error fetching admin matches:', matchesError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch matches data',
          details: matchesError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data to match the expected format
      const transformedMatches = (matchesData || []).map(match => {
        // Transform ELO changes into a keyed object by user ID
        const eloChanges: Record<string, { oldRating: number; newRating: number; change: number }> =
          {};
        (match.elo_changes || []).forEach(change => {
          if (change.user_id) {
            eloChanges[change.user_id] = {
              oldRating: change.old_rating,
              newRating: change.new_rating,
              change: change.change_amount,
            };
          }
        });

        return {
          id: match.id,
          date: match.date,
          matchType: match.match_type,
          groupCode: match.group_code,
          recordedBy: match.recorded_by,
          winnerEmail: match.winner_email,
          players:
            match.match_players?.map(player => ({
              match_id: match.id,
              user_id: player.user_id,
              team: player.team,
              position: player.position,
              is_guest: player.is_guest,
              guest_name: player.guest_name,
              users: player.users
                ? {
                    id: player.users.id,
                    name: player.users.name,
                    email: player.users.email,
                  }
                : null,
            })) || [],
          eloChanges,
        };
      });

      const data = {
        matches: transformedMatches,
        timestamp: new Date().toISOString(),
      };

      console.log(
        '✅ Returning admin matches for group:',
        currentUserData.current_group_code,
        'Count:',
        transformedMatches.length
      );

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin matches endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch admin matches data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin data cleanup endpoint - Identify incomplete matches
  if (
    (path === '/admin/cleanup-matches' || path === '/api-working/admin/cleanup-matches') &&
    req.method === 'POST'
  ) {
    console.log('🎯 Admin cleanup matches endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return errorResponse;
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      const errorData = {
        error: 'Forbidden',
        message: 'Admin privileges required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
      return errorResponse;
    }

    try {
      // Find matches with results but no players (incomplete data)
      const { data: incompleteMatches, error: incompleteError } = await supabase
        .from('matches')
        .select(
          `
          id,
          match_type,
          created_at,
          match_results!inner(match_id),
          match_players(match_id)
        `
        )
        .eq('group_code', 'ONEAXA')
        .is('winner_email', null);

      if (incompleteError) {
        throw incompleteError;
      }

      // Filter to only matches with results but no players
      const trulyIncompleteMatches = (incompleteMatches || []).filter(
        match =>
          match.match_results &&
          match.match_results.length > 0 &&
          (!match.match_players || match.match_players.length === 0)
      );

      const cleanupResults = trulyIncompleteMatches.map(match => ({
        id: match.id,
        match_type: match.match_type,
        created_at: match.created_at,
        has_results: match.match_results.length > 0,
        player_count: match.match_players?.length || 0,
        recommended_action: 'mark_as_incomplete',
      }));

      const successData = {
        success: true,
        message: `Found ${cleanupResults.length} incomplete matches`,
        totalIncompleteMatches: cleanupResults.length,
        cleanupResults,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(successData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      const errorData = {
        error: 'Cleanup failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return errorResponse;
    }
  }

  // Admin data migration endpoint - Fix winner_email for existing matches
  if (
    (path === '/admin/migrate-winners' || path === '/api-working/admin/migrate-winners') &&
    req.method === 'POST'
  ) {
    console.log('🎯 Admin migrate winners endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get user's current group
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (currentUserError || !currentUserData?.current_group_code) {
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Find matches that need winner_email migration (have null winner_email but have match_results)
      const { data: matchesToMigrate, error: migrationQueryError } = await supabase
        .from('matches')
        .select(
          `
          id,
          winner_email,
          match_results (
            winning_team
          ),
          match_players (
            user_id,
            team,
            users (
              email
            )
          )
        `
        )
        .eq('group_code', currentUserData.current_group_code)
        .is('winner_email', null)
        .not('match_results', 'is', null);

      if (migrationQueryError) {
        console.error('❌ Error querying matches for migration:', migrationQueryError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to query matches for migration',
          details: migrationQueryError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      let migratedCount = 0;
      const migrationResults = [];

      // Process each match that needs migration
      for (const match of matchesToMigrate || []) {
        if (!match.match_results || match.match_results.length === 0) {
          migrationResults.push({
            matchId: match.id,
            status: 'skipped',
            reason: 'No match results found',
          });
          continue;
        }

        const winningTeam = match.match_results[0].winning_team;

        // Find ALL players from the winning team (both registered users and guests)
        const winningTeamPlayers =
          match.match_players?.filter(player => player.team === winningTeam) || [];

        if (winningTeamPlayers.length === 0) {
          migrationResults.push({
            matchId: match.id,
            status: 'skipped',
            reason: 'No players found in winning team',
            winningTeam: winningTeam,
          });
          continue;
        }

        // First try to find a registered user in the winning team
        const registeredPlayers = winningTeamPlayers.filter(
          player => !player.is_guest && player.user_id
        );

        let winnerIdentifier = null;

        if (registeredPlayers.length > 0) {
          // Use the first registered player's ID (preferred)
          winnerIdentifier = registeredPlayers[0].user_id;
        } else {
          // If no registered users, try to find a guest player
          const guestPlayers = winningTeamPlayers.filter(
            player => player.is_guest && player.guest_name
          );

          if (guestPlayers.length > 0) {
            // Use guest identifier format
            winnerIdentifier = `guest:${guestPlayers[0].guest_name}`;
          }
        }

        if (winnerIdentifier) {
          // Update the match - store both winner_email (for backward compatibility) and winner_player_id
          const updateData: any = {};

          if (winnerIdentifier.startsWith('guest:')) {
            // For guest players, store the guest identifier in winner_email
            updateData.winner_email = winnerIdentifier;
            updateData.winner_is_guest = true;
          } else {
            // For registered users, store the player ID in winner_email (for now, to maintain compatibility)
            // TODO: Add winner_player_id field to matches table and use that instead
            updateData.winner_email = winnerIdentifier; // This should be the player ID, not email
            updateData.winner_is_guest = false;
          }

          const { error: updateError } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', match.id);

          if (updateError) {
            console.error(`❌ Error updating match ${match.id}:`, updateError);
            migrationResults.push({
              matchId: match.id,
              status: 'error',
              error: updateError.message,
              winnerEmail: winnerEmail,
              winningTeam: winningTeam,
            });
          } else {
            migratedCount++;
            migrationResults.push({
              matchId: match.id,
              status: 'success',
              winnerEmail: winnerEmail,
              winningTeam: winningTeam,
              playerType: registeredPlayers.length > 0 ? 'registered' : 'guest',
            });
          }
        } else {
          migrationResults.push({
            matchId: match.id,
            status: 'skipped',
            reason: 'No suitable winner found in winning team',
            winningTeam: winningTeam,
            playerCount: winningTeamPlayers.length,
          });
        }
      }

      const data = {
        success: true,
        message: `Migration completed. ${migratedCount} matches updated.`,
        migratedCount,
        totalMatchesFound: matchesToMigrate?.length || 0,
        migrationResults,
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Migration completed: ${migratedCount} matches updated`);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin migrate winners endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to migrate winner data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin users endpoint
  if ((path === '/admin/users' || path === '/api-working/admin/users') && req.method === 'GET') {
    console.log('🎯 Admin users endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get user's current group
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (currentUserError || !currentUserData?.current_group_code) {
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all users in the same group
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(
          'id, name, email, avatar, singles_elo, doubles_elo, singles_wins, singles_losses, doubles_wins, doubles_losses, current_group_code, is_admin, created_at, updated_at'
        )
        .eq('current_group_code', currentUserData.current_group_code);

      if (usersError) {
        console.error('❌ Error fetching admin users:', usersError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch users data',
          details: usersError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        users: usersData || [],
        timestamp: new Date().toISOString(),
      };

      console.log(
        '✅ Returning admin users for group:',
        currentUserData.current_group_code,
        'Count:',
        usersData?.length || 0
      );

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin users endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch admin users data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin groups endpoint
  if ((path === '/admin/groups' || path === '/api-working/admin/groups') && req.method === 'GET') {
    console.log('🎯 Admin groups endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all groups the user is a member of
      const { data: userGroupsData, error: userGroupsError } = await supabase
        .from('user_groups')
        .select(
          `
          group_code,
          joined_at,
          groups (
            code,
            name
          )
        `
        )
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (userGroupsError) {
        console.error('❌ Error fetching admin groups:', userGroupsError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch groups data',
          details: userGroupsError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data and get member counts for each group
      const groups = await Promise.all(
        (userGroupsData || []).map(async (userGroup: any) => {
          const group = userGroup.groups;
          if (!group) return null;

          // Get member count for this group
          const { count: memberCount } = await supabase
            .from('user_groups')
            .select('*', { count: 'exact', head: true })
            .eq('group_code', group.code);

          return {
            code: group.code,
            name: group.name,
            memberCount: memberCount || 1,
          };
        })
      );

      // Filter out null values
      const validGroups = groups.filter(group => group !== null);

      const data = {
        groups: validGroups,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning admin groups for user:', user.email, 'Groups:', validGroups.length);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin groups endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch admin groups data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin user operations - Toggle admin status
  console.log('Checking route [13/15]: Admin toggle user admin status');
  console.log('  Path:', path, 'Method:', req.method);
  console.log('  Condition 1:', path.startsWith('/admin/users/'));
  console.log('  Condition 2:', path.endsWith('/admin'));
  console.log('  Condition 3:', req.method === 'PUT');
  console.log(
    '  Combined condition:',
    path.startsWith('/admin/users/') && path.endsWith('/admin') && req.method === 'PUT'
  );
  console.log('  Path segments:', path.split('/'));
  console.log('  Path length:', path.split('/').length);

  if (
    ((path.startsWith('/admin/users/') && path.endsWith('/admin')) ||
      (path.startsWith('/api-working/admin/users/') && path.endsWith('/admin'))) &&
    req.method === 'PUT'
  ) {
    console.log('🎯 ENTERED: Admin toggle user admin status endpoint called');
    console.log('  User ID:', path.split('/')[path.split('/').length - 2]);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if requesting user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Extract user ID from path
      const pathParts = path.split('/');
      const targetUserId = pathParts[pathParts.length - 2]; // /admin/users/{userId}/admin

      // Get request body
      const body = await req.json();
      const { isAdmin } = body;

      // Update user admin status
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ is_admin: isAdmin })
        .eq('id', targetUserId)
        .select('id, name, email, is_admin')
        .single();

      if (updateError) {
        console.error('❌ Error updating user admin status:', updateError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to update user admin status',
          details: updateError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        user: updateData,
        message: `User admin status ${isAdmin ? 'granted' : 'revoked'} successfully`,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ User admin status updated:', updateData);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin toggle user admin status endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to update user admin status',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin user operations - Delete user
  console.log('Checking route [14/15]: Admin delete user');
  console.log('  Path:', path, 'Method:', req.method);
  console.log('  Condition 1:', path.startsWith('/admin/users/'));
  console.log('  Condition 2:', !path.endsWith('/admin'));
  console.log('  Condition 3:', req.method === 'DELETE');
  console.log(
    '  Combined condition:',
    path.startsWith('/admin/users/') && !path.endsWith('/admin') && req.method === 'DELETE'
  );
  console.log('  Path segments:', path.split('/'));
  console.log('  Path length:', path.split('/').length);

  if (
    ((path.startsWith('/admin/users/') && !path.endsWith('/admin')) ||
      (path.startsWith('/api-working/admin/users/') && !path.endsWith('/admin'))) &&
    req.method === 'DELETE'
  ) {
    console.log('🎯 ENTERED: Admin delete user endpoint called');
    console.log('  User ID:', path.split('/').pop());

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if requesting user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Extract user ID from path
      const pathParts = path.split('/');
      const targetUserId = pathParts[pathParts.length - 1]; // /admin/users/{userId}

      // Prevent self-deletion
      if (targetUserId === user.id) {
        const errorData = {
          error: 'Bad Request',
          message: 'Cannot delete your own account',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Soft delete user (set is_deleted = true)
      const { data: deleteData, error: deleteError } = await supabase
        .from('users')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', targetUserId)
        .select('id, name, email')
        .single();

      if (deleteError) {
        console.error('❌ Error deleting user:', deleteError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to delete user',
          details: deleteError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        user: deleteData,
        message: 'User deleted successfully',
        timestamp: new Date().toISOString(),
      };

      console.log('✅ User deleted:', deleteData);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin delete user endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to delete user',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Admin match operations - Delete match
  console.log('Checking route [15/15]: Admin delete match');
  console.log('  Path:', path, 'Method:', req.method);
  console.log('  Condition 1:', path.startsWith('/admin/matches/'));
  console.log('  Condition 2:', !path.endsWith('/admin'));
  console.log('  Condition 3:', req.method === 'DELETE');
  console.log(
    '  Combined condition:',
    path.startsWith('/admin/matches/') && !path.endsWith('/admin') && req.method === 'DELETE'
  );
  console.log('  Path segments:', path.split('/'));
  console.log('  Path length:', path.split('/').length);

  if (
    ((path.startsWith('/admin/matches/') && !path.endsWith('/admin')) ||
      (path.startsWith('/api-working/admin/matches/') && !path.endsWith('/admin'))) &&
    req.method === 'DELETE'
  ) {
    console.log('🎯 ENTERED: Admin delete match endpoint called');
    console.log('  Match ID:', path.split('/').pop());

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if requesting user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        const errorData = {
          error: 'Forbidden',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Extract match ID from path
      const pathParts = path.split('/');
      const matchId = pathParts[pathParts.length - 1]; // /admin/matches/{matchId}

      // Delete match and related data (cascade delete should handle related records)
      const { data: deleteData, error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)
        .select('id, date, match_type')
        .single();

      if (deleteError) {
        console.error('❌ Error deleting match:', deleteError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to delete match',
          details: deleteError.message,
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        match: deleteData,
        message: 'Match deleted successfully',
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Match deleted:', deleteData);

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in admin delete match endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to delete match',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Profile avatar upload endpoint
  if (
    (path === '/profile/avatar' ||
      path === '/api-working/profile/avatar' ||
      path === '/api-working/api-working/profile/avatar') &&
    req.method === 'POST'
  ) {
    console.log('🎯 Profile avatar upload endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get the uploaded file from form data
      const formData = await req.formData();
      const file = formData.get('avatar') as File;

      if (!file) {
        const errorData = {
          error: 'No file uploaded',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        const errorData = {
          error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        const errorData = {
          error: 'File too large. Maximum size is 5MB.',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Create avatars bucket if it doesn't exist
      const bucketName = 'make-171cbf6f-avatars';
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

      if (!bucketExists) {
        console.log('Creating avatars bucket...');
        const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          allowedMimeTypes: allowedTypes,
          fileSizeLimit: maxSize,
        });

        if (bucketError) {
          console.error('Failed to create avatars bucket:', bucketError);
          const errorData = {
            error: 'Failed to create storage bucket',
            timestamp: new Date().toISOString(),
          };
          const errorResponse = new Response(JSON.stringify(errorData), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
          return addCorsHeaders(errorResponse);
        }
        console.log('Avatars bucket created successfully');
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExtension}`;
      const filePath = `avatars/${fileName}`;

      // Convert file to ArrayBuffer for Supabase upload
      const fileBuffer = await file.arrayBuffer();

      // Upload to Supabase Storage
      console.log('Uploading avatar file:', filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Failed to upload avatar:', uploadError);
        const errorData = {
          error: 'Failed to upload avatar',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('Avatar uploaded successfully:', uploadData.path);

      // Generate signed URL for the uploaded avatar (valid for 1 year)
      // Use the actual uploaded path instead of the intended path
      const actualFilePath = uploadData.path || filePath;
      console.log('Creating signed URL for path:', actualFilePath);

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(actualFilePath, 60 * 60 * 24 * 365); // 1 year

      if (urlError) {
        console.error('Failed to create signed URL:', urlError);
        const errorData = {
          error: 'Failed to create avatar URL',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Update user profile with avatar URL in database
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          avatar: signedUrlData.signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update user avatar in database:', updateError);
        const errorData = {
          error: 'Failed to update user profile',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform response to match expected format
      const updatedProfile = {
        ...updatedUser,
        avatarUrl: updatedUser.avatar,
        isAdmin: updatedUser.is_admin,
        singlesElo: updatedUser.singles_elo,
        doublesElo: updatedUser.doubles_elo,
        singlesWins: updatedUser.singles_wins,
        singlesLosses: updatedUser.singles_losses,
        doublesWins: updatedUser.doubles_wins,
        doublesLosses: updatedUser.doubles_losses,
        currentGroup: updatedUser.current_group_code,
        updatedAt: updatedUser.updated_at,
        password: undefined, // Never send passwords
      };

      console.log('Profile updated with avatar URL');
      const data = {
        message: 'Avatar uploaded successfully',
        avatarUrl: signedUrlData.signedUrl,
        user: updatedProfile,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in profile avatar upload endpoint:', error);
      const errorData = {
        error: 'Internal server error while uploading avatar',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Profile avatar delete endpoint
  if (
    (path === '/profile/avatar' ||
      path === '/api-working/profile/avatar' ||
      path === '/api-working/api-working/profile/avatar') &&
    req.method === 'DELETE'
  ) {
    console.log('🎯 Profile avatar delete endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, avatar')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        const errorData = {
          error: 'User profile not found',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // If user has no avatar, nothing to delete
      if (!userData.avatar) {
        const data = {
          message: 'No avatar to delete',
          timestamp: new Date().toISOString(),
        };
        const response = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(response);
      }

      // Update user profile to remove avatar
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          avatar: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update user avatar in database:', updateError);
        const errorData = {
          error: 'Failed to delete avatar',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform response to match expected format
      const updatedProfile = {
        ...updatedUser,
        avatarUrl: null,
        isAdmin: updatedUser.is_admin,
        singlesElo: updatedUser.singles_elo,
        doublesElo: updatedUser.doubles_elo,
        singlesWins: updatedUser.singles_wins,
        singlesLosses: updatedUser.singles_losses,
        doublesWins: updatedUser.doubles_wins,
        doublesLosses: updatedUser.doubles_losses,
        currentGroup: updatedUser.current_group_code,
        updatedAt: updatedUser.updated_at,
        password: undefined, // Never send passwords
      };

      console.log('Avatar deleted successfully');
      const data = {
        message: 'Avatar deleted successfully',
        user: updatedProfile,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in profile avatar delete endpoint:', error);
      const errorData = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups current icon upload endpoint (admin only)
  if (
    (path === '/groups/current/icon' || path === '/api-working/groups/current/icon') &&
    req.method === 'POST'
  ) {
    console.log('🎯 Groups current icon upload endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's current group and check if admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code, is_admin')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        const errorData = {
          error: 'User profile not found',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      if (!userData.current_group_code) {
        const errorData = {
          error: 'User is not in any group',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      if (!userData.is_admin) {
        const errorData = {
          error: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get the uploaded file from form data
      const formData = await req.formData();
      const file = formData.get('icon') as File;

      if (!file) {
        const errorData = {
          error: 'No file uploaded',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        const errorData = {
          error: 'File must be an image',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        const errorData = {
          error: 'File size must be less than 5MB',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Create group icons bucket if it doesn't exist
      const bucketName = 'make-171cbf6f-group-icons';
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

      if (!bucketExists) {
        console.log('Creating group icons bucket...');
        const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
          fileSizeLimit: maxSize,
        });

        if (bucketError) {
          console.error('Failed to create group icons bucket:', bucketError);
          const errorData = {
            error: 'Failed to create storage bucket',
            timestamp: new Date().toISOString(),
          };
          const errorResponse = new Response(JSON.stringify(errorData), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
          return addCorsHeaders(errorResponse);
        }
        console.log('Group icons bucket created successfully');
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${userData.current_group_code}-${Date.now()}.${fileExtension}`;
      const filePath = fileName;

      // Convert file to ArrayBuffer for Supabase upload
      const fileBuffer = await file.arrayBuffer();

      // Upload to Supabase Storage
      console.log('Uploading group icon file:', filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload group icon:', uploadError);
        const errorData = {
          error: 'Failed to upload image',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('Group icon uploaded successfully:', uploadData.path);

      // Generate signed URL for the uploaded icon (valid for 1 year)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (urlError) {
        console.error('Failed to create signed URL:', urlError);
        const errorData = {
          error: 'Failed to get image URL',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Update group with icon URL in database
      const { data: updatedGroup, error: updateError } = await supabase
        .from('groups')
        .update({
          icon: signedUrlData.signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('code', userData.current_group_code)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update group icon in database:', updateError);
        const errorData = {
          error: 'Failed to update group with icon',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('Group updated with icon successfully');
      const data = {
        message: 'Group icon uploaded successfully',
        iconUrl: signedUrlData.signedUrl,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in groups current icon upload endpoint:', error);
      const errorData = {
        error: 'Internal server error while uploading group icon',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups current icon delete endpoint (admin only)
  if (
    (path === '/groups/current/icon' || path === '/api-working/groups/current/icon') &&
    req.method === 'DELETE'
  ) {
    console.log('🎯 Groups current icon delete endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's current group and check if admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code, is_admin')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        const errorData = {
          error: 'User profile not found',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      if (!userData.current_group_code) {
        const errorData = {
          error: 'User is not in any group',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      if (!userData.is_admin) {
        const errorData = {
          error: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get current group data
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('code, name, icon')
        .eq('code', userData.current_group_code)
        .single();

      if (groupError || !groupData) {
        const errorData = {
          error: 'Group not found',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // If group has no icon, nothing to delete
      if (!groupData.icon) {
        const data = {
          message: 'No icon to delete',
          timestamp: new Date().toISOString(),
        };
        const response = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(response);
      }

      // Update group to remove icon
      const { data: updatedGroup, error: updateError } = await supabase
        .from('groups')
        .update({
          icon: null,
          updated_at: new Date().toISOString(),
        })
        .eq('code', userData.current_group_code)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update group:', updateError);
        const errorData = {
          error: 'Failed to delete group icon',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      console.log('Group icon deleted successfully');
      const data = {
        message: 'Group icon deleted successfully',
        group: {
          code: updatedGroup.code,
          name: updatedGroup.name,
          icon: updatedGroup.icon,
          updatedAt: updatedGroup.updated_at,
        },
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in groups current icon delete endpoint:', error);
      const errorData = {
        error: 'Internal server error while deleting group icon',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups current relational endpoint
  if (
    (path === '/groups/current-relational' || path === '/api-working/groups/current-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Groups current relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's current group
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        const errorData = {
          error: 'No Current Group',
          message: 'User does not have a current group set',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('code, name, created_at, updated_at')
        .eq('code', userData.current_group_code)
        .single();

      if (groupError || !groupData) {
        const errorData = {
          error: 'Group Not Found',
          message: 'Current group not found in database',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Get member count
      const { count: memberCount, error: countError } = await supabase
        .from('user_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_code', userData.current_group_code);

      const data = {
        group: {
          code: groupData.code,
          name: groupData.name,
          memberCount: memberCount || 0,
          createdAt: groupData.created_at,
          updatedAt: groupData.updated_at,
        },
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in groups current relational endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch current group data',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups user relational endpoint
  if (
    (path === '/groups/user-relational' || path === '/api-working/groups/user-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Groups user relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's groups
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('user_groups')
        .select(
          `
          group_code,
          joined_at,
          groups (
            code,
            name,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', user.id);

      if (userGroupsError) {
        console.error('Error fetching user groups:', userGroupsError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch user groups',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data
      const groups =
        userGroups?.map(ug => ({
          code: ug.groups.code,
          name: ug.groups.name,
          memberCount: 0, // We'll calculate this separately if needed
          joinedAt: ug.joined_at,
          createdAt: ug.groups.created_at,
          updatedAt: ug.groups.updated_at,
        })) || [];

      const data = {
        groups,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in groups user relational endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch user groups',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Matches relational endpoint
  if (
    (path === '/matches-relational' || path === '/api-working/matches-relational') &&
    req.method === 'GET'
  ) {
    console.log('🎯 Matches relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: 'Unauthorized',
        message: 'Valid authentication required',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Create a Supabase client to query the database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's current group
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        const data = {
          matches: [],
          timestamp: new Date().toISOString(),
        };
        const response = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(response);
      }

      // Get matches for the group
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select(
          `
          id,
          date,
          match_type,
          series_type,
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
              username,
              email
            )
          )
        `
        )
        .eq('group_code', userData.current_group_code)
        .order('date', { ascending: false })
        .limit(50);

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        const errorData = {
          error: 'Database Error',
          message: 'Failed to fetch matches',
          timestamp: new Date().toISOString(),
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform matches to include player details
      const transformedMatches =
        matches?.map(match => {
          const players = match.match_players || [];
          const team1Players = players
            .filter(p => p.team === 'team1')
            .sort((a, b) => a.position - b.position);
          const team2Players = players
            .filter(p => p.team === 'team2')
            .sort((a, b) => a.position - b.position);

          return {
            id: match.id,
            date: match.date,
            matchType: match.match_type,
            seriesType: match.series_type,
            winnerEmail: match.winner_email,
            winnerIsGuest: match.winner_is_guest,
            createdAt: match.created_at,
            team1: team1Players.map(p => ({
              id: p.user_id || p.guest_name,
              name: p.is_guest
                ? p.guest_name
                : p.users?.name || p.users?.username || p.users?.email,
              isGuest: p.is_guest,
            })),
            team2: team2Players.map(p => ({
              id: p.user_id || p.guest_name,
              name: p.is_guest
                ? p.guest_name
                : p.users?.name || p.users?.username || p.users?.email,
              isGuest: p.is_guest,
            })),
          };
        }) || [];

      const data = {
        matches: transformedMatches,
        timestamp: new Date().toISOString(),
      };

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error in matches relational endpoint:', error);
      const errorData = {
        error: 'Internal Server Error',
        message: 'Failed to fetch matches',
        timestamp: new Date().toISOString(),
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Default 404 response
  console.log('❌ ENDPOINT NOT FOUND - NO ROUTES MATCHED');
  console.log('  Final path:', path);
  console.log('  Method:', req.method);
  console.log('  Original URL:', req.url);
  console.log('  All route checks completed without match');

  const errorData = {
    error: 'Endpoint not found',
    path: path,
    method: req.method,
    timestamp: new Date().toISOString(),
    debug_info: {
      route_checks_completed: true,
      path_stripped_correctly: true,
      possible_issues: [
        'Route condition logic failed',
        'Path does not match expected patterns',
        'Method does not match route requirements',
      ],
    },
  };

  const errorResponse = new Response(JSON.stringify(errorData), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
  return addCorsHeaders(errorResponse);
});
