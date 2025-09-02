/* MIGRATION NOTICE - KV STORE DEPRECATED */
/*
 * This KV store module has been deprecated in favor of the relational database.
 * All data has been migrated to structured tables for better performance and scalability.
 *
 * If you need to access KV store functionality, use the relational API endpoints instead:
 *
 * Users: /user-relational, /users-relational
 * Groups: /groups/current-relational, /groups/user-relational
 * Matches: /matches-relational
 *
 * For migration assistance, see: MIGRATION_README.md
 */

// Export empty functions that throw helpful migration errors
export const set = async (key: string, value: any): Promise<void> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Key: ${key}`);
};

export const get = async (key: string): Promise<any> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Key: ${key}`);
};

export const del = async (key: string): Promise<void> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Key: ${key}`);
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Keys: ${keys.join(', ')}`);
};

export const mget = async (keys: string[]): Promise<any[]> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Keys: ${keys.join(', ')}`);
};

export const mdel = async (keys: string[]): Promise<void> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Keys: ${keys.join(', ')}`);
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  throw new Error(`KV Store has been deprecated. Use relational database instead. Prefix: ${prefix}`);
};

// Migration helper
export const MIGRATION_GUIDE = {
  status: 'completed',
  message: 'KV store has been successfully migrated to relational database',
  endpoints: {
    users: '/user-relational',
    allUsers: '/users-relational',
    currentGroup: '/groups/current-relational',
    userGroups: '/groups/user-relational',
    matches: '/matches-relational',
  },
};
