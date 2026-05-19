import { useCallback, useState } from 'react';
import type { PathSelectionResult } from '../../shared/types/dialog';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import * as dialogClient from '../api/dialogClient';
import { getErrorMessage } from '../helpers/errors';
import { createPersistedFolderTreeSource } from '../helpers/folderTreeSource';
import { mergeRecentPaths } from '../helpers/recentPaths';

export type SourceSelectionActiveAction = 'folders' | 'files' | 'output' | null;

export interface SourceSelectionStatePatch {
  selectedFolders?: string[];
  selectedFolderSummary?: SelectedFolderSummary | null;
  folderTreeRootPath?: string | null;
  folderTreeLastScannedAt?: string | null;
  selectedFiles?: string[];
  outputFolder?: string | null;
  selectionMessage?: string | null;
}

interface UseSourceSelectionOptions {
  settings: AppSettings | null;
  includeSubfolders: boolean;
  persistSettings: (partialSettings: AppSettingsUpdate) => Promise<AppSettings | null>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: SourceSelectionActiveAction) => void;
}

export interface UseSourceSelectionValue {
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  folderTreeRootPath: string | null;
  folderTreeLastScannedAt: string | null;
  selectedFiles: string[];
  outputFolder: string | null;
  selectionMessage: string | null;
  folderTreeOpenRequestCount: number;
  applySourceSelectionState: (patch: SourceSelectionStatePatch) => void;
  requestFolderTreeOpen: () => void;
  applyFolderTreeSelection: (
    folderPaths: string[],
    rootPath: string,
    summary: SelectedFolderSummary,
    lastScannedAt: string | null
  ) => Promise<void>;
  chooseFolders: () => Promise<void>;
  chooseFiles: () => Promise<void>;
  chooseOutputFolder: () => Promise<void>;
  chooseRecentFolder: (path: string) => Promise<void>;
  clearSelectedSources: () => void;
}

