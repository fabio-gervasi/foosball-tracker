import * as kv from './kv_store.tsx';
import { INITIAL_ELO } from './server-constants.tsx';

// Migrate existing groups to have members array and create group-user relationships
export async function migrateGroupDataStructure() {
  try {
    console.log('=== Checking for group data migration ===');
    
    // Get all groups
    const groupPrefix = 'group:';
    const allGroups = await kv.getByPrefix(groupPrefix);
    
    for (const groupData of allGroups) {
      if (groupData && groupData.value && typeof groupData.value === 'object') {
        const group = groupData.value;
        const groupKey = groupData.key;
        
        // Skip if this is a lookup key (like group:name:something) or user relationship key
        if (groupKey.includes(':name:') || groupKey.includes(':user:')) {
          continue;
        }
        
        // Extract group code from key (format: "group:CODE")
        const groupCode = groupKey.replace('group:', '');
        
        if (!groupCode || !group.code) {
          console.warn('Skipping group with invalid code:', groupKey);
          continue;
        }
        
        console.log(`Processing group migration for: ${group.name} (${group.code})`);
        
        // Check if group has memberCount but no members array
        if (group.memberCount !== undefined && (!group.members || !Array.isArray(group.members))) {
          console.log(`Migrating group ${group.code} from memberCount to members array`);
          
          // Initialize empty members array
          group.members = [];
          
          // Remove old memberCount field
          delete group.memberCount;
          
          // Save the migrated group
          await kv.set(groupKey, group);
          console.log(`Group ${group.code} migrated to members array`);
        }
        
        // Ensure group has members array
        if (!group.members || !Array.isArray(group.members)) {
          group.members = [];
          await kv.set(groupKey, group);
        }
        
        // Now create group-user relationship entries for all users in this group
        // First find all users who claim to be in this group
        const userPrefix = 'user:';
        const allUsers = await kv.getByPrefix(userPrefix);
        const usersInGroup = [];
        
        for (const userData of allUsers) {
          if (userData && userData.value && typeof userData.value === 'object') {
            const user = userData.value;
            const userKey = userData.key;
            
            // Skip lookup keys
            if (userKey.includes(':username:') || userKey.includes(':email:')) {
              continue;
            }
            
            // Check if this user is in the current group
            if (user.currentGroup === group.code) {
              usersInGroup.push(user.id);
              
              // Create group-user relationship entry if it doesn't exist
              const relationshipKey = `group:${group.code}:user:${user.id}`;
              const existingRelationship = await kv.get(relationshipKey);
              
              if (!existingRelationship) {
                console.log(`Creating group-user relationship: ${relationshipKey}`);
                await kv.set(relationshipKey, user.id);
              }
            }
          }
        }
        
        // Update group members array if we found users not in the array
        let groupUpdated = false;
        for (const userId of usersInGroup) {
          if (!group.members.includes(userId)) {
            group.members.push(userId);
            groupUpdated = true;
            console.log(`Added user ${userId} to group ${group.code} members array`);
          }
        }
        
        if (groupUpdated) {
          group.memberCount = group.members.length;
          await kv.set(groupKey, group);
          console.log(`Updated group ${group.code} with ${group.members.length} members`);
        }
        
        console.log(`Group ${group.code} migration completed with ${usersInGroup.length} users`);
      }
    }
    
    console.log('=== Group data migration completed ===');
    
    // Run user profile migration after group migration
    await migrateUserProfiles();
    
  } catch (error) {
    console.error('=== Error during group data migration ===', error);
  }
}

// Migrate user profiles to ensure they have all required ELO fields
export async function migrateUserProfiles() {
  try {
    console.log('=== Checking for user profile migration ===');
    
    // Get all user profiles (not lookup keys)
    const userPrefix = 'user:';
    const allUsers = await kv.getByPrefix(userPrefix);
    
    for (const userData of allUsers) {
      if (userData && userData.value && typeof userData.value === 'object') {
        const user = userData.value;
        const userKey = userData.key;
        
        // Skip lookup keys
        if (userKey.includes(':username:') || userKey.includes(':email:')) {
          continue;
        }
        
        // Check if user needs migration
        let needsUpdate = false;
        const updatedUser = { ...user };
        
        // Ensure user has doublesElo field
        if (!updatedUser.doublesElo && updatedUser.doublesElo !== 0) {
          console.log(`Adding doublesElo field to user: ${user.username || user.name || user.id}`);
          updatedUser.doublesElo = INITIAL_ELO;
          needsUpdate = true;
        }
        
        // Ensure user has singlesElo field (for backward compatibility)
        if (!updatedUser.singlesElo && updatedUser.singlesElo !== 0) {
          console.log(`Adding singlesElo field to user: ${user.username || user.name || user.id}`);
          updatedUser.singlesElo = updatedUser.elo || INITIAL_ELO;
          needsUpdate = true;
        }
        
        // Ensure user has doubles wins/losses fields
        if (!updatedUser.doublesWins && updatedUser.doublesWins !== 0) {
          console.log(`Adding doublesWins field to user: ${user.username || user.name || user.id}`);
          updatedUser.doublesWins = 0;
          needsUpdate = true;
        }
        
        if (!updatedUser.doublesLosses && updatedUser.doublesLosses !== 0) {
          console.log(`Adding doublesLosses field to user: ${user.username || user.name || user.id}`);
          updatedUser.doublesLosses = 0;
          needsUpdate = true;
        }
        
        // Ensure user has singles wins/losses fields
        if (!updatedUser.singlesWins && updatedUser.singlesWins !== 0) {
          console.log(`Adding singlesWins field to user: ${user.username || user.name || user.id}`);
          updatedUser.singlesWins = updatedUser.wins || 0;
          needsUpdate = true;
        }
        
        if (!updatedUser.singlesLosses && updatedUser.singlesLosses !== 0) {
          console.log(`Adding singlesLosses field to user: ${user.username || user.name || user.id}`);
          updatedUser.singlesLosses = updatedUser.losses || 0;
          needsUpdate = true;
        }
        
        // Save updated user if changes were made
        if (needsUpdate) {
          await kv.set(userKey, updatedUser);
          console.log(`Updated user profile: ${user.username || user.name || user.id}`);
        }
      }
    }
    
    console.log('=== User profile migration completed ===');
  } catch (error) {
    console.error('=== Error during user profile migration ===', error);
  }
}