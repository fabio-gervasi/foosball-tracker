import { useState, useCallback } from 'react';
import { logger } from '../utils/logger';

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
}

export interface AlertConfig {
  title: string;
  description: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  actionText?: string;
}

export interface DialogState {
  isOpen: boolean;
  config: ConfirmDialogConfig | AlertConfig;
  type: 'confirm' | 'alert';
  resolve?: (value?: any) => void;
}

export interface UseDialogsReturn {
  // Dialog state
  dialogState: DialogState | null;

  // Confirmation dialogs
  showConfirmDialog: (config: ConfirmDialogConfig) => Promise<boolean>;

  // Alert dialogs
  showAlert: (config: AlertConfig) => Promise<void>;

  // Success/error notifications
  showSuccess: (message: string) => Promise<void>;
  showError: (error: Error | string) => Promise<void>;
  showWarning: (message: string) => Promise<void>;

  // Dialog state management
  closeDialog: () => void;
  closeAllDialogs: () => void;
}

export function useDialogs(): UseDialogsReturn {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const closeDialog = useCallback(() => {
    if (dialogState?.resolve && dialogState.type === 'confirm') {
      dialogState.resolve(false); // Default to false for confirm dialogs
    } else if (dialogState?.resolve && dialogState.type === 'alert') {
      dialogState.resolve();
    }
    setDialogState(null);
  }, [dialogState]);

  const closeAllDialogs = useCallback(() => {
    setDialogState(null);
  }, []);

  const showConfirmDialog = useCallback((config: ConfirmDialogConfig): Promise<boolean> => {
    logger.debug('Showing confirm dialog', { title: config.title });

    return new Promise(resolve => {
      setDialogState({
        isOpen: true,
        config: {
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'default',
          ...config,
        },
        type: 'confirm',
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((config: AlertConfig): Promise<void> => {
    logger.debug('Showing alert dialog', { title: config.title });

    return new Promise(resolve => {
      setDialogState({
        isOpen: true,
        config: {
          actionText: 'OK',
          variant: 'info',
          ...config,
        },
        type: 'alert',
        resolve,
      });
    });
  }, []);

  const showSuccess = useCallback(
    (message: string): Promise<void> => {
      return showAlert({
        title: 'Success',
        description: message,
        variant: 'success',
        actionText: 'OK',
      });
    },
    [showAlert]
  );

  const showError = useCallback(
    (error: Error | string): Promise<void> => {
      const message = error instanceof Error ? error.message : error;
      logger.error('Showing error dialog', { message });

      return showAlert({
        title: 'Error',
        description: message,
        variant: 'error',
        actionText: 'OK',
      });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (message: string): Promise<void> => {
      return showAlert({
        title: 'Warning',
        description: message,
        variant: 'warning',
        actionText: 'OK',
      });
    },
    [showAlert]
  );

  return {
    dialogState,
    showConfirmDialog,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    closeDialog,
    closeAllDialogs,
  };
}
