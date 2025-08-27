import { useMemo, useCallback } from 'react';
import { useAppData } from './useAppData';
import { logger } from '../utils/logger';

// Validation interfaces
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export interface Player {
  id?: string;
  email?: string;
  name?: string;
  isGuest?: boolean;
}

export interface MatchValidationData {
  matchType: '1v1' | '2v2';
  player1Email?: string;
  player2Email?: string;
  team1Player1Email?: string;
  team1Player2Email?: string;
  team2Player1Email?: string;
  team2Player2Email?: string;
  score1: number;
  score2: number;
}

export interface UseMatchValidationReturn {
  validateMatch: (matchData: MatchValidationData) => ValidationResult;
  validatePlayers: (players: Player[]) => ValidationResult;
  validateScore: (score1: number, score2: number) => ValidationResult;
  validateMatchType: (matchType: string, players: Player[]) => ValidationResult;

  // Current validation state
  errors: ValidationError[];
  isValid: boolean;

  // Utility functions
  isValidEmail: (email: string) => boolean;
  isValidScore: (score: number) => boolean;
  getPlayerByEmail: (email: string) => Player | undefined;

  // Validation rules
  rules: {
    minScore: number;
    maxScore: number;
    maxScoreDifference: number;
    requiresWinner: boolean;
  };
}

// Default validation rules
const DEFAULT_RULES = {
  minScore: 0,
  maxScore: 10,
  maxScoreDifference: 10,
  requiresWinner: true,
};

/**
 * Comprehensive match validation hook
 * Provides validation for all match-related data and business rules
 */
