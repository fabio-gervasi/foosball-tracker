import { describe, it, expect } from 'vitest';
import {
  getPasswordByteLength,
  validatePasswordLength,
  validatePasswordRealtime,
  getPasswordErrorMessage,
  hasMultiByteCharacters,
  SUPABASE_PASSWORD_BYTE_LIMIT,
  RECOMMENDED_CHARACTER_LIMIT,
} from '../../../utils/password-validation';

describe('Password Validation Utilities', () => {
  describe('getPasswordByteLength', () => {
    it('should return 0 for empty string', () => {
      expect(getPasswordByteLength('')).toBe(0);
    });

    it('should calculate correct byte length for ASCII characters', () => {
      expect(getPasswordByteLength('password123')).toBe(11);
      expect(getPasswordByteLength('Hello World!')).toBe(12);
    });

    it('should calculate correct byte length for UTF-8 characters', () => {
      // Accented characters (2 bytes each)
      expect(getPasswordByteLength('café')).toBe(5); // c(1) + a(1) + f(1) + é(2) = 5
      expect(getPasswordByteLength('niño')).toBe(5); // n(1) + i(1) + ñ(2) + o(1) = 5

      // Chinese characters (3 bytes each)
      expect(getPasswordByteLength('中文')).toBe(6); // 中(3) + 文(3) = 6

      // Emoji (4 bytes each)
      expect(getPasswordByteLength('🔐')).toBe(4);
      expect(getPasswordByteLength('🔐🔑')).toBe(8);

      // Mixed characters
      expect(getPasswordByteLength('pass🔐word')).toBe(12); // pass(4) + 🔐(4) + word(4) = 12
    });

    it('should handle complex UTF-8 combinations', () => {
      const complexPassword = 'Hëllö🌍Wörld!中文';
      // H(1) + ë(2) + l(1) + l(1) + ö(2) + 🌍(4) + W(1) + ö(2) + r(1) + l(1) + d(1) + !(1) + 中(3) + 文(3) = 24
      expect(getPasswordByteLength(complexPassword)).toBe(24);
    });
  });

  describe('validatePasswordLength', () => {
    it('should validate empty password', () => {
      const result = validatePasswordLength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
      expect(result.byteLength).toBe(0);
      expect(result.characterLength).toBe(0);
    });

    it('should validate short password', () => {
      const result = validatePasswordLength('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.byteLength).toBe(5);
      expect(result.characterLength).toBe(5);
    });

    it('should validate normal password', () => {
      const result = validatePasswordLength('password123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.byteLength).toBe(11);
      expect(result.characterLength).toBe(11);
    });

    it('should reject password exceeding byte limit', () => {
      // Create a password that exceeds 72 bytes using emoji
      const longPassword = '🔐'.repeat(19); // 19 * 4 = 76 bytes, but actual is 19 characters
      const result = validatePasswordLength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.byteLength).toBe(76);
      expect(result.characterLength).toBe(longPassword.length); // Use actual length
      expect(result.errors[0]).toContain('Password is too long');
      expect(result.errors[0]).toContain('76 bytes');
      expect(result.errors[0]).toContain('72 bytes');
    });

    it('should warn when approaching byte limit', () => {
      // Create a password that is close to the limit
      const nearLimitPassword = `${'🔐'.repeat(17)}a`; // 17 * 4 + 1 = 69 bytes
      const result = validatePasswordLength(nearLimitPassword);

      expect(result.isValid).toBe(true);
      expect(result.byteLength).toBe(69);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('close to the byte limit');
    });

    it('should calculate password strength correctly', () => {
      const weakResult = validatePasswordLength('password');
      expect(weakResult.strength.score).toBeLessThan(4);
      expect(['Very Weak', 'Weak', 'Fair']).toContain(weakResult.strength.label);

      const strongResult = validatePasswordLength('P@ssw0rd123!');
      expect(strongResult.strength.score).toBeGreaterThan(2);
      expect(['Strong', 'Very Strong']).toContain(strongResult.strength.label);
    });
  });

  describe('validatePasswordRealtime', () => {
    it('should provide real-time feedback for empty password', () => {
      const result = validatePasswordRealtime('');
      expect(result.messageType).toBe('error'); // Empty password is an error
      expect(result.message).toContain('required');
    });

    it('should provide error feedback for invalid password', () => {
      const longPassword = '🔐'.repeat(19); // 76 bytes
      const result = validatePasswordRealtime(longPassword);
      expect(result.messageType).toBe('error');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('too long');
    });

    it('should provide success feedback for valid password', () => {
      const result = validatePasswordRealtime('ValidPass123!');
      expect(result.messageType).toBe('success');
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should provide warning for passwords near limit', () => {
      const nearLimitPassword = `${'🔐'.repeat(17)}a`; // 69 bytes
      const result = validatePasswordRealtime(nearLimitPassword);
      expect(result.messageType).toBe('warning');
      expect(result.isValid).toBe(true);
    });
  });

  describe('getPasswordErrorMessage', () => {
    it('should prioritize byte length errors', () => {
      const validation = {
        isValid: false,
        byteLength: 76,
        characterLength: 19,
        errors: ['Password is too long (76 bytes). Maximum allowed is 72 bytes.', 'Other error'],
        warnings: [],
        strength: { score: 0, label: 'Very Weak', color: 'text-red-500' },
      };

      const message = getPasswordErrorMessage(validation);
      expect(message).toContain('Password too long');
      expect(message).toContain('60 characters or fewer');
      expect(message).toContain('19 characters');
      expect(message).toContain('76 bytes');
    });

    it('should return other errors when no byte length error', () => {
      const validation = {
        isValid: false,
        byteLength: 5,
        characterLength: 5,
        errors: ['Password must be at least 8 characters long'],
        warnings: [],
        strength: { score: 0, label: 'Very Weak', color: 'text-red-500' },
      };

      const message = getPasswordErrorMessage(validation);
      expect(message).toBe('Password must be at least 8 characters long');
    });
  });

  describe('hasMultiByteCharacters', () => {
    it('should detect single-byte characters', () => {
      expect(hasMultiByteCharacters('password123')).toBe(false);
      expect(hasMultiByteCharacters('Hello World!')).toBe(false);
    });

    it('should detect multi-byte characters', () => {
      expect(hasMultiByteCharacters('café')).toBe(true);
      expect(hasMultiByteCharacters('niño')).toBe(true);
      expect(hasMultiByteCharacters('🔐')).toBe(true);
      expect(hasMultiByteCharacters('中文')).toBe(true);
      expect(hasMultiByteCharacters('password🔐')).toBe(true);
    });
  });

  describe('Edge cases and security', () => {
    it('should handle very long ASCII passwords', () => {
      const longAsciiPassword = 'a'.repeat(80); // 80 bytes, 80 characters
      const result = validatePasswordLength(longAsciiPassword);

      expect(result.isValid).toBe(false);
      expect(result.byteLength).toBe(80);
      expect(result.characterLength).toBe(80);
      expect(result.errors[0]).toContain('too long');
    });

    it('should handle exactly 72-byte password', () => {
      const exactLimitPassword = 'a'.repeat(72); // Exactly 72 bytes
      const result = validatePasswordLength(exactLimitPassword);

      expect(result.isValid).toBe(true);
      expect(result.byteLength).toBe(72);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle 73-byte password (just over limit)', () => {
      const overLimitPassword = 'a'.repeat(73); // 73 bytes
      const result = validatePasswordLength(overLimitPassword);

      expect(result.isValid).toBe(false);
      expect(result.byteLength).toBe(73);
      expect(result.errors[0]).toContain('too long');
    });

    it('should handle mixed character sets correctly', () => {
      // Password with mix of 1, 2, 3, and 4-byte characters
      const mixedPassword = 'Aé中🔐'; // A(1) + é(2) + 中(3) + 🔐(4) = 10 bytes, 5 chars (emoji counts as 2 chars in JS)
      const result = validatePasswordLength(mixedPassword);

      expect(result.byteLength).toBe(10);
      expect(result.characterLength).toBe(mixedPassword.length); // Use actual length
      expect(result.isValid).toBe(false); // Too short (< 8 characters)
    });

    it('should validate constants are correct', () => {
      expect(SUPABASE_PASSWORD_BYTE_LIMIT).toBe(72);
      expect(RECOMMENDED_CHARACTER_LIMIT).toBe(60);
    });
  });

  describe('Real-world password scenarios', () => {
    const testCases = [
      {
        name: 'Simple English password',
        password: 'MyPassword123!',
        expectedBytes: 14,
        expectedValid: true,
      },
      {
        name: 'Spanish password with accents',
        password: 'MiContraseña123!',
        expectedBytes: 17, // ñ is 2 bytes
        expectedValid: true,
      },
      {
        name: 'French password with accents',
        password: 'MonMotDePasse123!',
        expectedBytes: 17,
        expectedValid: true,
      },
      {
        name: 'Password with emoji',
        password: 'MyPass🔐123!',
        expectedBytes: 14, // MyPass(6) + 🔐(4) + 123!(4) = 14 bytes
        expectedValid: true,
      },
      {
        name: 'Long password approaching limit',
        password: 'ThisIsAVeryLongPasswordThatApproachesTheLimit123!🔐',
        expectedBytes: 53, // Calculate actual bytes
        expectedValid: true,
      },
      {
        name: 'Password exceeding limit with emojis',
        password: '🔐🔑🛡️🔒🗝️🔓🔐🔑🛡️🔒🗝️🔓🔐🔑🛡️🔒🗝️🔓🔐🔑', // Many 4-byte emojis
        expectedBytes: 98, // Actual calculated bytes (some emojis are more than 4 bytes)
        expectedValid: false,
      },
    ];

    testCases.forEach(({ name, password, expectedBytes, expectedValid }) => {
      it(`should handle ${name}`, () => {
        const result = validatePasswordLength(password);
        expect(result.byteLength).toBe(expectedBytes);
        expect(result.isValid).toBe(expectedValid);

        if (!expectedValid && expectedBytes > SUPABASE_PASSWORD_BYTE_LIMIT) {
          expect(result.errors[0]).toContain('too long');
        }
      });
    });
  });
});
