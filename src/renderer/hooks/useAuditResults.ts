import { useCallback, useMemo, useState } from 'react';
import type { AuditRequest, AuditResult } from '../../shared/types/audit';
import type {
  MediaPreviewResult,
  MediaPreviewResultItem,
  PreviewClipResult
} from '../../shared/types/mediaPreview';
import type { VideoRow } from '../../shared/types/video';
import { getErrorMessage } from '../helpers/errors';
import { formatDateTime } from '../helpers/formatting';
import { getActiveRows, getRemovedRowCount } from '../helpers/resultFilters';
import {
  clearStoredAuditResult,
  loadStoredAuditResult,
  saveStoredAuditHistoryEntry,
  saveStoredAuditResult
} from '../storage/auditResultStorage';
import type { StoredAuditResultState } from '../storage/auditResultStorage';
import type { VideoResultsWorkspaceSource } from '../stores/useVideoResultsStore';
import { useVideoResultsStore } from '../stores/useVideoResultsStore';

interface ApplyAuditResultOptions {
  persist: boolean;
  source?: Exclude<VideoResultsWorkspaceSource, 'empty'>;
  savedAt?: string;
  showThumbnails?: boolean;
}

interface ResetAuditResultsOptions {
  storageMessage?: string | null;
}

interface AuditHistoryArchiveResult {
  savedHistoryMetadata: boolean;
  historyMetadataError: string | null;
}

export interface UseAuditResultsValue {
  auditResult: AuditResult | null;
  auditSummary: AuditResult['summary'] | null;
  auditErrors: AuditResult['errors'];
  videoRows: VideoRow[] | null;
  visibleVideoRows: VideoRow[];
  removedVideoCount: number;
  storageMessage: string | null;
  storageSavedAt: string | null;
  isStorageLoading: boolean;
  lastAuditRequest: AuditRequest | null;
  loadStoredAuditResultState: () => Promise<StoredAuditResultState | null>;
  applyStoredAuditResult: (storedAudit: StoredAuditResultState) => Promise<void>;
  finishStorageLoading: () => void;
  applyAuditResult: (
    result: AuditResult,
    request: AuditRequest | null,
    options: ApplyAuditResultOptions
  ) => Promise<void>;
  persistCurrentResult: (nextResult: AuditResult, thumbnailValue?: boolean) => Promise<void>;
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  restoreRemovedVideos: () => Promise<void>;
  mergeMediaPreviewResult: (result: MediaPreviewResult) => Promise<void>;
  mergeMediaPreviewItemsIntoRows: (items: MediaPreviewResultItem[]) => Promise<void>;
  mergePreviewClipResult: (result: PreviewClipResult) => Promise<void>;
  resetResultStateForAuditStart: (request: AuditRequest) => void;
  resetAuditResults: (options?: ResetAuditResultsOptions) => void;
  setStorageMessage: (message: string | null) => void;
  archiveCurrentResultToHistory: (
    options: { outputFolder: string | null }
  ) => Promise<AuditHistoryArchiveResult>;
  clearStoredAuditResultState: () => Promise<void>;
}

