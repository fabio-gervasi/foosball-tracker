/**
 * Component Prop Interfaces for Foosball Tracker
 *
 * This file contains reusable prop interfaces that provide consistency
 * across components and reduce duplication. Uses inheritance patterns
 * to create a hierarchy of prop types.
 */

import type { ReactNode } from 'react';
import type {
  User,
  Group,
  Match,
  UserStats,
  LoadingState,
  ValidationError,
  Permission,
  MatchSubmissionData,
  ProfileUpdateData,
} from './index';

// =============================================================================
// BASE COMPONENT PROPS
// =============================================================================

/**
 * Base props that most authenticated components need
 */
export interface BaseComponentProps {
  /** Current authenticated user */
  currentUser: User;
  /** Access token for API requests */
  accessToken: string;
  /** Current group context */
  group: Group | null;
}

/**
 * Props for components that need loading state
 */
export interface LoadingComponentProps {
  /** Loading state */
  loading?: boolean;
  /** Custom loading message */
  loadingMessage?: string;
  /** Loading state object with more details */
  loadingState?: LoadingState;
}

/**
 * Props for components that handle errors
 */
export interface ErrorComponentProps {
  /** Error message to display */
  error?: string | null;
  /** Callback when error is cleared/dismissed */
  onError?: (error: string) => void;
  /** Callback to clear error */
  onClearError?: () => void;
}

/**
 * Combined base props with common functionality
 */
export interface StandardComponentProps
  extends BaseComponentProps,
          LoadingComponentProps,
          ErrorComponentProps {
  /** Optional className for styling */
  className?: string;
  /** Optional children */
  children?: ReactNode;
}

// =============================================================================
// DATA COMPONENT PROPS
// =============================================================================

/**
 * Props for components that work with user data
 */
export interface DataComponentProps extends BaseComponentProps {
  /** List of users in current group */
  users: User[];
  /** List of matches in current group */
  matches: Match[];
  /** Callback when data changes and needs refresh */
  onDataChange?: () => void;
  /** Callback for data refresh */
  onRefresh?: () => Promise<void>;
}

/**
 * Props for components that display statistics
 */
export interface StatsComponentProps extends BaseComponentProps {
  /** User statistics data */
  userStats?: UserStats;
  /** Group-wide statistics */
  groupStats?: {
    totalMatches: number;
    totalPlayers: number;
    averageElo: number;
    topPlayer?: User;
  };
}

/**
 * Props for match-related components
 */
export interface MatchComponentProps extends BaseComponentProps {
  /** Match data */
  match?: Match;
  /** List of matches */
  matches?: Match[];
  /** Available users for match creation */
  availableUsers?: User[];
  /** Callback when match is submitted */
  onMatchSubmit?: (data: MatchSubmissionData) => Promise<void>;
  /** Callback when match is deleted */
  onMatchDelete?: (matchId: string) => Promise<void>;
}

// =============================================================================
// ADMIN COMPONENT PROPS
// =============================================================================

/**
 * Base props for admin components
 */
export interface AdminComponentProps extends BaseComponentProps {
  /** Whether user has admin permissions */
  isAdmin: boolean;
  /** Callback for error handling */
  onError: (error: string) => void;
  /** Loading state for admin operations */
  loading?: boolean;
}

/**
 * Props for user management components
 */
export interface UserManagementProps extends AdminComponentProps {
  /** List of users to manage */
  users: User[];
  /** Callback when user is updated */
  onUserUpdate?: (user: User) => Promise<void>;
  /** Callback when user is deleted */
  onUserDelete?: (userId: string) => Promise<void>;
  /** Callback when user permissions change */
  onPermissionChange?: (userId: string, permissions: Permission[]) => Promise<void>;
}

/**
 * Props for group management components
 */
export interface GroupManagementProps extends AdminComponentProps {
  /** List of groups user can manage */
  groups: Group[];
  /** Callback when group is updated */
  onGroupUpdate?: (group: Group) => Promise<void>;
  /** Callback when group is deleted */
  onGroupDelete?: (groupId: string) => Promise<void>;
  /** Callback when group settings change */
  onGroupSettingsChange?: (groupId: string, settings: any) => Promise<void>;
}

