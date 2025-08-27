import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useDialogContext } from '../common/DialogProvider';
import { logger } from '../../utils/logger';
import { supabase } from '../../utils/supabase/client';

interface PasswordResetFormProps {
  token?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
}

export function PasswordResetForm({ token, onSuccess, onCancel }: PasswordResetFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { showSuccess, showError } = useDialogContext();

  // Password strength calculation
  const getPasswordStrength = (password: string): PasswordStrength => {
    if (!password) return { score: 0, feedback: [], color: 'bg-gray-200' };

    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('At least 8 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('One number');
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One special character');
    }

    const colors = [
      'bg-red-500',
      'bg-red-400',
      'bg-yellow-500',
      'bg-yellow-400',
      'bg-green-500'
    ];

    return {
      score,
      feedback,
      color: colors[Math.min(score, 4)]
    };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate token
    if (!token) {
      newErrors.token = 'Invalid or missing reset token';
    }

    // Validate new password
    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    } else if (passwordStrength.score < 2) {
      newErrors.newPassword = 'Password is too weak';
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      logger.info('Attempting password reset with Supabase');
      
      // Update the password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        logger.error('Failed to update password', updateError);
        throw new Error(updateError.message || 'Failed to update password. Please try again.');
      }
      
      logger.info('Password reset successful');
      await showSuccess('Password updated successfully! You can now log in with your new password.');
      
      // Sign out the user after password reset
      await supabase.auth.signOut();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      logger.error('Password reset failed', error);
      await showError(error instanceof Error ? error.message : 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.token && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {errors.token}
              </div>
            )}
            
            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={errors.newPassword ? 'border-red-500' : ''}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {passwordStrength.score < 2 ? 'Weak' : 
                       passwordStrength.score < 4 ? 'Medium' : 'Strong'}
                    </span>
                  </div>
                  
                  {passwordStrength.feedback.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Missing: {passwordStrength.feedback.join(', ')}
                    </div>
                  )}
                </div>
              )}
              
              {errors.newPassword && (
                <p className="text-sm text-red-600">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || passwordStrength.score < 2}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting...
                  </div>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
