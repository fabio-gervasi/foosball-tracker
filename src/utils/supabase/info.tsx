/* Environment variables configuration - secure deployment */

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!projectId || !publicAnonKey) {
  throw new Error(
    'Missing required environment variables. Please check .env.example and configure your .env file.'
  );
}
