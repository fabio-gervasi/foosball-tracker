/**
 * Password validation utilities for Supabase authentication
 *
 * Supabase uses bcrypt which has a 72-byte password limit.
 * This module provides utilities to validate password length in bytes,
 * not characters, which is crucial for UTF-8 encoded passwords.
 */

import { logger } from './logger';

// Supabase/bcrypt password byte limit
export const SUPABASE_PASSWORD_BYTE_LIMIT = 72;

// Recommended character limit for most single-byte characters
export const RECOMMENDED_CHARACTER_LIMIT = 60;

export interface PasswordValidationResult {
  isValid: boolean;
  byteLength: number;
  characterLength: number;
  errors: string[];
  warnings: string[];
  strength: {
    score: number; // 0-4
    label: string; // 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'
    color: string; // CSS color class
  };
}

/**
 * Calculate the byte length of a string using UTF-8 encoding
 * This is crucial because bcrypt operates on bytes, not characters
 */
export function getPasswordByteLength(password: string): number {
  if (!password) return 0;

  // Use TextEncoder to get accurate UTF-8 byte length
  const encoder = new TextEncoder();
  const bytes = encoder.encode(password);
  return bytes.length;
}

/**
 * Validate password against Supabase/bcrypt requirements
 */
export function validatePasswordLength(password: string): PasswordValidationResult {
  const byteLength = getPasswordByteLength(password);
  const characterLength = password.length;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical: Check byte length limit
  if (byteLength > SUPABASE_PASSWORD_BYTE_LIMIT) {
    errors.push(
      `Password is too long (${byteLength} bytes). Maximum allowed is ${SUPABASE_PASSWORD_BYTE_LIMIT} bytes.`
    );
  }

  // Warning for passwords approaching the limit
  if (
    byteLength > SUPABASE_PASSWORD_BYTE_LIMIT - 10 &&
    byteLength <= SUPABASE_PASSWORD_BYTE_LIMIT
  ) {
    warnings.push(
      `Password is close to the byte limit (${byteLength}/${SUPABASE_PASSWORD_BYTE_LIMIT} bytes). Consider shortening it.`
    );
  }

  // Basic length requirements
  if (characterLength === 0) {
    errors.push('Password is required');
  } else if (characterLength < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Calculate password strength
  const strength = calculatePasswordStrength(password);

  const result: PasswordValidationResult = {
    isValid: errors.length === 0,
    byteLength,
    characterLength,
    errors,
    warnings,
    strength,
  };

  logger.debug('Password validation result', {
    byteLength,
    characterLength,
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length,
  });

  return result;
}

/**
 * Calculate password strength score (0-4)
 */
function calculatePasswordStrength(password: string): PasswordValidationResult['strength'] {
  if (!password) {
    return { score: 0, label: 'Very Weak', color: 'text-red-500' };
  }

  let score = 0;

  // Length bonus
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 0.5;
  if (/[A-Z]/.test(password)) score += 0.5;
  if (/[0-9]/.test(password)) score += 0.5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 0.5;

  // Round to nearest integer
  score = Math.round(score);

  // Cap at 4
  score = Math.min(score, 4);

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = [
    'text-red-500',
    'text-orange-500',
    'text-yellow-500',
    'text-blue-500',
    'text-green-500',
  ];

  return {
    score,
    label: strengthLabels[score],
    color: strengthColors[score],
  };
}

/**
 * Get user-friendly error message for password validation
 */
export function getPasswordErrorMessage(validation: PasswordValidationResult): string {
  if (validation.errors.length === 0) return '';

  // Prioritize byte length errors as they're most critical
  const byteLengthError = validation.errors.find(
    error => error.includes('too long') && error.includes('bytes')
  );

  if (byteLengthError) {
    return `Password too long. Please use ${RECOMMENDED_CHARACTER_LIMIT} characters or fewer (current: ${validation.characterLength} characters, ${validation.byteLength} bytes).`;
  }

  // Return the first error for other cases
  return validation.errors[0];
}

/**
 * Get user-friendly success message with byte information
 */
export function getPasswordSuccessMessage(validation: PasswordValidationResult): string {
  if (!validation.isValid) return '';

  const { byteLength, characterLength, strength } = validation;

  if (validation.warnings.length > 0) {
    return `Password is valid but close to limit (${byteLength}/${SUPABASE_PASSWORD_BYTE_LIMIT} bytes). Strength: ${strength.label}.`;
  }

  return `Password is valid (${characterLength} characters, ${byteLength} bytes). Strength: ${strength.label}.`;
}

/**
 * Real-time validation for password input fields
 * Returns immediate feedback for UI components
 */
export function validatePasswordRealtime(password: string): {
  isValid: boolean;
  message: string;
  messageType: 'error' | 'warning' | 'success' | 'info';
  byteLength: number;
  characterLength: number;
  strength: PasswordValidationResult['strength'];
} {
  const validation = validatePasswordLength(password);

  let message = '';
  let messageType: 'error' | 'warning' | 'success' | 'info' = 'info';

  if (validation.errors.length > 0) {
    message = getPasswordErrorMessage(validation);
    messageType = 'error';
  } else if (validation.warnings.length > 0) {
    message = validation.warnings[0];
    messageType = 'warning';
  } else if (password.length > 0) {
    message = getPasswordSuccessMessage(validation);
    messageType = 'success';
  } else {
    message = 'Enter your password';
    messageType = 'info';
  }

  return {
    isValid: validation.isValid,
    message,
    messageType,
    byteLength: validation.byteLength,
    characterLength: validation.characterLength,
    strength: validation.strength,
  };
}

/**
 * Check if a character is likely to be multi-byte in UTF-8
 * This is a heuristic for user education
 */
export function hasMultiByteCharacters(text: string): boolean {
  const byteLength = getPasswordByteLength(text);
  const characterLength = text.length;
  return byteLength > characterLength;
}

/**
 * Get examples of multi-byte characters for user education
 */
export function getMultiByteExamples(): string {
  return 'Examples of multi-byte characters: é, ñ, 中, 🔐, Ω';
}
