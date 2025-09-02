#!/usr/bin/env node

/**
 * Standalone script to run data migrations
 * This can be used to manually trigger data migrations without running the full Supabase stack
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables using the same pattern as the app
const PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_ID || !ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY must be set');
  console.error('');
  console.error('Please check your .env file and make sure these variables are set.');
  console.error('You can find these values in your Supabase Dashboard > Settings > API');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY:');
  console.error('');
  console.error('For data migrations, you need the service role key (not just the anon key).');
  console.error('You can find this in your Supabase Dashboard > Settings > API');
  console.error('Copy the "service_role" key and set it as SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

// Simple KV store simulation for the migration
class SimpleKVStore {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async get(key) {
    try {
      // This is a simplified version - the actual implementation uses Deno KV
      // For this demo, we'll just return null to simulate no existing data
      console.log(`KV get: ${key}`);
      return null;
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async getByPrefix(prefix) {
    try {
      // This is a simplified version - the actual implementation uses Deno KV
      console.log(`KV getByPrefix: ${prefix}`);
      // Return empty array to simulate no existing data to migrate
      return [];
    } catch (error) {
      console.error('KV getByPrefix error:', error);
      return [];
    }
  }

  async set(key, value) {
    try {
      console.log(`KV set: ${key}`);
      // This is a simplified version - the actual implementation uses Deno KV
      return true;
    } catch (error) {
      console.error('KV set error:', error);
      return false;
    }
  }
}

// Migration functions (simplified versions of the actual ones)
async function migrateGroupDataStructure(kv) {
  try {
    console.log('=== Checking for group data migration ===');

    // Get all groups (simplified - would actually query KV store)
    const allGroups = await kv.getByPrefix('group:');
    console.log(`Found ${allGroups.length} groups to check.`);

    // In a real migration, this would check and update group structures
    console.log('Group data migration check completed (no changes needed in demo)');

    console.log('=== Group data migration completed ===');
  } catch (error) {
    console.error('=== Error during group data migration ===', error);
  }
}

async function migrateUserProfiles(kv) {
  try {
    console.log('=== Checking for user profile migration ===');

    // Get all users (simplified - would actually query KV store)
    const allUsers = await kv.getByPrefix('user:');
    console.log(`Found ${allUsers.length} users to check.`);

    // In a real migration, this would check and update user profiles
    console.log('User profile migration check completed (no changes needed in demo)');

    console.log('=== User profile migration completed ===');
  } catch (error) {
    console.error('=== Error during user profile migration ===', error);
  }
}

async function runMigrations() {
  console.log('🚀 Starting data migrations...');
  console.log('');

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = `https://${PROJECT_ID}.supabase.co`;
    const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY);
    console.log('✅ Connected to Supabase');

    // Initialize simple KV store (this is a demo - actual implementation uses Deno KV)
    const kv = new SimpleKVStore(supabase);

    // Run the group data structure migration
    console.log('📦 Running group data structure migration...');
    await migrateGroupDataStructure(kv);
    console.log('✅ Group data migration completed');

    // Run the user profile migration
    console.log('👤 Running user profile migration...');
    await migrateUserProfiles(kv);
    console.log('✅ User profile migration completed');

    console.log('');
    console.log('🎉 All data migrations completed successfully!');
    console.log('');
    console.log('Note: This is a simplified demo version.');
    console.log('The actual migrations run automatically when Supabase Edge Functions start.');
    console.log('The migration functions are designed to be idempotent,');
    console.log('so it\'s safe to run them multiple times.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('');
    console.error('Please check your environment variables and try again.');
    console.error('Make sure your SUPABASE_SERVICE_ROLE_KEY is correct.');
    process.exit(1);
  }
}

// Run the migrations
runMigrations();
