import { useCallback, useEffect, useState } from 'react';
import type {
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest
} from '../../shared/types/audit';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import * as discoveryClient from '../api/discoveryClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type DiscoveryWorkflowActiveAction = 'discovery' | null;

interface UseDiscoveryWorkflowOptions {
  selectedFolders: string[];
  selectedFiles: string[];
  includeSubfolders: boolean;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: DiscoveryWorkflowActiveAction) => void;
}

interface UseDiscoveryWorkflowValue {
  discoveryProgress: FileDiscoveryJobSnapshot | null;
  discoveryPercent: number | null;
  discoveredPaths: string[];
  startDiscovery: () => Promise<void>;
  cancelDiscovery: () => Promise<void>;
  resetDiscoveryWorkflow: () => void;
}

export function useDiscoveryWorkflow({
  selectedFolders,
  selectedFiles,
  includeSubfolders,
  setWorkflowMessage,
  setActiveAction
}: UseDiscoveryWorkflowOptions): UseDiscoveryWorkflowValue {
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<FileDiscoveryJobSnapshot | null>(null);
  const discoveryPercent = getProgressPercent(
    discoveryProgress?.processedFiles,
    discoveryProgress?.totalFiles
  );
  const discoveredPaths = discoveryProgress?.result?.files.map((file) => file.path) ?? [];

  useEffect(() => {
    return discoveryClient.subscribeToDiscoveryProgress((progress) => {
      setDiscoveryProgress(progress);

      if (progress.jobId) {
        setDiscoveryJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery stopped.');
      }
    });
  }, [setActiveAction, setWorkflowMessage]);

  const startDiscovery = useCallback(async (): Promise<void> => {
    const request: FileDiscoveryRequest = {
      folderPaths: dedupeOverlappingFolderPaths(selectedFolders),
      filePaths: selectedFiles,
      includeSubfolders
    };

    setWorkflowMessage(null);
    setDiscoveryProgress(null);

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before scanning.');
      return;
    }

    setActiveAction('discovery');

    try {
      const response = await discoveryClient.startDiscovery(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start file discovery.');
        return;
      }

      setDiscoveryJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'File discovery started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start file discovery.'));
    }
  }, [includeSubfolders, selectedFiles, selectedFolders, setActiveAction, setWorkflowMessage]);

  const cancelDiscovery = useCallback(async (): Promise<void> => {
    if (!discoveryJobId) {
      return;
    }

    try {
      const progress = await discoveryClient.cancelDiscovery(discoveryJobId);
      setDiscoveryProgress(progress);
      setWorkflowMessage(progress.message ?? 'File discovery canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel file discovery.'));
    }
  }, [discoveryJobId, setActiveAction, setWorkflowMessage]);

  const resetDiscoveryWorkflow = useCallback((): void => {
    setDiscoveryJobId(null);
    setDiscoveryProgress(null);
  }, []);

  return {
    discoveryProgress,
    discoveryPercent,
    discoveredPaths,
    startDiscovery,
    cancelDiscovery,
    resetDiscoveryWorkflow
  };
}
