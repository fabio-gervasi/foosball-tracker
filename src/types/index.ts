/**
 * Core Type Definitions for Foosball Tracker
 *
 * This file contains all the main entity interfaces and types used throughout
 * the application. These types provide comprehensive TypeScript coverage and
 * ensure type safety across all components and hooks.
 */

// =============================================================================
// CORE ENTITY INTERFACES
// =============================================================================

/**
 * User entity representing a player in the foosball tracker
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** User's email address (used for authentication) */
  email: string;
  /** User's chosen username */
  username: string;
  /** User's display name */
  name: string;
  /** Code of the group the user is currently active in */
  currentGroup?: string;
  /** Legacy rating field (use elo instead) */
  rating?: number;
  /** Current ELO rating */
  elo?: number;
  /** Avatar image filename or URL */
  avatar?: string;
  /** Full avatar URL (computed field) */
  avatarUrl?: string;
  /** Whether the user has admin privileges */
  isAdmin?: boolean;
  /** Total number of wins across all match types */
  wins?: number;
  /** Total number of losses across all match types */
  losses?: number;
  /** Singles match wins */
  singlesWins?: number;
  /** Singles match losses */
  singlesLosses?: number;
  /** Doubles match wins */
  doublesWins?: number;
  /** Doubles match losses */
  doublesLosses?: number;
  /** ELO rating for singles matches */
  singlesElo?: number;
  /** ELO rating for doubles matches */
  doublesElo?: number;
  /** Timestamp when the user was created */
  createdAt: string;
  /** Timestamp when the user was last updated */
  updatedAt: string;
}

/**
 * Group entity representing a foosball group/organization
 */
export interface Group {
  /** Unique identifier for the group */
  id: string;
  /** Display name of the group */
  name: string;
  /** Unique join code for the group */
  code: string;
  /** Optional icon/logo for the group */
  icon?: string;
  /** Timestamp when the group was created */
  createdAt: string;
  /** Array of user IDs who are admins of this group */
  adminIds: string[];
  /** Number of members in the group (computed field) */
  memberCount?: number;
}

/**
 * Player reference used in matches (supports both users and guests)
 */
export interface PlayerReference {
  /** Player ID (for registered users) */
  id?: string;
  /** Player name */
  name: string;
  /** Player email (for registered users) */
  email?: string;
  /** Whether this is a guest player */
  isGuest?: boolean;
}

/**
 * Team structure for doubles matches
 */
export interface Team {
  /** First player in the team */
  player1: PlayerReference;
  /** Second player in the team */
  player2: PlayerReference;
}

/**
 * Match entity representing a completed game
 */
export interface Match {
  /** Unique identifier for the match */
  id: string;
  /** Type of match (singles or doubles) */
  matchType: '1v1' | '2v2';
  /** First player (for singles matches) */
  player1?: PlayerReference;
  /** Second player (for singles matches) */
  player2?: PlayerReference;
  /** First team (for doubles matches) */
  team1?: Team;
  /** Second team (for doubles matches) */
  team2?: Team;
  /** Score for player1 or team1 */
  score1: number;
  /** Score for player2 or team2 */
  score2: number;
  /** ID of the group this match belongs to */
  groupId: string;
  /** ID of the user who created this match */
  createdBy?: string;
  /** Timestamp when the match was created */
  createdAt: string;

  // Legacy fields for backward compatibility
  /** Legacy: Winner email */
  winnerEmail?: string;
  /** Legacy: Loser email */
  loserEmail?: string;
  /** Legacy: Player 1 email */
  player1Email?: string;
  /** Legacy: Player 2 email */
  player2Email?: string;
  /** Legacy: Team 1 Player 1 email */
  team1Player1Email?: string;
  /** Legacy: Team 1 Player 2 email */
  team1Player2Email?: string;
  /** Legacy: Team 2 Player 1 email */
  team2Player1Email?: string;
  /** Legacy: Team 2 Player 2 email */
  team2Player2Email?: string;
  /** Legacy: Winner reference */
  winner?: PlayerReference;
  /** Legacy: Winning team identifier */
  winningTeam?: string;
  /** Legacy: Date field */
  date: string;
  /** Legacy: ELO changes from the match */
  eloChanges?: any;
  /** Legacy: Group code */
  groupCode?: string;
}

// =============================================================================
// USER STATISTICS AND ANALYTICS
// =============================================================================

/**
 * Comprehensive user statistics
 */
export interface UserStats {
  /** Total matches played */
  totalMatches: number;
  /** Total wins */
  wins: number;
  /** Total losses */
  losses: number;
  /** Win percentage (0-100) */
  winPercentage: number;
  /** Current ELO rating */
  elo: number;
  /** Singles-specific statistics */
  singles: {
    matches: number;
    wins: number;
    losses: number;
    winPercentage: number;
    elo: number;
  };
  /** Doubles-specific statistics */
  doubles: {
    matches: number;
    wins: number;
    losses: number;
    winPercentage: number;
    elo: number;
  };
  /** Recent form (last N matches) */
  recentForm?: MatchResult[];
  /** Longest win streak */
  longestWinStreak?: number;
  /** Current win streak */
  currentStreak?: number;
}

