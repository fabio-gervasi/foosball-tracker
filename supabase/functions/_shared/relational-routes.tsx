import { Hono } from 'npm:hono';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateUserAuth } from './auth-helpers-relational.tsx';

// Create Supabase client for relational queries
const createRelationalClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseKey);
};

// Create relational routes
export const createRelationalRoutes = (supabase: any) => {
  const app = new Hono();

  console.log('🔧 Creating relational routes...');

  // User relational endpoints
  app.get('/user-relational', async (c) => {
    console.log('📨 Received request for /user-relational');
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (!authResult.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const user = await getRelationalUser(authResult.user.id);
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      return c.json({ user });
    } catch (error) {
      console.error('Error in /user-relational:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  app.get('/users-relational', async (c) => {
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (!authResult.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Get user's current group
      const user = await getRelationalUser(authResult.user.id);
      if (!user || !user.current_group_code) {
        return c.json({ users: [] });
      }

      const users = await getRelationalUsersInGroup(user.current_group_code);
      return c.json({ users });
    } catch (error) {
      console.error('Error in /users-relational:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Group relational endpoints
  app.get('/groups/current-relational', async (c) => {
    console.log('📨 Received request for /groups/current-relational');
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (!authResult.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const user = await getRelationalUser(authResult.user.id);
      if (!user || !user.current_group_code) {
        return c.json({ error: 'User not in a group' }, 404);
      }

      const group = await getRelationalGroup(user.current_group_code);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      return c.json({ group });
    } catch (error) {
      console.error('Error in /groups/current-relational:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  app.get('/groups/user-relational', async (c) => {
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (!authResult.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const groups = await getRelationalUserGroups(authResult.user.id);
      return c.json({ groups });
    } catch (error) {
      console.error('Error in /groups/user-relational:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Match relational endpoints
  app.get('/matches-relational', async (c) => {
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (!authResult.user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const user = await getRelationalUser(authResult.user.id);
      if (!user || !user.current_group_code) {
        return c.json({ matches: [] });
      }

      const matches = await getRelationalMatchesInGroup(user.current_group_code);

      // Transform matches to include full details
      const detailedMatches = await Promise.all(
        matches.map(match => buildRelationalMatchWithDetails(match))
      );

      return c.json({ matches: detailedMatches });
    } catch (error) {
      console.error('Error in /matches-relational:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
};

// User relational queries
export const getRelationalUser = async (userId: string): Promise<User | null> => {
  const supabase = createRelationalClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching relational user:', error);
    return null;
  }

  return data;
};

export const getRelationalUsersInGroup = async (groupCode: string): Promise<User[]> => {
  const supabase = createRelationalClient();

  // First get user IDs from the user_groups junction table
  const { data: userGroups, error: ugError } = await supabase
    .from('user_groups')
    .select('user_id')
    .eq('group_code', groupCode);

  if (ugError) {
    console.error('Error fetching user groups:', ugError);
    return [];
  }

  if (!userGroups || userGroups.length === 0) {
    return [];
  }

  const userIds = userGroups.map(ug => ug.user_id);

  // Then fetch the actual user data
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds)
    .eq('is_deleted', false);

  if (error) {
    console.error('Error fetching relational users:', error);
    return [];
  }

  return data || [];
};

// Group relational queries
export const getRelationalGroup = async (groupCode: string): Promise<Group | null> => {
  const supabase = createRelationalClient();

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('code', groupCode)
    .single();

  if (error) {
    console.error('Error fetching relational group:', error);
    return null;
  }

  // Add computed fields for compatibility
  const group = data as Group;
  group.id = group.code; // Legacy compatibility

  // Get member count
  const { count } = await supabase
    .from('user_groups')
    .select('*', { count: 'exact', head: true })
    .eq('group_code', groupCode);

  group.memberCount = count || 0;

  return group;
};

export const getRelationalUserGroups = async (userId: string): Promise<Group[]> => {
  const supabase = createRelationalClient();

  // First get group codes from user_groups
  const { data: userGroups, error: ugError } = await supabase
    .from('user_groups')
    .select('group_code')
    .eq('user_id', userId);

  if (ugError) {
    console.error('Error fetching user groups:', ugError);
    return [];
  }

  if (!userGroups || userGroups.length === 0) {
    return [];
  }

  const groupCodes = userGroups.map(ug => ug.group_code);

  // Then fetch group data
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .in('code', groupCodes);

  if (error) {
    console.error('Error fetching relational groups:', error);
    return [];
  }

  // Add computed fields for compatibility
  return (data || []).map(group => ({
    ...group,
    id: group.code, // Legacy compatibility
  }));
};

// Match relational queries
export const getRelationalMatchesInGroup = async (groupCode: string): Promise<Match[]> => {
  const supabase = createRelationalClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('group_code', groupCode)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching relational matches:', error);
    return [];
  }

  // Transform to legacy format for compatibility
  return (data || []).map(match => ({
    ...match,
    matchType: match.match_type, // Legacy compatibility
    match_type: match.match_type,
    groupId: match.group_code, // Legacy compatibility
    group_code: match.group_code,
    createdBy: match.recorded_by, // Legacy compatibility
    created_by: match.recorded_by,
    createdAt: match.created_at, // Legacy compatibility
    created_at: match.created_at,
    groupCode: match.group_code, // Legacy compatibility
    group_code: match.group_code,
  }));
};

// Helper function to build match with players and results
export const buildRelationalMatchWithDetails = async (matchData: any): Promise<Match> => {
  const supabase = createRelationalClient();

  // Get match players
  const { data: players, error: playersError } = await supabase
    .from('match_players')
    .select('*')
    .eq('match_id', matchData.id);

  // Get match results
  const { data: results, error: resultsError } = await supabase
    .from('match_results')
    .select('*')
    .eq('match_id', matchData.id)
    .order('game_number');

  // Get ELO changes
  const { data: eloChanges, error: eloError } = await supabase
    .from('elo_changes')
    .select('*')
    .eq('match_id', matchData.id);

  // Build player references
  const playerMap = new Map();
  const guestPlayers: any[] = [];

  if (players) {
    for (const player of players) {
      if (player.is_guest && player.guest_name) {
        guestPlayers.push({
          id: player.guest_name,
          name: player.guest_name,
          isGuest: true,
        });
      } else if (player.user_id) {
        const user = await getRelationalUser(player.user_id);
        if (user) {
          playerMap.set(`${player.team}_${player.position}`, {
            id: user.id,
            name: user.name,
            email: user.email,
            isGuest: false,
          });
        }
      }
    }
  }

  // Build team structure for 2v2 matches
  let team1, team2, player1, player2;

  if (matchData.match_type === '2v2') {
    team1 = {
      player1: playerMap.get('team1_1'),
      player2: playerMap.get('team1_2'),
    };
    team2 = {
      player1: playerMap.get('team2_1'),
      player2: playerMap.get('team2_2'),
    };
  } else {
    // For 1v1 matches
    player1 = playerMap.get('team1_1') || guestPlayers[0];
    player2 = playerMap.get('team2_1') || guestPlayers[1];
  }

  // Build ELO changes object
  const eloChangesObj: any = {};
  if (eloChanges) {
    for (const change of eloChanges) {
      if (change.user_id) {
        eloChangesObj[change.user_id] = {
          oldRating: change.old_rating,
          newRating: change.new_rating,
          change: change.change_amount,
        };
      }
    }
  }

  // Build game results
  const gameResults: string[] = [];
  if (results) {
    for (const result of results) {
      gameResults.push(result.winning_team);
    }
  }

  return {
    ...matchData,
    matchType: matchData.match_type,
    match_type: matchData.match_type,
    groupId: matchData.group_code,
    group_code: matchData.group_code,
    createdBy: matchData.recorded_by,
    created_by: matchData.recorded_by,
    createdAt: matchData.created_at,
    created_at: matchData.created_at,
    groupCode: matchData.group_code,
    group_code: matchData.group_code,
    player1,
    player2,
    team1,
    team2,
    eloChanges: eloChangesObj,
    gameResults,
    winningTeam: results && results.length > 0 ? results[results.length - 1]?.winning_team : undefined,
  };
};
