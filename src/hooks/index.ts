/**
 * Custom Hooks Index
 *
 * Centralized exports for all custom hooks in the application.
 * This provides a clean import interface for components.
 */

// Core hooks
export { useAuth } from './useAuth';
export { useAppData } from './useAppData';

// Specialized hooks
export { usePermissions } from './usePermissions';
export { useMatchValidation } from './useMatchValidation';
export {
  useLocalStorage,
  useUserPreferences,
  useThemePreferences,
  useFormStorage,
  useRecentItems
} from './useLocalStorage';

// React Query hooks (re-export for consistency)
export {
  useUserQuery,
  useCurrentGroupQuery,
  useUsersQuery,
  useMatchesQuery,
  useUserGroupsQuery,
  useAppDataQueries,
  queryKeys
} from './useQueries';

export {
  useSubmitMatchMutation,
  useUpdateProfileMutation,
  useGroupSwitchMutation,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useRefreshDataMutation
} from './useMutations';

// Types
export type { UseAuthReturn, ProfileUpdateData, Permission } from './useAuth';
export type { UseAppDataReturn, MatchData, ProfileData, GroupData, UserStats } from './useAppData';
export type { UsePermissionsReturn, PermissionLevel } from './usePermissions';
export type { UseMatchValidationReturn, ValidationResult, ValidationError, Player, MatchValidationData } from './useMatchValidation';
export type { UseLocalStorageReturn, LocalStorageOptions } from './useLocalStorage';