export function useAuditResults(): UseAuditResultsValue {
  const auditResult = useVideoResultsStore((state) => state.auditResult);
  const rows = useVideoResultsStore((state) => state.rows);
  const auditSummary = useVideoResultsStore((state) => state.summary);
  const auditErrors = useVideoResultsStore((state) => state.errors);
  const showThumbnails = useVideoResultsStore((state) => state.showThumbnails);
  const storageSavedAt = useVideoResultsStore((state) => state.storageSavedAt);
  const lastAuditRequest = useVideoResultsStore((state) => state.lastAuditRequest);
  const applyAuditResultToStore = useVideoResultsStore((state) => state.applyAuditResult);
  const clearResultsInStore = useVideoResultsStore((state) => state.clearResults);
  const resetForAuditStartInStore = useVideoResultsStore((state) => state.resetForAuditStart);
  const setStorageSavedAtInStore = useVideoResultsStore((state) => state.setStorageSavedAt);
  const hideRowsByPathInStore = useVideoResultsStore((state) => state.hideRowsByPath);
  const restoreRemovedRowsInStore = useVideoResultsStore((state) => state.restoreRemovedRows);
  const mergeMediaPreviewItemsInStore = useVideoResultsStore((state) => state.mergeMediaPreviewItems);
  const mergePreviewClipItemsInStore = useVideoResultsStore((state) => state.mergePreviewClipItems);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageMessage, setStorageMessageState] = useState<string | null>(null);

  const videoRows = useMemo(() => (auditResult ? rows : null), [auditResult, rows]);
  const visibleVideoRows = useMemo(() => getActiveRows(rows), [rows]);
  const removedVideoCount = useMemo(() => getRemovedRowCount(rows), [rows]);

  const setStorageMessage = useCallback((message: string | null): void => {
    setStorageMessageState(message);
  }, []);

  const persistCurrentResult = useCallback(
    async (nextResult: AuditResult, thumbnailValue = showThumbnails): Promise<void> => {
      if (!lastAuditRequest) {
        return;
      }

      const storedState = await saveStoredAuditResult({
        request: lastAuditRequest,
        result: nextResult,
        showThumbnails: thumbnailValue
      });

      setStorageSavedAtInStore(storedState.savedAt);
      setStorageMessageState(`Saved ${nextResult.videos.length.toLocaleString()} flagged row(s).`);
    },
    [lastAuditRequest, setStorageSavedAtInStore, showThumbnails]
  );

  const persistStoreAuditResult = useCallback(
    async (thumbnailValue?: boolean): Promise<void> => {
      const nextResult = useVideoResultsStore.getState().auditResult;

      if (nextResult) {
        await persistCurrentResult(nextResult, thumbnailValue);
      }
    },
    [persistCurrentResult]
  );

  const applyAuditResult = useCallback(
    async (
      result: AuditResult,
      request: AuditRequest | null,
      options: ApplyAuditResultOptions
    ): Promise<void> => {
      applyAuditResultToStore({
        result,
        request,
        source: options.source ?? 'audit',
        savedAt: options.savedAt,
        showThumbnails: options.showThumbnails
      });

      const normalizedResult = useVideoResultsStore.getState().auditResult;

      if (options.persist && request && normalizedResult) {
        const storedState = await saveStoredAuditResult({
          request,
          result: normalizedResult,
          showThumbnails: options.showThumbnails ?? useVideoResultsStore.getState().showThumbnails,
          savedAt: options.savedAt
        });

        setStorageSavedAtInStore(storedState.savedAt);
        setStorageMessageState(`Saved ${normalizedResult.videos.length.toLocaleString()} flagged row(s).`);
      }
    },
    [applyAuditResultToStore, setStorageSavedAtInStore]
  );

  const loadStoredAuditResultState = useCallback(async (): Promise<StoredAuditResultState | null> => {
    return loadStoredAuditResult();
  }, []);

  const applyStoredAuditResult = useCallback(
    async (storedAudit: StoredAuditResultState): Promise<void> => {
      setStorageMessageState(`Restored saved audit from ${formatDateTime(storedAudit.savedAt)}.`);
      await applyAuditResult(storedAudit.result, storedAudit.request, {
        persist: false,
        source: 'stored-audit',
        savedAt: storedAudit.savedAt,
        showThumbnails: storedAudit.showThumbnails
      });
    },
    [applyAuditResult]
  );

  const finishStorageLoading = useCallback((): void => {
    setIsStorageLoading(false);
  }, []);

  const hideVideoPathsFromTable = useCallback(
    async (paths: string[]): Promise<number> => {
      if (paths.length === 0) {
        return 0;
      }

      const hiddenCount = hideRowsByPathInStore(paths);

      if (hiddenCount === 0) {
        return 0;
      }

      await persistStoreAuditResult();

      return hiddenCount;
    },
    [hideRowsByPathInStore, persistStoreAuditResult]
  );

  const restoreRemovedVideos = useCallback(async (): Promise<void> => {
    if (!useVideoResultsStore.getState().auditResult) {
      return;
    }

    restoreRemovedRowsInStore();
    await persistStoreAuditResult();
  }, [persistStoreAuditResult, restoreRemovedRowsInStore]);

  const mergeMediaPreviewItemsIntoRows = useCallback(
    async (items: MediaPreviewResultItem[]): Promise<void> => {
      if (!useVideoResultsStore.getState().auditResult) {
        return;
      }

      mergeMediaPreviewItemsInStore(items);
      await persistStoreAuditResult();
    },
    [mergeMediaPreviewItemsInStore, persistStoreAuditResult]
  );

  const mergeMediaPreviewResult = useCallback(
    async (result: MediaPreviewResult): Promise<void> => {
      await mergeMediaPreviewItemsIntoRows(result.items);
    },
    [mergeMediaPreviewItemsIntoRows]
  );

  const mergePreviewClipResult = useCallback(
    async (result: PreviewClipResult): Promise<void> => {
      if (!useVideoResultsStore.getState().auditResult) {
        return;
      }

      mergePreviewClipItemsInStore(result.items);
      await persistStoreAuditResult();
    },
    [mergePreviewClipItemsInStore, persistStoreAuditResult]
  );

  const resetResultStateForAuditStart = useCallback(
    (request: AuditRequest): void => {
      resetForAuditStartInStore(request);
    },
    [resetForAuditStartInStore]
  );

  const resetAuditResults = useCallback(
    (options: ResetAuditResultsOptions = {}): void => {
      clearResultsInStore();
      setStorageMessageState(options.storageMessage ?? null);
    },
    [clearResultsInStore]
  );

  const archiveCurrentResultToHistory = useCallback(
    async ({ outputFolder }: { outputFolder: string | null }): Promise<AuditHistoryArchiveResult> => {
      const currentState = useVideoResultsStore.getState();

      if (!currentState.auditResult || !currentState.lastAuditRequest) {
        return {
          savedHistoryMetadata: false,
          historyMetadataError: null
        };
      }

      try {
        await saveStoredAuditHistoryEntry({
          request: currentState.lastAuditRequest,
          result: currentState.auditResult,
          outputFolder,
          savedAt: currentState.storageSavedAt
        });

        return {
          savedHistoryMetadata: true,
          historyMetadataError: null
        };
      } catch (error: unknown) {
        return {
          savedHistoryMetadata: false,
          historyMetadataError: getErrorMessage(error, 'Could not save scan history metadata.')
        };
      }
    },
    []
  );

  const clearStoredAuditResultState = useCallback(async (): Promise<void> => {
    await clearStoredAuditResult();
  }, []);

  return {
    auditResult,
    auditSummary,
    auditErrors,
    videoRows,
    visibleVideoRows,
    removedVideoCount,
    storageMessage,
    storageSavedAt,
    isStorageLoading,
    lastAuditRequest,
    loadStoredAuditResultState,
    applyStoredAuditResult,
    finishStorageLoading,
    applyAuditResult,
    persistCurrentResult,
    hideVideoPathsFromTable,
    restoreRemovedVideos,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    resetResultStateForAuditStart,
    resetAuditResults,
    setStorageMessage,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState
  };
}
