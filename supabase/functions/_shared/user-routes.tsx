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

export function createUserRoutes(supabase: any) {
  const app = new Hono();

  // Get all users in the current user's group
  app.get('/users', async c => {
    try {
      console.log('=== Get users request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const relationalClient = createRelationalClient();

      // Get the current user to find their group
      const { data: userData, error: userError } = await relationalClient
        .from('users')
        .select('current_group_code')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.log('User not found or error:', userError);
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userData.current_group_code) {
        console.log('User has no group, returning empty users array');
        return c.json({ users: [] });
      }

      console.log('Getting users for group:', userData.current_group_code);

      // Get all users in the same group using the junction table
      const { data: usersData, error: usersError } = await relationalClient
        .from('user_groups')
        .select(`
          user_id,
          users!inner (
            id,
            email,
            username,
            name,
            avatar,
            is_admin,
            singles_elo,
            doubles_elo,
            singles_wins,
            singles_losses,
            doubles_wins,
            doubles_losses,
            current_group_code,
            created_at,
            updated_at
          )
        `)
        .eq('group_code', userData.current_group_code);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return c.json({ error: 'Failed to fetch users' }, 500);
      }

      // Transform the data to match the expected format
      const users = (usersData || []).map(item => {
        const user = item.users;
        return {
          ...user,
          avatarUrl: user.avatar, // Map avatar to avatarUrl for frontend compatibility
          isAdmin: user.is_admin,
          singlesElo: user.singles_elo,
          doublesElo: user.doubles_elo,
          singlesWins: user.singles_wins,
          singlesLosses: user.singles_losses,
          doublesWins: user.doubles_wins,
          doublesLosses: user.doubles_losses,
          currentGroup: user.current_group_code,
          // Remove sensitive information
          password: undefined,
        };
      });

      // Sort users by name for consistent ordering
      users.sort((a, b) => (a.name || a.username || '').localeCompare(b.name || b.username || ''));

      console.log(`Returning ${users.length} users for group ${userData.current_group_code}`);
      return c.json({ users });
    } catch (error) {
      console.error('=== Get users error ===', error);
      return c.json({ error: 'Internal server error while getting users' }, 500);
    }
  });

  // Get specific user profile
  app.get('/users/:userId', async c => {
    try {
      console.log('=== Get specific user request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userId = c.req.param('userId');
      const relationalClient = createRelationalClient();

      // Get both users' group information
      const { data: usersData, error: usersError } = await relationalClient
        .from('users')
        .select('id, current_group_code, name, email, username, avatar, is_admin, singles_elo, doubles_elo, singles_wins, singles_losses, doubles_wins, doubles_losses, created_at, updated_at')
        .in('id', [authResult.user.id, userId])
        .eq('is_deleted', false);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return c.json({ error: 'Failed to fetch user data' }, 500);
      }

      const requestingUser = usersData?.find(u => u.id === authResult.user.id);
      const targetUser = usersData?.find(u => u.id === userId);

      if (!requestingUser) {
        return c.json({ error: 'Requesting user profile not found' }, 404);
      }

      if (!targetUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if both users are in the same group
      if (requestingUser.current_group_code !== targetUser.current_group_code) {
        return c.json({ error: 'User not in your group' }, 403);
      }

      // Return safe user data (without sensitive information)
      const safeUser = {
        ...targetUser,
        avatarUrl: targetUser.avatar, // Map avatar to avatarUrl for frontend compatibility
        isAdmin: targetUser.is_admin,
        singlesElo: targetUser.singles_elo,
        doublesElo: targetUser.doubles_elo,
        singlesWins: targetUser.singles_wins,
        singlesLosses: targetUser.singles_losses,
        doublesWins: targetUser.doubles_wins,
        doublesLosses: targetUser.doubles_losses,
        currentGroup: targetUser.current_group_code,
        password: undefined, // Never send passwords
      };

      console.log('Returning user profile for user:', userId);
      return c.json({ user: safeUser });
    } catch (error) {
      console.error('=== Get specific user error ===', error);
      return c.json({ error: 'Internal server error while getting user' }, 500);
    }
  });

  // Get matches for a specific user
  app.get('/users/:userId/matches', async c => {
    try {
      console.log('=== Get user matches request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userId = c.req.param('userId');
      const relationalClient = createRelationalClient();

      // Get both users to verify they are in the same group
      const { data: usersData, error: usersError } = await relationalClient
        .from('users')
        .select('id, current_group_code')
        .in('id', [authResult.user.id, userId])
        .eq('is_deleted', false);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return c.json({ error: 'Failed to fetch user data' }, 500);
      }

      const requestingUser = usersData?.find(u => u.id === authResult.user.id);
      const targetUser = usersData?.find(u => u.id === userId);

      if (!requestingUser) {
        return c.json({ error: 'Requesting user profile not found' }, 404);
      }

      if (!targetUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if both users are in the same group
      if (requestingUser.current_group_code !== targetUser.current_group_code) {
        return c.json({ error: 'User not in your group' }, 403);
      }

      const groupCode = requestingUser.current_group_code;

      // Get all matches for the group using relational database
      const { data: matchesData, error: matchesError } = await relationalClient
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
            guest_name
          ),
          match_results (
            game_number,
            winning_team
          )
        `)
        .eq('group_code', groupCode)
        .order('created_at', { ascending: false });

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        return c.json({ error: 'Failed to fetch matches' }, 500);
      }

      const userMatches = [];

      for (const matchData of matchesData || []) {
        try {
          // Check if the target user participated in this match
          const participated = (matchData.match_players || []).some((player: any) =>
            player.user_id === userId
          );

          if (participated) {
            // Transform to legacy format for frontend compatibility
            const match = {
              id: matchData.id,
              date: matchData.date,
              groupCode: matchData.group_code,
              matchType: matchData.match_type,
              seriesType: matchData.series_type,
              recordedBy: matchData.recorded_by,
              winnerEmail: matchData.winner_email,
              winnerIsGuest: matchData.winner_is_guest,
              createdAt: matchData.created_at,
              created_at: matchData.created_at,
              group_code: matchData.group_code,
              match_type: matchData.match_type,
            };

            userMatches.push(match);
          }
        } catch (matchError) {
          console.error('Error processing match:', matchError);
          // Continue with other matches
        }
      }

      console.log(`Returning ${userMatches.length} matches for user ${userId}`);
      return c.json({ matches: userMatches });
    } catch (error) {
      console.error('=== Get user matches error ===', error);
      return c.json({ error: 'Internal server error while getting user matches' }, 500);
    }
  });

  // Update user profile
  app.put('/profile', async c => {
    try {
      console.log('=== Update profile request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const relationalClient = createRelationalClient();
      const updateData = await c.req.json();
      console.log('Profile update data:', updateData);

      // Only allow updating certain fields
      const allowedFields = ['name', 'username'];
      const updates: any = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      // Add updated_at timestamp
      updates.updated_at = new Date().toISOString();

      // Update the user in the database
      const { data, error } = await relationalClient
        .from('users')
        .update(updates)
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return c.json({ error: 'Failed to update profile' }, 500);
      }

      // Transform the response to match expected format
      const updatedProfile = {
        ...data,
        avatarUrl: data.avatar,
        isAdmin: data.is_admin,
        singlesElo: data.singles_elo,
        doublesElo: data.doubles_elo,
        singlesWins: data.singles_wins,
        singlesLosses: data.singles_losses,
        doublesWins: data.doubles_wins,
        doublesLosses: data.doubles_losses,
        currentGroup: data.current_group_code,
        updatedAt: data.updated_at,
        password: undefined, // Never send passwords
      };

      console.log('Profile updated successfully');
      return c.json({
        message: 'Profile updated successfully',
        user: updatedProfile,
      });
    } catch (error) {
      console.error('=== Update profile error ===', error);
      return c.json({ error: 'Internal server error while updating profile' }, 500);
    }
  });

  // Upload user avatar
  app.post('/profile/avatar', async c => {
    try {
      console.log('=== Avatar upload request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const relationalClient = createRelationalClient();

      // Verify user exists in database
      const { data: userData, error: userError } = await relationalClient
        .from('users')
        .select('id, avatar')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.log('User not found in database:', userError);
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Get the uploaded file from form data
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
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (urlError) {
        console.error('Failed to create signed URL:', urlError);
        return c.json({ error: 'Failed to create avatar URL' }, 500);
      }

      // Update user profile with avatar URL in database
      const { data: updatedUser, error: updateError } = await relationalClient
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
      console.error('=== Avatar upload error ===', error);
      return c.json({ error: 'Internal server error while uploading avatar' }, 500);
    }
  });

  // Delete user avatar
  app.delete('/profile/avatar', async c => {
    try {
      console.log('=== Avatar delete request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const relationalClient = createRelationalClient();

      // Get current user data
      const { data: userData, error: userError } = await relationalClient
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
      const { data: updatedUser, error: updateError } = await relationalClient
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
      console.error('=== Avatar delete error ===', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
