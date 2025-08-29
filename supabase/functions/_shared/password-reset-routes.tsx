import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import { API_PREFIX } from './server-constants.tsx';

export function createPasswordResetRoutes(supabase: any) {
  const app = new Hono();

  // Password reset request endpoint
  app.post('/password-reset', async c => {
    try {
      console.log('=== Password reset request received ===');

      const { identifier, redirectUrl } = await c.req.json();
      console.log('Password reset request for identifier:', identifier);
      console.log('Redirect URL:', redirectUrl);

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
        console.log('User not found for password reset:', identifier);
        return c.json({ error: 'No account found with that username or email address' }, 404);
      }

      // Get user profile
      userProfile = await kv.get(`user:${userId}`);
      if (!userProfile || !userProfile.email) {
        console.log('User profile not found or no email associated with account');
        return c.json({ error: 'Account found but no email address is associated with it' }, 400);
      }

      console.log('Sending password reset email to:', userProfile.email);

      // Use a client with anon key for password reset (this is the correct approach)
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) {
        console.error('SUPABASE_ANON_KEY not configured');
        return c.json({ error: 'Email service not configured for password resets' }, 503);
      }

      const clientSupabase = createClient(Deno.env.get('SUPABASE_URL')!, anonKey);

      // Send password reset email
      const { data, error: resetError } = await clientSupabase.auth.resetPasswordForEmail(
        userProfile.email,
        {
          redirectTo:
            redirectUrl ||
            `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/password-reset-callback`,
        }
      );

      if (resetError) {
        console.error('Supabase password reset error:', resetError);

        // Provide more specific error messages
        if (resetError.message?.includes('Email rate limit exceeded')) {
          return c.json(
            { error: 'Too many password reset attempts. Please wait before trying again.' },
            429
          );
        } else if (resetError.message?.includes('Email not found')) {
          return c.json({ error: 'No account found with that email address' }, 404);
        } else if (resetError.message?.includes('SMTP')) {
          return c.json(
            { error: 'Email service is not fully configured. Please contact your administrator.' },
            503
          );
        } else {
          return c.json(
            { error: resetError.message || 'Failed to send password reset email' },
            400
          );
        }
      }

      console.log('Password reset email sent successfully');

      return c.json({
        message: 'Password reset email sent successfully',
        email: userProfile.email,
      });
    } catch (error) {
      console.error('=== Password reset error ===', error);
      return c.json({ error: 'Internal server error during password reset' }, 500);
    }
  });

  // Password reset callback verification endpoint
  app.post('/password-reset-verify', async c => {
    try {
      console.log('=== Password reset verify request ===');

      const { token, tokenHash, type } = await c.req.json();
      console.log('Verify request with:', { hasToken: !!token, hasTokenHash: !!tokenHash, type });

      if (!token && !tokenHash) {
        return c.json({ error: 'Reset token required' }, 400);
      }

      // Use anon key client for verification
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) {
        return c.json({ error: 'Authentication service not configured' }, 503);
      }

      const clientSupabase = createClient(Deno.env.get('SUPABASE_URL')!, anonKey);

      let verifyResult;

      if (tokenHash && type === 'recovery') {
        // New PKCE flow
        console.log('Using PKCE verification flow');
        verifyResult = await clientSupabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
      } else if (token) {
        // Legacy flow
        console.log('Using legacy verification flow');
        verifyResult = await clientSupabase.auth.verifyOtp({
          token,
          type: 'recovery',
        });
      } else {
        return c.json({ error: 'Invalid verification parameters' }, 400);
      }

      if (verifyResult.error) {
        console.error('Token verification failed:', verifyResult.error);

        if (verifyResult.error.message?.includes('expired')) {
          return c.json(
            { error: 'Reset link has expired. Please request a new password reset.' },
            400
          );
        } else {
          return c.json({ error: 'Invalid or expired reset link' }, 400);
        }
      }

      console.log('Token verification successful');

      return c.json({
        message: 'Reset token verified successfully',
        session: verifyResult.data.session,
      });
    } catch (error) {
      console.error('=== Password reset verify error ===', error);
      return c.json({ error: 'Internal server error during verification' }, 500);
    }
  });

  // Update password endpoint (after successful verification)
  app.post('/update-password', async c => {
    try {
      console.log('=== Update password request ===');

      const authHeader = c.req.header('Authorization');
      if (!authHeader) {
        return c.json({ error: 'Authorization required' }, 401);
      }

      const accessToken = authHeader.replace('Bearer ', '');
      const { newPassword } = await c.req.json();

      if (!newPassword || newPassword.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters long' }, 400);
      }

      // Use anon key client for password update
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) {
        return c.json({ error: 'Authentication service not configured' }, 503);
      }

      const clientSupabase = createClient(Deno.env.get('SUPABASE_URL')!, anonKey);

      // Set the session first
      const { data: sessionData, error: sessionError } =
        await clientSupabase.auth.getUser(accessToken);
      if (sessionError || !sessionData.user) {
        console.error('Invalid session for password update:', sessionError);
        return c.json({ error: 'Invalid or expired session' }, 401);
      }

      console.log('Updating password for user:', sessionData.user.id);

      // Update the password using the service role client (more reliable)
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        sessionData.user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Password update failed:', updateError);
        return c.json({ error: updateError.message || 'Failed to update password' }, 400);
      }

      console.log('Password updated successfully');

      return c.json({
        message: 'Password updated successfully',
      });
    } catch (error) {
      console.error('=== Update password error ===', error);
      return c.json({ error: 'Internal server error during password update' }, 500);
    }
  });

  return app;
}
