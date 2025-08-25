import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
  className?: string;
  textClassName?: string;
}

export function Avatar({ src, alt = "Profile", fallback, className = "", textClassName = "" }: AvatarProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {src ? (
        <img 
          src={src} 
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to text avatar if image fails to load
            e.currentTarget.style.display = 'none';
            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
            if (nextElement) {
              nextElement.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span 
        className={`${src ? 'hidden' : 'flex'} items-center justify-center w-full h-full absolute inset-0 ${textClassName}`}
      >
        {fallback}
      </span>
    </div>
  );
}