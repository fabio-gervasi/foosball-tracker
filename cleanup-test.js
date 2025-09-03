// Test script for cleanup endpoint
// Run this in browser console while logged in as admin

async function testCleanup() {
  try {
    console.log('🔄 Testing cleanup endpoint...');

    const response = await fetch('https://eezimywnyqzbtqqwbqqr.supabase.co/functions/v1/api-working/admin/cleanup-matches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log('Response:', data);

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testCleanup();
