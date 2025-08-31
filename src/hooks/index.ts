/**
 * Custom Hooks Index
 *
 * Centralized exports for all custom hooks in the application.
 * This provides a clean import interface for components.
 */

// Core hooks
export { useAuth } from './useAuth';
export { useAppData } from './useAppData';

// API Request hooks
export { useApiRequest, useApiQuery } from './useApiRequest';

// Specialized hooks
export { usePermissions } from './usePermissions';
export { useMatchValidation } from './useMatchValidation';

// React Query hooks (re-export for consistency)
export {
  useUserQuery,
  useCurrentGroupQuery,
  useUsersQuery,
  useMatchesQuery,
  useUserGroupsQuery,
  useAppDataQueries,
  queryKeys,
} from './useQueries';

export {
  useSubmitMatchMutation,
  useUpdateProfileMutation,
  useGroupSwitchMutation,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useRefreshDataMutation,
} from './useMutations';

// Types
export type { UseAuthReturn } from './useAuth';
export type { ProfileUpdateData, Permission } from '../types';
export type { UseAppDataReturn } from './useAppData';
export type { UseApiRequestReturn, ApiRequestOptions } from './useApiRequest';
export type { UsePermissionsReturn, PermissionLevel } from './usePermissions';
export type {
  UseMatchValidationReturn,
  ValidationResult,
  ValidationError,
  Player,
  MatchValidationData,
} from './useMatchValidation';
// User type is exported from main types file
export type { User, UserStats, Match, Group } from '../types';

// Error handling types
export type {
  UserFriendlyError,
  ValidationError as APIValidationError,
  NetworkError,
} from '../utils/errorHandler';
