// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Import ELO calculation functions
import { calculateELOChanges, calculateFoosballELOChanges } from './elo-system.tsx';

console.log("🚀 Starting API Working function...");

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

    const { data: { user }, error } = await supabase.auth.getUser();

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
      const player1User = matchData.player1IsGuest ? null :
        (await supabase.from('users').select('id, singles_elo').eq('email', matchData.player1Email).single()).data;
      const player2User = matchData.player2IsGuest ? null :
        (await supabase.from('users').select('id, singles_elo').eq('email', matchData.player2Email).single()).data;

      if (player1User && player2User) {
        const isPlayer1Winner = matchData.winnerEmail === matchData.player1Email;

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
            change_amount: eloResult.player1.change
          },
          {
            match_id: matchId,
            user_id: player2User.id,
            old_rating: eloResult.player2.oldRating,
            new_rating: eloResult.player2.newRating,
            rating_type: 'singles',
            change_amount: eloResult.player2.change
          }
        ]);

        // Update user ELO ratings
        await supabase.from('users').update({
          singles_elo: eloResult.player1.newRating,
          singles_wins: isPlayer1Winner ? player1User.singles_wins + 1 : player1User.singles_wins,
          singles_losses: isPlayer1Winner ? player1User.singles_losses : player1User.singles_losses + 1
        }).eq('id', player1User.id);

        await supabase.from('users').update({
          singles_elo: eloResult.player2.newRating,
          singles_wins: isPlayer1Winner ? player2User.singles_wins : player2User.singles_wins + 1,
          singles_losses: isPlayer1Winner ? player2User.singles_losses + 1 : player2User.singles_losses
        }).eq('id', player2User.id);

        eloChanges[player1User.id] = {
          oldRating: eloResult.player1.oldRating,
          newRating: eloResult.player1.newRating,
          change: eloResult.player1.change
        };

        eloChanges[player2User.id] = {
          oldRating: eloResult.player2.oldRating,
          newRating: eloResult.player2.newRating,
          change: eloResult.player2.change
        };
      }
    } else if (matchData.matchType === '2v2') {
      // Get player ratings for 2v2
      const team1Player1 = matchData.team1Player1IsGuest ? null :
        (await supabase.from('users').select('id, doubles_elo, singles_wins, singles_losses').eq('email', matchData.team1Player1Email).single()).data;
      const team1Player2 = matchData.team1Player2IsGuest ? null :
        (await supabase.from('users').select('id, doubles_elo, singles_wins, singles_losses').eq('email', matchData.team1Player2Email).single()).data;
      const team2Player1 = matchData.team2Player1IsGuest ? null :
        (await supabase.from('users').select('id, doubles_elo, singles_wins, singles_losses').eq('email', matchData.team2Player1Email).single()).data;
      const team2Player2 = matchData.team2Player2IsGuest ? null :
        (await supabase.from('users').select('id, doubles_elo, singles_wins, singles_losses').eq('email', matchData.team2Player2Email).single()).data;

      if (team1Player1 && team1Player2 && team2Player1 && team2Player2) {
        const isTeam1Winner = matchData.winningTeam === 'team1';

        // Calculate games played for K-factor
        const getGamesPlayed = (player: any) => (player.singles_wins || 0) + (player.singles_losses || 0);

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
            change_amount: eloResult.team1Player1.change
          },
          {
            match_id: matchId,
            user_id: team1Player2.id,
            old_rating: eloResult.team1Player2.oldRating,
            new_rating: eloResult.team1Player2.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team1Player2.change
          },
          {
            match_id: matchId,
            user_id: team2Player1.id,
            old_rating: eloResult.team2Player1.oldRating,
            new_rating: eloResult.team2Player1.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team2Player1.change
          },
          {
            match_id: matchId,
            user_id: team2Player2.id,
            old_rating: eloResult.team2Player2.oldRating,
            new_rating: eloResult.team2Player2.newRating,
            rating_type: 'doubles',
            change_amount: eloResult.team2Player2.change
          }
        ]);

        // Update user ELO ratings and stats
        await supabase.from('users').update({
          doubles_elo: eloResult.team1Player1.newRating,
          doubles_wins: isTeam1Winner ? team1Player1.doubles_wins + 1 : team1Player1.doubles_wins,
          doubles_losses: isTeam1Winner ? team1Player1.doubles_losses : team1Player1.doubles_losses + 1
        }).eq('id', team1Player1.id);

        await supabase.from('users').update({
          doubles_elo: eloResult.team1Player2.newRating,
          doubles_wins: isTeam1Winner ? team1Player2.doubles_wins + 1 : team1Player2.doubles_wins,
          doubles_losses: isTeam1Winner ? team1Player2.doubles_losses : team1Player2.doubles_losses + 1
        }).eq('id', team1Player2.id);

        await supabase.from('users').update({
          doubles_elo: eloResult.team2Player1.newRating,
          doubles_wins: isTeam1Winner ? team2Player1.doubles_wins : team2Player1.doubles_wins + 1,
          doubles_losses: isTeam1Winner ? team2Player1.doubles_losses + 1 : team2Player1.doubles_losses
        }).eq('id', team2Player1.id);

        await supabase.from('users').update({
          doubles_elo: eloResult.team2Player2.newRating,
          doubles_wins: isTeam1Winner ? team2Player2.doubles_wins : team2Player2.doubles_wins + 1,
          doubles_losses: isTeam1Winner ? team2Player2.doubles_losses + 1 : team2Player2.doubles_losses
        }).eq('id', team2Player2.id);

        eloChanges[team1Player1.id] = {
          oldRating: eloResult.team1Player1.oldRating,
          newRating: eloResult.team1Player1.newRating,
          change: eloResult.team1Player1.change
        };

        eloChanges[team1Player2.id] = {
          oldRating: eloResult.team1Player2.oldRating,
          newRating: eloResult.team1Player2.newRating,
          change: eloResult.team1Player2.change
        };

        eloChanges[team2Player1.id] = {
          oldRating: eloResult.team2Player1.oldRating,
          newRating: eloResult.team2Player1.newRating,
          change: eloResult.team2Player1.change
        };

        eloChanges[team2Player2.id] = {
          oldRating: eloResult.team2Player2.oldRating,
          newRating: eloResult.team2Player2.newRating,
          change: eloResult.team2Player2.change
        };
      }
    }

    return eloChanges;
  } catch (error) {
    console.error('Error calculating ELO changes:', error);
    return {};
  }
}

