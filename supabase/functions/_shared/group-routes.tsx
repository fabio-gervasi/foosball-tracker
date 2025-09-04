import { Hono } from 'npm:hono';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { INITIAL_ELO } from './server-constants.tsx';
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

export function createGroupRoutes(supabase: any) {
  const app = new Hono();

  // Create a new group
  app.post('/groups', async c => {
    try {
      console.log('=== Create group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const { name } = await c.req.json();
      console.log('Group creation attempt:', name);

      if (!name) {
        return c.json({ error: 'Group name is required' }, 400);
      }

      if (name.length < 3) {
        return c.json({ error: 'Group name must be at least 3 characters' }, 400);
      }

      const relationalClient = createRelationalClient();

      // Generate a unique group code
      let groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Check if group code already exists in database
      const { data: existingGroup } = await relationalClient
        .from('groups')
        .select('code')
        .eq('code', groupCode)
        .single();

      if (existingGroup) {
        // Try again with a different code
        groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: secondCheck } = await relationalClient
          .from('groups')
          .select('code')
          .eq('code', groupCode)
          .single();

        if (secondCheck) {
          return c.json({ error: 'Failed to generate unique group code, please try again' }, 500);
        }
      }

      // Create group in database
      const { data: groupData, error: groupError } = await relationalClient
        .from('groups')
        .insert({
          code: groupCode,
          name,
          created_by: authResult.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (groupError) {
        console.error('Failed to create group in database:', groupError);
        return c.json({ error: 'Failed to create group' }, 500);
      }

      // Create group-user relationship in database
      const { error: relationError } = await relationalClient
        .from('user_groups')
        .insert({
          user_id: authResult.user.id,
          group_code: groupCode,
          joined_at: new Date().toISOString(),
        });

      if (relationError) {
        console.error('Failed to create user-group relationship:', relationError);
        // Continue anyway - the group was created
      }

      // Update user's current group in database
      const { error: userError } = await relationalClient
        .from('users')
        .update({
          current_group_code: groupCode,
          is_admin: true, // Creator is automatically an admin
          updated_at: new Date().toISOString(),
        })
        .eq('id', authResult.user.id)
        .eq('is_deleted', false);

      if (userError) {
        console.error('Failed to update user with new group:', userError);
        // Continue anyway - the group was created
      }

      console.log('Group created successfully:', groupCode);
      return c.json({
        message: 'Group created successfully',
        group: {
          ...groupData,
          id: groupData.code, // Legacy compatibility
          members: [authResult.user.id],
          memberCount: 1,
          admins: [authResult.user.id],
        },
      });
    } catch (error) {
      console.error('=== Create group error ===', error);
      return c.json({ error: 'Internal server error during group creation' }, 500);
    }
  });

  // Join an existing group (updated for multi-group support)
  app.post('/groups/join', async c => {
    try {
      console.log('=== Join group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const { groupCode, setAsCurrent = true } = await c.req.json();
      console.log('Group join attempt for code:', groupCode, 'setAsCurrent:', setAsCurrent);

      if (!groupCode) {
        return c.json({ error: 'Group code is required' }, 400);
      }

      const groupCodeUpper = groupCode.toUpperCase();

      // Get the group
      const group = await kv.get(`group:${groupCodeUpper}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      // Get user profile
      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Check if user is already a member
      if (!group.members || !Array.isArray(group.members)) {
        console.warn('Group members is not an array, initializing:', group.members);
        group.members = [];
      }

      const isAlreadyMember = group.members.includes(authResult.user.id);

      // Add user to group members if not already a member
      if (!isAlreadyMember) {
        group.members.push(authResult.user.id);
        group.memberCount = (group.memberCount || 0) + 1;
        await kv.set(`group:${groupCodeUpper}`, group);

        // Create group-user relationship entry
        await kv.set(`group:${groupCodeUpper}:user:${authResult.user.id}`, authResult.user.id);
      }

      // Initialize user groups if not exists
      if (!userProfile.groups || !Array.isArray(userProfile.groups)) {
        userProfile.groups = [];
      }

      // Add group to user's groups list if not already there
      if (!userProfile.groups.some(g => g.code === groupCodeUpper)) {
        userProfile.groups.push({
          code: groupCodeUpper,
          name: group.name,
          joinedAt: new Date().toISOString(),
        });
      }

      // Set as current group if requested or if user has no current group
      if (setAsCurrent || !userProfile.currentGroup) {
        userProfile.currentGroup = groupCodeUpper;
        userProfile.joinedGroupAt = new Date().toISOString();
      }

      await kv.set(`user:${authResult.user.id}`, userProfile);

      console.log('User joined group successfully:', groupCode, 'Member count:', group.memberCount);
      return c.json({
        message: isAlreadyMember ? 'Already a member of this group' : 'Joined group successfully',
        group,
        isNewMember: !isAlreadyMember,
        setAsCurrent: setAsCurrent || !userProfile.currentGroup,
      });
    } catch (error) {
      console.error('=== Join group error ===', error);
      return c.json({ error: 'Internal server error during group join' }, 500);
    }
  });

  // Get current user's group
  app.get('/groups/current', async c => {
    try {
      console.log('=== Get current group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile || !userProfile.currentGroup) {
        return c.json({ error: 'User is not in any group' }, 404);
      }

      const group = await kv.get(`group:${userProfile.currentGroup}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      return c.json({
        group,
      });
    } catch (error) {
      console.error('=== Get current group error ===', error);
      return c.json({ error: 'Internal server error while getting current group' }, 500);
    }
  });

  // Get all user's groups
  app.get('/groups/user-groups', async c => {
    try {
      console.log('=== Get user groups request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Initialize groups array if not exists
      if (!userProfile.groups || !Array.isArray(userProfile.groups)) {
        userProfile.groups = [];
        await kv.set(`user:${authResult.user.id}`, userProfile);
      }

      // Get full group data for each group
      const groupsWithDetails = [];
      for (const userGroup of userProfile.groups) {
        const group = await kv.get(`group:${userGroup.code}`);
        if (group) {
          groupsWithDetails.push({
            code: group.code,
            name: group.name,
            icon: group.icon,
            memberCount: group.memberCount || 0,
            joinedAt: userGroup.joinedAt,
            isCurrent: userProfile.currentGroup === group.code,
          });
        }
      }

      return c.json({
        groups: groupsWithDetails,
        currentGroup: userProfile.currentGroup,
      });
    } catch (error) {
      console.error('=== Get user groups error ===', error);
      return c.json({ error: 'Internal server error while getting user groups' }, 500);
    }
  });

  // Switch current group
  app.post('/groups/switch', async c => {
    try {
      console.log('=== Switch group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const { groupCode } = await c.req.json();

      if (!groupCode) {
        return c.json({ error: 'Group code is required' }, 400);
      }

      const groupCodeUpper = groupCode.toUpperCase();

      // Get user profile
      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Check if user is a member of the group
      if (!userProfile.groups || !Array.isArray(userProfile.groups)) {
        return c.json({ error: 'User is not a member of any groups' }, 400);
      }

      const isGroupMember = userProfile.groups.some(g => g.code === groupCodeUpper);
      if (!isGroupMember) {
        return c.json({ error: 'User is not a member of this group' }, 403);
      }

      // Verify group still exists
      const group = await kv.get(`group:${groupCodeUpper}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      // Update current group
      userProfile.currentGroup = groupCodeUpper;
      userProfile.groupSwitchedAt = new Date().toISOString();
      await kv.set(`user:${authResult.user.id}`, userProfile);

      console.log('User switched to group successfully:', groupCodeUpper);
      return c.json({
        message: 'Switched to group successfully',
        group,
      });
    } catch (error) {
      console.error('=== Switch group error ===', error);
      return c.json({ error: 'Internal server error while switching group' }, 500);
    }
  });

  // Update group settings (admin only)
  app.put('/groups/current', async c => {
    try {
      console.log('=== Update group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile || !userProfile.currentGroup) {
        return c.json({ error: 'User is not in any group' }, 404);
      }

      // Check if user is admin
      if (!userProfile.isAdmin) {
        return c.json({ error: 'Admin privileges required' }, 403);
      }

      const { name, code, icon } = await c.req.json();

      // Get current group
      const group = await kv.get(`group:${userProfile.currentGroup}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      const updatedGroup = { ...group };

      // Update name if provided
      if (name !== undefined) {
        if (!name || name.length < 3) {
          return c.json({ error: 'Group name must be at least 3 characters' }, 400);
        }
        updatedGroup.name = name;
      }

      // Update code if provided
      if (code !== undefined) {
        if (!code || code.length < 3) {
          return c.json({ error: 'Group code must be at least 3 characters' }, 400);
        }

        const codeUpper = code.toUpperCase();

        // Check if new code already exists (unless it's the same code)
        if (codeUpper !== userProfile.currentGroup) {
          const existingGroup = await kv.get(`group:${codeUpper}`);
          if (existingGroup) {
            return c.json({ error: 'Group code already exists' }, 409);
          }

          // If changing code, we need to move the group data
          await kv.set(`group:${codeUpper}`, { ...updatedGroup, code: codeUpper });
          await kv.del(`group:${userProfile.currentGroup}`);

          // Update all users' currentGroup
          if (group.members && Array.isArray(group.members)) {
            for (const memberId of group.members) {
              const memberProfile = await kv.get(`user:${memberId}`);
              if (memberProfile && memberProfile.currentGroup === userProfile.currentGroup) {
                memberProfile.currentGroup = codeUpper;
                await kv.set(`user:${memberId}`, memberProfile);
              }

              // Update group-user relationship entries
              await kv.set(`group:${codeUpper}:user:${memberId}`, memberId);
              await kv.del(`group:${userProfile.currentGroup}:user:${memberId}`);
            }
          }

          // Update all matches to use new group code
          const matchPrefix = `match:${userProfile.currentGroup}:`;
          const matchItems = await kv.getByPrefix(matchPrefix);

          for (const matchItem of matchItems) {
            const match = matchItem.value;
            if (match) {
              match.groupCode = codeUpper;
              const newMatchKey = matchItem.key.replace(
                `match:${userProfile.currentGroup}:`,
                `match:${codeUpper}:`
              );
              await kv.set(newMatchKey, match);
              await kv.del(matchItem.key);
            }
          }

          updatedGroup.code = codeUpper;
        }
      }

      // Update icon if provided
      if (icon !== undefined) {
        updatedGroup.icon = icon;
      }

      updatedGroup.updatedAt = new Date().toISOString();
      updatedGroup.updatedBy = authResult.user.id;

      // Save the updated group
      const finalGroupCode = updatedGroup.code;
      await kv.set(`group:${finalGroupCode}`, updatedGroup);

      console.log('Group updated successfully:', finalGroupCode);
      return c.json({
        message: 'Group updated successfully',
        group: updatedGroup,
      });
    } catch (error) {
      console.error('=== Update group error ===', error);
      return c.json({ error: 'Internal server error while updating group' }, 500);
    }
  });

  // Test endpoint for icon upload debugging
  app.get('/groups/current/icon/test', async c => {
    try {
      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      return c.json({
        message: 'Icon upload test endpoint working',
        user: authResult.user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Icon test endpoint error:', error);
      return c.json({ error: `Test endpoint failed: ${error.message}` }, 500);
    }
  });

  // Upload group icon (admin only)
  app.post('/groups/current/icon', async c => {
    console.log('=== Upload group icon request received ===');

    try {
      console.log('Step 1: Validating user authentication...');
      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        console.log('Auth validation failed:', authResult.error);
        return c.json({ error: authResult.error }, authResult.status);
      }
      console.log('✅ Auth validation successful, user ID:', authResult.user.id);

      const relationalClient = createRelationalClient();

      console.log('Step 2: Getting user profile...');
      const { data: userData, error: userError } = await relationalClient
        .from('users')
        .select('id, current_group_code, is_admin')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.log('User profile not found:', userError);
        return c.json({ error: 'User is not in any group' }, 404);
      }

      if (!userData.current_group_code) {
        console.log('User has no current group');
        return c.json({ error: 'User is not in any group' }, 404);
      }

      console.log(
        '✅ User profile found, group:',
        userData.current_group_code,
        'isAdmin:',
        userData.is_admin
      );

      // Check if user is admin
      if (!userData.is_admin) {
        console.log('User is not admin, denying access');
        return c.json({ error: 'Admin privileges required' }, 403);
      }

      console.log('Step 3: Parsing FormData...');
      console.log('Request Content-Type:', c.req.header('Content-Type'));
      console.log('Request method:', c.req.method);
      console.log('Request headers:', Object.fromEntries(c.req.raw.headers.entries()));

      let formData;
      try {
        formData = await c.req.formData();
        console.log('✅ FormData parsed successfully');
      } catch (formError) {
        console.error('❌ Failed to parse FormData:', formError);
        console.error('FormData error details:', {
          name: formError.name,
          message: formError.message,
          stack: formError.stack?.substring(0, 500),
        });
        return c.json({ error: `Failed to parse form data: ${formError.message}` }, 400);
      }

      console.log('Step 4: Extracting file from FormData...');
      const file = formData.get('icon') as File;

      console.log('FormData contents:');
      for (const [key, value] of formData.entries()) {
        console.log(
          `  ${key}:`,
          typeof value,
          value instanceof File ? `File(${value.name}, ${value.size}b, ${value.type})` : value
        );
      }

      if (!file) {
        console.log('❌ No file found in FormData');
        return c.json({ error: 'No file provided' }, 400);
      }

      if (!(file instanceof File)) {
        console.log('❌ Icon field is not a File object:', typeof file, file);
        return c.json({ error: 'Invalid file format' }, 400);
      }

      console.log('✅ File extracted:', file.name, 'size:', file.size, 'type:', file.type);

      console.log('Step 5: Validating file...');
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.log('❌ Invalid file type:', file.type);
        return c.json({ error: 'File must be an image' }, 400);
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        console.log('❌ File too large:', file.size);
        return c.json({ error: 'File size must be less than 5MB' }, 400);
      }
      console.log('✅ File validation passed');

      console.log('Step 6: Setting up storage bucket...');
      // Create bucket if it doesn't exist
      const bucketName = 'make-171cbf6f-group-icons';
      console.log('Checking if bucket exists:', bucketName);

      let buckets, listError;
      try {
        const listResult = await supabase.storage.listBuckets();
        buckets = listResult.data;
        listError = listResult.error;
      } catch (storageError) {
        console.error('Exception listing buckets:', storageError);
        return c.json({ error: `Storage service unavailable: ${storageError.message}` }, 500);
      }

      if (listError) {
        console.error('Failed to list buckets:', listError);
        return c.json({ error: `Failed to access storage: ${listError.message}` }, 500);
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      console.log('Bucket exists:', bucketExists, 'Total buckets:', buckets?.length || 0);

      if (!bucketExists) {
        console.log('Creating bucket:', bucketName);
        try {
          const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            fileSizeLimit: 5 * 1024 * 1024, // 5MB
          });
          if (bucketError) {
            console.error('Failed to create bucket:', bucketError);
            return c.json(
              { error: `Failed to create storage bucket: ${bucketError.message}` },
              500
            );
          }
          console.log('✅ Bucket created successfully');
        } catch (createError) {
          console.error('Exception creating bucket:', createError);
          return c.json({ error: `Failed to create storage bucket: ${createError.message}` }, 500);
        }
      } else {
        console.log('✅ Bucket already exists');
      }

      console.log('Step 7: Preparing file for upload...');
      // Generate file name
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${userProfile.currentGroup}-${Date.now()}.${fileExt}`;
      console.log('Generated fileName:', fileName);

      // Convert File to ArrayBuffer for Supabase Storage
      console.log('Converting file to buffer...');
      let fileBuffer;
      try {
        fileBuffer = await file.arrayBuffer();
        console.log('✅ File converted to buffer, size:', fileBuffer.byteLength, 'bytes');
      } catch (bufferError) {
        console.error('❌ Failed to convert file to buffer:', bufferError);
        return c.json({ error: `Failed to process file: ${bufferError.message}` }, 500);
      }

      console.log('Step 8: Uploading file to storage...');
      console.log('Upload params:', {
        bucket: bucketName,
        fileName,
        bufferSize: fileBuffer.byteLength,
        contentType: file.type,
      });

      let uploadData, uploadError;
      try {
        const uploadResult = await supabase.storage.from(bucketName).upload(fileName, fileBuffer, {
          upsert: true,
          contentType: file.type,
        });
        uploadData = uploadResult.data;
        uploadError = uploadResult.error;
      } catch (uploadException) {
        console.error('❌ Exception during upload:', uploadException);
        return c.json({ error: `Upload service error: ${uploadException.message}` }, 500);
      }

      if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        return c.json({ error: `Failed to upload image: ${uploadError.message}` }, 500);
      }

      console.log('✅ File uploaded successfully:', uploadData?.path || fileName);

      console.log('Step 9: Creating signed URL...');
      let signedUrlData, urlError;
      try {
        const urlResult = await supabase.storage
          .from(bucketName)
          .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry
        signedUrlData = urlResult.data;
        urlError = urlResult.error;
      } catch (urlException) {
        console.error('❌ Exception creating signed URL:', urlException);
        return c.json({ error: `URL service error: ${urlException.message}` }, 500);
      }

      if (urlError) {
        console.error('❌ Failed to create signed URL:', urlError);
        console.error('Signed URL error details:', JSON.stringify(urlError, null, 2));
        return c.json({ error: `Failed to get image URL: ${urlError.message}` }, 500);
      }

      if (!signedUrlData?.signedUrl) {
        console.error('❌ No signed URL returned');
        return c.json({ error: 'Failed to generate image URL' }, 500);
      }

      console.log('✅ Signed URL created successfully');

      console.log('Step 10: Updating group record...');

      // Update group with icon in database
      const { data: updatedGroup, error: updateError } = await relationalClient
        .from('groups')
        .update({
          icon: signedUrlData.signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('code', userData.current_group_code)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update group with icon:', updateError);
        return c.json({ error: `Failed to update group with icon: ${updateError.message}` }, 500);
      }

      console.log('✅ Group updated with new icon successfully');

      console.log('🎉 Group icon upload completed successfully!');
      return c.json({
        message: 'Group icon uploaded successfully',
        iconUrl: signedUrlData.signedUrl,
      });
    } catch (error) {
      console.error('=== CRITICAL: Upload group icon error ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack (first 1000 chars):', error.stack?.substring(0, 1000));
      console.error(
        'Full error object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );

      // Provide more specific error messages based on error type
      let errorMessage = 'Internal server error while uploading group icon';

      if (error.message?.includes('FormData')) {
        errorMessage = `Failed to process upload data: ${error.message}`;
      } else if (error.message?.includes('storage') || error.message?.includes('bucket')) {
        errorMessage = `Storage service error: ${error.message}`;
      } else if (error.message?.includes('auth') || error.message?.includes('token')) {
        errorMessage = `Authentication error: ${error.message}`;
      } else if (error.message?.includes('kv') || error.message?.includes('database')) {
        errorMessage = `Database error: ${error.message}`;
      } else if (error.message) {
        errorMessage = `Upload failed: ${error.message}`;
      }

      return c.json(
        {
          error: errorMessage,
          details: error.message,
        },
        500
      );
    }
  });

  // Delete group icon (admin only)
  app.delete('/groups/current/icon', async c => {
    console.log('=== Delete group icon request received ===');

    try {
      console.log('Step 1: Validating user authentication...');
      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        console.log('Auth validation failed:', authResult.error);
        return c.json({ error: authResult.error }, authResult.status);
      }
      console.log('✅ Auth validation successful, user ID:', authResult.user.id);

      const relationalClient = createRelationalClient();

      console.log('Step 2: Getting user profile...');
      const { data: userData, error: userError } = await relationalClient
        .from('users')
        .select('id, current_group_code, is_admin')
        .eq('id', authResult.user.id)
        .eq('is_deleted', false)
        .single();

      if (userError || !userData) {
        console.log('User profile not found:', userError);
        return c.json({ error: 'User is not in any group' }, 404);
      }

      if (!userData.current_group_code) {
        console.log('User has no current group');
        return c.json({ error: 'User is not in any group' }, 404);
      }

      console.log(
        '✅ User profile found, group:',
        userData.current_group_code,
        'isAdmin:',
        userData.is_admin
      );

      // Check if user is admin
      if (!userData.is_admin) {
        console.log('User is not admin, denying access');
        return c.json({ error: 'Admin privileges required' }, 403);
      }

      console.log('Step 3: Getting group data...');
      const { data: groupData, error: groupError } = await relationalClient
        .from('groups')
        .select('code, name, icon')
        .eq('code', userData.current_group_code)
        .single();

      if (groupError || !groupData) {
        console.error('❌ Group not found:', groupError);
        return c.json({ error: 'Group not found' }, 404);
      }
      console.log('✅ Group found:', groupData.name);

      // If group has no icon, nothing to delete
      if (!groupData.icon) {
        return c.json({ message: 'No icon to delete' });
      }

      console.log('Step 4: Updating group record...');
      // Update group to remove icon
      const { data: updatedGroup, error: updateError } = await relationalClient
        .from('groups')
        .update({
          icon: null,
          updated_at: new Date().toISOString(),
        })
        .eq('code', userData.current_group_code)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update group:', updateError);
        return c.json({ error: `Failed to delete group icon: ${updateError.message}` }, 500);
      }

      console.log('✅ Group updated successfully');

      console.log('🎉 Group icon deletion completed successfully!');
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
      console.error('=== CRITICAL: Delete group icon error ===');
      console.error(error);
      return c.json({ error: 'Internal server error while deleting group icon' }, 500);
    }
  });

  // Leave a group
  app.post('/groups/leave', async c => {
    try {
      console.log('=== Leave group request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const { groupCode } = await c.req.json();
      console.log('Group leave attempt for code:', groupCode);

      if (!groupCode) {
        return c.json({ error: 'Group code is required' }, 400);
      }

      const groupCodeUpper = groupCode.toUpperCase();

      // Get the group
      const group = await kv.get(`group:${groupCodeUpper}`);
      if (!group) {
        return c.json({ error: 'Group not found' }, 404);
      }

      // Get user profile
      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Initialize groups array if not exists
      if (!userProfile.groups || !Array.isArray(userProfile.groups)) {
        userProfile.groups = [];
      }

      // Check if user is a member of this group
      const isGroupMember = userProfile.groups.some(g => g.code === groupCodeUpper);
      if (!isGroupMember) {
        return c.json({ error: 'User is not a member of this group' }, 400);
      }

      // Check if user is a member in the group's members array
      if (!group.members || !Array.isArray(group.members)) {
        console.warn('Group members is not an array, initializing:', group.members);
        group.members = [];
      }

      const isMemberInGroup = group.members.includes(authResult.user.id);
      if (!isMemberInGroup) {
        console.warn('User not found in group members array, but found in user groups');
      }

      // Remove user from group members if present
      if (isMemberInGroup) {
        group.members = group.members.filter(memberId => memberId !== authResult.user.id);
        group.memberCount = Math.max((group.memberCount || 1) - 1, 0);
        await kv.set(`group:${groupCodeUpper}`, group);
      }

      // Remove group from user's groups list
      userProfile.groups = userProfile.groups.filter(g => g.code !== groupCodeUpper);

      // Handle current group switching logic
      let newCurrentGroup = null;
      if (userProfile.currentGroup === groupCodeUpper) {
        // User is leaving their current group
        if (userProfile.groups.length > 0) {
          // Switch to the most recently joined group
          const sortedGroups = userProfile.groups.sort(
            (a, b) => new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime()
          );
          newCurrentGroup = sortedGroups[0].code;
          userProfile.currentGroup = newCurrentGroup;
          userProfile.groupSwitchedAt = new Date().toISOString();
        } else {
          // User has no more groups
          userProfile.currentGroup = null;
          userProfile.groupSwitchedAt = new Date().toISOString();
        }
      }
      // If leaving a non-current group, no current group change needed

      // Update user profile
      await kv.set(`user:${authResult.user.id}`, userProfile);

      // Clean up group-user relationship entry
      await kv.del(`group:${groupCodeUpper}:user:${authResult.user.id}`);

      console.log(
        'User left group successfully:',
        groupCodeUpper,
        'New member count:',
        group.memberCount
      );
      console.log('New current group:', newCurrentGroup);

      return c.json({
        message: 'Left group successfully',
        leftGroup: groupCodeUpper,
        newCurrentGroup,
        remainingGroups: userProfile.groups.length,
      });
    } catch (error) {
      console.error('=== Leave group error ===', error);
      return c.json({ error: 'Internal server error while leaving group' }, 500);
    }
  });

  return app;
}
