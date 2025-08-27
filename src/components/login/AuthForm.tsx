import React from 'react';
import { User, Lock, Mail, RefreshCw } from 'lucide-react';
import { LOGIN_MESSAGES, USERNAME_REQUIREMENTS, INSTRUCTIONS } from '../../utils/login-constants';
import { logger } from '../../utils/logger';

interface AuthFormProps {
  isLogin: boolean;
  isPasswordReset: boolean;
  isLoading: boolean;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
  username: string;
  setUsername: (username: string) => void;
  error: string;
  validationErrors: any;
  serverStatus: any;
  onSubmit: (e: React.FormEvent) => void;
  onModeSwitch: (isLogin: boolean) => void;
  onPasswordResetToggle: () => void;
}

export function AuthForm({
  isLogin,
  isPasswordReset,
  isLoading,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  name,
  setName,
  username,
  setUsername,
  error,
  validationErrors,
  serverStatus,
  onSubmit,
  onModeSwitch,
  onPasswordResetToggle
}: AuthFormProps) {
  const handleFormSubmit = (e) => {
    logger.debug('AuthForm - Form Submit Triggered', {
      isLogin,
      isPasswordReset,
      email: email ? `[EMAIL:${email.split('@')[1] || 'unknown'}]` : 'empty',
      hasPassword: !!password,
      isLoading,
      serverHealthy: serverStatus?.isHealthy
    });
    onSubmit(e);
  };

  return (
    <div className="p-8">
      {/* Mode Toggle - Hide during password reset */}
      {!isPasswordReset && (
        <div className="flex mb-8">
          <button
            type="button"
            onClick={() => onModeSwitch(true)}
            className={`flex-1 py-3 text-center rounded-l-lg transition-colors ${
              isLogin
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeSwitch(false)}
            className={`flex-1 py-3 text-center rounded-r-lg transition-colors ${
              !isLogin
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Password Reset Header */}
      {isPasswordReset && (
        <div className="mb-8 text-center">
          <h2 className="text-lg text-gray-800 mb-2">Reset Password</h2>
          <p className="text-sm text-gray-600">
            Enter your email address and we'll send you a reset link
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Name Field (Signup Only) */}
        {!isLogin && !isPasswordReset && (
          <div>
            <label className="block text-gray-700 text-sm mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name"
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
            {validationErrors.name && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>
            )}
          </div>
        )}

        {/* Username Field (Signup Only) */}
        {!isLogin && !isPasswordReset && (
          <div>
            <label className="block text-gray-700 text-sm mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            {validationErrors.username && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.username}</p>
            )}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label className="block text-gray-700 text-sm mb-2">
            {isPasswordReset ? 'Email' : (isLogin ? 'Username or Email' : 'Email')}
          </label>
          <div className="relative">
            {(isLogin && !isPasswordReset) ? (
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            ) : (
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            )}
            <input
              type={(isLogin && !isPasswordReset) ? "text" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={
                isPasswordReset
                  ? "Enter your email address"
                  : (isLogin ? "Enter your username or email" : "Enter your email address")
              }
              disabled={isLoading}
              autoComplete={(isLogin && !isPasswordReset) ? "username" : "email"}
            />
          </div>
          {validationErrors.email && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
          )}
          {isLogin && !isPasswordReset && (
            <p className="text-xs text-gray-500 mt-1">
              You can sign in with either your username or email address
            </p>
          )}
        </div>

        {/* Password Field - Hide during password reset */}
        {!isPasswordReset && (
          <div>
            <label className="block text-gray-700 text-sm mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete={!isLogin ? "new-password" : "current-password"}
              />
            </div>
            {validationErrors.password && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.password}</p>
            )}
          </div>
        )}

        {/* Confirm Password Field (Signup Only) */}
        {!isLogin && !isPasswordReset && (
          <div>
            <label className="block text-gray-700 text-sm mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm your password"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            {validationErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.confirmPassword}</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading || (serverStatus && serverStatus.isLoading) || (serverStatus && !serverStatus.isHealthy)}
            onClick={() => {
              const isDisabled = isLoading || (serverStatus && serverStatus.isLoading) || (serverStatus && !serverStatus.isHealthy);
              logger.debug('AuthForm - Button Clicked', {
                isDisabled,
                isLoading,
                serverLoading: serverStatus?.isLoading,
                serverHealthy: serverStatus?.isHealthy
              });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>
                  {isPasswordReset
                    ? 'Sending Reset Email...'
                    : (!isLogin ? 'Creating Account...' : 'Signing In...')
                  }
                </span>
              </>
            ) : (
              <span>
                {isPasswordReset
                  ? 'Send Reset Email'
                  : (!isLogin ? 'Create Account' : 'Sign In')
                }
              </span>
            )}
          </button>
        </div>

        {/* Password Reset Link */}
        {isLogin && !isPasswordReset && (
          <div className="pt-6 text-center">
            <button
              type="button"
              onClick={onPasswordResetToggle}
              className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
            >
              Forgot your password?
            </button>
          </div>
        )}

        {/* Password Reset Mode */}
        {isPasswordReset && (
          <div className="pt-6 text-center">
            <button
              type="button"
              onClick={onPasswordResetToggle}
              className="text-gray-600 hover:text-gray-800 text-sm transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </form>

      {/* Requirements and Instructions */}
      {!isLogin && !isPasswordReset && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-3">Account Requirements:</p>
          <div className="text-xs text-gray-500 space-y-1">
            <div><strong>Password:</strong> Minimum 6 characters</div>
            <div><strong>Email:</strong> Valid email address required for password recovery</div>
            <div><strong>Username:</strong> Letters, numbers, spaces, hyphens, and underscores allowed</div>
          </div>
        </div>
      )}

      {/* Password Reset Instructions */}
      {isPasswordReset && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">Password Reset Instructions:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <div>• Enter the email address associated with your account</div>
            <div>• Check your inbox for a password reset link</div>
            <div>• Follow the link to set a new password</div>
            <div className="pt-2 text-blue-600 italic">
              Note: Email delivery may take a few minutes and depends on your email provider.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
