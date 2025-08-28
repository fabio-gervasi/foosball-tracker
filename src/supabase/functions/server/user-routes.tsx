import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { validateUserAuth } from './auth-helpers.tsx';

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

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      if (!userProfile.currentGroup) {
        console.log('User has no group, returning empty users array');
        return c.json({ users: [] });
      }

      console.log('Getting users for group:', userProfile.currentGroup);
      console.log('User profile details:', {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        currentGroup: userProfile.currentGroup,
      });

      // Get all users in the same group
      const groupUserPrefix = `group:${userProfile.currentGroup}:user:`;
      console.log('Searching for group-user entries with prefix:', groupUserPrefix);
      const groupUserEntries = await kv.getByPrefix(groupUserPrefix);

      console.log(`Found ${groupUserEntries.length} user entries in group`);
      if (groupUserEntries.length > 0) {
        console.log(
          'Sample group-user entries:',
          groupUserEntries.slice(0, 3).map(e => ({
            key: e.key,
            value: e.value,
          }))
        );
      } else {
        console.log(
          'No group-user entries found. This suggests the group-user relationships are missing.'
        );

        // Let's also check if the group exists and has members
        const groupData = await kv.get(`group:${userProfile.currentGroup}`);
        console.log(
          'Group data:',
          groupData
            ? {
                code: groupData.code,
                name: groupData.name,
                memberCount: groupData.memberCount,
                membersArrayLength: Array.isArray(groupData.members)
                  ? groupData.members.length
                  : 'not an array',
                members: groupData.members,
              }
            : 'Group not found'
        );
      }

      const users = [];

      for (const entry of groupUserEntries) {
        try {
          const userId = entry.value;
          const user = await kv.get(`user:${userId}`);

          if (user && !user.isDeleted) {
            // Remove sensitive information before sending
            const safeUser = {
              ...user,
              password: undefined, // Never send passwords
            };
            users.push(safeUser);
          }
        } catch (userError) {
          console.error('Error getting user from group entry:', userError);
          // Continue with other users
        }
      }

      // Sort users by name for consistent ordering
      users.sort((a, b) => (a.name || a.username || '').localeCompare(b.name || b.username || ''));

      console.log(`Returning ${users.length} users for group ${userProfile.currentGroup}`);
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
      const requestingUserProfile = await kv.get(`user:${authResult.user.id}`);
      const targetUserProfile = await kv.get(`user:${userId}`);

      if (!requestingUserProfile) {
        return c.json({ error: 'Requesting user profile not found' }, 404);
      }

      if (!targetUserProfile || targetUserProfile.isDeleted) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if both users are in the same group
      if (requestingUserProfile.currentGroup !== targetUserProfile.currentGroup) {
        return c.json({ error: 'User not in your group' }, 403);
      }

      // Return safe user data (without sensitive information)
      const safeUser = {
        ...targetUserProfile,
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
      const requestingUserProfile = await kv.get(`user:${authResult.user.id}`);
      const targetUserProfile = await kv.get(`user:${userId}`);

      if (!requestingUserProfile) {
        return c.json({ error: 'Requesting user profile not found' }, 404);
      }

      if (!targetUserProfile || targetUserProfile.isDeleted) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if both users are in the same group
      if (requestingUserProfile.currentGroup !== targetUserProfile.currentGroup) {
        return c.json({ error: 'User not in your group' }, 403);
      }

      const groupId = requestingUserProfile.currentGroup;

      // Get all matches for the group
      const matchPrefix = `group:${groupId}:match:`;
      console.log('Getting matches with prefix:', matchPrefix);
      const matchEntries = await kv.getByPrefix(matchPrefix);

      const userMatches = [];
      const playerIdentifier = targetUserProfile.username || targetUserProfile.email;

      for (const entry of matchEntries) {
        try {
          const match = entry.value;

          // Check if the target user participated in this match
          const participated =
            match.player1Email === playerIdentifier ||
            match.player2Email === playerIdentifier ||
            (match.gameMode === 'doubles' &&
              (match.team1Player1Email === playerIdentifier ||
                match.team1Player2Email === playerIdentifier ||
                match.team2Player1Email === playerIdentifier ||
                match.team2Player2Email === playerIdentifier));

          if (participated) {
            userMatches.push(match);
          }
        } catch (matchError) {
          console.error('Error processing match entry:', matchError);
          // Continue with other matches
        }
      }

      // Sort matches by date (most recent first)
      userMatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      const updateData = await c.req.json();
      console.log('Profile update data:', updateData);

      // Only allow updating certain fields
      const allowedFields = ['name'];
      const updates = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      const updatedProfile = {
        ...userProfile,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`user:${authResult.user.id}`, updatedProfile);

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

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
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

      // Update user profile with avatar URL
      const updatedProfile = {
        ...userProfile,
        avatarUrl: signedUrlData.signedUrl,
        avatarPath: filePath, // Store the path for future reference
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`user:${authResult.user.id}`, updatedProfile);

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

  return app;
}