export const useMatchValidation = (): UseMatchValidationReturn => {
  const { users, currentGroup } = useAppData();

  // Validation rules (could be made configurable per group)
  const rules = useMemo(() => ({
    ...DEFAULT_RULES,
    // Add any group-specific rules here
  }), []);

  // Email validation
  const isValidEmail = useCallback((email: string): boolean => {
    if (!email) return false;

    // Basic email pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Allow foosball.local emails for local users
    const localPattern = /^[^\s@]+@foosball\.local$/;

    return emailPattern.test(email) || localPattern.test(email);
  }, []);

  // Score validation
  const isValidScore = useCallback((score: number): boolean => {
    return Number.isInteger(score) &&
           score >= rules.minScore &&
           score <= rules.maxScore;
  }, [rules]);

  // Get player by email
  const getPlayerByEmail = useCallback((email: string): Player | undefined => {
    return users.find(user => user.email === email);
  }, [users]);

  // Validate individual players
  const validatePlayers = useCallback((players: Player[]): ValidationResult => {
    const errors: ValidationError[] = [];

    // Check for empty players array
    if (!players || players.length === 0) {
      errors.push({
        field: 'players',
        message: 'At least one player is required',
        code: 'PLAYERS_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Validate each player
    players.forEach((player, index) => {
      if (!player.email) {
        errors.push({
          field: `player${index + 1}`,
          message: 'Player email is required',
          code: 'PLAYER_EMAIL_REQUIRED'
        });
        return;
      }

      if (!isValidEmail(player.email)) {
        errors.push({
          field: `player${index + 1}`,
          message: 'Invalid email format',
          code: 'INVALID_EMAIL_FORMAT'
        });
        return;
      }

      // Check if player exists in current group
      const existingPlayer = getPlayerByEmail(player.email);
      if (!existingPlayer) {
        errors.push({
          field: `player${index + 1}`,
          message: `Player with email ${player.email} not found in current group`,
          code: 'PLAYER_NOT_FOUND'
        });
      } else if (existingPlayer.currentGroup !== currentGroup?.code) {
        errors.push({
          field: `player${index + 1}`,
          message: `Player ${player.email} is not a member of the current group`,
          code: 'PLAYER_NOT_IN_GROUP'
        });
      }
    });

    // Check for duplicate players
    const emailSet = new Set();
    players.forEach((player, index) => {
      if (player.email && emailSet.has(player.email)) {
        errors.push({
          field: `player${index + 1}`,
          message: 'Duplicate player in match',
          code: 'DUPLICATE_PLAYER'
        });
      }
      if (player.email) {
        emailSet.add(player.email);
      }
    });

    return { isValid: errors.length === 0, errors };
  }, [isValidEmail, getPlayerByEmail, currentGroup]);

  // Validate scores
  const validateScore = useCallback((score1: number, score2: number): ValidationResult => {
    const errors: ValidationError[] = [];

    // Validate individual scores
    if (!isValidScore(score1)) {
      errors.push({
        field: 'score1',
        message: `Score must be between ${rules.minScore} and ${rules.maxScore}`,
        code: 'INVALID_SCORE_RANGE'
      });
    }

    if (!isValidScore(score2)) {
      errors.push({
        field: 'score2',
        message: `Score must be between ${rules.minScore} and ${rules.maxScore}`,
        code: 'INVALID_SCORE_RANGE'
      });
    }

    // Check for tie (if not allowed)
    if (rules.requiresWinner && score1 === score2) {
      errors.push({
        field: 'scores',
        message: 'Match cannot end in a tie',
        code: 'TIE_NOT_ALLOWED'
      });
    }

    // Check score difference (if there's a maximum)
    const scoreDiff = Math.abs(score1 - score2);
    if (scoreDiff > rules.maxScoreDifference) {
      errors.push({
        field: 'scores',
        message: `Score difference cannot exceed ${rules.maxScoreDifference}`,
        code: 'SCORE_DIFFERENCE_TOO_LARGE'
      });
    }

    return { isValid: errors.length === 0, errors };
  }, [isValidScore, rules]);

  // Validate match type against players
  const validateMatchType = useCallback((matchType: string, players: Player[]): ValidationResult => {
    const errors: ValidationError[] = [];

    if (matchType === '1v1' && players.length !== 2) {
      errors.push({
        field: 'matchType',
        message: '1v1 matches require exactly 2 players',
        code: 'INVALID_PLAYER_COUNT_1V1'
      });
    }

    if (matchType === '2v2' && players.length !== 4) {
      errors.push({
        field: 'matchType',
        message: '2v2 matches require exactly 4 players',
        code: 'INVALID_PLAYER_COUNT_2V2'
      });
    }

    if (!['1v1', '2v2'].includes(matchType)) {
      errors.push({
        field: 'matchType',
        message: 'Match type must be either 1v1 or 2v2',
        code: 'INVALID_MATCH_TYPE'
      });
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  // Main match validation function
  const validateMatch = useCallback((matchData: MatchValidationData): ValidationResult => {
    const allErrors: ValidationError[] = [];

    logger.debug('Validating match data', {
      matchType: matchData.matchType,
      hasScore1: matchData.score1 !== undefined,
      hasScore2: matchData.score2 !== undefined
    });

    // Extract players based on match type
    const players: Player[] = [];

    if (matchData.matchType === '1v1') {
      if (matchData.player1Email) {
        players.push({ email: matchData.player1Email });
      }
      if (matchData.player2Email) {
        players.push({ email: matchData.player2Email });
      }
    } else if (matchData.matchType === '2v2') {
      if (matchData.team1Player1Email) {
        players.push({ email: matchData.team1Player1Email });
      }
      if (matchData.team1Player2Email) {
        players.push({ email: matchData.team1Player2Email });
      }
      if (matchData.team2Player1Email) {
        players.push({ email: matchData.team2Player1Email });
      }
      if (matchData.team2Player2Email) {
        players.push({ email: matchData.team2Player2Email });
      }
    }

    // Validate match type
    const matchTypeValidation = validateMatchType(matchData.matchType, players);
    allErrors.push(...matchTypeValidation.errors);

    // Validate players
    const playersValidation = validatePlayers(players);
    allErrors.push(...playersValidation.errors);

    // Validate scores
    const scoresValidation = validateScore(matchData.score1, matchData.score2);
    allErrors.push(...scoresValidation.errors);

    // Additional business rule validations could go here
    // For example: rate limiting, player availability, etc.

    const isValid = allErrors.length === 0;

    logger.debug('Match validation complete', {
      isValid,
      errorCount: allErrors.length,
      errors: allErrors.map(e => e.code)
    });

    return { isValid, errors: allErrors };
  }, [validateMatchType, validatePlayers, validateScore]);

  // Current validation state (could be expanded to track last validation)
  const errors: ValidationError[] = [];
  const isValid = errors.length === 0;

  return {
    validateMatch,
    validatePlayers,
    validateScore,
    validateMatchType,

    // Current state
    errors,
    isValid,

    // Utilities
    isValidEmail,
    isValidScore,
    getPlayerByEmail,

    // Rules
    rules,
  };
};
