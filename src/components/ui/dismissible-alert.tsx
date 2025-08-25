import React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

interface DismissibleAlertProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onDismiss: () => void;
  className?: string;
}

const alertStyles = {
  error: "bg-destructive/10 border-destructive/20 text-destructive",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800", 
  info: "bg-blue-50 border-blue-200 text-blue-800"
};

const buttonStyles = {
  error: "text-destructive/60 hover:text-destructive",
  success: "text-green-600/60 hover:text-green-800",
  warning: "text-yellow-600/60 hover:text-yellow-800",
  info: "text-blue-600/60 hover:text-blue-800"
};

export function DismissibleAlert({ type, message, onDismiss, className }: DismissibleAlertProps) {
  return (
    <div 
      className={cn(
        "relative rounded-lg border px-4 py-3",
        alertStyles[type],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <p className="text-sm pr-6">{message}</p>
      <button
        onClick={onDismiss}
        className={cn(
          "absolute top-2 right-2 transition-colors",
          buttonStyles[type]
        )}
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}