/**
 * Props for match management components
 */
export interface MatchManagementProps extends AdminComponentProps {
  /** List of matches to manage */
  matches: Match[];
  /** Callback when match is edited */
  onMatchEdit?: (match: Match) => Promise<void>;
  /** Callback when match is deleted */
  onMatchDelete?: (matchId: string) => Promise<void>;
  /** Callback when match results are recalculated */
  onRecalculateResults?: () => Promise<void>;
}

// =============================================================================
// AUTHENTICATION COMPONENT PROPS
// =============================================================================

/**
 * Props for login/authentication components
 */
export interface AuthComponentProps {
  /** Callback when login is successful */
  onLogin?: (user: User, token: string) => void;
  /** Callback when logout is requested */
  onLogout?: () => void;
  /** Loading state for auth operations */
  isLoading?: boolean;
  /** Error message from auth operations */
  error?: string | null;
  /** Callback to clear auth errors */
  onClearError?: () => void;
}

/**
 * Props for password reset components
 */
export interface PasswordResetProps {
  /** Reset token from URL */
  token?: string;
  /** Reset type */
  type?: 'recovery' | 'signup';
  /** Callback when password is successfully reset */
  onPasswordReset?: () => void;
  /** Callback when reset is cancelled */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
}

// =============================================================================
// FORM COMPONENT PROPS
// =============================================================================

/**
 * Base props for form components
 */
export interface FormComponentProps {
  /** Form submission handler */
  onSubmit: (data: any) => Promise<void> | void;
  /** Form cancellation handler */
  onCancel?: () => void;
  /** Loading state during submission */
  isSubmitting?: boolean;
  /** Validation errors */
  errors?: ValidationError[];
  /** Initial form values */
  initialValues?: Record<string, any>;
  /** Whether form is disabled */
  disabled?: boolean;
}

/**
 * Props for profile form components
 */
export interface ProfileFormProps extends FormComponentProps {
  /** Current user data for initial values */
  user: User;
  /** Profile update handler */
  onSubmit: (data: ProfileUpdateData) => Promise<void>;
  /** Available avatar options */
  avatarOptions?: string[];
}

/**
 * Props for match entry form components
 */
export interface MatchEntryFormProps extends FormComponentProps {
  /** Available users for match */
  users: User[];
  /** Match submission handler */
  onSubmit: (data: MatchSubmissionData) => Promise<void>;
  /** Default match type */
  defaultMatchType?: '1v1' | '2v2';
}

// =============================================================================
// NAVIGATION COMPONENT PROPS
// =============================================================================

/**
 * Props for navigation components
 */
export interface NavigationProps extends BaseComponentProps {
  /** Current view/route */
  currentView: string;
  /** Navigation handler */
  onNavigate: (view: string) => void;
  /** Available navigation items */
  navigationItems?: NavigationItem[];
  /** Whether navigation is collapsed */
  isCollapsed?: boolean;
}

/**
 * Navigation item configuration
 */
export interface NavigationItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component or name */
  icon?: ReactNode | string;
  /** Target view/route */
  view: string;
  /** Required permissions */
  permissions?: Permission[];
  /** Whether item is disabled */
  disabled?: boolean;
  /** Badge content (e.g., notification count) */
  badge?: string | number;
}

// =============================================================================
// DIALOG COMPONENT PROPS
// =============================================================================

/**
 * Props for dialog components
 */
export interface DialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Dialog close handler */
  onClose: () => void;
  /** Dialog title */
  title?: string;
  /** Dialog content */
  children?: ReactNode;
  /** Dialog size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether dialog can be closed by clicking outside */
  closeOnOutsideClick?: boolean;
}

/**
 * Props for confirmation dialog components
 */
export interface ConfirmDialogProps extends DialogProps {
  /** Confirmation message */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: 'default' | 'destructive' | 'outline';
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Loading state during confirmation */
  isConfirming?: boolean;
}

/**
 * Props for alert dialog components
 */
export interface AlertDialogProps extends DialogProps {
  /** Alert message */
  message: string;
  /** Alert type */
  type?: 'info' | 'warning' | 'error' | 'success';
  /** Action button text */
  actionText?: string;
  /** Callback when action is taken */
  onAction?: () => void;
}

