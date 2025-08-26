/**
 * Environment-based logger utility for secure logging
 * Prevents sensitive data exposure in production builds
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    // Determine environment based on Vite's NODE_ENV or import.meta.env.DEV
    this.isDevelopment = import.meta.env?.DEV || import.meta.env?.NODE_ENV === 'development';

    // Set log level based on environment
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(prefix: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${prefix} ${message}`;

    if (data !== undefined) {
      console.log(formattedMessage, data);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Log error messages - always shown in all environments
   */
  error(message: string, error?: Error | any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (error instanceof Error) {
        console.error(`[ERROR] ${message}`, error.message);
        if (this.isDevelopment && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      } else if (error) {
        console.error(`[ERROR] ${message}`, error);
      } else {
        console.error(`[ERROR] ${message}`);
      }
    }
  }

  /**
   * Log warning messages - only in development
   */
  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      if (data !== undefined) {
        console.warn(`[WARN] ${message}`, data);
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  }

  /**
   * Log info messages - only in development
   */
  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.formatMessage('[INFO]', message, data);
    }
  }

  /**
   * Log debug messages - only in development
   */
  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.formatMessage('[DEBUG]', message, data);
    }
  }

  /**
   * Secure API logging - never logs sensitive data
   */
  apiRequest(endpoint: string, method: string = 'GET', hasAuth: boolean = false): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.info(`API Request: ${method} ${endpoint}`, {
        hasAuth,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Secure API response logging
   */
  apiResponse(endpoint: string, status: number, success: boolean): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.info(`API Response: ${endpoint}`, {
        status,
        success,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Secure auth logging - never logs tokens or session details
   */
  authEvent(event: string, success: boolean = true): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.info(`Auth Event: ${event}`, { success });
    }
  }

  /**
   * Session logging - only logs safe metadata
   */
  sessionEvent(event: 'created' | 'validated' | 'refreshed' | 'expired' | 'cleared', userId?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.info(`Session ${event}`, {
        hasUser: !!userId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check if development mode for conditional logging
   */
  get isDev(): boolean {
    return this.isDevelopment;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, error?: Error | any) => logger.error(message, error);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