Deno.serve(async (req) => {
  console.log("Request received:", req.method, req.url);

  const url = new URL(req.url);
  const path = url.pathname;
  console.log('Request path:', path);
  console.log('Full URL:', req.url);

  // Helper function to add CORS headers
  function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With');

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
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Origin, X-Requested-With',
      },
    });
  }

  // Basic test endpoint
  if ((path === '/test' || path === '/api-working/test') && req.method === 'GET') {
    console.log('🎯 Test endpoint called');
    const data = {
      message: 'API working',
      timestamp: new Date().toISOString(),
    };
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response);
  }

  // User relational endpoint
  if ((path === '/user-relational' || path === '/api-working/user-relational') && req.method === 'GET') {
    console.log('🎯 User relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }

    // Generate a consistent group code based on user ID for demo purposes
    const groupCode = `GRP_${user.id.substring(0, 6).toUpperCase()}`;

    const data = {
      user: {
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'Unknown User',
        email: user.email,
        current_group_code: groupCode
      },
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Returning user data for:', user.email);

    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
    return addCorsHeaders(response);
  }

  // Users relational endpoint
  if ((path === '/users-relational' || path === '/api-working/users-relational') && req.method === 'GET') {
    console.log('🎯 Users relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
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
          error: "No Current Group",
          message: "User does not have a current group set",
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all users in the same group
      console.log('🔍 Querying users for group:', userData.current_group_code);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, avatar, singles_elo, doubles_elo, singles_wins, singles_losses, doubles_wins, doubles_losses, current_group_code')
        .eq('current_group_code', userData.current_group_code);

      console.log('📊 Users query result:', {
        dataLength: usersData?.length || 0,
        error: usersError,
        groupCode: userData.current_group_code
      });

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        const errorData = {
          error: "Database Error",
          message: "Failed to fetch users data",
          details: usersError.message,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      const data = {
        users: usersData || [],
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning real users for group:', userData.current_group_code, 'Count:', usersData?.length || 0);

      const response = new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in users-relational endpoint:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to fetch users data",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups current relational endpoint
  if ((path === '/groups/current-relational' || path === '/api-working/groups/current-relational') && req.method === 'GET') {
    console.log('🎯 Groups current relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
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
        .select(`
          group_code,
          joined_at,
          groups (
            code,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .single();

      console.log('📊 Current group query result:', {
        data: userGroupData,
        error: userGroupError,
        hasGroups: !!userGroupData?.groups
      });

      if (userGroupError || !userGroupData?.groups) {
        console.log('❌ No group membership found for user:', user.id, 'Error:', userGroupError);
        const errorData = {
          error: "No Current Group",
          message: "User is not a member of any group",
          details: userGroupError?.message || "No group data found",
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      const groupData = userGroupData.groups;

      if (!groupData) {
        const errorData = {
          error: "Group Not Found",
          message: `Group data not available`,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
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
          memberCount: memberCount || 1
        },
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning current group data for:', groupData.code, groupData.name);

      const response = new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error fetching current group:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to fetch current group data",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Groups user relational endpoint
  if ((path === '/groups/user-relational' || path === '/api-working/groups/user-relational') && req.method === 'GET') {
    console.log('🎯 Groups user relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
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
        .select(`
          group_code,
          joined_at,
          groups (
            code,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      console.log('📊 User groups query result:', {
        data: userGroupsData,
        error: userGroupsError,
        dataLength: userGroupsData?.length || 0
      });

      if (userGroupsError) {
        console.error('❌ Error fetching user groups:', userGroupsError);
        const errorData = {
          error: "Database Error",
          message: "Failed to fetch user groups",
          details: userGroupsError.message,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { "Content-Type": "application/json" }
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
            memberCount: memberCount || 1
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
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to fetch user groups",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
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
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }

    try {
      // Parse the request body to get the group code
      const body = await req.json();
      const { groupCode } = body;

      if (!groupCode) {
        const errorData = {
          error: "Bad Request",
          message: "Group code is required",
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      // For now, we'll simulate group joining
      // In a real implementation, this would check if the group exists and add the user to it

      // Check if it's the expected group code "ONEAXA"
      if (groupCode === 'ONEAXA') {
        const data = {
          success: true,
          message: "Successfully joined group",
          group: {
            code: groupCode,
            name: "AXA Foosball Group",
            memberCount: 15,
            joined: true
          },
          timestamp: new Date().toISOString(),
        };

        console.log('✅ User joined group:', groupCode);

        const response = new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(response);
      } else {
        // Group not found
        const errorData = {
          error: "Group Not Found",
          message: `Group with code '${groupCode}' not found`,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }
    } catch (error) {
      console.error('Error processing group join request:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to process group join request",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Matches relational endpoint
  if ((path === '/matches-relational' || path === '/api-working/matches-relational') && req.method === 'GET') {
    console.log('🎯 Matches relational endpoint called');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const user = authHeader ? await getAuthenticatedUser(authHeader) : null;

    if (!user) {
      const errorData = {
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
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
      console.log('🔍 Getting current group for matches:', user.id);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.current_group_code) {
        console.log('❌ No current group found for user:', user.id);
        const errorData = {
          error: "No Current Group",
          message: "User does not have a current group set",
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      // Get all matches for the user's group with player details and ELO changes
      console.log('🔍 Querying matches for group:', userData.current_group_code);
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
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
        `)
        .eq('group_code', userData.current_group_code)
        .order('date', { ascending: false });

      console.log('📊 Matches query result:', {
        dataLength: matchesData?.length || 0,
        error: matchesError,
        groupCode: userData.current_group_code
      });

      if (matchesError) {
        console.error('❌ Error fetching matches:', matchesError);
        const errorData = {
          error: "Database Error",
          message: "Failed to fetch matches data",
          details: matchesError.message,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      // Transform the data to match the expected format
      const transformedMatches = (matchesData || []).map(match => {
        // Transform ELO changes into a keyed object by user ID
        const eloChanges: Record<string, { oldRating: number; newRating: number; change: number }> = {};
        (match.elo_changes || []).forEach(change => {
          if (change.user_id) {
            eloChanges[change.user_id] = {
              oldRating: change.old_rating,
              newRating: change.new_rating,
              change: change.change_amount
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
          players: match.match_players?.map(player => ({
            userId: player.user_id,
            team: player.team,
            position: player.position,
            isGuest: player.is_guest,
            guestName: player.guest_name,
            name: player.users?.name || player.guest_name,
            email: player.users?.email
          })) || [],
          eloChanges
        };
      });

      const data = {
        matches: transformedMatches,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Returning real matches for group:', userData.current_group_code, 'Count:', transformedMatches.length);

      const response = new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in matches-relational endpoint:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to fetch matches data",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
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
        error: "Unauthorized",
        message: "Valid authentication required",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { "Content-Type": "application/json" }
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
          error: "No Current Group",
          message: "User does not have a current group set",
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 404,
          headers: { "Content-Type": "application/json" }
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
          winner_is_guest: matchData.winnerIsGuest || false
        })
        .select()
        .single();

      if (matchError) {
        console.error('Error inserting match:', matchError);
        const errorData = {
          error: "Database Error",
          message: "Failed to create match",
          details: matchError.message,
          timestamp: new Date().toISOString()
        };
        const errorResponse = new Response(JSON.stringify(errorData), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
        return addCorsHeaders(errorResponse);
      }

      // Insert match players
      const matchPlayers = [];

      if (matchData.matchType === '1v1') {
        // Handle 1v1 match players
        if (matchData.player1Email) {
          const player1User = matchData.player1IsGuest ? null :
            (await supabase.from('users').select('id').eq('email', matchData.player1Email).single()).data;

          matchPlayers.push({
            match_id: matchId,
            user_id: player1User?.id || null,
            team: 'team1',
            position: 1,
            is_guest: matchData.player1IsGuest || false,
            guest_name: matchData.player1IsGuest ? matchData.player1Email : null
          });
        }

        if (matchData.player2Email) {
          const player2User = matchData.player2IsGuest ? null :
            (await supabase.from('users').select('id').eq('email', matchData.player2Email).single()).data;

          matchPlayers.push({
            match_id: matchId,
            user_id: player2User?.id || null,
            team: 'team2',
            position: 1,
            is_guest: matchData.player2IsGuest || false,
            guest_name: matchData.player2IsGuest ? matchData.player2Email : null
          });
        }
      } else if (matchData.matchType === '2v2') {
        // Handle 2v2 match players
        const teamPlayers = [
          { email: matchData.team1Player1Email, isGuest: matchData.team1Player1IsGuest, team: 'team1', position: 1 },
          { email: matchData.team1Player2Email, isGuest: matchData.team1Player2IsGuest, team: 'team1', position: 2 },
          { email: matchData.team2Player1Email, isGuest: matchData.team2Player1IsGuest, team: 'team2', position: 1 },
          { email: matchData.team2Player2Email, isGuest: matchData.team2Player2IsGuest, team: 'team2', position: 2 },
        ];

        for (const player of teamPlayers) {
          if (player.email) {
            const playerUser = player.isGuest ? null :
              (await supabase.from('users').select('id').eq('email', player.email).single()).data;

            matchPlayers.push({
              match_id: matchId,
              user_id: playerUser?.id || null,
              team: player.team,
              position: player.position,
              is_guest: player.isGuest || false,
              guest_name: player.isGuest ? player.email : null
            });
          }
        }
      }

      // Insert match players
      if (matchPlayers.length > 0) {
        const { error: playersError } = await supabase
          .from('match_players')
          .insert(matchPlayers);

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
          eloChanges
        },
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Match submitted successfully:', matchId);

      const response = new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('❌ Error in submit match endpoint:', error);
      const errorData = {
        error: "Internal Server Error",
        message: "Failed to submit match",
        timestamp: new Date().toISOString()
      };
      const errorResponse = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
      return addCorsHeaders(errorResponse);
    }
  }

  // Default 404 response
  console.log('❌ Endpoint not found:', path);
  const errorData = {
    error: "Endpoint not found",
    path: path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  const errorResponse = new Response(JSON.stringify(errorData), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(errorResponse);
});
