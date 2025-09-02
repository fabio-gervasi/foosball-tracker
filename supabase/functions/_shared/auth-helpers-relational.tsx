import { createClient } from 'npm:@supabase/supabase-js@2';

// Helper to validate user authorization for protected endpoints (relational version)
export async function validateUserAuth(c: any, supabase: any) {
  console.log('=== Starting validateUserAuth (relational) ===');

  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header:', authHeader ? 'present but invalid format' : 'missing');
    return {
      error: 'Unauthorized',
      status: 401,
    };
  }

  const accessToken = authHeader.split(' ')[1];
  if (!accessToken) {
    console.error('No access token in Authorization header');
    return {
      error: 'Unauthorized',
      status: 401,
    };
  }

  console.log('Token received - length:', accessToken.length, 'starts with:', `${accessToken.substring(0, 20)}...`);

  // For real JWT tokens, validate with Supabase
  console.log('Processing real JWT token...');

  // First, try with the anon key client
  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) {
      console.error('SUPABASE_ANON_KEY not configured');
      return {
        error: 'Authentication service unavailable',
        status: 503,
      };
    }

    console.log('Creating client with anon key for JWT validation...');
    const clientSupabase = createClient(Deno.env.get('SUPABASE_URL'), anonKey);

    console.log('Attempting JWT validation with anon client...');
    const { data: { user }, error } = await clientSupabase.auth.getUser(accessToken);

    if (error) {
      console.log('Anon client validation failed:', error.message, 'Status:', error.status);
      
      // Try with service role client as fallback
      console.log('Trying service role client as fallback...');
      try {
        const { data: serviceData, error: serviceError } = await supabase.auth.getUser(accessToken);
        if (serviceError || !serviceData.user) {
          console.error('Service role validation also failed:', serviceError?.message);
          return {
            error: 'Invalid JWT',
            status: 401,
          };
        }
        console.log('Service role validation successful for user:', serviceData.user.id);
        return {
          user: serviceData.user,
        };
      } catch (serviceException) {
        console.error('Service role validation exception:', serviceException.message);
        return {
          error: 'Invalid JWT',
          status: 401,
        };
      }
    }

    if (!user) {
      console.error('Anon client returned no user data');
      return {
        error: 'Invalid JWT',
        status: 401,
      };
    }

    console.log('Anon client validation successful for user:', user.id);
    return {
      user,
    };
  } catch (error) {
    console.error('JWT validation exception:', error.message);
    
    // Final fallback attempt with service role
    try {
      console.log('Final fallback with service role client...');
      const { data: { user }, error: finalError } = await supabase.auth.getUser(accessToken);
      if (finalError || !user) {
        console.error('Final fallback failed:', finalError?.message);
        return {
          error: 'JWT validation failed',
          status: 401,
        };
      }
      console.log('Final fallback successful for user:', user.id);
      return {
        user,
      };
    } catch (finalException) {
      console.error('All validation attempts failed:', finalException.message);
      return {
        error: 'JWT validation failed',
        status: 401,
      };
    }
  }
}

// Helper to validate admin authorization (relational version)
export async function validateAdminAuth(c: any, supabase: any) {
  const authResult = await validateUserAuth(c, supabase);
  if (authResult.error) {
    return authResult;
  }

  // Get user profile from relational database
  const { data: userProfile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authResult.user.id)
    .single();

  if (error || !userProfile) {
    return {
      error: 'User profile not found',
      status: 404,
    };
  }

  if (!userProfile.is_admin) {
    return {
      error: 'Admin access required',
      status: 403,
    };
  }

  return {
    user: authResult.user,
    userProfile,
  };
}
