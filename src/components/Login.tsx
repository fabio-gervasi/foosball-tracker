import React, { useState, useEffect } from "react";
import { User, Lock, Mail, Server, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from "./figma/ImageWithFallback";
import foosballIcon from "../assets/foosball-icon.png";
import { apiRequest, supabase } from "../utils/supabase/client";
import {
  validateUsername,
  validateEmail,
  checkServerStatus,
  transformErrorMessage,
} from "../utils/login-helpers";

export function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState({
    isHealthy: false,
    isLoading: true,
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    const status = await checkServerStatus();
    setServerStatus(status);
  };

  const validateForm = () => {
    const errors = {};

    if (!email.trim()) {
      errors.email = isLogin ? "Username or email is required" : "Email is required";
    } else if (!isLogin && validateEmail(email)) {
      // Only validate email format for signup mode
      errors.email = validateEmail(email);
    } else if (isPasswordReset && validateEmail(email)) {
      // Validate email format for password reset
      errors.email = validateEmail(email);
    }

    if (!isPasswordReset) {
      if (!password) {
        errors.password = "Password is required";
      }

      if (!isLogin) {
        if (!name.trim()) {
          errors.name = "Name is required";
        }

        if (!username.trim()) {
          errors.username = "Username is required";
        } else if (validateUsername(username)) {
          errors.username = validateUsername(username);
        }

        if (password !== confirmPassword) {
          errors.confirmPassword = "Passwords do not match";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setUsername("");
    setError("");
    setValidationErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isPasswordReset) {
        // Send password reset email through Supabase Auth
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/password-reset-callback`,
          });

        if (resetError) {
          throw resetError;
        }

        alert(
          "Password reset email sent! Please check your inbox and follow the instructions.",
        );

        // Reset form and go back to login
        resetForm();
        setIsPasswordReset(false);
        return;
      }

      if (isLogin) {
        // Check if input looks like an email or username
        const isEmailFormat = email.includes('@');

        if (isEmailFormat) {
          // Step 1: Authenticate with Supabase directly for email
          const { data, error: authError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (authError) {
            throw authError;
          }

          if (!data.session?.access_token) {
            throw new Error("No access token received");
          }

          // Step 2: Validate with our server and get user profile
          const response = await apiRequest("/user", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          });

          onLogin(response.user, data.session.access_token);
        } else {
          // Username login: use server endpoint that handles username-to-email conversion
          const response = await apiRequest("/signin", {
            method: "POST",
            body: JSON.stringify({
              username: email, // email field contains username in this case
              password,
            }),
          });

          // The server response includes both user profile and session token
          onLogin(response.user, response.session.access_token);
        }
      } else {
        // Step 1: Create account via our server
        const response = await apiRequest("/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            username: username.trim(),
            name: name.trim(),
          }),
        });

        // Step 2: Sign in to get the session
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          throw signInError;
        }

        onLogin(response.user, data.session.access_token);
      }
    } catch (error) {
      const friendlyError = transformErrorMessage(error.message, !isLogin);
      setError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeSwitch = (newIsLogin) => {
    setIsLogin(newIsLogin);
    setIsPasswordReset(false);
    resetForm();
  };

  const handlePasswordResetToggle = () => {
    setIsPasswordReset(!isPasswordReset);
    resetForm();
  };

  const getServerStatusDisplay = () => {
    if (serverStatus.isLoading) {
      return {
        icon: <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>,
        text: "Connecting...",
        className: "text-gray-500"
      };
    } else if (serverStatus.isHealthy) {
      return {
        icon: <Server className="w-3 h-3 text-green-600" />,
        text: "Connected",
        className: "text-green-600"
      };
    } else {
      return {
        icon: <AlertCircle className="w-3 h-3 text-red-600" />,
        text: "Server Error",
        className: "text-red-600"
      };
    }
  };

  const statusDisplay = getServerStatusDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4 relative">
      <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
        {/* Header - Removed blue background and made logo bigger */}
        <div className="p-8 text-center">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="bg-white rounded-full w-32 h-32 flex items-center justify-center shadow-xl overflow-hidden mb-6 border-4 border-blue-100">
              <ImageWithFallback
                src={foosballIcon}
                alt="Foosball Logo"
                className="w-28 h-28 object-cover rounded-full"
              />
            </div>
            <div className="text-gray-800">
              <h1 className="text-5xl text-gray-800 tracking-tight mb-2">Foosball</h1>
              <h2 className="text-2xl text-gray-600">Tracker</h2>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Mode Toggle - Hide during password reset */}
          {!isPasswordReset && (
            <div className="flex mb-6">
              <button
                type="button"
                onClick={() => handleModeSwitch(true)}
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
                onClick={() => handleModeSwitch(false)}
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
            <div className="mb-6 text-center">
              <h2 className="text-lg text-gray-800 mb-2">Reset Password</h2>
              <p className="text-sm text-gray-600">
                Enter your email address and we'll send you a reset link
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                </div>
                {validationErrors.username && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.username}</p>
                )}
              </div>
            )}

            {/* Email/Username Field */}
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
                  />
                </div>

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
                  />
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.confirmPassword}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !serverStatus.isHealthy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
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
          </form>

          {/* Password Reset Link */}
          {isLogin && !isPasswordReset && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handlePasswordResetToggle}
                className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Password Reset Mode */}
          {isPasswordReset && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handlePasswordResetToggle}
                className="text-gray-600 hover:text-gray-800 text-sm transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Requirements and Instructions */}
          {!isLogin && !isPasswordReset && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Account Requirements:</p>
              <div className="text-xs text-gray-500 space-y-1">

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
      </div>

      {/* Server Status - Moved to bottom corner */}
      <div className="fixed bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-white/20">
        <div className="flex items-center space-x-2 text-xs">
          {statusDisplay.icon}
          <span className={statusDisplay.className}>{statusDisplay.text}</span>
          {!serverStatus.isHealthy && !serverStatus.isLoading && (
            <button
              onClick={checkServerHealth}
              className="text-blue-600 hover:text-blue-800 ml-2 underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
