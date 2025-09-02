#!/usr/bin/env node

/**
 * Debug script to check production environment and API endpoints
 */

import { config } from 'dotenv';
import https from 'https';

// Load environment variables
config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

console.log('🔍 Production Debug Check');
console.log('==========================');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('ADMIN_SECRET:', ADMIN_SECRET ? '✅ Set' : '❌ Missing');
console.log('REACT_APP_MIGRATION_MODE:', process.env.REACT_APP_MIGRATION_MODE || '❌ Not set (defaults to kv)');
console.log('');

// Test API endpoints
async function testEndpoint(endpoint, description) {
  return new Promise((resolve) => {
    const url = `${SUPABASE_URL}/functions/v1/api${endpoint}`;

    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-secret': ADMIN_SECRET
      }
    };

    console.log(`Testing ${description}: ${endpoint}`);

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ ${description}: ${res.statusCode} - OK`);
            resolve({ success: true, response });
          } else {
            console.log(`❌ ${description}: ${res.statusCode} - ${response.error || body}`);
            resolve({ success: false, response });
          }
        } catch (e) {
          console.log(`❌ ${description}: ${res.statusCode} - Parse error: ${body}`);
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description}: Network error - ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(10000, () => {
      console.log(`❌ ${description}: Timeout after 10s`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

// Test endpoints
async function runTests() {
  console.log('🧪 Testing API Endpoints');
  console.log('========================');

  // Test simple root endpoint first
  console.log('Testing simple root endpoint...');
  await testEndpoint('/test', 'Simple Root Test');

  // Test basic debug endpoint first
  console.log('Testing basic debug endpoint...');
  await testEndpoint('/make-server-171cbf6f/debug', 'Basic Debug');

  // Test basic health check first
  console.log('Testing basic health endpoint...');
  await testEndpoint('/make-server-171cbf6f/simple-health', 'Health Check');

  console.log('');

  // Test old KV endpoints
  await testEndpoint('/make-server-171cbf6f/user', 'KV User endpoint');
  await testEndpoint('/make-server-171cbf6f/users', 'KV Users endpoint');
  await testEndpoint('/make-server-171cbf6f/groups/current', 'KV Current Group endpoint');

  console.log('');

  // Test new relational endpoints
  await testEndpoint('/make-server-171cbf6f/user-relational', 'Relational User endpoint');
  await testEndpoint('/make-server-171cbf6f/users-relational', 'Relational Users endpoint');
  await testEndpoint('/make-server-171cbf6f/groups/current-relational', 'Relational Current Group endpoint');

  console.log('');
  console.log('💡 Analysis:');
  console.log('If basic health check fails, the Supabase function is not deployed correctly.');
  console.log('If health check works but relational endpoints fail, the database may not be migrated.');
  console.log('If all endpoints fail, there may be an authentication or routing issue.');
}

runTests().catch(console.error);