/**
 * Match result from a user's perspective
 */
export interface MatchResult {
  /** Match ID */
  matchId: string;
  /** Whether the user won */
  won: boolean;
  /** Match type */
  matchType: '1v1' | '2v2';
  /** Match date */
  date: string;
  /** ELO change from this match */
  eloChange?: number;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  /** Response data */
  data?: T;
  /** Error message if request failed */
  error?: string;
  /** Success indicator */
  success?: boolean;
  /** Additional metadata */
  meta?: {
    /** Total count for paginated responses */
    total?: number;
    /** Current page */
    page?: number;
    /** Items per page */
    limit?: number;
  };
}

/**
 * User-related API responses
 */
export interface UserResponse extends ApiResponse<User> {
  user: User;
}

export interface UsersResponse extends ApiResponse<User[]> {
  users: User[];
}

/**
 * Group-related API responses
 */
export interface GroupResponse extends ApiResponse<Group> {
  group: Group;
}

export interface GroupsResponse extends ApiResponse<Group[]> {
  groups: Group[];
}

/**
 * Match-related API responses
 */
export interface MatchResponse extends ApiResponse<Match> {
  match: Match;
}

export interface MatchesResponse extends ApiResponse<Match[]> {
  matches: Match[];
}

// =============================================================================
// FORM DATA INTERFACES
// =============================================================================

/**
 * Data structure for match submission
 */
export interface MatchSubmissionData {
  /** Type of match being submitted */
  matchType: '1v1' | '2v2';
  /** Player 1 email (for singles) */
  player1Email?: string;
  /** Player 2 email (for singles) */
  player2Email?: string;
  /** Winner email (for singles) - required by server validation */
  winnerEmail?: string;
  /** Team 1 Player 1 email (for doubles) */
  team1Player1Email?: string;
  /** Team 1 Player 2 email (for doubles) */
  team1Player2Email?: string;
  /** Team 2 Player 1 email (for doubles) */
  team2Player1Email?: string;
  /** Team 2 Player 2 email (for doubles) */
  team2Player2Email?: string;
  /** Score for player1/team1 */
  score1: number;
  /** Score for player2/team2 */
  score2: number;
  /** Additional fields for flexibility */
  [key: string]: any;
}

/**
 * Data structure for profile updates
 */
export interface ProfileUpdateData {
  /** Updated display name */
  name?: string;
  /** Updated username */
  username?: string;
  /** Updated avatar */
  avatar?: string;
  /** Additional fields for flexibility */
  [key: string]: any;
}

/**
 * Data structure for group switching
 */
export interface GroupSwitchData {
  /** Code of the group to switch to */
  groupCode: string;
}

/**
 * Data structure for group creation
 */
export interface GroupCreationData {
  /** Name of the new group */
  name: string;
  /** Optional group code (auto-generated if not provided) */
  code?: string;
  /** Optional group icon */
  icon?: string;
}

// =============================================================================
// VALIDATION AND ERROR TYPES
// =============================================================================

/**
 * Validation error for form fields
 */
export interface ValidationError {
  /** Field name that has the error */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Array of validation errors */
  errors: ValidationError[];
}

/**
 * User-friendly error with additional context
 */
export interface UserFriendlyError extends Error {
  /** User-friendly error message */
  userMessage: string;
  /** Original error for debugging */
  originalError?: Error;
  /** HTTP status code if applicable */
  status?: number;
  /** Error code for programmatic handling */
  code?: string;
}

// =============================================================================
// PERMISSION AND AUTHORIZATION TYPES
// =============================================================================

/**
 * Available permissions in the system
 */
export type Permission =
  | 'view_dashboard'
  | 'view_leaderboard'
  | 'view_statistics'
  | 'view_match_history'
  | 'view_profile'
  | 'edit_profile'
  | 'create_group'
  | 'join_group'
  | 'switch_group'
  | 'leave_group'
  | 'manage_group'
  | 'manage_users'
  | 'manage_matches'
  | 'delete_matches'
  | 'submit_matches';

/**
 * User role within a group
 */
export type UserRole = 'admin' | 'member' | 'guest';

// =============================================================================
// UI AND COMPONENT TYPES
// =============================================================================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  /** Whether operation is in progress */
  isLoading: boolean;
  /** Optional loading message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Dialog state and configuration
 */
export interface DialogState {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title?: string;
  /** Dialog content/message */
  message?: string;
  /** Dialog type for styling */
  type?: 'info' | 'warning' | 'error' | 'success' | 'confirm';
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Whether there are more pages */
  hasNextPage: boolean;
  /** Whether there are previous pages */
  hasPreviousPage: boolean;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Make all properties of T optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Pick specific properties from T
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * Omit specific properties from T
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Extract non-nullable type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Create a type with all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

// Re-export commonly used types for convenience
export type {
  // React Query types (if needed)
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';

// React types for component props
export type { ReactNode, ComponentProps, FC } from 'react';
