import { useCallback, useEffect, useState } from 'react';
import type {
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest
} from '../../shared/types/audit';
import type { FfprobeResult } from '../../shared/types/video';
import * as ffprobeClient from '../api/ffprobeClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type FfprobeWorkflowActiveAction = 'ffprobe' | null;

interface UseFfprobeWorkflowOptions {
  discoveredPaths: string[];
  ffprobePathOverride: string | null;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: FfprobeWorkflowActiveAction) => void;
}

interface UseFfprobeWorkflowValue {
  ffprobeProgress: FfprobeMetadataJobSnapshot | null;
  ffprobePercent: number | null;
  metadataItems: FfprobeResult[];
  startFfprobe: () => Promise<void>;
  cancelFfprobe: () => Promise<void>;
  resetFfprobeWorkflow: () => void;
}

export function useFfprobeWorkflow({
  discoveredPaths,
  ffprobePathOverride,
  setWorkflowMessage,
  setActiveAction
}: UseFfprobeWorkflowOptions): UseFfprobeWorkflowValue {
  const [ffprobeJobId, setFfprobeJobId] = useState<string | null>(null);
  const [ffprobeProgress, setFfprobeProgress] = useState<FfprobeMetadataJobSnapshot | null>(null);
  const ffprobePercent = getProgressPercent(ffprobeProgress?.processedFiles, ffprobeProgress?.totalFiles);
  const metadataItems = ffprobeProgress?.result?.items ?? [];

  useEffect(() => {
    return ffprobeClient.subscribeToFfprobeProgress((progress) => {
      setFfprobeProgress(progress);

      if (progress.jobId) {
        setFfprobeJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction stopped.');
      }
    });
  }, [setActiveAction, setWorkflowMessage]);

  const startFfprobe = useCallback(async (): Promise<void> => {
    const request: FfprobeMetadataRequest = {
      filePaths: discoveredPaths,
      ffprobePathOverride
    };

    setWorkflowMessage(null);
    setFfprobeProgress(null);

    if (request.filePaths.length === 0) {
      setWorkflowMessage('Scan files before running metadata extraction.');
      return;
    }

    setActiveAction('ffprobe');

    try {
      const response = await ffprobeClient.startFfprobe(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start metadata extraction.');
        return;
      }

      setFfprobeJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Metadata extraction started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start metadata extraction.'));
    }
  }, [discoveredPaths, ffprobePathOverride, setActiveAction, setWorkflowMessage]);

  const cancelFfprobe = useCallback(async (): Promise<void> => {
    if (!ffprobeJobId) {
      return;
    }

    try {
      const progress = await ffprobeClient.cancelFfprobe(ffprobeJobId);
      setFfprobeProgress(progress);
      setWorkflowMessage(progress.message ?? 'Metadata extraction canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel metadata extraction.'));
    }
  }, [ffprobeJobId, setActiveAction, setWorkflowMessage]);

  const resetFfprobeWorkflow = useCallback((): void => {
    setFfprobeJobId(null);
    setFfprobeProgress(null);
  }, []);

  return {
    ffprobeProgress,
    ffprobePercent,
    metadataItems,
    startFfprobe,
    cancelFfprobe,
    resetFfprobeWorkflow
  };
}
