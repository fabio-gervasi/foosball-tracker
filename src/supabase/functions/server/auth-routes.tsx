import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import {
  INITIAL_ELO,
  ADMIN_SECRET,
  API_PREFIX
} from './server-constants.tsx';
import {
  generateAvatar,
  usernameToEmail,
  emailToUsername,
  validateUsername,
  validateEmail
} from './server-helpers.tsx';
import { serverLogger } from './server-logger.tsx';
import { validateUserAuth, validateAdminAuth } from './auth-helpers.tsx';

export function createAuthRoutes(supabase: any) {
  const app = new Hono();

  // User signin with username instead of email
  app.post('/signin', async (c) => {
    try {
      serverLogger.info('Signin request received');
      const authHeader = c.req.header('Authorization');
      serverLogger.debug('Auth header present', { hasAuth: !!authHeader });

      const { username, password } = await c.req.json();
      serverLogger.info('Signin attempt', { username: username ? '[USERNAME_PROVIDED]' : '[NO_USERNAME]' });

      if (!username || !password) {
        serverLogger.warn('Missing username or password');
        return c.json({ error: 'Username and password required' }, 400);
      }

      // Try to find the user in KV store
      serverLogger.debug('Checking if user exists in KV store');
      let userId = null;
      let userProfile = null;

      // First, try username lookup
      userId = await kv.get(`user:username:${username}`);
      if (userId) {
        serverLogger.debug('Found user by username lookup');
      } else {
        // Backward compatibility: if username lookup fails, try email lookup
        serverLogger.debug('Username not found, trying email lookup for backward compatibility');
        userId = await kv.get(`user:email:${username}`);

        if (userId) {
          serverLogger.info('Found user by email lookup, migrating to username lookup');
          try {
            await kv.set(`user:username:${username}`, userId);
          } catch (migrationError) {
            serverLogger.error('Failed to migrate user to username lookup', migrationError);
          }
        }
      }

      if (!userId) {
        console.error('User not found in KV store for identifier:', username);

        // Get all username keys to help debug (but don't expose to client)
        const allUserKeys = await kv.getByPrefix('user:username:');
        console.log('Available usernames:', allUserKeys.map(item => item.key.replace('user:username:', '')));

        // Check if this might be a commonly attempted demo username
        const demoUsernames = ['Demo Player', 'Tsubasa', 'demo', 'demo.player'];
        if (demoUsernames.some(demo => demo.toLowerCase() === username.toLowerCase())) {
          return c.json({
            error: `Demo accounts are no longer available. Please create a new account by clicking "Sign Up".`
          }, 401);
        }

        return c.json({
          error: `User '${username}' not found. Please check your username and try again, or create a new account by clicking "Sign Up".`
        }, 401);
      }

      // Get user profile
      userProfile = await kv.get(`user:${userId}`);
      if (!userProfile) {
        console.error('User profile not found in KV store for user ID:', userId);
        return c.json({ error: 'Invalid login credentials' }, 401);
      }

      // Check if user is deleted
      if (userProfile.isDeleted) {
        console.error('Deleted user attempted to login:', userId);
        return c.json({ error: 'Account has been deleted' }, 401);
      }

      console.log('User found in KV store:', {
        userId,
        username: userProfile.username,
        email: userProfile.email ? 'present' : 'missing',
        hasCurrentGroup: !!userProfile.currentGroup
      });

      // For other users, try Supabase auth if ANON_KEY is available
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) {
        console.error('SUPABASE_ANON_KEY not configured, cannot authenticate non-demo users');
        return c.json({ error: 'Authentication service unavailable' }, 503);
      }

      console.log('Attempting Supabase auth signin with anon key...');

      // Create a client-side Supabase client for authentication
      const clientSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey
      );

      // Build list of emails to try for authentication
      const emailsToTry = [];

      // 1. First priority: real email from user profile (new users)
      if (userProfile.email && userProfile.email !== username && !userProfile.email.endsWith('@foosball.app')) {
        emailsToTry.push(userProfile.email);
        console.log('Will try real email from profile:', userProfile.email);
      }

      // 2. Second priority: username if it looks like an email
      if (username.includes('@')) {
        emailsToTry.push(username);
        console.log('Will try username as email:', username);
      }

      // 3. Third priority: converted username to fake email (legacy users)
      try {
        const fakeEmail = usernameToEmail(username);
        if (!emailsToTry.includes(fakeEmail)) {
          emailsToTry.push(fakeEmail);
          console.log('Will try converted fake email:', fakeEmail);
        }
      } catch (emailError) {
        console.log('Could not generate fake email from username:', emailError.message);
      }

      // 4. Fourth priority: stored email from profile (even if it's fake)
      if (userProfile.email && !emailsToTry.includes(userProfile.email)) {
        emailsToTry.push(userProfile.email);
        console.log('Will try stored profile email:', userProfile.email);
      }

      console.log(`Attempting authentication with ${emailsToTry.length} email formats for user:`, userId);

      let authSuccess = false;
      let authData = null;
      let lastError = null;

      // Try each email until one works
      for (let i = 0; i < emailsToTry.length; i++) {
        const emailForAuth = emailsToTry[i];
        try {
          console.log(`Auth attempt ${i + 1}/${emailsToTry.length} with email:`, emailForAuth);

          const { data, error } = await clientSupabase.auth.signInWithPassword({
            email: emailForAuth,
            password,
          });

          if (error) {
            console.log(`Auth failed for email ${emailForAuth}:`, error.message);
            lastError = error;
            continue;
          }

          if (data?.user && data?.session) {
            console.log('Supabase signin successful! User ID:', data.user.id);

            // Verify that the authenticated user matches our KV store user
            if (data.user.id === userId) {
              console.log('User ID matches KV store, authentication successful');
              authSuccess = true;
              authData = data;
              break;
            } else {
              console.log('User ID mismatch - Expected:', userId, 'Got:', data.user.id);
              lastError = new Error('User ID mismatch');
            }
          } else {
            console.log('Auth returned no data or user for email:', emailForAuth);
            lastError = new Error('No auth data returned');
          }
        } catch (authError) {
          console.log(`Auth attempt failed for email ${emailForAuth}:`, authError.message);
          lastError = authError;
        }
      }

      if (authSuccess && authData) {
        console.log('Authentication successful, returning session');
        return c.json({
          user: userProfile,
          session: { access_token: authData.session.access_token }
        });
      } else {
        console.error('All authentication attempts failed for username:', username);
        console.error('Last error:', lastError?.message);
        return c.json({ error: 'Invalid login credentials' }, 401);
      }

    } catch (error) {
      console.error('=== Signin error ===', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500) // Truncate stack trace
      });
      return c.json({ error: 'Internal server error during signin' }, 500);
    }
  });

  // User signup with username and email
  app.post('/signup', async (c) => {
    try {
      console.log('=== Signup request received ===');
      const authHeader = c.req.header('Authorization');
      console.log('Auth header present:', !!authHeader);

      const { username, email, password } = await c.req.json();
      console.log('Signup attempt for username:', username, 'email:', email);

      if (!username || !email || !password) {
        return c.json({ error: 'Username, email, and password are required' }, 400);
      }

      if (username.length < 3) {
        return c.json({ error: 'Username must be at least 3 characters' }, 400);
      }

      // Validate username format
      const usernameError = validateUsername(username);
      if (usernameError) {
        return c.json({ error: usernameError }, 400);
      }

      // Validate email format
      const emailError = validateEmail(email);
      if (emailError) {
        return c.json({ error: emailError }, 400);
      }

      // Check if username already exists
      const existingUserId = await kv.get(`user:username:${username}`);
      if (existingUserId) {
        console.log('Username already exists:', username);
        return c.json({ error: 'Username already exists' }, 400);
      }

      // Check if email is already in use
      const existingUserByEmail = await kv.get(`user:email:${email}`);
      if (existingUserByEmail) {
        console.log('Email already exists:', email);
        return c.json({ error: 'Email address is already in use' }, 400);
      }

      // Additional check: ensure username isn't used as an email in the legacy system
      const existingUserByUsernameAsEmail = await kv.get(`user:email:${username}`);
      if (existingUserByUsernameAsEmail) {
        console.log('Username conflicts with existing email-based account:', username);
        return c.json({ error: 'Username already exists as an account email' }, 400);
      }

      // Use the real email provided by the user
      console.log('Creating user with email for Supabase:', email);

      // Create user in Supabase Auth using service role
      console.log('Creating user in Supabase auth...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { name: username },
        // Automatically confirm the user's email since an email server hasn't been configured.
        email_confirm: true
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        return c.json({ error: authError.message }, 400);
      }

      console.log('Supabase user created, ID:', authData.user.id);

      // Store user profile in KV store
      const userProfile = {
        id: authData.user.id,
        name: username, // Use username as the display name
        username,
        email, // Store the real email provided by the user
        singlesWins: 0,
        singlesLosses: 0,
        doublesWins: 0,
        doublesLosses: 0,
        singlesElo: INITIAL_ELO,
        doublesElo: INITIAL_ELO,
        // Legacy fields for backward compatibility
        wins: 0,
        losses: 0,
        elo: INITIAL_ELO,
        avatar: generateAvatar(username),
        currentGroup: null, // User starts without a group
        isAdmin: false, // Regular users are not admin by default
        createdAt: new Date().toISOString()
      };

      console.log('Storing user profile in KV...');
      await kv.set(`user:${authData.user.id}`, userProfile);
      await kv.set(`user:username:${username}`, authData.user.id);
      // Store email lookup using the real email
      await kv.set(`user:email:${email}`, authData.user.id);
      console.log('User profile stored successfully');

      return c.json({ user: userProfile });
    } catch (error) {
      console.error('=== Signup error ===', error);
      return c.json({ error: 'Internal server error during signup' }, 500);
    }
  });

  // Get current user info
  app.get('/user', async (c) => {
    try {
      console.log('=== User info request received ===');

      const authResult = await validateUserAuth(c, supabase);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const userProfile = await kv.get(`user:${authResult.user.id}`);
      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      return c.json({ user: userProfile });
    } catch (error) {
      console.error('=== Get user error ===', error);
      return c.json({ error: 'Internal server error while getting user info' }, 500);
    }
  });

  // Endpoint to help users check if they need to create a new account
  app.post('/check-user-exists', async (c) => {
    try {
      console.log('=== Check user exists request ===');

      const { username } = await c.req.json();
      if (!username) {
        return c.json({ error: 'Username is required' }, 400);
      }

      // Check if user exists in KV store
      const userId = await kv.get(`user:username:${username}`);
      if (!userId) {
        return c.json({
          exists: false,
          message: 'User not found. Please create a new account.'
        });
      }

      // Check if user exists in Supabase auth
      try {
        const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !authUser) {
          // User exists in KV but not in auth - orphaned user
          console.log(`Orphaned user detected: ${username}`);
          return c.json({
            exists: false,
            orphaned: true,
            message: 'This account needs to be recreated. Please sign up with a new account using your email.'
          });
        }

        return c.json({
          exists: true,
          message: 'User exists. You can sign in.'
        });
      } catch (authError) {
        console.error('Error checking auth user:', authError);
        return c.json({
          exists: false,
          message: 'Unable to verify account. Please try creating a new account.'
        });
      }
    } catch (error) {
      console.error('Check user exists error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
