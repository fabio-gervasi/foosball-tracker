import { useState, useCallback, useMemo } from 'react';
import {
  validatePasswordRealtime,
  validatePasswordLength,
  getPasswordByteLength,
  hasMultiByteCharacters,
  SUPABASE_PASSWORD_BYTE_LIMIT,
  RECOMMENDED_CHARACTER_LIMIT,
  type PasswordValidationResult,
} from '../utils/password-validation';
import { logger } from '../utils/logger';

export interface UsePasswordValidationOptions {
  /** Enable real-time validation as user types */
  realtime?: boolean;
  /** Minimum password length in characters */
  minLength?: number;
  /** Show byte count information to user */
  showByteInfo?: boolean;
  /** Custom validation function */
  customValidator?: (password: string) => string | null;
}

export interface UsePasswordValidationReturn {
  // Validation state
  validation: PasswordValidationResult;
  isValid: boolean;
  errors: string[];
  warnings: string[];

  // UI helpers
  message: string;
  messageType: 'error' | 'warning' | 'success' | 'info';
  strengthColor: string;
  strengthLabel: string;

  // Byte information
  byteLength: number;
  characterLength: number;
  byteLimitExceeded: boolean;
  isNearByteLimit: boolean;
  hasMultiByteChars: boolean;

  // Actions
  validatePassword: (password: string) => PasswordValidationResult;
  clearValidation: () => void;

  // Constants for UI
  constants: {
    BYTE_LIMIT: number;
    RECOMMENDED_CHAR_LIMIT: number;
  };
}

const DEFAULT_OPTIONS: Required<UsePasswordValidationOptions> = {
  realtime: true,
  minLength: 8,
  showByteInfo: true,
  customValidator: () => null,
};

/**
 * Hook for comprehensive password validation with Supabase byte-length support
 *
 * Provides real-time validation, byte-length checking, and user-friendly feedback
 * for password input fields with Supabase authentication requirements.
 */
export function usePasswordValidation(
  password: string = '',
  options: UsePasswordValidationOptions = {}
): UsePasswordValidationReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Internal state for validation results
  const [lastValidationResult, setLastValidationResult] = useState<PasswordValidationResult | null>(
    null
  );

  // Memoized validation result
  const validation = useMemo(() => {
    if (!opts.realtime && !lastValidationResult) {
      // Return empty validation if not in realtime mode and no explicit validation called
      return {
        isValid: true,
        byteLength: 0,
        characterLength: 0,
        errors: [],
        warnings: [],
        strength: { score: 0, label: 'Very Weak', color: 'text-gray-400' },
      } as PasswordValidationResult;
    }

    if (opts.realtime) {
      // Real-time validation
      const result = validatePasswordLength(password);

      // Apply custom validation if provided
      if (opts.customValidator) {
        const customError = opts.customValidator(password);
        if (customError) {
          result.errors.push(customError);
          result.isValid = false;
        }
      }

      return result;
    }

    return (
      lastValidationResult ||
      ({
        isValid: true,
        byteLength: 0,
        characterLength: 0,
        errors: [],
        warnings: [],
        strength: { score: 0, label: 'Very Weak', color: 'text-gray-400' },
      } as PasswordValidationResult)
    );
  }, [password, opts.realtime, opts.customValidator, lastValidationResult]);

  // Manual validation function
  const validatePassword = useCallback(
    (passwordToValidate: string): PasswordValidationResult => {
      logger.debug('Manual password validation triggered', {
        passwordLength: passwordToValidate.length,
        byteLength: getPasswordByteLength(passwordToValidate),
      });

      const result = validatePasswordLength(passwordToValidate);

      // Apply custom validation
      if (opts.customValidator) {
        const customError = opts.customValidator(passwordToValidate);
        if (customError) {
          result.errors.push(customError);
          result.isValid = false;
        }
      }

      setLastValidationResult(result);
      return result;
    },
    [opts.customValidator]
  );

  // Clear validation state
  const clearValidation = useCallback(() => {
    setLastValidationResult(null);
  }, []);

  // UI message and type
  const { message, messageType } = useMemo(() => {
    if (opts.realtime && password) {
      const realtimeResult = validatePasswordRealtime(password);
      return {
        message: realtimeResult.message,
        messageType: realtimeResult.messageType,
      };
    }

    if (validation.errors.length > 0) {
      return {
        message: validation.errors[0],
        messageType: 'error' as const,
      };
    }

    if (validation.warnings.length > 0) {
      return {
        message: validation.warnings[0],
        messageType: 'warning' as const,
      };
    }

    if (password && validation.isValid) {
      return {
        message: `Password strength: ${validation.strength.label}`,
        messageType: 'success' as const,
      };
    }

    return {
      message: password ? 'Enter your password' : '',
      messageType: 'info' as const,
    };
  }, [password, validation, opts.realtime]);

  // Derived state
  const byteLength = validation.byteLength;
  const characterLength = validation.characterLength;
  const byteLimitExceeded = byteLength > SUPABASE_PASSWORD_BYTE_LIMIT;
  const isNearByteLimit =
    byteLength > SUPABASE_PASSWORD_BYTE_LIMIT - 10 && byteLength <= SUPABASE_PASSWORD_BYTE_LIMIT;
  const hasMultiByteChars = hasMultiByteCharacters(password);

  return {
    // Validation state
    validation,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,

    // UI helpers
    message,
    messageType,
    strengthColor: validation.strength.color,
    strengthLabel: validation.strength.label,

    // Byte information
    byteLength,
    characterLength,
    byteLimitExceeded,
    isNearByteLimit,
    hasMultiByteChars,

    // Actions
    validatePassword,
    clearValidation,

    // Constants
    constants: {
      BYTE_LIMIT: SUPABASE_PASSWORD_BYTE_LIMIT,
      RECOMMENDED_CHAR_LIMIT: RECOMMENDED_CHARACTER_LIMIT,
    },
  };
}

/**
 * Hook for password confirmation validation
 * Validates that two passwords match and both meet requirements
 */
export function usePasswordConfirmValidation(
  password: string,
  confirmPassword: string,
  options: UsePasswordValidationOptions = {}
) {
  const passwordValidation = usePasswordValidation(password, options);

  const confirmValidation = useMemo(() => {
    if (!confirmPassword) {
      return {
        isValid: true,
        message: '',
        messageType: 'info' as const,
      };
    }

    if (password !== confirmPassword) {
      return {
        isValid: false,
        message: 'Passwords do not match',
        messageType: 'error' as const,
      };
    }

    return {
      isValid: true,
      message: 'Passwords match',
      messageType: 'success' as const,
    };
  }, [password, confirmPassword]);

  const overallValid = passwordValidation.isValid && confirmValidation.isValid;

  return {
    passwordValidation,
    confirmValidation,
    isValid: overallValid,
    canSubmit: overallValid && password.length > 0 && confirmPassword.length > 0,
  };
}
