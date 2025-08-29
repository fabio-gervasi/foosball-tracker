import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
  usePasswordValidation,
  type UsePasswordValidationOptions,
} from '../../hooks/usePasswordValidation';
import { hasMultiByteCharacters, getMultiByteExamples } from '../../utils/password-validation';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  showStrengthMeter?: boolean;
  showByteCounter?: boolean;
  showToggleVisibility?: boolean;
  validationOptions?: UsePasswordValidationOptions;
  className?: string;
  'data-testid'?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter your password',
  label = 'Password',
  disabled = false,
  showStrengthMeter = true,
  showByteCounter = true,
  showToggleVisibility = true,
  validationOptions = {},
  className = '',
  'data-testid': testId,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const {
    isValid,
    message,
    messageType,
    strengthColor,
    strengthLabel,
    byteLength,
    characterLength,
    byteLimitExceeded,
    isNearByteLimit,
    hasMultiByteChars,
    constants,
  } = usePasswordValidation(value, {
    realtime: true,
    showByteInfo: true,
    ...validationOptions,
  });

  const handleToggleVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getMessageIcon = () => {
    switch (messageType) {
      case 'error':
        return <XCircle className='w-4 h-4 text-red-500' />;
      case 'warning':
        return <AlertTriangle className='w-4 h-4 text-yellow-500' />;
      case 'success':
        return <CheckCircle className='w-4 h-4 text-green-500' />;
      default:
        return <Info className='w-4 h-4 text-gray-400' />;
    }
  };

  const getMessageColor = () => {
    switch (messageType) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getInputBorderColor = () => {
    if (!value) return 'border-gray-300 focus:border-blue-500';
    if (messageType === 'error') return 'border-red-300 focus:border-red-500';
    if (messageType === 'warning') return 'border-yellow-300 focus:border-yellow-500';
    if (messageType === 'success') return 'border-green-300 focus:border-green-500';
    return 'border-gray-300 focus:border-blue-500';
  };

  const getStrengthBarColor = (index: number, score: number) => {
    if (index >= score) return 'bg-gray-200';
    if (score <= 1) return 'bg-red-400';
    if (score === 2) return 'bg-yellow-400';
    if (score === 3) return 'bg-blue-400';
    return 'bg-green-400';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className='block text-gray-700 text-sm font-medium'>
        {label}
        {showByteCounter && (
          <span className='ml-2 text-xs text-gray-500'>
            ({characterLength} chars, {byteLength}/{constants.BYTE_LIMIT} bytes)
          </span>
        )}
      </label>

      {/* Input Field */}
      <div className='relative'>
        <Lock className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className={`
            w-full pl-10 pr-12 py-3 rounded-lg transition-colors
            ${getInputBorderColor()}
            focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            disabled:bg-gray-50 disabled:text-gray-500
            ${byteLimitExceeded ? 'bg-red-50' : ''}
            ${isNearByteLimit ? 'bg-yellow-50' : ''}
          `}
        />

        {/* Toggle Visibility Button */}
        {showToggleVisibility && (
          <button
            type='button'
            onClick={handleToggleVisibility}
            disabled={disabled}
            className='absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none'
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
          </button>
        )}
      </div>

      {/* Validation Message */}
      {message && (
        <div className={`flex items-start space-x-2 text-sm ${getMessageColor()}`}>
          {getMessageIcon()}
          <div className='flex-1'>
            <p>{message}</p>

            {/* Multi-byte character warning */}
            {hasMultiByteChars && (byteLimitExceeded || isNearByteLimit) && (
              <div className='mt-1 p-2 bg-blue-50 rounded text-blue-700 text-xs'>
                <p className='font-medium'>💡 Tip: Your password contains special characters</p>
                <p>Some characters use more than 1 byte each. {getMultiByteExamples()}</p>
                <p>Consider using simpler characters if you're near the limit.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Strength Meter */}
      {showStrengthMeter && value && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-xs'>
            <span className='text-gray-600'>Password Strength</span>
            <span className={strengthColor}>{strengthLabel}</span>
          </div>
          <div className='flex space-x-1'>
            {[1, 2, 3, 4].map(index => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-colors ${getStrengthBarColor(
                  index,
                  Math.max(
                    1,
                    Math.ceil(
                      byteLength > constants.BYTE_LIMIT
                        ? 0
                        : isValid
                          ? (value.length >= 8 ? 2 : 1) +
                            (((/[A-Z]/.test(value) ? 1 : 0) +
                              (/[0-9]/.test(value) ? 1 : 0) +
                              (/[^a-zA-Z0-9]/.test(value) ? 1 : 0)) /
                              3) *
                              2
                          : 0
                    )
                  )
                )}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Byte Limit Information */}
      {showByteCounter && value && (byteLimitExceeded || isNearByteLimit) && (
        <div
          className={`p-3 rounded-lg text-sm ${
            byteLimitExceeded ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          <div className='flex items-center space-x-2'>
            {byteLimitExceeded ? (
              <XCircle className='w-4 h-4 text-red-500' />
            ) : (
              <AlertTriangle className='w-4 h-4 text-yellow-500' />
            )}
            <div>
              <p className='font-medium'>
                {byteLimitExceeded ? 'Password Too Long' : 'Approaching Limit'}
              </p>
              <p className='text-xs mt-1'>
                Your password is {byteLength} bytes. The maximum is {constants.BYTE_LIMIT} bytes.
                {!byteLimitExceeded && ' Consider shortening it to avoid issues.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!value && (
        <div className='text-xs text-gray-500 space-y-1'>
          <p>Password requirements:</p>
          <ul className='list-disc list-inside space-y-0.5 ml-2'>
            <li>At least 8 characters long</li>
            <li>Maximum {constants.RECOMMENDED_CHAR_LIMIT} characters recommended</li>
            <li>Mix of letters, numbers, and symbols for better security</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Password confirmation input component
 * Validates that the password matches the original
 */
interface PasswordConfirmInputProps {
  value: string;
  onChange: (value: string) => void;
  originalPassword: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function PasswordConfirmInput({
  value,
  onChange,
  originalPassword,
  placeholder = 'Confirm your password',
  label = 'Confirm Password',
  disabled = false,
  className = '',
  'data-testid': testId,
}: PasswordConfirmInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isMatching = value === originalPassword;
  const hasValue = value.length > 0;
  const hasOriginal = originalPassword.length > 0;

  const getValidationState = () => {
    if (!hasValue) return { message: '', type: 'info' as const };
    if (!hasOriginal) return { message: 'Enter password first', type: 'warning' as const };
    if (isMatching) return { message: 'Passwords match', type: 'success' as const };
    return { message: 'Passwords do not match', type: 'error' as const };
  };

  const { message, type } = getValidationState();

  const getMessageIcon = () => {
    switch (type) {
      case 'error':
        return <XCircle className='w-4 h-4 text-red-500' />;
      case 'warning':
        return <AlertTriangle className='w-4 h-4 text-yellow-500' />;
      case 'success':
        return <CheckCircle className='w-4 h-4 text-green-500' />;
      default:
        return null;
    }
  };

  const getMessageColor = () => {
    switch (type) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getInputBorderColor = () => {
    if (!hasValue) return 'border-gray-300 focus:border-blue-500';
    if (type === 'error') return 'border-red-300 focus:border-red-500';
    if (type === 'warning') return 'border-yellow-300 focus:border-yellow-500';
    if (type === 'success') return 'border-green-300 focus:border-green-500';
    return 'border-gray-300 focus:border-blue-500';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className='block text-gray-700 text-sm font-medium'>{label}</label>

      {/* Input Field */}
      <div className='relative'>
        <Lock className='absolute left-3 top-3 w-5 h-5 text-gray-400' />
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className={`
            w-full pl-10 pr-12 py-3 rounded-lg transition-colors
            ${getInputBorderColor()}
            focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            disabled:bg-gray-50 disabled:text-gray-500
          `}
        />

        {/* Toggle Visibility Button */}
        <button
          type='button'
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          className='absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none'
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
        </button>
      </div>

      {/* Validation Message */}
      {message && (
        <div className={`flex items-center space-x-2 text-sm ${getMessageColor()}`}>
          {getMessageIcon()}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
