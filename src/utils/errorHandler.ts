import { logger } from './logger';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// User-friendly error interface
export interface UserFriendlyError extends Error {
  message: string;
  code: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  action?: string; // Suggested user action
  originalError?: Error;
  context?: Record<string, any>;
}

// Network error interface
export interface NetworkError extends Error {
  status?: number;
  statusText?: string;
  response?: any;
}

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Error categories for better handling
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

// Error code mappings for user-friendly messages
const ERROR_MESSAGES: Record<
  string,
  { message: string; action?: string; severity: ErrorSeverity }
> = {
  // Network errors
  NETWORK_ERROR: {
    message: 'Unable to connect to the server. Please check your internet connection.',
    action: 'Check your internet connection and try again.',
    severity: 'error',
  },
  REQUEST_TIMEOUT: {
    message: 'The request is taking longer than expected.',
    action: 'Please try again in a moment.',
    severity: 'warning',
  },
  SERVER_UNAVAILABLE: {
    message: 'The server is temporarily unavailable.',
    action: 'Please try again in a few minutes.',
    severity: 'error',
  },

  // Authentication errors
  AUTH_REQUIRED: {
    message: 'You need to sign in to access this feature.',
    action: 'Please sign in to continue.',
    severity: 'info',
  },
  AUTH_EXPIRED: {
    message: 'Your session has expired.',
    action: 'Please sign in again.',
    severity: 'warning',
  },
  AUTH_INVALID: {
    message: 'Your credentials are invalid.',
    action: 'Please check your email and password.',
    severity: 'error',
  },

  // Authorization errors
  ACCESS_DENIED: {
    message: "You don't have permission to perform this action.",
    action: 'Contact an administrator if you need access.',
    severity: 'warning',
  },
  INSUFFICIENT_PERMISSIONS: {
    message: "You don't have sufficient permissions.",
    action: 'Contact an administrator for assistance.',
    severity: 'warning',
  },

  // Validation errors
  VALIDATION_ERROR: {
    message: 'Please check the information you entered.',
    action: 'Correct the highlighted fields and try again.',
    severity: 'info',
  },
  REQUIRED_FIELD: {
    message: 'Some required fields are missing.',
    action: 'Please fill in all required fields.',
    severity: 'info',
  },
  INVALID_FORMAT: {
    message: 'Some fields have invalid formats.',
    action: 'Please check the format of your entries.',
    severity: 'info',
  },

  // Server errors
  SERVER_ERROR: {
    message: 'Something went wrong on our end.',
    action: 'Please try again later or contact support if the problem persists.',
    severity: 'error',
  },
  NOT_FOUND: {
    message: 'The requested resource was not found.',
    action: 'Please check the URL or contact support.',
    severity: 'warning',
  },
  CONFLICT: {
    message: 'This action conflicts with existing data.',
    action: 'Please refresh the page and try again.',
    severity: 'warning',
  },

  // Client errors
  INVALID_REQUEST: {
    message: 'The request format is invalid.',
    action: 'Please try again or contact support.',
    severity: 'error',
  },
  RATE_LIMITED: {
    message: 'Too many requests. Please slow down.',
    action: 'Wait a moment before trying again.',
    severity: 'warning',
  },

  // Generic fallback
  UNKNOWN_ERROR: {
    message: 'An unexpected error occurred.',
    action: 'Please try again or contact support if the problem persists.',
    severity: 'error',
  },
};

// HTTP status code to error code mapping
const STATUS_CODE_MAPPING: Record<number, string> = {
  400: 'INVALID_REQUEST',
  401: 'AUTH_REQUIRED',
  403: 'ACCESS_DENIED',
  404: 'NOT_FOUND',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  502: 'SERVER_UNAVAILABLE',
  503: 'SERVER_UNAVAILABLE',
  504: 'REQUEST_TIMEOUT',
};

/**
 * Enhanced error handler class with comprehensive error processing
 */