// =============================================================================
// DASHBOARD COMPONENT PROPS
// =============================================================================

/**
 * Props for dashboard components
 */
export interface DashboardProps extends DataComponentProps {
  /** User statistics */
  userStats: UserStats;
  /** Recent matches */
  recentMatches: Match[];
  /** Leaderboard data */
  leaderboard: User[];
  /** Dashboard refresh handler */
  onRefresh: () => Promise<void>;
}

/**
 * Props for leaderboard components
 */
export interface LeaderboardProps extends BaseComponentProps {
  /** Users ranked by ELO */
  users: User[];
  /** Current user's rank */
  currentUserRank?: number;
  /** Leaderboard type */
  type?: 'overall' | 'singles' | 'doubles';
  /** Number of entries to show */
  limit?: number;
}

/**
 * Props for statistics components
 */
export interface StatisticsProps extends BaseComponentProps {
  /** User to show statistics for */
  user: User;
  /** User's matches for analysis */
  matches: Match[];
  /** Group context for comparisons */
  group: Group | null;
  /** Time period for statistics */
  period?: 'all' | 'month' | 'week';
}

// =============================================================================
// PLAYER PROFILE COMPONENT PROPS
// =============================================================================

/**
 * Props for player profile components
 */
export interface PlayerProfileProps extends BaseComponentProps {
  /** Player to display */
  player: User;
  /** Player's match history */
  matches: Match[];
  /** Player's statistics */
  stats: UserStats;
  /** Whether this is the current user's profile */
  isOwnProfile: boolean;
  /** Navigation back handler */
  onBack: () => void;
  /** Challenge player handler */
  onChallenge?: () => void;
}

// =============================================================================
// UTILITY PROP TYPES
// =============================================================================

/**
 * Props that accept children
 */
export interface WithChildren {
  children: ReactNode;
}

/**
 * Props with optional className
 */
export interface WithClassName {
  className?: string;
}

/**
 * Props with optional test ID for testing
 */
export interface WithTestId {
  'data-testid'?: string;
}

/**
 * Combined utility props
 */
export interface UtilityProps extends WithChildren, WithClassName, WithTestId {}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for auth hooks
 */
export interface UseAuthReturn {
  /** Whether user is logged in */
  isLoggedIn: boolean;
  /** Current user data */
  currentUser: User | null;
  /** Access token */
  accessToken: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Login handler */
  login: (user: User, token: string) => Promise<void>;
  /** Logout handler */
  logout: () => Promise<void>;
  /** Session check handler */
  checkSession: () => Promise<void>;
  /** Clear error handler */
  clearError: () => void;
}

/**
 * Return type for app data hooks
 */
export interface UseAppDataReturn {
  /** Users in current group */
  users: User[];
  /** Matches in current group */
  matches: Match[];
  /** Current group */
  currentGroup: Group | null;
  /** Loading state */
  isLoadingData: boolean;
  /** Error message */
  error: string | null;
  /** Data refresh handler */
  refreshData: () => Promise<void>;
  /** User update handler */
  updateUser: (user: User) => void;
  /** Match addition handler */
  addMatch: (match: Match) => void;
  /** Group change handler */
  setCurrentGroup: (group: Group | null) => void;
  /** Group selection handler */
  handleGroupSelected: () => Promise<void>;
  /** Group change handler */
  handleGroupChanged: () => Promise<void>;
  /** Match submission handler */
  handleMatchSubmit: (matchData: MatchSubmissionData) => Promise<any>;
  /** Profile update handler */
  handleProfileUpdate: (updatedProfile: ProfileUpdateData) => Promise<void>;
  /** Error clearing handler */
  clearError: () => void;
  /** Additional React Query states */
  isFetching: boolean;
  isLoadingInitial: boolean;
  /** Refetch all data */
  refetchAll: () => void;
  /** Get current user statistics */
  getCurrentUserStats: () => UserStats;
}

// =============================================================================
// EXPORT ALL PROP TYPES
// =============================================================================

export type {
  // Additional React types that might be useful
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  FormHTMLAttributes,
  MouseEvent,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
} from 'react';
