// Migration script to fix winner_email for existing matches
// Run this in the browser console while logged in as admin

async function migrateWinners() {
  try {
    console.log('🔄 Starting winner migration...');

    const response = await fetch('https://eezimywnyqzbtqqwbqqr.supabase.co/functions/v1/api-working/admin/migrate-winners', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization header will be automatically added by the browser
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Migration completed!');
      console.log(`📊 ${data.migratedCount} matches updated out of ${data.totalMatchesFound} found`);
      console.log('📋 Migration results:', data.migrationResults);
    } else {
      console.error('❌ Migration failed:', data.error, data.message);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Call the migration function
migrateWinners();
