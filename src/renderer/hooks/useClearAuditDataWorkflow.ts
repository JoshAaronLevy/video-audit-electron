import { useCallback } from 'react';
import type { AuditOptions } from '../../shared/types/audit';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import * as mediaPreviewClient from '../api/mediaPreviewClient';
import { settingsToAuditOptions } from '../helpers/auditOptions';
import { getErrorMessage } from '../helpers/errors';

export type ClearAuditDataActiveAction = 'clearCache' | null;

interface SourceSelectionResetPatch {
  outputFolder: string | null;
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  folderTreeRootPath: string | null;
  folderTreeLastScannedAt: string | null;
  selectedFiles: string[];
  selectionMessage: string | null;
}

interface AuditHistoryArchiveResult {
  savedHistoryMetadata: boolean;
  historyMetadataError: string | null;
}

interface ResetAuditResultsOptions {
  storageMessage?: string | null;
}

interface UseClearAuditDataWorkflowOptions {
  outputFolder: string | null;
  archiveCurrentResultToHistory: (
    options: { outputFolder: string | null }
  ) => Promise<AuditHistoryArchiveResult>;
  clearStoredAuditResultState: () => Promise<void>;
  saveSettingsSilently: (
    partialSettings: AppSettingsUpdate,
    options?: { errorMessage?: string | null; throwOnError?: boolean }
  ) => Promise<AppSettings | null>;
  applySourceSelectionState: (patch: SourceSelectionResetPatch) => void;
  setAuditOptions: (options: AuditOptions) => void;
  resetAuditWorkflow: () => void;
  resetDiscoveryWorkflow: () => void;
  resetFfprobeWorkflow: () => void;
  resetAutoFixWorkflow: () => void;
  resetAutoCropWorkflow: () => void;
  resetMediaPreviewWorkflow: () => void;
  resetMigrationWorkflow: () => void;
  resetDuplicateScanWorkflow: () => void;
  resetFileOperationsWorkflow: () => void;
  resetPostConversionWorkflow: () => void;
  resetPremiereBridgeWorkflow: () => void;
  resetAuditResults: (options?: ResetAuditResultsOptions) => void;
  setStorageMessage: (message: string | null) => void;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: ClearAuditDataActiveAction) => void;
}

interface UseClearAuditDataWorkflowValue {
  clearAuditData: () => Promise<void>;
}

export function useClearAuditDataWorkflow({
  outputFolder,
  archiveCurrentResultToHistory,
  clearStoredAuditResultState,
  saveSettingsSilently,
  applySourceSelectionState,
  setAuditOptions,
  resetAuditWorkflow,
  resetDiscoveryWorkflow,
  resetFfprobeWorkflow,
  resetAutoFixWorkflow,
  resetAutoCropWorkflow,
  resetMediaPreviewWorkflow,
  resetMigrationWorkflow,
  resetDuplicateScanWorkflow,
  resetFileOperationsWorkflow,
  resetPostConversionWorkflow,
  resetPremiereBridgeWorkflow,
  resetAuditResults,
  setStorageMessage,
  setWorkflowMessage,
  setActiveAction
}: UseClearAuditDataWorkflowOptions): UseClearAuditDataWorkflowValue {
  const clearAuditData = useCallback(async (): Promise<void> => {
    setActiveAction('clearCache');
    setStorageMessage('Clearing cache...');
    setWorkflowMessage(null);
    resetDuplicateScanWorkflow();

    const { savedHistoryMetadata, historyMetadataError } = await archiveCurrentResultToHistory({
      outputFolder
    });

    try {
      const previewCacheResponse = await mediaPreviewClient.clearCache();

      if (previewCacheResponse.status !== 'complete') {
        throw new Error(previewCacheResponse.message || 'Could not clear media preview cache.');
      }

      await clearStoredAuditResultState();

      const updatedSettings = await saveSettingsSilently(
        {
          defaultOutputDirectory: null,
          latestSelectedFolder: null,
          latestFolderTreeSource: null,
          lastAuditResultSummary: null
        },
        {
          errorMessage: null,
          throwOnError: true
        }
      );

      if (!updatedSettings) {
        return;
      }

      applySourceSelectionState({
        outputFolder: updatedSettings.defaultOutputDirectory,
        selectedFolders: [],
        selectedFolderSummary: null,
        folderTreeRootPath: null,
        folderTreeLastScannedAt: null,
        selectedFiles: [],
        selectionMessage: null
      });
      setAuditOptions(settingsToAuditOptions(updatedSettings));
      resetAuditWorkflow();
      resetDiscoveryWorkflow();
      resetFfprobeWorkflow();
      resetAutoFixWorkflow();
      resetAutoCropWorkflow();
      resetMediaPreviewWorkflow();
      resetMigrationWorkflow();
      resetDuplicateScanWorkflow();
      resetFileOperationsWorkflow();
      resetPostConversionWorkflow();
      resetPremiereBridgeWorkflow();
      resetAuditResults({
        storageMessage: historyMetadataError
          ? `Cache cleared. Scan history metadata could not be saved: ${historyMetadataError}`
          : savedHistoryMetadata
            ? 'Cache cleared. Scan metadata saved for future history.'
            : 'Cache cleared.'
      });
    } catch (error: unknown) {
      setStorageMessage(getErrorMessage(error, 'Could not clear cache.'));
    } finally {
      setActiveAction(null);
    }
  }, [
    applySourceSelectionState,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState,
    outputFolder,
    resetAuditResults,
    resetAuditWorkflow,
    resetAutoCropWorkflow,
    resetAutoFixWorkflow,
    resetDiscoveryWorkflow,
    resetDuplicateScanWorkflow,
    resetFileOperationsWorkflow,
    resetFfprobeWorkflow,
    resetMediaPreviewWorkflow,
    resetMigrationWorkflow,
    resetPostConversionWorkflow,
    resetPremiereBridgeWorkflow,
    saveSettingsSilently,
    setActiveAction,
    setAuditOptions,
    setStorageMessage,
    setWorkflowMessage
  ]);

  return {
    clearAuditData
  };
}
