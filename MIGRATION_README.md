# Foosball Tracker Database Migration Guide

## Overview

This guide walks you through migrating your Foosball Tracker from a KV store (JSON-based) to a relational database structure. The migration provides better performance, data integrity, and scalability.

## Migration Benefits

✅ **Data Integrity**: Foreign keys prevent orphaned records
✅ **Performance**: Proper indexing for fast queries
✅ **Type Safety**: Database schema matches your application types
✅ **Scalability**: Handles much larger datasets efficiently
✅ **Maintainability**: Clear, normalized structure

## Migration Steps

### Phase 1: Preparation (✅ Completed)

1. **Database Schema**: Created relational tables
2. **Migration Scripts**: Built data transformation functions
3. **TypeScript Types**: Updated to match new schema
4. **Hybrid Hooks**: Created fallback system
5. **API Endpoints**: Added relational query support

### Phase 2: Execution

#### Step 1: Test Current System
```bash
npm run migrate:test
```
This verifies that:
- Server is running
- Environment variables are configured
- Migration endpoints are accessible

#### Step 2: Apply Database Schema
```bash
# Via API call (recommended)
curl -X POST https://your-project.supabase.co/functions/v1/data-migration/apply-schema \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

This creates the following tables:
- `users` - User profiles with ELO ratings
- `groups` - Foosball groups/organizations
- `user_groups` - User-group membership junction
- `matches` - Match records
- `match_players` - Players in each match
- `match_results` - Game results within matches
- `elo_changes` - ELO rating changes

#### Step 3: Migrate Data
```bash
# Via API call
curl -X POST https://your-project.supabase.co/functions/v1/data-migration/migrate-kv-to-relational \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

This transforms your existing JSON data into the relational structure.

#### Step 4: Switch Application Mode

**Option A: Hybrid Mode (Recommended)**
```bash
# Set in .env file
REACT_APP_MIGRATION_MODE=hybrid
```

**Option B: Full Relational Mode**
```bash
# Set in .env file
REACT_APP_MIGRATION_MODE=relational
```

**Option C: Stay on KV Store**
```bash
# Set in .env file
REACT_APP_MIGRATION_MODE=kv
```

### Phase 3: Validation

#### Test Application Functionality
1. Login and verify user data loads correctly
2. Check group membership and permissions
3. Create/view matches and verify data integrity
4. Test ELO calculations and statistics

#### Performance Testing
```bash
npm run ci:performance-budget
```

#### Data Integrity Check
Verify that:
- All users migrated successfully
- Group memberships preserved
- Match history intact
- ELO ratings accurate
- No orphaned records

## Migration Modes

### KV Store Mode
- Uses original JSON-based storage
- Proven, stable, but limited scalability
- Good fallback option

### Relational Mode
- Uses new structured database
- Best performance and scalability
- Requires successful migration

### Hybrid Mode (Recommended)
- Automatically uses best available system
- Falls back to KV store if relational fails
- Smooth transition experience

## Troubleshooting

### Migration Fails
```bash
# Rollback to KV store
npm run migrate:rollback

# Or emergency recovery
npm run migrate:emergency
```

### Performance Issues
```bash
# Switch back to KV store temporarily
REACT_APP_MIGRATION_MODE=kv
npm run build
npm run deploy:preview
```

### Data Issues
```bash
# Check migration logs
# Verify Supabase function logs
# Run data integrity queries
```

## Rollback Plan

### Automatic Rollback
The application automatically falls back to KV store if relational queries fail.

### Manual Rollback
```bash
npm run migrate:rollback
```

### Emergency Recovery
```bash
npm run migrate:emergency
```

## Environment Variables

Required for migration:
```bash
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
ADMIN_SECRET=your-admin-secret
REACT_APP_MIGRATION_MODE=hybrid  # kv | relational | hybrid
```

## Migration Checklist

- [ ] Environment variables configured
- [ ] Server health check passed
- [ ] Database schema applied
- [ ] Data migration completed
- [ ] Application mode set
- [ ] Functionality tested
- [ ] Performance validated
- [ ] Data integrity verified
- [ ] Rollback plan documented

## Support

If you encounter issues:
1. Check Supabase function logs
2. Verify environment variables
3. Test with hybrid mode first
4. Use rollback if needed
5. Contact development team with migration logs

## Next Steps

After successful migration:
1. Monitor performance metrics
2. Gradually increase load testing
3. Consider cleanup of old KV data (after 30-day verification period)
4. Update documentation for new features
5. Plan for future scalability improvements

---

**Migration Status**: Ready for execution
**Estimated Downtime**: Minimal (application continues working during migration)
**Rollback Time**: Immediate (automatic fallback)
**Risk Level**: Low (comprehensive fallback system)
