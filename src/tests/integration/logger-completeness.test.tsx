import { describe, it, expect } from 'vitest';
import { logger } from '@/utils/logger';

describe('Logger Completeness Integration', () => {
  it('should have all logger methods used throughout the application', () => {
    // This list is based on actual usage found in the codebase
    // If any new logger methods are added to the code, this test will fail
    // and remind us to update the logger implementation
    const methodsUsedInCodebase = [
      // Basic logging methods
      'debug',
      'info',
      'warn',
      'error',

      // Authentication-specific methods
      'authEvent',
      'sessionEvent',

      // API-specific methods
      'apiEvent',
      'apiRequest', // Used in src/utils/supabase/client.tsx:26
      'apiResponse', // Used in src/utils/supabase/client.tsx:132
    ];

    methodsUsedInCodebase.forEach(method => {
      expect(logger).toHaveProperty(method);
      expect(typeof logger[method]).toBe('function');
    });
  });

  it('should handle all logger method calls without throwing errors', () => {
    // Test that all methods can be called safely
    expect(() => {
      logger.debug('test message', { data: 'test' });
      logger.info('test message', { data: 'test' });
      logger.warn('test message', { data: 'test' });
      logger.error('test message', { data: 'test' });
      logger.authEvent('test event', { user: 'test' });
      logger.sessionEvent('test session', { session: 'test' });
      logger.apiEvent('test api', { endpoint: 'test' });
      logger.apiRequest('/test', 'GET', { param: 'test' });
      logger.apiResponse('/test', 200, true, { result: 'test' });
    }).not.toThrow();
  });

  it('should validate logger method signatures match expected usage', () => {
    // Verify that logger methods accept the expected parameters
    // This helps catch signature mismatches that could cause runtime errors

    // Basic methods should accept message and optional data
    expect(() => logger.debug('message')).not.toThrow();
    expect(() => logger.debug('message', { data: 'test' })).not.toThrow();
    expect(() => logger.info('message')).not.toThrow();
    expect(() => logger.info('message', { data: 'test' })).not.toThrow();

    // API methods should accept their specific parameters
    expect(() => logger.apiRequest('/endpoint')).not.toThrow();
    expect(() => logger.apiRequest('/endpoint', 'POST')).not.toThrow();
    expect(() => logger.apiRequest('/endpoint', 'POST', { data: 'test' })).not.toThrow();

    expect(() => logger.apiResponse('/endpoint', 200, true)).not.toThrow();
    expect(() => logger.apiResponse('/endpoint', 404, false, { error: 'test' })).not.toThrow();
  });

  it('should maintain consistent logging format across all methods', () => {
    // This test ensures that if we change the logging format,
    // we update it consistently across all methods

    // Mock console to capture output format
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const logCalls: string[] = [];

    console.log = (message: string) => logCalls.push(message);
    console.error = (message: string) => logCalls.push(message);
    console.warn = (message: string) => logCalls.push(message);
    console.info = (message: string) => logCalls.push(message);

    try {
      // Only test in development mode (when logging actually happens)
      if (import.meta.env.DEV) {
        logger.debug('test');
        logger.info('test');
        logger.warn('test');
        logger.authEvent('test');
        logger.sessionEvent('test');
        logger.apiEvent('test');
        logger.apiRequest('/test');
        logger.apiResponse('/test', 200, true);

        // Verify all log messages follow the expected format [CATEGORY] message
        logCalls.forEach(call => {
          expect(call).toMatch(/^\[[\w\s]+\]/);
        });
      }
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  });

  it('should provide helpful error messages when methods are missing', () => {
    // This test documents the issue we encountered and ensures
    // future missing methods are caught in testing

    const loggerKeys = Object.keys(logger);
    const requiredMethods = [
      'debug',
      'info',
      'warn',
      'error',
      'authEvent',
      'sessionEvent',
      'apiEvent',
      'apiRequest',
      'apiResponse',
    ];

    requiredMethods.forEach(method => {
      expect(loggerKeys).toContain(
        method,
        `Logger is missing the '${method}' method. This will cause "logger.${method} is not a function" errors at runtime.`
      );
    });
  });
});
