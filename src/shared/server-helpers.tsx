// Consolidated server helper functions for both client and server environments
// Platform-aware implementation that works in browser and Deno

// Environment detection
const isServer = typeof Deno !== 'undefined';
const isBrowser = typeof window !== 'undefined';

export function generateAvatar(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

export function generateGroupCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Convert username to email format for Supabase (which requires email format)
export function usernameToEmail(username: string): string {
  // If it's already an email, return as is (for backward compatibility)
  if (username.includes('@')) {
    return username;
  }

  // Handle empty or null username
  if (!username || username.trim().length === 0) {
    throw new Error('Username cannot be empty');
  }

  // Use the more robust server version of sanitization
  const sanitizedUsername = username
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.') // Replace spaces with dots
    .replace(/'/g, '') // Remove apostrophes
    .replace(/[^a-z0-9._-]/g, '') // Remove other invalid email characters (keep dots, underscores, hyphens)
    .replace(/[._-]{2,}/g, '.') // Replace consecutive special chars with single dot
    .replace(/^[._-]+|[._-]+$/g, ''); // Remove leading/trailing special chars

  // Ensure we have a valid username after sanitization
  if (sanitizedUsername.length === 0) {
    throw new Error('Username contains only invalid characters');
  }

  // Construct email - use environment-specific domain
  const domain = isServer ? 'foosball.local' : 'foosball.local';
  return `${sanitizedUsername}@${domain}`;
}

// Email to username conversion
export function emailToUsername(email: string): string {
  if (!email || !email.includes('@')) {
    return email || '';
  }

  const username = email.split('@')[0];

  // Convert back from email format to readable username
  return username
    .replace(/\./g, ' ') // Convert dots back to spaces
    .replace(/[._-]/g, ' ') // Convert other separators to spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Title case
    .join(' ');
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate username format
export function isValidUsername(username: string): boolean {
  if (!username || username.trim().length === 0) {
    return false;
  }

  // Allow letters, numbers, spaces, apostrophes, dots, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9\s'._-]+$/;
  return usernameRegex.test(username.trim());
}

// Generate a secure random string
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  if (isServer) {
    // Server environment - use crypto if available
    try {
      const crypto = globalThis.crypto || (await import('crypto')).webcrypto;
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
      }
      return result;
    } catch (error) {
      // Fallback to Math.random
    }
  }

  // Browser environment or fallback
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Format date consistently across environments
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Format datetime consistently across environments
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString(); // Full ISO format
}

// Safe JSON parsing with fallback
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    return fallback;
  }
}

// Environment-aware logging
export function logInfo(message: string, data?: any): void {
  if (isServer) {
    // Server logging - could be enhanced with proper logger
    console.log(`[SERVER] ${message}`, data);
  } else {
    // Client logging - development only
    if (import.meta.env?.DEV) {
      console.log(`[CLIENT] ${message}`, data);
    }
  }
}

export function logError(message: string, error?: any): void {
  // Always log errors regardless of environment
  console.error(`[${isServer ? 'SERVER' : 'CLIENT'}] ${message}`, error);
}
