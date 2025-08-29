import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@/utils/logger';

// Mock console methods to test logging behavior
const mockConsole = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('Logger Utility', () => {
  beforeEach(() => {
    // Mock console methods
    vi.stubGlobal('console', mockConsole);

    // Clear all mocks
    vi.clearAllMocks();

    // Mock environment as development
    vi.stubEnv('DEV', true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('Basic logging methods', () => {
    it('should have debug method that logs in development', () => {
      logger.debug('Test debug message', { data: 'test' });

      expect(mockConsole.info).toHaveBeenCalledWith('[DEBUG] Test debug message', { data: 'test' });
    });

    it('should have info method that logs in development', () => {
      logger.info('Test info message', { data: 'test' });

      expect(mockConsole.info).toHaveBeenCalledWith('[INFO] Test info message', { data: 'test' });
    });

    it('should have warn method that logs in development', () => {
      logger.warn('Test warn message', { data: 'test' });

      expect(mockConsole.warn).toHaveBeenCalledWith('[WARN] Test warn message', { data: 'test' });
    });

    it('should have error method that always logs', () => {
      logger.error('Test error message', { error: 'test' });

      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR] Test error message', {
        error: 'test',
      });
    });
  });

  describe('Authentication logging methods', () => {
    it('should have authEvent method that logs in development', () => {
      logger.authEvent('User signed in', { userId: '123' });

      expect(mockConsole.info).toHaveBeenCalledWith('[AUTH] User signed in', { userId: '123' });
    });

    it('should have sessionEvent method that logs in development', () => {
      logger.sessionEvent('Session created', { sessionId: 'abc' });

      expect(mockConsole.info).toHaveBeenCalledWith('[SESSION] Session created', {
        sessionId: 'abc',
      });
    });
  });

  describe('API logging methods', () => {
    it('should have apiEvent method that logs in development', () => {
      logger.apiEvent('API call completed', { endpoint: '/users' });

      expect(mockConsole.info).toHaveBeenCalledWith('[API] API call completed', {
        endpoint: '/users',
      });
    });

    it('should have apiRequest method that logs in development', () => {
      logger.apiRequest('/api/users', 'GET', { param: 'value' });

      expect(mockConsole.info).toHaveBeenCalledWith('[API REQUEST] GET /api/users', {
        param: 'value',
      });
    });

    it('should handle apiRequest with default method', () => {
      logger.apiRequest('/api/users');

      expect(mockConsole.info).toHaveBeenCalledWith('[API REQUEST] GET /api/users', undefined);
    });

    it('should have apiResponse method that logs in development', () => {
      logger.apiResponse('/api/users', 200, true, { users: [] });

      expect(mockConsole.info).toHaveBeenCalledWith('[API RESPONSE] SUCCESS 200 /api/users', {
        users: [],
      });
    });

    it('should log error responses with apiResponse', () => {
      logger.apiResponse('/api/users', 404, false, { error: 'Not found' });

      expect(mockConsole.info).toHaveBeenCalledWith('[API RESPONSE] ERROR 404 /api/users', {
        error: 'Not found',
      });
    });

    it('should handle apiResponse without data parameter', () => {
      logger.apiResponse('/api/users', 200, true);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[API RESPONSE] SUCCESS 200 /api/users',
        undefined
      );
    });
  });

  describe('Production environment behavior', () => {
    beforeEach(() => {
      // Mock environment as production
      vi.stubEnv('DEV', false);
      // Also stub import.meta.env.DEV for the logger
      Object.defineProperty(import.meta, 'env', {
        value: { DEV: false },
        writable: true,
      });
    });

    it('should not log debug messages in production', () => {
      logger.debug('Debug message');

      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should not log info messages in production', () => {
      logger.info('Info message');

      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should not log auth events in production', () => {
      logger.authEvent('Auth event');

      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should still log errors in production', () => {
      logger.error('Error message', { error: 'test' });

      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR] Error message', { error: 'test' });
    });
  });

  describe('Logger interface completeness', () => {
    it('should have all required methods defined', () => {
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
        expect(logger).toHaveProperty(method);
        expect(typeof (logger as any)[method]).toBe('function');
      });
    });

    it('should not throw errors when calling any logger method', () => {
      expect(() => logger.debug('test')).not.toThrow();
      expect(() => logger.info('test')).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
      expect(() => logger.authEvent('test')).not.toThrow();
      expect(() => logger.sessionEvent('test')).not.toThrow();
      expect(() => logger.apiEvent('test')).not.toThrow();
      expect(() => logger.apiRequest('/test')).not.toThrow();
      expect(() => logger.apiResponse('/test', 200, true)).not.toThrow();
    });
  });
});