class ErrorHandler {
  /**
   * Determine error category from error object
   */
  private categorizeError(error: any): ErrorCategory {
    if (error.name === 'AbortError') {
      return ErrorCategory.CANCELLED;
    }

    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      return ErrorCategory.TIMEOUT;
    }

    if (
      error.message?.includes('network') ||
      error.message?.includes('Network') ||
      error.message?.includes('fetch')
    ) {
      return ErrorCategory.NETWORK;
    }

    if (error.status) {
      if (error.status === 401) return ErrorCategory.AUTHENTICATION;
      if (error.status === 403) return ErrorCategory.AUTHORIZATION;
      if (error.status >= 400 && error.status < 500) return ErrorCategory.CLIENT;
      if (error.status >= 500) return ErrorCategory.SERVER;
    }

    if (error.message?.toLowerCase().includes('validation')) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: any, category: ErrorCategory): string {
    // Check for explicit error code
    if (error.code) {
      return error.code;
    }

    // Map HTTP status codes
    if (error.status && STATUS_CODE_MAPPING[error.status]) {
      return STATUS_CODE_MAPPING[error.status];
    }

    // Map based on category
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'NETWORK_ERROR';
      case ErrorCategory.TIMEOUT:
        return 'REQUEST_TIMEOUT';
      case ErrorCategory.AUTHENTICATION:
        return 'AUTH_REQUIRED';
      case ErrorCategory.AUTHORIZATION:
        return 'ACCESS_DENIED';
      case ErrorCategory.VALIDATION:
        return 'VALIDATION_ERROR';
      case ErrorCategory.SERVER:
        return 'SERVER_ERROR';
      case ErrorCategory.CLIENT:
        return 'INVALID_REQUEST';
      case ErrorCategory.CANCELLED:
        return 'REQUEST_CANCELLED';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Determine if error is recoverable (can be retried)
   */
  private isRecoverable(error: any, category: ErrorCategory): boolean {
    // Never retry authentication or authorization errors
    if (category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.AUTHORIZATION) {
      return false;
    }

    // Never retry validation errors
    if (category === ErrorCategory.VALIDATION) {
      return false;
    }

    // Never retry cancelled requests
    if (category === ErrorCategory.CANCELLED) {
      return false;
    }

    // Retry network and timeout errors
    if (category === ErrorCategory.NETWORK || category === ErrorCategory.TIMEOUT) {
      return true;
    }

    // Retry server errors (5xx)
    if (category === ErrorCategory.SERVER) {
      return true;
    }

    // Don't retry client errors (4xx) except for specific cases
    if (category === ErrorCategory.CLIENT) {
      return error.status === 408 || error.status === 429; // Timeout or rate limit
    }

    return false;
  }

  /**
   * Main error processing function
   */
  handleApiError(error: any, context?: Record<string, any>): UserFriendlyError {
    const category = this.categorizeError(error);
    const code = this.extractErrorCode(error, category);
    const recoverable = this.isRecoverable(error, category);

    // Get user-friendly message
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES['UNKNOWN_ERROR'];

    // Create enhanced error object
    const userFriendlyError: UserFriendlyError = {
      name: 'UserFriendlyError',
      message: errorInfo.message,
      code,
      severity: errorInfo.severity,
      recoverable,
      action: errorInfo.action,
      originalError: error,
      context,
    };

    // Log error with appropriate level
    const logLevel =
      errorInfo.severity === 'critical' || errorInfo.severity === 'error' ? 'error' : 'warn';

    if (logLevel === 'error') {
      logger.error('API Error processed', {
        code,
        category,
        recoverable,
        severity: errorInfo.severity,
        originalMessage: error.message,
        context,
      });
    } else {
      logger.warn('API Warning processed', {
        code,
        category,
        recoverable,
        severity: errorInfo.severity,
        originalMessage: error.message,
        context,
      });
    }

    return userFriendlyError;
  }

  /**
   * Handle authentication-specific errors
   */
  handleAuthError(error: any): UserFriendlyError {
    logger.debug('Processing authentication error', { error: error.message });

    let code = 'AUTH_INVALID';

    if (error.message?.includes('expired') || error.message?.includes('JWT')) {
      code = 'AUTH_EXPIRED';
    } else if (error.message?.includes('required') || error.message?.includes('session')) {
      code = 'AUTH_REQUIRED';
    }

    const errorInfo = ERROR_MESSAGES[code];

    const authError: UserFriendlyError = {
      name: 'UserFriendlyError',
      message: errorInfo.message,
      code,
      severity: errorInfo.severity,
      recoverable: false, // Auth errors typically require user action
      action: errorInfo.action,
      originalError: error,
    };

    // Trigger auth state cleanup for expired sessions
    if (code === 'AUTH_EXPIRED') {
      // This could trigger a logout or token refresh
      logger.info('Authentication expired, may need to refresh session');
    }

    return authError;
  }

  /**
   * Handle validation errors from forms or API
   */
  handleValidationError(errors: ValidationError[]): Record<string, string> {
    const fieldErrors: Record<string, string> = {};

    errors.forEach(error => {
      fieldErrors[error.field] = error.message;

      logger.debug('Validation error processed', {
        field: error.field,
        code: error.code,
        message: error.message,
      });
    });

    return fieldErrors;
  }

  /**
   * Handle network-specific errors
   */
  handleNetworkError(error: NetworkError): UserFriendlyError {
    logger.debug('Processing network error', {
      status: error.status,
      statusText: error.statusText,
    });

    let code = 'NETWORK_ERROR';

    if (error.status === 0 || !navigator.onLine) {
      code = 'NETWORK_ERROR';
    } else if (error.status && error.status >= 500) {
      code = 'SERVER_UNAVAILABLE';
    } else if (error.message?.includes('timeout')) {
      code = 'REQUEST_TIMEOUT';
    }

    const errorInfo = ERROR_MESSAGES[code];

    return {
      name: 'UserFriendlyError',
      message: errorInfo.message,
      code,
      severity: errorInfo.severity,
      recoverable: true, // Network errors are generally recoverable
      action: errorInfo.action,
      originalError: error,
    };
  }

  /**
   * Check if an error can be retried
   */
  canRetry(error: any): boolean {
    const category = this.categorizeError(error);
    return this.isRecoverable(error, category);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Report error to external service (placeholder for future implementation)
   */
  reportError(error: Error, context?: Record<string, any>): void {
    // In development, just log
    if (import.meta.env?.DEV) {
      logger.debug('Error reported for external tracking', {
        message: error.message,
        stack: error.stack,
        context,
      });
      return;
    }

    // In production, this could send to error tracking service
    // like Sentry, LogRocket, etc.
    try {
      // Placeholder for error reporting service
      logger.info('Error reported to tracking service', {
        message: error.message,
        hasContext: !!context,
      });
    } catch (reportingError) {
      logger.error('Failed to report error to tracking service', reportingError);
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleApiError = (error: any, context?: Record<string, any>): UserFriendlyError => {
  return errorHandler.handleApiError(error, context);
};

export const handleAuthError = (error: any): UserFriendlyError => {
  return errorHandler.handleAuthError(error);
};

export const handleValidationError = (errors: ValidationError[]): Record<string, string> => {
  return errorHandler.handleValidationError(errors);
};

export const handleNetworkError = (error: NetworkError): UserFriendlyError => {
  return errorHandler.handleNetworkError(error);
};

export const canRetryError = (error: any): boolean => {
  return errorHandler.canRetry(error);
};

export const getRetryDelay = (attempt: number, baseDelay?: number): number => {
  return errorHandler.getRetryDelay(attempt, baseDelay);
};

export const reportError = (error: Error, context?: Record<string, any>): void => {
  return errorHandler.reportError(error, context);
};

// Types are exported as interfaces above
