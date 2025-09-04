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
  app.get('/user-relational', async c => {
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

  app.get('/users-relational', async c => {
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
  app.get('/groups/current-relational', async c => {
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

  app.get('/groups/user-relational', async c => {
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
  app.get('/matches-relational', async c => {
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

  // Profile avatar upload endpoint
  app.post('/profile/avatar', async c => {
    console.log('🎯 Relational profile avatar upload endpoint called');

    const authResult = await validateUserAuth(c, supabase);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    try {
      const formData = await c.req.formData();
      const file = formData.get('avatar') as File;

      if (!file) {
        return c.json({ error: 'No file uploaded' }, 400);
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return c.json(
          { error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' },
          400
        );
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
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
          return c.json({ error: 'Failed to create storage bucket' }, 500);
        }
        console.log('Avatars bucket created successfully');
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${authResult.user.id}-${Date.now()}.${fileExtension}`;
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
        return c.json({ error: 'Failed to upload avatar' }, 500);
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
        return c.json({ error: 'Failed to create avatar URL' }, 500);
      }

      // Update user profile with avatar URL in database
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          avatar: signedUrlData.signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update user avatar in database:', updateError);
        return c.json({ error: 'Failed to update user profile' }, 500);
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
      return c.json({
        message: 'Avatar uploaded successfully',
        avatarUrl: signedUrlData.signedUrl,
        user: updatedProfile,
      });
    } catch (error) {
      console.error('Error in relational profile avatar upload endpoint:', error);
      return c.json({ error: 'Internal server error while uploading avatar' }, 500);
    }
  });

  // Profile avatar delete endpoint
  app.delete('/profile/avatar', async c => {
    console.log('🎯 Relational profile avatar delete endpoint called');

    const authResult = await validateUserAuth(c, supabase);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    try {
      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, avatar')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // If user has no avatar, nothing to delete
      if (!userData.avatar) {
        return c.json({ message: 'No avatar to delete' });
      }

      // Update user profile to remove avatar
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          avatar: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update user avatar in database:', updateError);
        return c.json({ error: 'Failed to delete avatar' }, 500);
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
      return c.json({
        message: 'Avatar deleted successfully',
        user: updatedProfile,
      });
    } catch (error) {
      console.error('Error in relational profile avatar delete endpoint:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Group icon upload endpoint (admin only)
  app.post('/groups/current/icon', async c => {
    console.log('🎯 Relational groups current icon upload endpoint called');

    const authResult = await validateUserAuth(c, supabase);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    try {
      // Get user's current group and check if admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code, is_admin')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userData.current_group_code) {
        return c.json({ error: 'User is not in any group' }, 404);
      }

      if (!userData.is_admin) {
        return c.json({ error: 'Admin privileges required' }, 403);
      }

      const formData = await c.req.formData();
      const file = formData.get('icon') as File;

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return c.json({ error: 'File must be an image' }, 400);
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return c.json({ error: 'File size must be less than 5MB' }, 400);
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
          return c.json({ error: 'Failed to create storage bucket' }, 500);
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
        return c.json({ error: 'Failed to upload image' }, 500);
      }

      console.log('Group icon uploaded successfully:', uploadData.path);

      // Generate signed URL for the uploaded icon (valid for 1 year)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (urlError) {
        console.error('Failed to create signed URL:', urlError);
        return c.json({ error: 'Failed to get image URL' }, 500);
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
        return c.json({ error: 'Failed to update group with icon' }, 500);
      }

      console.log('Group updated with icon successfully');
      return c.json({
        message: 'Group icon uploaded successfully',
        iconUrl: signedUrlData.signedUrl,
      });
    } catch (error) {
      console.error('Error in relational groups current icon upload endpoint:', error);
      return c.json({ error: 'Internal server error while uploading group icon' }, 500);
    }
  });

  // Group icon delete endpoint (admin only)
  app.delete('/groups/current/icon', async c => {
    console.log('🎯 Relational groups current icon delete endpoint called');

    const authResult = await validateUserAuth(c, supabase);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    try {
      // Get user's current group and check if admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('current_group_code, is_admin')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userData.current_group_code) {
        return c.json({ error: 'User is not in any group' }, 404);
      }

      if (!userData.is_admin) {
        return c.json({ error: 'Admin privileges required' }, 403);
      }

      // Get current group data
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('code, name, icon')
        .eq('code', userData.current_group_code)
        .single();

      if (groupError || !groupData) {
        return c.json({ error: 'Group not found' }, 404);
      }

      // If group has no icon, nothing to delete
      if (!groupData.icon) {
        return c.json({ message: 'No icon to delete' });
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
        return c.json({ error: 'Failed to delete group icon' }, 500);
      }

      console.log('Group icon deleted successfully');
      return c.json({
        message: 'Group icon deleted successfully',
        group: {
          code: updatedGroup.code,
          name: updatedGroup.name,
          icon: updatedGroup.icon,
          updatedAt: updatedGroup.updated_at,
        },
      });
    } catch (error) {
      console.error('Error in relational groups current icon delete endpoint:', error);
      return c.json({ error: 'Internal server error while deleting group icon' }, 500);
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

  // Transform database fields to match frontend expectations
  const user = data as User;
  user.avatarUrl = user.avatar; // Map avatar column to avatarUrl
  user.isAdmin = user.is_admin;
  user.singlesElo = user.singles_elo;
  user.doublesElo = user.doubles_elo;
  user.singlesWins = user.singles_wins;
  user.singlesLosses = user.singles_losses;
  user.doublesWins = user.doubles_wins;
  user.doublesLosses = user.doubles_losses;
  user.currentGroup = user.current_group_code;

  return user;
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

  // Transform database fields to match frontend expectations
  const users = (data || []).map(user => ({
    ...user,
    avatarUrl: user.avatar, // Map avatar column to avatarUrl
    isAdmin: user.is_admin,
    singlesElo: user.singles_elo,
    doublesElo: user.doubles_elo,
    singlesWins: user.singles_wins,
    singlesLosses: user.singles_losses,
    doublesWins: user.doubles_wins,
    doublesLosses: user.doubles_losses,
    currentGroup: user.current_group_code,
  }));

  return users;
};

// Group relational queries
export const getRelationalGroup = async (groupCode: string): Promise<Group | null> => {
  const supabase = createRelationalClient();

  const { data, error } = await supabase
    .from('groups')
    .select('code, name, created_by, created_at, updated_at, icon')
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
    .select('group_code, joined_at')
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
    .select('code, name, created_by, created_at, updated_at, icon')
    .in('code', groupCodes);

  if (error) {
    console.error('Error fetching relational groups:', error);
    return [];
  }

  // Add computed fields for compatibility and join with user group data
  return (data || []).map(group => {
    const userGroupData = userGroups.find(ug => ug.group_code === group.code);
    return {
      ...group,
      id: group.code, // Legacy compatibility
      joinedAt: userGroupData?.joined_at,
    };
  });
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
            avatarUrl: user.avatarUrl, // Include avatar URL
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
    winningTeam:
      results && results.length > 0 ? results[results.length - 1]?.winning_team : undefined,
  };
};
