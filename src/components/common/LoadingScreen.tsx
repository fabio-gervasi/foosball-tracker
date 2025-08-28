import React from 'react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import foosballIcon from '../../assets/foosball-icon.png';

interface Group {
  id: string;
  name: string;
  code: string;
  icon?: string;
  createdAt: string;
  adminIds: string[];
}

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  currentGroup?: Group;
  variant?: 'full' | 'inline' | 'overlay';
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  showLogo = true,
  currentGroup,
  variant = 'full',
}) => {
  const baseClasses = 'flex flex-col items-center justify-center';

  const variantClasses = {
    full: 'min-h-screen bg-gray-50',
    inline: 'py-12',
    overlay: 'fixed inset-0 bg-black bg-opacity-50 z-50',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      {showLogo && (
        <div className='mb-6'>
          <ImageWithFallback
            src={currentGroup?.icon || foosballIcon}
            alt={`${currentGroup?.name || 'Foosball'} Logo`}
            className='w-16 h-16 md:w-20 md:h-20 object-cover rounded-full animate-pulse'
          />
        </div>
      )}

      <div className='text-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
        <p
          className={`text-lg font-medium ${variant === 'overlay' ? 'text-white' : 'text-gray-900'}`}
        >
          {message}
        </p>
        {currentGroup?.name && (
          <p
            className={`text-sm mt-2 ${variant === 'overlay' ? 'text-gray-300' : 'text-gray-500'}`}
          >
            {currentGroup.name}
          </p>
        )}
      </div>
    </div>
  );
};
