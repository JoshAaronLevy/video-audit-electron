import { useCallback, useEffect, useState } from 'react';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewResultItem,
  MediaPreviewScope,
  PreviewClipJobSnapshot,
  PreviewClipResult
} from '../../shared/types/mediaPreview';
import type { VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import * as mediaPreviewClient from '../api/mediaPreviewClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type MediaPreviewWorkflowActiveAction = 'mediaPreview' | 'previewClip' | null;

interface UseMediaPreviewWorkflowOptions {
  visibleVideoRows: VideoRow[];
  selectedVideos: VideoRow[];
  hasAuditResult: boolean;
  previewClipDurationSecondsDefault?: number;
  previewClipWidthDefault?: number;
  mergeMediaPreviewResult: (result: MediaPreviewResult) => Promise<void>;
  mergeMediaPreviewItemsIntoRows: (items: MediaPreviewResultItem[]) => Promise<void>;
  mergePreviewClipResult: (result: PreviewClipResult) => Promise<void>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: MediaPreviewWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UseMediaPreviewWorkflowValue {
  mediaPreviewProgress: MediaPreviewJobSnapshot | null;
  mediaPreviewPercent: number | null;
  mediaPreviewResult: MediaPreviewResult | null;
  mediaPreviewError: string | null;
  mediaPreviewScope: MediaPreviewScope;
  isThumbnailDialogVisible: boolean;
  previewClipProgress: PreviewClipJobSnapshot | null;
  previewClipPercent: number | null;
  previewClipResult: PreviewClipResult | null;
  previewClipError: string | null;
  previewFrameFetchPath: string | null;
  previewFrameError: string | null;
  openThumbnailDialog: () => void;
  closeThumbnailDialog: () => void;
  setMediaPreviewScope: (scope: MediaPreviewScope) => void;
  startThumbnailGeneration: () => Promise<void>;
  cancelThumbnailGeneration: () => Promise<void>;
  clearPreviewFrameError: () => void;
  getFreshThumbnailsForVideo: (video: VideoRow) => Promise<void>;
  startPreviewClipGeneration: (video: VideoRow, frames: VideoPreviewFrame[]) => Promise<void>;
  cancelPreviewClipGeneration: () => Promise<void>;
  resetMediaPreviewWorkflow: () => void;
}

export function useMediaPreviewWorkflow({
  visibleVideoRows,
  selectedVideos,
  hasAuditResult,
  previewClipDurationSecondsDefault,
  previewClipWidthDefault,
  mergeMediaPreviewResult,
  mergeMediaPreviewItemsIntoRows,
  mergePreviewClipResult,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseMediaPreviewWorkflowOptions): UseMediaPreviewWorkflowValue {
  const [mediaPreviewJobId, setMediaPreviewJobId] = useState<string | null>(null);
  const [mediaPreviewProgress, setMediaPreviewProgress] = useState<MediaPreviewJobSnapshot | null>(null);
  const [mediaPreviewResult, setMediaPreviewResult] = useState<MediaPreviewResult | null>(null);
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null);
  const [mediaPreviewScope, setMediaPreviewScope] = useState<MediaPreviewScope>('all');
  const [isThumbnailDialogVisible, setIsThumbnailDialogVisible] = useState(false);
  const [previewClipJobId, setPreviewClipJobId] = useState<string | null>(null);
  const [previewClipProgress, setPreviewClipProgress] = useState<PreviewClipJobSnapshot | null>(null);
  const [previewClipResult, setPreviewClipResult] = useState<PreviewClipResult | null>(null);
  const [previewClipError, setPreviewClipError] = useState<string | null>(null);
  const [previewFrameFetchPath, setPreviewFrameFetchPath] = useState<string | null>(null);
  const [previewFrameError, setPreviewFrameError] = useState<string | null>(null);

  const mediaPreviewPercent = getProgressPercent(
    mediaPreviewProgress?.processedVideos,
    mediaPreviewProgress?.totalVideos
  );
  const previewClipPercent = getProgressPercent(
    previewClipProgress?.processedClips,
    previewClipProgress?.totalClips
  );
  const selectedVideoCount = selectedVideos.length;

  const resetMediaPreviewWorkflow = useCallback((): void => {
    setMediaPreviewJobId(null);
    setMediaPreviewProgress(null);
    setMediaPreviewResult(null);
    setMediaPreviewError(null);
    setMediaPreviewScope('all');
    setIsThumbnailDialogVisible(false);
    setPreviewClipJobId(null);
    setPreviewClipProgress(null);
    setPreviewClipResult(null);
    setPreviewClipError(null);
    setPreviewFrameFetchPath(null);
    setPreviewFrameError(null);
  }, []);

  useEffect(() => {
    return mediaPreviewClient.subscribeToMediaPreviewProgress((progress) => {
      setMediaPreviewProgress(progress);

      if (progress.jobId) {
        setMediaPreviewJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('mediaPreview');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setMediaPreviewResult(progress.result);
        setMediaPreviewError(null);
        void mergeMediaPreviewResult(progress.result).then(() => {
          setWorkflowMessage(
            `Thumbnail generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setMediaPreviewError(progress.error ?? progress.message ?? 'Thumbnail generation failed.');
        setWorkflowMessage(progress.message ?? 'Thumbnail generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setMediaPreviewError(null);
        setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      }
    });
  }, [mergeMediaPreviewResult, setActiveAction, setWorkflowMessage]);

  useEffect(() => {
    return mediaPreviewClient.subscribeToClipProgress((progress) => {
      setPreviewClipProgress(progress);

      if (progress.jobId) {
        setPreviewClipJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('previewClip');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setPreviewClipResult(progress.result);
        setPreviewClipError(null);
        void mergePreviewClipResult(progress.result).then(() => {
          setWorkflowMessage(
            `Preview clip generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setPreviewClipError(progress.error ?? progress.message ?? 'Preview clip generation failed.');
        setWorkflowMessage(progress.message ?? 'Preview clip generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setPreviewClipError(null);
        setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      }
    });
  }, [mergePreviewClipResult, setActiveAction, setWorkflowMessage]);

  const openThumbnailDialog = useCallback((): void => {
    if (visibleVideoRows.length === 0) {
      setWorkflowMessage('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewScope(selectedVideoCount > 0 ? 'selected' : 'all');
    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress(null);
    setIsThumbnailDialogVisible(true);
  }, [selectedVideoCount, setWorkflowMessage, visibleVideoRows.length]);

  const closeThumbnailDialog = useCallback((): void => {
    if (busyState.activeAction === 'mediaPreview' || isRunningMediaPreviewProgress(mediaPreviewProgress)) {
      return;
    }

    setIsThumbnailDialogVisible(false);
    setMediaPreviewError(null);
  }, [busyState.activeAction, mediaPreviewProgress]);

  const startThumbnailGeneration = useCallback(async (): Promise<void> => {
    const rows = mediaPreviewScope === 'selected' && selectedVideoCount > 0 ? selectedVideos : visibleVideoRows;

    if (rows.length === 0) {
      setMediaPreviewError('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: rows.length,
      processedVideos: 0,
      generatedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      currentFile: null,
      message: 'Starting thumbnail generation.',
      error: null
    });
    setActiveAction('mediaPreview');

    try {
      const response = await mediaPreviewClient.startMediaPreview({
        videos: rows,
        mode: 'thumbnail'
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setMediaPreviewError(response.message ?? 'Could not start thumbnail generation.');
        return;
      }

      setMediaPreviewJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Thumbnail generation started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setMediaPreviewError(getErrorMessage(error, 'Could not start thumbnail generation.'));
    }
  }, [
    mediaPreviewScope,
    selectedVideoCount,
    selectedVideos,
    setActiveAction,
    setWorkflowMessage,
    visibleVideoRows
  ]);

  const cancelThumbnailGeneration = useCallback(async (): Promise<void> => {
    if (!mediaPreviewJobId) {
      return;
    }

    try {
      const progress = await mediaPreviewClient.cancelMediaPreview(mediaPreviewJobId);
      setMediaPreviewProgress(progress);
      setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setMediaPreviewError(getErrorMessage(error, 'Could not cancel thumbnail generation.'));
    }
  }, [mediaPreviewJobId, setActiveAction, setWorkflowMessage]);

  const clearPreviewFrameError = useCallback((): void => {
    setPreviewFrameError(null);
  }, []);

  const getFreshThumbnailsForVideo = useCallback(
    async (video: VideoRow): Promise<void> => {
      if (!hasAuditResult) {
        setPreviewFrameError('No audit result is available for thumbnail updates.');
        return;
      }

      setPreviewFrameFetchPath(video.path);
      setPreviewFrameError(null);

      try {
        const response = await mediaPreviewClient.generateFrames({
          video,
          mode: 'fresh'
        });

        if (response.status !== 'complete' || !response.result) {
          setPreviewFrameError(response.message ?? 'Could not get fresh thumbnails.');
          return;
        }

        const fallbackThumbnail =
          video.thumbnail ??
          response.result.frames.find((frame) => frame.thumbnail.generated)?.thumbnail ?? {
            generated: false,
            error: 'No generated thumbnails returned.'
          };
        const previewItem: MediaPreviewResultItem = {
          id: video.id,
          fileName: video.fileName,
          path: video.path,
          absolutePath: video.path,
          thumbnail: fallbackThumbnail,
          previewFrames: response.result
        };

        await mergeMediaPreviewItemsIntoRows([previewItem]);
        setWorkflowMessage(
          `Fresh thumbnails ready. ${response.result.summary.returned.toLocaleString()} frame(s) available.`
        );
      } catch (error: unknown) {
        setPreviewFrameError(getErrorMessage(error, 'Could not get fresh thumbnails.'));
      } finally {
        setPreviewFrameFetchPath(null);
      }
    },
    [hasAuditResult, mergeMediaPreviewItemsIntoRows, setWorkflowMessage]
  );

  const startPreviewClipGeneration = useCallback(
    async (video: VideoRow, frames: VideoPreviewFrame[]): Promise<void> => {
      if (!video) {
        setPreviewClipError('Choose a video before generating preview clips.');
        return;
      }

      setPreviewClipError(null);
      setPreviewClipResult(null);
      setPreviewClipProgress({
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalClips: frames.length || null,
        processedClips: 0,
        generatedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        currentFile: video.fileName,
        currentTimestampLabel: null,
        message: 'Starting preview clip generation.',
        error: null
      });
      setActiveAction('previewClip');

      try {
        const response = await mediaPreviewClient.startClipGeneration({
          video,
          frames,
          clipDurationSeconds: previewClipDurationSecondsDefault ?? 5,
          width: previewClipWidthDefault ?? 640
        });

        if (response.status !== 'started' || !response.jobId) {
          setActiveAction(null);
          setPreviewClipError(response.message ?? 'Could not start preview clip generation.');
          return;
        }

        setPreviewClipJobId(response.jobId);
        setWorkflowMessage(response.message ?? 'Preview clip generation started.');
      } catch (error: unknown) {
        setActiveAction(null);
        setPreviewClipError(getErrorMessage(error, 'Could not start preview clip generation.'));
      }
    },
    [previewClipDurationSecondsDefault, previewClipWidthDefault, setActiveAction, setWorkflowMessage]
  );

  const cancelPreviewClipGeneration = useCallback(async (): Promise<void> => {
    if (!previewClipJobId) {
      return;
    }

    try {
      const progress = await mediaPreviewClient.cancelClipGeneration(previewClipJobId);
      setPreviewClipProgress(progress);
      setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setPreviewClipError(getErrorMessage(error, 'Could not cancel preview clip generation.'));
    }
  }, [previewClipJobId, setActiveAction, setWorkflowMessage]);

  return {
    mediaPreviewProgress,
    mediaPreviewPercent,
    mediaPreviewResult,
    mediaPreviewError,
    mediaPreviewScope,
    isThumbnailDialogVisible,
    previewClipProgress,
    previewClipPercent,
    previewClipResult,
    previewClipError,
    previewFrameFetchPath,
    previewFrameError,
    openThumbnailDialog,
    closeThumbnailDialog,
    setMediaPreviewScope,
    startThumbnailGeneration,
    cancelThumbnailGeneration,
    clearPreviewFrameError,
    getFreshThumbnailsForVideo,
    startPreviewClipGeneration,
    cancelPreviewClipGeneration,
    resetMediaPreviewWorkflow
  };
}

function isRunningMediaPreviewProgress(progress: MediaPreviewJobSnapshot | null): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}
