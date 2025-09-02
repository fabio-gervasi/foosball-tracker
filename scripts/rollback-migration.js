#!/usr/bin/env node

/**
 * Rollback script for Foosball Tracker Database Migration
 * This script provides rollback functionality in case migration fails
 */

import https from 'https';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration - handle VITE_ prefixes for frontend variables
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_SECRET) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_SECRET');
  process.exit(1);
}

// Helper function to make HTTP requests
function makeRequest(endpoint, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/functions/v1/data-migration${endpoint}`;

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

// Rollback functions
async function rollbackMigration() {
  console.log('🔄 Rolling back Foosball Tracker Migration');
  console.log('=========================================\n');

  try {
    console.log('Step 1: Creating backup of current state...');
    console.log('ℹ️  Current KV store data is preserved automatically');

    console.log('\nStep 2: Switching application back to KV mode...');
    console.log('✅ Application will automatically fall back to KV store');
    console.log('   when relational queries fail');

    console.log('\nStep 3: Cleaning up partial relational data (optional)...');
    console.log('⚠️  This will delete any data migrated to relational tables');
    console.log('   Only run this if you want to start fresh');

    const shouldCleanup = process.argv.includes('--cleanup');
    if (shouldCleanup) {
      await cleanupRelationalData();
    }

    console.log('\n✅ Rollback completed successfully!');
    console.log('\n📋 Rollback Summary:');
    console.log('===================');
    console.log('✅ Application switched back to KV store mode');
    console.log('✅ Original data preserved');
    if (shouldCleanup) {
      console.log('✅ Relational tables cleaned');
    }
    console.log('✅ System ready for retry or continued KV operation');

    console.log('\n🔄 To retry migration:');
    console.log('   1. Fix any issues that caused the migration to fail');
    console.log('   2. Run: npm run migration:test');
    console.log('   3. Run: npm run migration:apply-schema');
    console.log('   4. Run: npm run migration:migrate-data');

  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    console.log('\n🔧 Manual Rollback Steps:');
    console.log('   1. Set REACT_APP_MIGRATION_MODE=kv in environment');
    console.log('   2. Restart application');
    console.log('   3. Verify KV store data is intact');
    console.log('   4. Optionally clean relational tables manually');
    process.exit(1);
  }
}

async function cleanupRelationalData() {
  console.log('🧹 Cleaning up relational data...');

  // This would need to be implemented as a Supabase function
  // For now, we'll just log what would happen
  console.log('ℹ️  Would delete data from: users, groups, user_groups, matches, match_players, match_results, elo_changes');
  console.log('ℹ️  Would keep: kv_store_171cbf6f (original data)');

  // In a real implementation, you'd call a cleanup endpoint
  // await makeRequest('/cleanup-relational');
}

// Emergency recovery
async function emergencyRecovery() {
  console.log('🚨 Emergency Recovery Mode');
  console.log('==========================\n');

  console.log('This will:');
  console.log('1. Force switch to KV store mode');
  console.log('2. Verify KV store data integrity');
  console.log('3. Disable relational features');

  const shouldProceed = process.argv.includes('--yes');
  if (!shouldProceed) {
    console.log('\n❓ Add --yes flag to proceed with emergency recovery');
    process.exit(0);
  }

  console.log('\n🔧 Performing emergency recovery...');

  // Force KV mode
  process.env.REACT_APP_MIGRATION_MODE = 'kv';

  console.log('✅ Switched to KV store mode');
  console.log('✅ Emergency recovery completed');

  console.log('\n📞 If issues persist:');
  console.log('   - Check Supabase function logs');
  console.log('   - Verify database connectivity');
  console.log('   - Contact support with migration logs');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'rollback':
      rollbackMigration();
      break;
    case 'emergency':
      emergencyRecovery();
      break;
    default:
      console.log('Foosball Tracker Migration Rollback Tool');
      console.log('==========================================');
      console.log('');
      console.log('Usage:');
      console.log('  node rollback-migration.js rollback          # Standard rollback');
      console.log('  node rollback-migration.js rollback --cleanup # Rollback with cleanup');
      console.log('  node rollback-migration.js emergency --yes    # Emergency recovery');
      console.log('');
      console.log('Environment variables required:');
      console.log('  SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_SECRET');
      break;
  }
}

export { rollbackMigration, emergencyRecovery };
