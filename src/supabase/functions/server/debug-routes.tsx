import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import {
  API_PREFIX
} from './server-constants.tsx';
import { validateUserAuth } from './auth-helpers.tsx';

export function createDebugRoutes(supabase: any) {
  const app = new Hono();

  // Health check with environment info (public endpoint)
  app.get('/health', async (c) => {
    console.log('Health check endpoint called');
    const authHeader = c.req.header('Authorization');
    console.log('Auth header present:', !!authHeader);

    // Test service role connection
    let serviceRoleStatus = 'not tested';
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) {
        serviceRoleStatus = `error: ${error.message}`;
      } else {
        serviceRoleStatus = 'working';
      }
    } catch (testError) {
      serviceRoleStatus = `exception: ${testError.message}`;
    }

    // Test KV store connection
    let kvStatus = 'not tested';
    try {
      await kv.get('health-check-test');
      kvStatus = 'working';
    } catch (kvError) {
      kvStatus = `error: ${kvError.message}`;
    }

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'foosball-tracker',
      env: {
        supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
        serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'configured' : 'missing',
        anonKey: Deno.env.get('SUPABASE_ANON_KEY') ? 'configured' : 'missing'
      },
      services: {
        serviceRole: serviceRoleStatus,
        kvStore: kvStatus
      }
    });
  });

  // Debug endpoint to list all usernames (public endpoint for debugging)
  app.get('/debug/users', async (c) => {
    try {
      console.log('=== Debug users endpoint called ===');

      // Get all username mappings
      const allUserKeys = await kv.getByPrefix('user:username:');
      const usernames = allUserKeys.map(item => ({
        username: item.key.replace('user:username:', ''),
        userId: item.value
      }));

      // Also get all email mappings for comparison
      const allEmailKeys = await kv.getByPrefix('user:email:');
      const emails = allEmailKeys.map(item => ({
        email: item.key.replace('user:email:', ''),
        userId: item.value
      }));

      return c.json({
        server: 'foosball-tracker-debug-users',
        totalUsernames: usernames.length,
        totalEmails: emails.length,
        usernames,
        emails: emails.slice(0, 10), // Limit emails for brevity
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug users endpoint error:', error);
      return c.json({ error: 'Debug failed', details: error.message }, 500);
    }
  });



  // Debug endpoint for authenticated users to check their match data
  app.get('/debug/matches', async (c) => {
    try {
      console.log('=== Debug matches endpoint called ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      console.log('User profile:', {
        id: userProfile.id,
        username: userProfile.username,
        currentGroup: userProfile.currentGroup
      });

      // Get all matches with different prefixes to debug
      const results = {
        userGroup: userProfile.currentGroup,
        groupMatches: [],
        allMatches: [],
        matchesByGroup: {},
        rawMatchData: []
      };

      if (userProfile.currentGroup) {
        const groupPrefix = `match:${userProfile.currentGroup}:`;
        const groupMatches = await kv.getByPrefix(groupPrefix);

        // Log raw data for debugging
        groupMatches.forEach((item, index) => {
          console.log(`Raw match ${index + 1}:`, {
            key: item.key,
            valueType: typeof item.value,
            hasValue: !!item.value,
            value: item.value
          });
        });

        results.groupMatches = groupMatches.map(item => ({
          key: item.key,
          matchType: item.value?.matchType,
          date: item.value?.date,
          createdAt: item.value?.createdAt,
          hasValue: !!item.value,
          valueType: typeof item.value
        }));
        results.rawMatchData = groupMatches.map(item => item.value);
        console.log(`Found ${groupMatches.length} matches for group ${userProfile.currentGroup}`);
      }

      // Get all matches to see what exists
      const allMatches = await kv.getByPrefix('match:');
      results.allMatches = allMatches.map(item => ({
        key: item.key,
        groupCode: item.value?.groupCode,
        matchType: item.value?.matchType,
        date: item.value?.date,
        hasValue: !!item.value
      }));

      // Group matches by group code
      allMatches.forEach(item => {
        const groupCode = item.value?.groupCode || 'unknown';
        if (!results.matchesByGroup[groupCode]) {
          results.matchesByGroup[groupCode] = [];
        }
        results.matchesByGroup[groupCode].push(item.key);
      });

      console.log('Debug results:', results);
      return c.json(results);
    } catch (error) {
      console.error('=== Debug matches error ===', error);
      return c.json({ error: 'Debug failed', details: error.message }, 500);
    }
  });





  // User lookup endpoint (for password reset email lookup)
  app.post('/debug/user-lookup', async (c) => {
    try {
      console.log('=== User lookup request ===');

      const { identifier } = await c.req.json();
      console.log('Looking up user for identifier:', identifier);

      if (!identifier) {
        return c.json({ error: 'Username or email required' }, 400);
      }

      // Find the user by username or email
      let userId = null;
      let userProfile = null;

      // Try username lookup first
      userId = await kv.get(`user:username:${identifier}`);
      if (userId) {
        console.log('Found user by username');
      } else {
        // Try email lookup
        userId = await kv.get(`user:email:${identifier}`);
        if (userId) {
          console.log('Found user by email');
        }
      }

      if (!userId) {
        console.log('User not found for lookup:', identifier);
        return c.json({ error: 'No account found with that username or email address' }, 404);
      }

      // Get user profile
      userProfile = await kv.get(`user:${userId}`);
      if (!userProfile || !userProfile.email) {
        console.log('User profile not found or no email associated with account');
        return c.json({ error: 'Account found but no email address on file' }, 400);
      }

      console.log('User lookup successful, email found:', userProfile.email);

      return c.json({
        email: userProfile.email,
        userId: userProfile.id,
        username: userProfile.username
      });

    } catch (error) {
      console.error('=== User lookup error ===', error);
      return c.json({ error: 'Internal server error during user lookup' }, 500);
    }
  });



  // Debug endpoint to list password reset tokens (for debugging)
  app.get('/debug/password-reset-tokens', async (c) => {
    try {
      console.log('=== Debug password reset tokens ===');

      // Get all password reset tokens
      const resetTokens = await kv.getByPrefix('password_reset:');

      const tokenInfo = resetTokens.map(item => ({
        key: item.key,
        hasValue: !!item.value,
        userId: item.value?.userId,
        email: item.value?.email,
        createdAt: item.value?.createdAt,
        expiresAt: item.value?.expiresAt,
        isExpired: item.value?.expiresAt ? new Date(item.value.expiresAt) < new Date() : null
      }));

      return c.json({
        server: 'foosball-tracker-debug-tokens',
        totalTokens: resetTokens.length,
        tokens: tokenInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug password reset tokens error:', error);
      return c.json({ error: 'Debug failed', details: error.message }, 500);
    }
  });

  // Debug endpoint to test email configuration
  app.post('/debug/test-email-config', async (c) => {
    try {
      console.log('=== Testing email configuration ===');

      const { testEmail } = await c.req.json();

      if (!testEmail) {
        return c.json({ error: 'Test email required' }, 400);
      }

      // Test with anon key client (this is what password reset uses)
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) {
        return c.json({
          error: 'SUPABASE_ANON_KEY not configured',
          config: {
            supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
            serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            anonKey: false
          }
        }, 503);
      }

      const clientSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey
      );

      console.log('Testing password reset email with test address:', testEmail);

      // Try to send a password reset email to the test address
      const { data, error: resetError } = await clientSupabase.auth.resetPasswordForEmail(
        testEmail,
        {
          redirectTo: 'https://test.example.com/callback' // Use a dummy redirect URL for testing
        }
      );

      if (resetError) {
        console.error('Email test failed:', resetError);

        return c.json({
          success: false,
          error: resetError.message,
          errorCode: resetError.code,
          diagnosis: getDiagnosis(resetError),
          config: {
            supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
            serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            anonKey: !!anonKey
          }
        });
      }

      console.log('Email test successful');

      return c.json({
        success: true,
        message: 'Email configuration appears to be working',
        testEmail,
        config: {
          supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
          serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          anonKey: !!anonKey
        }
      });

    } catch (error) {
      console.error('Email config test error:', error);
      return c.json({
        success: false,
        error: 'Test failed',
        details: error.message,
        config: {
          supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
          serviceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          anonKey: !!Deno.env.get('SUPABASE_ANON_KEY')
        }
      }, 500);
    }

    function getDiagnosis(error: any) {
      if (error.message?.includes('SMTP')) {
        return 'SMTP server not configured in Supabase project settings. Go to Authentication > Settings > SMTP Settings in Supabase dashboard.';
      } else if (error.message?.includes('rate limit')) {
        return 'Rate limit exceeded. Wait before testing again.';
      } else if (error.message?.includes('not found')) {
        return 'Email address not found in auth database. Password reset only works for existing users.';
      } else if (error.message?.includes('disabled')) {
        return 'Password reset functionality may be disabled in Supabase project settings.';
      } else {
        return 'Unknown email configuration issue. Check Supabase project settings.';
      }
    }
  });

  // Debug endpoint to clean up orphaned demo users
  app.post('/debug/cleanup-orphaned-users', async (c) => {
    try {
      console.log('=== Cleanup orphaned users ===');

      // Get all username mappings
      const allUserKeys = await kv.getByPrefix('user:username:');
      const orphanedUsers = [];
      const validUsers = [];

      for (const userKey of allUserKeys) {
        const username = userKey.key.replace('user:username:', '');
        const userId = userKey.value;

        try {
          // Check if user exists in Supabase auth
          const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);

          if (error || !authUser) {
            console.log(`Orphaned user found: ${username} (${userId})`);
            orphanedUsers.push({ username, userId, reason: error?.message || 'User not found in auth' });

            // Clean up the orphaned user data
            await kv.del(`user:username:${username}`);
            const userProfile = await kv.get(`user:${userId}`);
            if (userProfile) {
              if (userProfile.email) {
                await kv.del(`user:email:${userProfile.email}`);
              }
              await kv.del(`user:${userId}`);
            }
          } else {
            validUsers.push({ username, userId });
          }
        } catch (checkError) {
          console.error(`Error checking user ${username}:`, checkError);
        }
      }

      return c.json({
        message: 'Cleanup completed',
        orphanedUsersRemoved: orphanedUsers.length,
        validUsersRemaining: validUsers.length,
        orphanedUsers,
        validUsers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Cleanup orphaned users error:', error);
      return c.json({ error: 'Cleanup failed', details: error.message }, 500);
    }
  });



  return app;
}
