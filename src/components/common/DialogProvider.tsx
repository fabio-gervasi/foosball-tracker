import React, { createContext, useContext } from 'react';
import { useDialogs, UseDialogsReturn, ConfirmDialogConfig, AlertConfig } from '../../hooks/useDialogs';
import { ConfirmDialog } from './ConfirmDialog';
import { CustomAlertDialog } from './AlertDialog';

interface DialogProviderProps {
  children: React.ReactNode;
}

// Create context for dialog functions
const DialogContext = createContext<UseDialogsReturn | null>(null);

export function useDialogContext(): UseDialogsReturn {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const dialogMethods = useDialogs();
  const { dialogState, closeDialog } = dialogMethods;

  const handleConfirm = () => {
    if (dialogState?.resolve && dialogState.type === 'confirm') {
      dialogState.resolve(true);
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (dialogState?.resolve && dialogState.type === 'confirm') {
      dialogState.resolve(false);
    }
    closeDialog();
  };

  const handleAction = () => {
    if (dialogState?.resolve && dialogState.type === 'alert') {
      dialogState.resolve();
    }
    closeDialog();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel(); // Default to cancel when closing via overlay/escape
    }
  };

  return (
    <DialogContext.Provider value={dialogMethods}>
      {children}
      
      {/* Confirm Dialog */}
      {dialogState?.type === 'confirm' && (
        <ConfirmDialog
          open={dialogState.isOpen}
          onOpenChange={handleOpenChange}
          config={dialogState.config as ConfirmDialogConfig}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      
      {/* Alert Dialog */}
      {dialogState?.type === 'alert' && (
        <CustomAlertDialog
          open={dialogState.isOpen}
          onOpenChange={handleOpenChange}
          config={dialogState.config as AlertConfig}
          onAction={handleAction}
        />
      )}
    </DialogContext.Provider>
  );
}
