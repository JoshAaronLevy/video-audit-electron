import { useCallback, useEffect, useState } from 'react';
import type { AutoFixJobSnapshot, AutoFixResult } from '../../shared/types/autoFix';
import type { AutoCropResult } from '../../shared/types/autoCrop';
import type { VideoRow } from '../../shared/types/video';
import * as autoFixClient from '../api/autoFixClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type AutoFixWorkflowActiveAction = 'autoFix' | null;

interface UseAutoFixWorkflowOptions {
  selectedVideos: VideoRow[];
  autoFixOutputDirectory: string | null;
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  createPostConversionPlan: (input: {
    sourceLabel: string;
    autoFixResult?: AutoFixResult;
    autoCropResult?: AutoCropResult;
  }) => Promise<boolean>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: AutoFixWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UseAutoFixWorkflowValue {
  autoFixProgress: AutoFixJobSnapshot | null;
  autoFixPercent: number | null;
  autoFixResult: AutoFixResult | null;
  autoFixError: string | null;
  isAutoFixDialogVisible: boolean;
  openAutoFixDialog: () => void;
  closeAutoFixDialog: () => void;
  startAutoFix: () => Promise<void>;
  cancelAutoFix: () => Promise<void>;
  resetAutoFixWorkflow: () => void;
}

export function useAutoFixWorkflow({
  selectedVideos,
  autoFixOutputDirectory,
  hideVideoPathsFromTable,
  createPostConversionPlan,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseAutoFixWorkflowOptions): UseAutoFixWorkflowValue {
  const [autoFixJobId, setAutoFixJobId] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<AutoFixJobSnapshot | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [autoFixError, setAutoFixError] = useState<string | null>(null);
  const [isAutoFixDialogVisible, setIsAutoFixDialogVisible] = useState(false);
  const autoFixPercent = getProgressPercent(autoFixProgress?.processedVideos, autoFixProgress?.totalVideos);

  const resetAutoFixWorkflow = useCallback((): void => {
    setAutoFixJobId(null);
    setAutoFixProgress(null);
    setAutoFixResult(null);
    setAutoFixError(null);
    setIsAutoFixDialogVisible(false);
  }, []);

  useEffect(() => {
    return autoFixClient.subscribeToAutoFixProgress((progress) => {
      setAutoFixProgress(progress);

      if (progress.jobId) {
        setAutoFixJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoFix');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoFixResult(progress.result);
        setAutoFixError(null);

        const succeededPaths = progress.result.items
          .filter((item) => item.status === 'success' && item.sourcePath)
          .map((item) => item.sourcePath as string);

        void hideVideoPathsFromTable(succeededPaths).then((hiddenCount) => {
          const removedText =
            hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} video(s) were removed from the table.` : '';
          setWorkflowMessage(`Auto-Fix complete.${removedText}`);
          void createPostConversionPlan({
            sourceLabel: 'Auto-Fix',
            autoFixResult: progress.result
          }).then((opened) => {
            if (opened) {
              setIsAutoFixDialogVisible(false);
            }
          });
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoFixError(progress.error ?? progress.message ?? 'Auto-Fix failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Fix failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoFixError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      }
    });
  }, [createPostConversionPlan, hideVideoPathsFromTable, setActiveAction, setWorkflowMessage]);

  const openAutoFixDialog = useCallback((): void => {
    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress(null);
    setIsAutoFixDialogVisible(true);

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
    }
  }, [autoFixOutputDirectory]);

  const closeAutoFixDialog = useCallback((): void => {
    if (busyState.activeAction === 'autoFix' || isRunningAutoFixProgress(autoFixProgress)) {
      return;
    }

    setIsAutoFixDialogVisible(false);
    setAutoFixError(null);
  }, [autoFixProgress, busyState.activeAction]);

  const startAutoFix = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoFixError('Select at least one video before running Auto-Fix.');
      return;
    }

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
      return;
    }

    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: selectedVideos.length,
      processedVideos: 0,
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message: 'Starting Auto-Fix.',
      succeeded: 0,
      failed: 0,
      outputDirectory: autoFixOutputDirectory,
      error: null
    });
    setActiveAction('autoFix');

    try {
      const response = await autoFixClient.startAutoFix({
        videos: selectedVideos,
        outputDirectory: autoFixOutputDirectory
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoFixError(response.message ?? 'Could not start Auto-Fix.');
        return;
      }

      setAutoFixJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Fix started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoFixError(getErrorMessage(error, 'Could not start Auto-Fix.'));
    }
  }, [autoFixOutputDirectory, selectedVideos, setActiveAction, setWorkflowMessage]);

  const cancelAutoFix = useCallback(async (): Promise<void> => {
    if (!autoFixJobId) {
      return;
    }

    try {
      const progress = await autoFixClient.cancelAutoFix(autoFixJobId);
      setAutoFixProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoFixError(getErrorMessage(error, 'Could not cancel Auto-Fix.'));
    }
  }, [autoFixJobId, setActiveAction, setWorkflowMessage]);

  return {
    autoFixProgress,
    autoFixPercent,
    autoFixResult,
    autoFixError,
    isAutoFixDialogVisible,
    openAutoFixDialog,
    closeAutoFixDialog,
    startAutoFix,
    cancelAutoFix,
    resetAutoFixWorkflow
  };
}

function isRunningAutoFixProgress(progress: AutoFixJobSnapshot | null): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}
