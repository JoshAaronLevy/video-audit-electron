import { useEffect } from 'react';
import type { AuditOptions } from '../../shared/types/audit';
import type { AppSettings } from '../../shared/types/settings';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import { settingsToAuditOptions } from '../helpers/auditOptions';
import { getErrorMessage } from '../helpers/errors';
import { getPersistedFolderTreeSourcePaths } from '../helpers/folderTreeSource';
import type { StoredAuditResultState } from '../storage/auditResultStorage';
import type { UseAuditResultsValue } from './useAuditResults';
import type { SourceSelectionStatePatch } from './useSourceSelection';

interface UseInitialVideoAuditStateOptions {
  loadStoredAuditResultState: () => Promise<StoredAuditResultState | null>;
  loadSettings: () => Promise<AppSettings>;
  applySourceSelectionState: (patch: SourceSelectionStatePatch) => void;
  setAuditOptions: (options: AuditOptions) => void;
  applyStoredAuditResult: UseAuditResultsValue['applyStoredAuditResult'];
  finishStorageLoading: () => void;
  setSettingsMessage: (message: string | null) => void;
}

export function useInitialVideoAuditState({
  loadStoredAuditResultState,
  loadSettings,
  applySourceSelectionState,
  setAuditOptions,
  applyStoredAuditResult,
  finishStorageLoading,
  setSettingsMessage
}: UseInitialVideoAuditStateOptions): void {
  useEffect(() => {
    let isMounted = true;

    async function loadInitialState(): Promise<void> {
      try {
        const storedAudit = await loadStoredAuditResultState();
        const loadedSettings = await loadSettings();

        if (!isMounted) {
          return;
        }

        const restoredFolderTreeSource = loadedSettings.latestFolderTreeSource;
        const restoredFolderTreePaths = restoredFolderTreeSource
          ? getPersistedFolderTreeSourcePaths(restoredFolderTreeSource)
          : [];

        if (storedAudit) {
          const restoredSelectedFolders =
            restoredFolderTreePaths.length > 0
              ? restoredFolderTreePaths
              : dedupeOverlappingFolderPaths(storedAudit.request.folderPaths);
          applySourceSelectionState({
            outputFolder: loadedSettings.defaultOutputDirectory,
            folderTreeRootPath: restoredFolderTreeSource?.rootPath ?? null,
            folderTreeLastScannedAt: restoredFolderTreeSource?.lastScannedAt ?? null,
            selectedFolders: restoredSelectedFolders,
            selectedFolderSummary: restoredFolderTreeSource?.selectedFolderSummary ?? null,
            selectedFiles: storedAudit.request.filePaths
          });
          setAuditOptions({
            ...storedAudit.request.options,
            includeSubfolders:
              restoredFolderTreeSource?.includeSubfolders ?? storedAudit.request.options.includeSubfolders
          });
          await applyStoredAuditResult(storedAudit);
        } else {
          const restoredAuditOptions = settingsToAuditOptions(loadedSettings);
          applySourceSelectionState({
            outputFolder: loadedSettings.defaultOutputDirectory,
            folderTreeRootPath: restoredFolderTreeSource?.rootPath ?? null,
            folderTreeLastScannedAt: restoredFolderTreeSource?.lastScannedAt ?? null,
            selectedFolders: restoredFolderTreePaths,
            selectedFolderSummary: restoredFolderTreeSource?.selectedFolderSummary ?? null
          });
          setAuditOptions({
            ...restoredAuditOptions,
            includeSubfolders:
              restoredFolderTreeSource?.includeSubfolders ?? restoredAuditOptions.includeSubfolders
          });
        }
      } catch (error: unknown) {
        if (isMounted) {
          setSettingsMessage(getErrorMessage(error, 'Could not load settings.'));
        }
      } finally {
        if (isMounted) {
          finishStorageLoading();
        }
      }
    }

    void loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [
    applySourceSelectionState,
    applyStoredAuditResult,
    finishStorageLoading,
    loadSettings,
    loadStoredAuditResultState,
    setAuditOptions,
    setSettingsMessage
  ]);
}
