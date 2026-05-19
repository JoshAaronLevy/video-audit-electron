import { useCallback, useEffect, useState } from 'react';
import type { AutoCropJobSnapshot, AutoCropResult } from '../../shared/types/autoCrop';
import type { AutoFixResult } from '../../shared/types/autoFix';
import type { VideoRow } from '../../shared/types/video';
import * as autoCropClient from '../api/autoCropClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type AutoCropWorkflowActiveAction = 'autoCrop' | null;

interface UseAutoCropWorkflowOptions {
  selectedVideos: VideoRow[];
  autoCropOutputRootDir: string | null;
  createPostConversionPlan: (input: {
    sourceLabel: string;
    autoFixResult?: AutoFixResult;
    autoCropResult?: AutoCropResult;
  }) => Promise<boolean>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: AutoCropWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UseAutoCropWorkflowValue {
  autoCropProgress: AutoCropJobSnapshot | null;
  autoCropPercent: number | null;
  autoCropResult: AutoCropResult | null;
  autoCropError: string | null;
  isAutoCropDialogVisible: boolean;
  openAutoCropDialog: () => void;
  closeAutoCropDialog: () => void;
  startAutoCrop: () => Promise<void>;
  cancelAutoCrop: () => Promise<void>;
  resetAutoCropWorkflow: () => void;
}

export function useAutoCropWorkflow({
  selectedVideos,
  autoCropOutputRootDir,
  createPostConversionPlan,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseAutoCropWorkflowOptions): UseAutoCropWorkflowValue {
  const [autoCropJobId, setAutoCropJobId] = useState<string | null>(null);
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropJobSnapshot | null>(null);
  const [autoCropResult, setAutoCropResult] = useState<AutoCropResult | null>(null);
  const [autoCropError, setAutoCropError] = useState<string | null>(null);
  const [isAutoCropDialogVisible, setIsAutoCropDialogVisible] = useState(false);
  const autoCropPercent = getProgressPercent(autoCropProgress?.processedFiles, autoCropProgress?.totalFiles);

  const resetAutoCropWorkflow = useCallback((): void => {
    setAutoCropJobId(null);
    setAutoCropProgress(null);
    setAutoCropResult(null);
    setAutoCropError(null);
    setIsAutoCropDialogVisible(false);
  }, []);

  useEffect(() => {
    return autoCropClient.subscribeToAutoCropProgress((progress) => {
      setAutoCropProgress(progress);

      if (progress.jobId) {
        setAutoCropJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoCrop');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoCropResult(progress.result);
        setAutoCropError(null);
        const croppedCount = progress.result.summary.succeeded;
        const croppedLabel = croppedCount === 1 ? 'cropped copy' : 'cropped copies';
        setWorkflowMessage(
          `Auto-Crop complete. ${croppedCount.toLocaleString()} ${croppedLabel} created.`
        );
        void createPostConversionPlan({
          sourceLabel: 'Auto-Crop',
          autoCropResult: progress.result
        }).then((opened) => {
          if (opened) {
            setIsAutoCropDialogVisible(false);
          }
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoCropError(progress.error ?? progress.message ?? 'Auto-Crop failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Crop failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoCropError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      }
    });
  }, [createPostConversionPlan, setActiveAction, setWorkflowMessage]);

  const openAutoCropDialog = useCallback((): void => {
    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress(null);
    setIsAutoCropDialogVisible(true);

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
    }
  }, [autoCropOutputRootDir]);

  const closeAutoCropDialog = useCallback((): void => {
    if (busyState.activeAction === 'autoCrop' || isRunningAutoCropProgress(autoCropProgress)) {
      return;
    }

    setIsAutoCropDialogVisible(false);
    setAutoCropError(null);
  }, [autoCropProgress, busyState.activeAction]);

  const startAutoCrop = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoCropError('Select at least one video before running Auto-Crop.');
      return;
    }

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
      return;
    }

    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      outputRootDir: autoCropOutputRootDir,
      outputDir: null,
      totalFiles: selectedVideos.length,
      processedFiles: 0,
      succeededCount: 0,
      skippedCount: 0,
      errorCount: 0,
      currentFile: null,
      message: 'Starting Auto-Crop.',
      error: null
    });
    setActiveAction('autoCrop');

    try {
      const response = await autoCropClient.startAutoCrop({
        videos: selectedVideos,
        outputRootDir: autoCropOutputRootDir
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoCropError(response.message ?? 'Could not start Auto-Crop.');
        return;
      }

      setAutoCropJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Crop started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoCropError(getErrorMessage(error, 'Could not start Auto-Crop.'));
    }
  }, [autoCropOutputRootDir, selectedVideos, setActiveAction, setWorkflowMessage]);

  const cancelAutoCrop = useCallback(async (): Promise<void> => {
    if (!autoCropJobId) {
      return;
    }

    try {
      const progress = await autoCropClient.cancelAutoCrop(autoCropJobId);
      setAutoCropProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoCropError(getErrorMessage(error, 'Could not cancel Auto-Crop.'));
    }
  }, [autoCropJobId, setActiveAction, setWorkflowMessage]);

  return {
    autoCropProgress,
    autoCropPercent,
    autoCropResult,
    autoCropError,
    isAutoCropDialogVisible,
    openAutoCropDialog,
    closeAutoCropDialog,
    startAutoCrop,
    cancelAutoCrop,
    resetAutoCropWorkflow
  };
}

function isRunningAutoCropProgress(progress: AutoCropJobSnapshot | null): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}
