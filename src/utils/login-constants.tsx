

export const USERNAME_REQUIREMENTS = {
  minLength: 3,
  maxLength: 30,
  regex: /^[a-zA-Z0-9._\-'\s]+$/,
  examples: ['John Doe', 'player_123', 'O\'Connor', 'demo.user']
};

export const LOGIN_MESSAGES = {
  connecting: 'Connecting to server...',
  serverConnected: 'Server connected',
  serverFailed: 'Server connection failed',
  creatingAccount: 'Creating Account...',
  signingIn: 'Signing In...',
  createAccount: 'Create Account',
  signIn: 'Sign In'
};

export const INSTRUCTIONS = {
  emailRequired: 'Required for password recovery',
  emailNotVisible: 'Not visible to other players',
  nextSteps: {
    createGroup: 'Create or join a group to start competing',
    recordMatches: 'Record matches and climb the leaderboard!',
    becomeAdmin: 'Visit your profile to become an admin if needed'
  },
  troubleshooting: {
    serverStartup: 'Server may be starting up (try waiting 30 seconds)',
    checkConsole: 'Check browser console for detailed errors',
    tryRefresh: 'Try refreshing the page'
  }
};