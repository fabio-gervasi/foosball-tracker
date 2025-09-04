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
 * Updated to match relational database schema
 */
export interface User {
  /** Unique identifier for the user (UUID) */
  id: string;
  /** User's email address (used for authentication) */
  email: string;
  /** User's chosen username */
  username?: string | null;
  /** User's display name */
  name: string;
  /** Avatar image filename or URL */
  avatar?: string | null;
  /** Whether the user has admin privileges */
  is_admin?: boolean;
  /** ELO rating for singles matches */
  singles_elo?: number;
  /** ELO rating for doubles matches */
  doubles_elo?: number;
  /** Singles match wins */
  singles_wins?: number;
  /** Singles match losses */
  singles_losses?: number;
  /** Doubles match wins */
  doubles_wins?: number;
  /** Doubles match losses */
  doubles_losses?: number;
  /** Code of the group the user is currently active in */
  current_group_code?: string | null;
  /** Timestamp when the user was created */
  created_at: string;
  /** Timestamp when the user was last updated */
  updated_at: string;
  /** Timestamp when the user was soft deleted */
  deleted_at?: string | null;
  /** Whether the user is soft deleted */
  is_deleted?: boolean;

  // Computed/legacy properties for backward compatibility
  /** @deprecated Use current_group_code instead */
  currentGroup?: string | null;
  /** @deprecated Use singles_elo instead */
  singlesElo?: number;
  /** @deprecated Use doubles_elo instead */
  doublesElo?: number;
  /** @deprecated Use singles_wins instead */
  singlesWins?: number;
  /** @deprecated Use singles_losses instead */
  singlesLosses?: number;
  /** @deprecated Use doubles_wins instead */
  doublesWins?: number;
  /** @deprecated Use doubles_losses instead */
  doublesLosses?: number;

  // Computed fields (not in database)
  /** Legacy rating field (use singles_elo instead) */
  rating?: number;
  /** Current ELO rating (alias for singles_elo) */
  elo?: number;
  /** Full avatar URL (computed field) */
  avatarUrl?: string;
  /** Total number of wins across all match types (computed) */
  wins?: number;
  /** Total number of losses across all match types (computed) */
  losses?: number;
  /** Legacy admin field (use is_admin instead) */
  isAdmin?: boolean;
}

/**
 * Group entity representing a foosball group/organization
 * Updated to match relational database schema
 */
export interface Group {
  /** Unique join code for the group (primary key) */
  code: string;
  /** Display name of the group */
  name: string;
  /** ID of the user who created the group */
  created_by?: string;
  /** Timestamp when the group was created */
  created_at: string;
  /** Timestamp when the group was last updated */
  updated_at: string;

  // Computed fields (not in database)
  /** Legacy ID field (use code instead) */
  id?: string;
  /** Optional icon/logo for the group */
  icon?: string;
  /** Array of user IDs who are admins of this group (computed from separate table) */
  adminIds?: string[];
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
  /** Date of the match */
  date: string;
  /** Code of the group this match belongs to */
  group_code: string;
  /** Type of match (singles or doubles) */
  match_type: '1v1' | '2v2';
  /** Series type (bo1, bo3, bo5) */
  series_type?: 'bo1' | 'bo3' | 'bo5';
  /** ID of the user who recorded this match */
  recorded_by?: string;
  /** Winner's email */
  winner_email?: string;
  /** Whether winner is a guest */
  winner_is_guest?: boolean;
  /** Timestamp when the match was created */
  created_at: string;

  // Relational database fields
  /** Players in this match (from match_players table with user joins) */
  players?: MatchPlayer[];

  // Legacy fields for backward compatibility
  /** Type of match (legacy field, use match_type instead) */
  matchType?: '1v1' | '2v2';
  /** First player (for singles matches) */
  player1?: PlayerReference;
  /** Second player (for singles matches) */
  player2?: PlayerReference;
  /** First team (for doubles matches) */
  team1?: Team;
  /** Second team (for doubles matches) */
  team2?: Team;
  /** Score for player1 or team1 */
  score1?: number;
  /** Score for player2 or team2 */
  score2?: number;
  /** ID of the group this match belongs to (legacy, use group_code) */
  groupId?: string;
  /** ID of the user who created this match (legacy, use recorded_by) */
  createdBy?: string;
  /** Timestamp when the match was created (legacy, use created_at) */
  createdAt?: string;
  /** Winner reference */
  winner?: PlayerReference;
  /** Winning team identifier */
  winningTeam?: string;
  /** ELO changes from the match, keyed by playerId */
  eloChanges?: Record<
    string,
    {
      oldRating: number;
      newRating: number;
      change: number;
    }
  >;
  /** Group code (legacy, use group_code) */
  groupCode?: string;
  /** Match results for series matches */
  match_results?: MatchResult[];
  /** Alternative match results property */
  results?: MatchResult[];
}

// =============================================================================
// RELATIONAL DATABASE ENTITIES
// =============================================================================

/**
 * User-Group relationship entity
 */
export interface UserGroup {
  /** User ID */
  user_id: string;
  /** Group code */
  group_code: string;
  /** When the user joined the group */
  joined_at: string;
}

/**
 * Match player entity
 */
export interface MatchPlayer {
  /** Match ID */
  match_id: string;
  /** User ID (null for guests) */
  user_id: string | null;
  /** Team identifier */
  team: 'team1' | 'team2';
  /** Position in team (1 or 2) */
  position: 1 | 2;
  /** Whether this is a guest player */
  is_guest: boolean;
  /** Guest player name (if applicable) */
  guest_name?: string | null;

  // Joined user data from relational query
  /** User data (joined from users table) */
  users?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Match result entity
 */
export interface MatchResult {
  /** Match ID */
  match_id: string;
  /** Game number in the series */
  game_number: number;
  /** Winning team */
  winning_team: 'team1' | 'team2';
}

/**
 * ELO change entity
 */
export interface EloChange {
  /** Match ID */
  match_id: string;
  /** User ID */
  user_id: string;
  /** Old rating before the match */
  old_rating: number;
  /** New rating after the match */
  new_rating: number;
  /** Type of rating (singles or doubles) */
  rating_type: 'singles' | 'doubles';
  /** Rating change amount */
  change_amount: number;
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
 * Data structure for leaving a group
 */
export interface LeaveGroupData {
  /** Code of the group to leave */
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