export function useSourceSelection({
  settings,
  includeSubfolders,
  persistSettings,
  setWorkflowMessage,
  setActiveAction
}: UseSourceSelectionOptions): UseSourceSelectionValue {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFolderSummary, setSelectedFolderSummary] = useState<SelectedFolderSummary | null>(null);
  const [folderTreeRootPath, setFolderTreeRootPath] = useState<string | null>(null);
  const [folderTreeLastScannedAt, setFolderTreeLastScannedAt] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [folderTreeOpenRequestCount, setFolderTreeOpenRequestCount] = useState(0);

  const applySourceSelectionState = useCallback((patch: SourceSelectionStatePatch): void => {
    if ('selectedFolders' in patch) {
      setSelectedFolders(patch.selectedFolders ?? []);
    }

    if ('selectedFolderSummary' in patch) {
      setSelectedFolderSummary(patch.selectedFolderSummary ?? null);
    }

    if ('folderTreeRootPath' in patch) {
      setFolderTreeRootPath(patch.folderTreeRootPath ?? null);
    }

    if ('folderTreeLastScannedAt' in patch) {
      setFolderTreeLastScannedAt(patch.folderTreeLastScannedAt ?? null);
    }

    if ('selectedFiles' in patch) {
      setSelectedFiles(patch.selectedFiles ?? []);
    }

    if ('outputFolder' in patch) {
      setOutputFolder(patch.outputFolder ?? null);
    }

    if ('selectionMessage' in patch) {
      setSelectionMessage(patch.selectionMessage ?? null);
    }
  }, []);

  const requestFolderTreeOpen = useCallback((): void => {
    setFolderTreeOpenRequestCount((count) => count + 1);
    setSelectionMessage(null);
  }, []);

  const handleSelectionResult = useCallback(
    async (result: PathSelectionResult, onValidPaths: (paths: string[]) => void): Promise<void> => {
      if (result.canceled) {
        setSelectionMessage(null);
        return;
      }

      onValidPaths(result.paths);
      setSelectionMessage(
        result.invalidPaths.length > 0
          ? `${result.invalidPaths.length} selected path(s) could not be used.`
          : null
      );
    },
    []
  );

  const chooseFolders = useCallback(async (): Promise<void> => {
    setActiveAction('folders');

    try {
      const result = await dialogClient.chooseFolders();
      await handleSelectionResult(result, (paths) => {
        setSelectedFolders(dedupeOverlappingFolderPaths(paths));
        setSelectedFolderSummary(null);
        setFolderTreeRootPath(null);
        setFolderTreeLastScannedAt(null);
      });

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths(result.paths, settings?.recentFolders ?? []),
          latestSelectedFolder: result.paths[0],
          latestFolderTreeSource: null
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose folders.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, setActiveAction, settings?.recentFolders]);

  const applyFolderTreeSelection = useCallback(
    async (
      folderPaths: string[],
      rootPath: string,
      summary: SelectedFolderSummary,
      lastScannedAt: string | null
    ): Promise<void> => {
      const dedupedFolderPaths = dedupeOverlappingFolderPaths(folderPaths);
      const nextFolderTreeSource = createPersistedFolderTreeSource({
        rootPath,
        selectedFolderPaths: summary.selectedFolderPaths,
        dedupedSelectedFolderPaths: dedupedFolderPaths,
        summary: {
          ...summary,
          dedupedFolderPaths,
          dedupedFolderCount: dedupedFolderPaths.length
        },
        includeSubfolders,
        lastScannedAt
      });

      setSelectedFolders(dedupedFolderPaths);
      setSelectedFolderSummary(nextFolderTreeSource.selectedFolderSummary);
      setFolderTreeRootPath(rootPath);
      setFolderTreeLastScannedAt(lastScannedAt);
      setSelectionMessage(null);
      setWorkflowMessage(
        dedupedFolderPaths.length > 0
          ? `${dedupedFolderPaths.length.toLocaleString()} folder tree source(s) selected.`
          : 'No folder tree sources selected.'
      );

      if (dedupedFolderPaths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths([rootPath, ...dedupedFolderPaths], settings?.recentFolders ?? []),
          latestSelectedFolder: rootPath,
          latestFolderTreeSource: nextFolderTreeSource
        });
      }
    },
    [includeSubfolders, persistSettings, settings?.recentFolders, setWorkflowMessage]
  );

  const chooseRecentFolder = useCallback(
    async (path: string): Promise<void> => {
      if (!path) {
        return;
      }

      setSelectedFolders([path]);
      setSelectedFolderSummary(null);
      setFolderTreeRootPath(null);
      setFolderTreeLastScannedAt(null);
      setSelectedFiles([]);
      setSelectionMessage(null);
      await persistSettings({
        recentFolders: mergeRecentPaths([path], settings?.recentFolders ?? []),
        latestSelectedFolder: path,
        latestFolderTreeSource: null
      });
    },
    [persistSettings, settings?.recentFolders]
  );

  const chooseFiles = useCallback(async (): Promise<void> => {
    setActiveAction('files');

    try {
      const result = await dialogClient.chooseVideoFiles();
      await handleSelectionResult(result, setSelectedFiles);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFiles: mergeRecentPaths(result.paths, settings?.recentFiles ?? [])
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose files.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, setActiveAction, settings?.recentFiles]);

  const clearSelectedSources = useCallback((): void => {
    setSelectedFolders([]);
    setSelectedFolderSummary(null);
    setFolderTreeRootPath(null);
    setFolderTreeLastScannedAt(null);
    setSelectedFiles([]);
    setSelectionMessage(null);
    setWorkflowMessage('Selected sources cleared.');
    void persistSettings({
      latestFolderTreeSource: null,
      latestSelectedFolder: null
    });
  }, [persistSettings, setWorkflowMessage]);

  const chooseOutputFolder = useCallback(async (): Promise<void> => {
    setActiveAction('output');

    try {
      const result = await dialogClient.chooseOutputFolder();
      await handleSelectionResult(result, (paths) => setOutputFolder(paths[0] ?? null));

      if (!result.canceled && result.paths[0]) {
        await persistSettings({
          defaultOutputDirectory: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose an output folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, setActiveAction]);

  return {
    selectedFolders,
    selectedFolderSummary,
    folderTreeRootPath,
    folderTreeLastScannedAt,
    selectedFiles,
    outputFolder,
    selectionMessage,
    folderTreeOpenRequestCount,
    applySourceSelectionState,
    requestFolderTreeOpen,
    applyFolderTreeSelection,
    chooseFolders,
    chooseFiles,
    chooseOutputFolder,
    chooseRecentFolder,
    clearSelectedSources
  };
}
