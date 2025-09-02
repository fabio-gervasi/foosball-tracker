#!/usr/bin/env node

import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_PROJECT_ID
  ? `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
  : process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const API_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Make authenticated API request
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Measure API response time
 */
async function measureResponseTime(endpoint, options = {}) {
  const startTime = Date.now();
  try {
    await makeRequest(endpoint, options);
    const endTime = Date.now();
    return endTime - startTime;
  } catch (error) {
    const endTime = Date.now();
    return { error: error.message, time: endTime - startTime };
  }
}

/**
 * Run performance tests
 */
async function runPerformanceTests() {
  console.log('🚀 Starting Performance Monitor for Relational Database\n');
  console.log('=' .repeat(60));

  const endpoints = [
    { name: 'User Data', endpoint: '/user-relational' },
    { name: 'Current Group', endpoint: '/groups/current-relational' },
    { name: 'All Users', endpoint: '/users-relational' },
    { name: 'All Matches', endpoint: '/matches-relational' },
    { name: 'User Groups', endpoint: '/groups/user-relational' },
  ];

  const results = [];
  let totalTime = 0;
  let successfulRequests = 0;

  for (const { name, endpoint } of endpoints) {
    console.log(`📊 Testing ${name}...`);
    const result = await measureResponseTime(endpoint);

    if (typeof result === 'number') {
      console.log(`   ✅ ${result}ms`);
      results.push({ name, time: result, success: true });
      totalTime += result;
      successfulRequests++;
    } else {
      console.log(`   ❌ ${result.time}ms - ${result.error}`);
      results.push({ name, time: result.time, success: false, error: result.error });
      totalTime += result.time;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📈 PERFORMANCE RESULTS');
  console.log('=' .repeat(60));

  console.log(`\n📊 Summary:`);
  console.log(`   Total Requests: ${endpoints.length}`);
  console.log(`   Successful: ${successfulRequests}`);
  console.log(`   Failed: ${endpoints.length - successfulRequests}`);
  console.log(`   Average Response Time: ${Math.round(totalTime / endpoints.length)}ms`);
  console.log(`   Total Time: ${totalTime}ms`);

  console.log(`\n📋 Detailed Results:`);
  results.forEach(({ name, time, success, error }) => {
    const status = success ? '✅' : '❌';
    const errorMsg = error ? ` (${error})` : '';
    console.log(`   ${status} ${name}: ${time}ms${errorMsg}`);
  });

  // Performance assessment
  const avgTime = totalTime / endpoints.length;
  console.log(`\n🎯 Performance Assessment:`);
  if (avgTime < 100) {
    console.log('   🟢 EXCELLENT: Sub-100ms average response times');
  } else if (avgTime < 200) {
    console.log('   🟡 GOOD: Sub-200ms average response times');
  } else if (avgTime < 500) {
    console.log('   🟠 FAIR: Sub-500ms average response times');
  } else {
    console.log('   🔴 SLOW: Over 500ms average response times');
  }

  console.log('\n🎉 Performance monitoring complete!');
  console.log('\n💡 Key Improvements with Relational Database:');
  console.log('   • Optimized SQL queries with proper indexing');
  console.log('   • Reduced data transformation overhead');
  console.log('   • Efficient JOIN operations');
  console.log('   • Database-level query optimization');

  return {
    results,
    summary: {
      totalRequests: endpoints.length,
      successful: successfulRequests,
      failed: endpoints.length - successfulRequests,
      averageTime: Math.round(totalTime / endpoints.length),
      totalTime,
    },
  };
}

// Run the performance tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Performance monitoring failed:', error);
      process.exit(1);
    });
}

export { runPerformanceTests };
