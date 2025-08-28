/**
 * Server-side logger utility for Deno/Edge Functions
 * Compatible with Supabase Edge Functions environment
 */

export enum ServerLogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface SanitizedData {
  [key: string]: any;
}

// Sensitive field patterns that should be sanitized
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'accessToken',
  'refreshToken',
  'authorization',
  'auth',
  'session',
  'secret',
  'key',
  'credentials',
];

// Email regex for sanitization
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

class ServerLogger {
  private logLevel: ServerLogLevel;

  constructor() {
    // In production Edge Functions, only log errors by default
    // In development/local, allow more verbose logging
    const env = Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'development';
    this.logLevel = env === 'production' ? ServerLogLevel.ERROR : ServerLogLevel.DEBUG;
  }

  private shouldLog(level: ServerLogLevel): boolean {
    return level <= this.logLevel;
  }

  /**
   * Sanitize sensitive data from objects and strings
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: SanitizedData = {};

      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        // Check if field name contains sensitive patterns
        const isSensitiveField = SENSITIVE_FIELDS.some(field =>
          lowerKey.includes(field.toLowerCase())
        );

        if (isSensitiveField) {
          if (typeof value === 'string' && value.length > 0) {
            sanitized[key] = `[REDACTED:${value.length}chars]`;
          } else {
            sanitized[key] = '[REDACTED]';
          }
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize sensitive data from strings
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    // Sanitize email addresses - show only domain
    let sanitized = str.replace(EMAIL_REGEX, (match, username, domain) => {
      return `[EMAIL:${domain}]`;
    });

    // Sanitize JWT tokens (basic pattern)
    sanitized = sanitized.replace(
      /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g,
      '[JWT_TOKEN]'
    );

    // Sanitize bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/gi, 'Bearer [REDACTED]');

    return sanitized;
  }

  private formatMessage(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    if (data !== undefined) {
      const sanitizedData = this.sanitizeData(data);
      console.log(formattedMessage, sanitizedData);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Log error messages - always shown in all environments
   */
  error(message: string, error?: Error | any): void {
    if (this.shouldLog(ServerLogLevel.ERROR)) {
      const sanitizedMessage = this.sanitizeString(message);

      if (error instanceof Error) {
        console.error(`[ERROR] ${sanitizedMessage}`, error.message);
        // In development, show stack trace
        if (this.logLevel >= ServerLogLevel.DEBUG && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } else if (error) {
        const sanitizedError = this.sanitizeData(error);
        console.error(`[ERROR] ${sanitizedMessage}`, sanitizedError);
      } else {
        console.error(`[ERROR] ${sanitizedMessage}`);
      }
    }
  }

  /**
   * Log warning messages - only in development
   */
  warn(message: string, data?: any): void {
    if (this.shouldLog(ServerLogLevel.WARN)) {
      const sanitizedMessage = this.sanitizeString(message);
      this.formatMessage('WARN', sanitizedMessage, data);
    }
  }

  /**
   * Log info messages - only in development
   */
  info(message: string, data?: any): void {
    if (this.shouldLog(ServerLogLevel.INFO)) {
      const sanitizedMessage = this.sanitizeString(message);
      this.formatMessage('INFO', sanitizedMessage, data);
    }
  }

  /**
   * Log debug messages - only in development
   */
  debug(message: string, data?: any): void {
    if (this.shouldLog(ServerLogLevel.DEBUG)) {
      const sanitizedMessage = this.sanitizeString(message);
      this.formatMessage('DEBUG', sanitizedMessage, data);
    }
  }

  /**
   * Secure API logging - never logs sensitive data
   */
  apiRequest(endpoint: string, method: string = 'GET', hasAuth: boolean = false): void {
    if (this.shouldLog(ServerLogLevel.INFO)) {
      this.info(`API Request: ${method} ${endpoint}`, {
        hasAuth,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Secure API response logging
   */
  apiResponse(endpoint: string, status: number, success: boolean): void {
    if (this.shouldLog(ServerLogLevel.INFO)) {
      this.info(`API Response: ${endpoint}`, {
        status,
        success,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Secure auth logging - never logs tokens or session details
   */
  authEvent(event: string, success: boolean = true): void {
    if (this.shouldLog(ServerLogLevel.INFO)) {
      this.info(`Auth Event: ${event}`, { success });
    }
  }

  /**
   * Database operation logging
   */
  dbOperation(operation: string, table: string, success: boolean, recordCount?: number): void {
    if (this.shouldLog(ServerLogLevel.INFO)) {
      this.info(`DB ${operation}: ${table}`, {
        success,
        recordCount: recordCount || 0,
      });
    }
  }

  /**
   * Public method to sanitize data for external use
   */
  sanitize(data: any): any {
    return this.sanitizeData(data);
  }

  /**
   * Check if development mode for conditional logging
   */
  get isDev(): boolean {
    return this.logLevel >= ServerLogLevel.DEBUG;
  }
}

// Export singleton instance
export const serverLogger = new ServerLogger();

// Export convenience functions
export const logError = (message: string, error?: Error | any) =>
  serverLogger.error(message, error);
export const logWarn = (message: string, data?: any) => serverLogger.warn(message, data);
export const logInfo = (message: string, data?: any) => serverLogger.info(message, data);
export const logDebug = (message: string, data?: any) => serverLogger.debug(message, data);
