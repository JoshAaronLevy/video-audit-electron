import { useCallback, useEffect, useState } from 'react';
import type { AppCommand } from '../../shared/types/appCommands';
import * as appClient from '../api/appClient';

interface UseAppCommandsOptions {
  requestFolderTreeOpen: () => void;
  chooseFiles: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  setSettingsMessage: (message: string | null) => void;
  cancelAudit: () => Promise<void>;
  cancelAutoFix: () => Promise<void>;
  cancelAutoCrop: () => Promise<void>;
  cancelThumbnailGeneration: () => Promise<void>;
  cancelPreviewClipGeneration: () => Promise<void>;
  cancelReplacementExecution: () => Promise<void>;
  closeMigrationDialog: () => void;
  closeMigrationResultDialog: () => void;
  closeReplacementResultDialog: () => void;
  closeOperationHistory: () => void;
  closeTrashDialog: () => void;
  closeTrashResultDialog: () => void;
  closeMoveDialog: () => void;
  closeMoveResultDialog: () => void;
  closeArchiveDialog: () => void;
  closeArchiveResultDialog: () => void;
  closePostConversionDialog: () => void;
  closeThumbnailDialog: () => void;
  closeAutoCropDialog: () => void;
  closeAutoFixDialog: () => void;
  activeState: {
    isAuditActive: boolean;
    isAutoFixActive: boolean;
    isAutoCropActive: boolean;
    isMediaPreviewActive: boolean;
    isPreviewClipActive: boolean;
    isMigrationScanDialogVisible: boolean;
    isMigrationResultDialogVisible: boolean;
    isReplacementExecuting: boolean;
    isReplacementResultDialogVisible: boolean;
    isOperationHistoryVisible: boolean;
    isTrashConfirmDialogVisible: boolean;
    isTrashResultDialogVisible: boolean;
    isMoveConfirmDialogVisible: boolean;
    isMoveResultDialogVisible: boolean;
    isArchiveConfirmDialogVisible: boolean;
    isArchiveResultDialogVisible: boolean;
    isPostConversionDialogVisible: boolean;
    isThumbnailDialogVisible: boolean;
    isAutoCropDialogVisible: boolean;
    isAutoFixDialogVisible: boolean;
  };
}

interface UseAppCommandsValue {
  settingsOpenRequestCount: number;
}

export function useAppCommands({
  requestFolderTreeOpen,
  chooseFiles,
  refreshAudit,
  setSettingsMessage,
  cancelAudit,
  cancelAutoFix,
  cancelAutoCrop,
  cancelThumbnailGeneration,
  cancelPreviewClipGeneration,
  cancelReplacementExecution,
  closeMigrationDialog,
  closeMigrationResultDialog,
  closeReplacementResultDialog,
  closeOperationHistory,
  closeTrashDialog,
  closeTrashResultDialog,
  closeMoveDialog,
  closeMoveResultDialog,
  closeArchiveDialog,
  closeArchiveResultDialog,
  closePostConversionDialog,
  closeThumbnailDialog,
  closeAutoCropDialog,
  closeAutoFixDialog,
  activeState
}: UseAppCommandsOptions): UseAppCommandsValue {
  const [settingsOpenRequestCount, setSettingsOpenRequestCount] = useState(0);

  const cancelActiveWork = useCallback(async (): Promise<void> => {
    if (activeState.isAuditActive) {
      await cancelAudit();
      return;
    }

    if (activeState.isAutoFixActive) {
      await cancelAutoFix();
      return;
    }

    if (activeState.isAutoCropActive) {
      await cancelAutoCrop();
      return;
    }

    if (activeState.isMediaPreviewActive) {
      await cancelThumbnailGeneration();
      return;
    }

    if (activeState.isPreviewClipActive) {
      await cancelPreviewClipGeneration();
      return;
    }

    if (activeState.isMigrationScanDialogVisible) {
      closeMigrationDialog();
      return;
    }

    if (activeState.isMigrationResultDialogVisible) {
      closeMigrationResultDialog();
      return;
    }

    if (activeState.isReplacementExecuting) {
      await cancelReplacementExecution();
      return;
    }

    if (activeState.isReplacementResultDialogVisible) {
      closeReplacementResultDialog();
      return;
    }

    if (activeState.isOperationHistoryVisible) {
      closeOperationHistory();
      return;
    }

    if (activeState.isTrashConfirmDialogVisible) {
      closeTrashDialog();
      return;
    }

    if (activeState.isTrashResultDialogVisible) {
      closeTrashResultDialog();
      return;
    }

    if (activeState.isMoveConfirmDialogVisible) {
      closeMoveDialog();
      return;
    }

    if (activeState.isMoveResultDialogVisible) {
      closeMoveResultDialog();
      return;
    }

    if (activeState.isArchiveConfirmDialogVisible) {
      closeArchiveDialog();
      return;
    }

    if (activeState.isArchiveResultDialogVisible) {
      closeArchiveResultDialog();
      return;
    }

    if (activeState.isPostConversionDialogVisible) {
      closePostConversionDialog();
      return;
    }

    if (activeState.isThumbnailDialogVisible) {
      closeThumbnailDialog();
      return;
    }

    if (activeState.isAutoCropDialogVisible) {
      closeAutoCropDialog();
      return;
    }

    if (activeState.isAutoFixDialogVisible) {
      closeAutoFixDialog();
    }
  }, [
    activeState,
    cancelAudit,
    cancelAutoCrop,
    cancelAutoFix,
    cancelReplacementExecution,
    cancelPreviewClipGeneration,
    cancelThumbnailGeneration,
    closeArchiveDialog,
    closeArchiveResultDialog,
    closeAutoCropDialog,
    closeAutoFixDialog,
    closeMigrationDialog,
    closeMigrationResultDialog,
    closeMoveDialog,
    closeMoveResultDialog,
    closeOperationHistory,
    closePostConversionDialog,
    closeReplacementResultDialog,
    closeTrashDialog,
    closeTrashResultDialog,
    closeThumbnailDialog
  ]);

  const handleAppCommand = useCallback(
    async (command: AppCommand): Promise<void> => {
      if (command === 'choose-folder') {
        requestFolderTreeOpen();
        return;
      }

      if (command === 'choose-files') {
        await chooseFiles();
        return;
      }

      if (command === 'refresh-audit') {
        await refreshAudit();
        return;
      }

      if (command === 'cancel-active') {
        await cancelActiveWork();
        return;
      }

      if (command === 'open-settings') {
        setSettingsOpenRequestCount((count) => count + 1);
        setSettingsMessage(null);
      }
    },
    [cancelActiveWork, chooseFiles, refreshAudit, requestFolderTreeOpen, setSettingsMessage]
  );

  useEffect(() => appClient.subscribeToAppCommands((command) => {
    void handleAppCommand(command);
  }), [handleAppCommand]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      void handleAppCommand('cancel-active');
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAppCommand]);

  return {
    settingsOpenRequestCount
  };
}
