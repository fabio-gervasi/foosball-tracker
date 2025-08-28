// General utility functions for the server

export function generateAvatar(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
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
  
  // Sanitize username for email format - allow letters, numbers, dots, underscores, hyphens
  let sanitizedUsername = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, '') // Remove invalid email characters (keep dots, underscores, hyphens)
    .replace(/[._-]{2,}/g, '.') // Replace consecutive special chars with single dot
    .replace(/^[._-]+|[._-]+$/g, ''); // Remove leading/trailing special chars
    
  // Ensure we have something left
  if (sanitizedUsername.length === 0) {
    // Fallback: use a sanitized version of original username
    sanitizedUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
      .substring(0, 20); // Limit length
      
    if (sanitizedUsername.length === 0) {
      throw new Error('Username contains no valid email characters');
    }
  }
  
  // Ensure it starts and ends with alphanumeric
  sanitizedUsername = sanitizedUsername.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
  
  if (sanitizedUsername.length === 0) {
    throw new Error('Username must contain letters or numbers');
  }
  
  // Ensure minimum length
  if (sanitizedUsername.length < 2) {
    sanitizedUsername = `${sanitizedUsername  }01`; // Add numbers to make it longer
  }
  
  // Convert username to fake email format for Supabase using a valid domain
  return `${sanitizedUsername}@foosball.app`;
}

// Convert email back to username for display
export function emailToUsername(email: string): string {
  // If it's our fake email format, extract the username
  if (email.endsWith('@foosball.app')) {
    return email.replace('@foosball.app', '');
  }
  // Otherwise, return the email as is (for backward compatibility)
  return email;
}

// Validation functions
export function validateUsername(username: string): string | null {
  if (!username || username.trim().length === 0) {
    return 'Username is required';
  }
  
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, dots, underscores, and hyphens';
  }
  
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
}