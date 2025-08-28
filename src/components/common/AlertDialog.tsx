import React from 'react';
import {
  AlertDialog as ShadcnAlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertConfig } from '../../hooks/useDialogs';

interface CustomAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AlertConfig;
  onAction: () => void;
}

export function CustomAlertDialog({
  open,
  onOpenChange,
  config,
  onAction,
}: CustomAlertDialogProps) {
  const { title, description, variant = 'info', actionText = 'OK' } = config;

  const getVariantIcon = () => {
    switch (variant) {
      case 'success':
        return (
          <span className='text-green-500' role='img' aria-label='Success'>
            ✅
          </span>
        );
      case 'error':
        return (
          <span className='text-red-500' role='img' aria-label='Error'>
            ❌
          </span>
        );
      case 'warning':
        return (
          <span className='text-yellow-500' role='img' aria-label='Warning'>
            ⚠️
          </span>
        );
      case 'info':
      default:
        return (
          <span className='text-blue-500' role='img' aria-label='Information'>
            ℹ️
          </span>
        );
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-600';
      case 'error':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-600';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-600';
      case 'info':
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600';
    }
  };

  return (
    <ShadcnAlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            {getVariantIcon()}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className='text-left'>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAction} className={getVariantStyles()}>
            {actionText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </ShadcnAlertDialog>
  );
}
