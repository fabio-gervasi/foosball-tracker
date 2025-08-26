
# Foosball Tracker

This is a code bundle for Foosball Tracker. The original project is available at https://www.figma.com/design/lMAFQUTLD6AJctTedpoxAr/Foosball-Tracker.

## Environment Setup

Before running the application, you need to configure your environment variables:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Supabase credentials:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy your Project Reference ID to `VITE_SUPABASE_PROJECT_ID`
   - Copy your anon/public key to `VITE_SUPABASE_ANON_KEY`

3. Save the `.env` file

**Important**: The application will fail to start if these environment variables are not properly configured.

## Running the code

1. Install dependencies:
   ```bash
   npm i
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

The application will fail with a helpful error message if environment variables are missing.
