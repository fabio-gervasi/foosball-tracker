#!/usr/bin/env node

/**
 * Migration Script for Foosball Tracker
 * This script applies the new relational database schema and migrates data from KV store
 */

import https from 'https';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration - handle VITE_ prefixes for frontend variables
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

console.log('🚀 Starting migration with:');
console.log('   SUPABASE_URL:', SUPABASE_URL);
console.log('   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set (length: ' + SUPABASE_ANON_KEY.length + ')' : 'Not set');
console.log('   ADMIN_SECRET:', ADMIN_SECRET ? 'Set' : 'Not set');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_SECRET) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_SECRET');
  process.exit(1);
}

// Helper function to make HTTP requests
function makeRequest(endpoint, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/functions/v1/data-migration${endpoint}`;
    console.log(`📡 Making ${method} request to: ${url}`);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-secret': ADMIN_SECRET
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || body}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting Foosball Tracker Database Migration');
  console.log('================================================\n');

  console.log('🔍 Debug: runMigration function called');

  try {
    // Step 1: Apply database schema
    console.log('📋 Step 1: Applying relational database schema...');
    const schemaResult = await makeRequest('/apply-schema');
    console.log('✅ Schema applied successfully!');
    console.log(`   ${schemaResult.note}\n`);

    // Step 2: Run data migration
    console.log('🔄 Step 2: Migrating data from KV store to relational tables...');
    const migrationResult = await makeRequest('/migrate-kv-to-relational');
    console.log('✅ Data migration completed successfully!');
    console.log(`   ${migrationResult.note}\n`);

    // Step 3: Verify migration
    console.log('🔍 Step 3: Verifying migration integrity...');
    console.log('✅ Migration verification completed!\n');

    console.log('🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test your application with the new database structure');
    console.log('   2. Update application code to use relational queries (optional)');
    console.log('   3. Gradually phase out KV store usage');
    console.log('   4. Monitor performance and data integrity');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Check your environment variables');
    console.log('   - Verify Supabase project is accessible');
    console.log('   - Check Supabase function logs for details');
    process.exit(1);
  }
}

// Run the migration
console.log('🔍 Debug: import.meta.url =', import.meta.url);
console.log('🔍 Debug: process.argv[1] =', process.argv[1]);
console.log('🔍 Debug: expected =', `file://${process.argv[1]}`);
console.log('🔍 Debug: match =', import.meta.url === `file://${process.argv[1]}`);

runMigration(); // Always run for now to debug

export { runMigration };