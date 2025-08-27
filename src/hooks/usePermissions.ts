import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { logger } from '../utils/logger';

// Permission types
export type Permission =
  | 'admin'
  | 'manage_users'
  | 'manage_groups'
  | 'view_admin_panel'
  | 'delete_matches'
  | 'edit_user_profiles'
  | 'create_groups'
  | 'join_groups'
  | 'switch_groups'
  | 'view_statistics'
  | 'submit_matches';

// Permission levels
export enum PermissionLevel {
  GUEST = 0,
  MEMBER = 1,
  ADMIN = 2,
  SUPER_ADMIN = 3
}

export interface UsePermissionsReturn {
  // Basic permissions
  isAdmin: boolean;
  canManageUsers: boolean;
  canManageGroups: boolean;
  canViewAdminPanel: boolean;
  canDeleteMatches: boolean;
  canEditUserProfiles: boolean;

  // Group permissions
  canCreateGroups: boolean;
  canJoinGroups: boolean;
  canSwitchGroups: boolean;

  // Data permissions
  canViewStatistics: boolean;
  canSubmitMatches: boolean;

  // Utility functions
  hasPermission: (permission: Permission) => boolean;
  getPermissionLevel: () => PermissionLevel;
  canAccessRoute: (route: string) => boolean;

  // Permission checks with reasons
  checkPermission: (permission: Permission) => { allowed: boolean; reason?: string };
}

/**
 * Centralized permission management hook
 * Provides granular permission checking for different user roles and actions
 */
export const usePermissions = (): UsePermissionsReturn => {
  const { currentUser, isLoggedIn } = useAuth();

  // Basic permission calculations
  const isAdmin = useMemo((): boolean => {
    return currentUser?.isAdmin === true;
  }, [currentUser]);

  // Individual permission calculations
  const canManageUsers = useMemo((): boolean => {
    return isAdmin;
  }, [isAdmin]);

  const canManageGroups = useMemo((): boolean => {
    return isAdmin;
  }, [isAdmin]);

  const canViewAdminPanel = useMemo((): boolean => {
    return isAdmin;
  }, [isAdmin]);

  const canDeleteMatches = useMemo((): boolean => {
    return isAdmin;
  }, [isAdmin]);

  const canEditUserProfiles = useMemo((): boolean => {
    // Users can edit their own profile, admins can edit any profile
    return isLoggedIn;
  }, [isLoggedIn]);

  const canCreateGroups = useMemo((): boolean => {
    return isLoggedIn; // Any logged-in user can create groups
  }, [isLoggedIn]);

  const canJoinGroups = useMemo((): boolean => {
    return isLoggedIn; // Any logged-in user can join groups
  }, [isLoggedIn]);

  const canSwitchGroups = useMemo((): boolean => {
    return isLoggedIn; // Any logged-in user can switch between their groups
  }, [isLoggedIn]);

  const canViewStatistics = useMemo((): boolean => {
    return isLoggedIn; // Any logged-in user can view statistics
  }, [isLoggedIn]);

  const canSubmitMatches = useMemo((): boolean => {
    return isLoggedIn && !!currentUser?.currentGroup; // Must be logged in and have a current group
  }, [isLoggedIn, currentUser]);

  // General permission checker
  const hasPermission = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!isLoggedIn) {
        logger.debug('Permission denied: not logged in', { permission });
        return false;
      }

      switch (permission) {
        case 'admin':
        case 'manage_users':
        case 'manage_groups':
        case 'view_admin_panel':
        case 'delete_matches':
          return isAdmin;

        case 'edit_user_profiles':
        case 'create_groups':
        case 'join_groups':
        case 'switch_groups':
        case 'view_statistics':
          return isLoggedIn;

        case 'submit_matches':
          return isLoggedIn && !!currentUser?.currentGroup;

        default:
          logger.warn('Unknown permission requested', { permission });
          return false;
      }
    };
  }, [isLoggedIn, isAdmin, currentUser]);

  // Get user permission level
  const getPermissionLevel = useMemo(() => {
    return (): PermissionLevel => {
      if (!isLoggedIn) return PermissionLevel.GUEST;
      if (isAdmin) return PermissionLevel.ADMIN;
      return PermissionLevel.MEMBER;
    };
  }, [isLoggedIn, isAdmin]);

  // Route-based access control
  const canAccessRoute = useMemo(() => {
    return (route: string): boolean => {
      const normalizedRoute = route.toLowerCase().replace(/^\//, '');

      switch (normalizedRoute) {
        case '':
        case 'login':
        case 'signup':
          return true; // Public routes

        case 'dashboard':
        case 'profile':
        case 'statistics':
        case 'leaderboard':
        case 'match-history':
          return isLoggedIn;

        case 'match-entry':
          return canSubmitMatches;

        case 'admin':
        case 'admin-panel':
          return canViewAdminPanel;

        default:
          // Default to requiring login for unknown routes
          return isLoggedIn;
      }
    };
  }, [isLoggedIn, canSubmitMatches, canViewAdminPanel]);

  // Permission check with detailed reason
  const checkPermission = useMemo(() => {
    return (permission: Permission): { allowed: boolean; reason?: string } => {
      if (!isLoggedIn) {
        return {
          allowed: false,
          reason: 'Authentication required'
        };
      }

      const allowed = hasPermission(permission);

      if (!allowed) {
        switch (permission) {
          case 'admin':
          case 'manage_users':
          case 'manage_groups':
          case 'view_admin_panel':
          case 'delete_matches':
            return {
              allowed: false,
              reason: 'Administrator privileges required'
            };

          case 'submit_matches':
            if (!currentUser?.currentGroup) {
              return {
                allowed: false,
                reason: 'Must be a member of a group to submit matches'
              };
            }
            break;

          default:
            return {
              allowed: false,
              reason: 'Insufficient permissions'
            };
        }
      }

      return { allowed: true };
    };
  }, [isLoggedIn, hasPermission, currentUser]);

  return {
    // Basic permissions
    isAdmin,
    canManageUsers,
    canManageGroups,
    canViewAdminPanel,
    canDeleteMatches,
    canEditUserProfiles,

    // Group permissions
    canCreateGroups,
    canJoinGroups,
    canSwitchGroups,

    // Data permissions
    canViewStatistics,
    canSubmitMatches,

    // Utility functions
    hasPermission,
    getPermissionLevel,
    canAccessRoute,
    checkPermission,
  };
};
