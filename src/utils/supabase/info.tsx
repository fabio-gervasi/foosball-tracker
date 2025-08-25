/* Updated to use environment variables for secure deployment */

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "eezimywnyqzbtqqwbqqr"
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlemlteXdueXF6YnRxcXdicXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3OTE5MjYsImV4cCI6MjA3MTM2NzkyNn0.WjocfbV5d7OJ_-LJBsT5248uXRfp9yL-2ZHmOSbJD0k"
