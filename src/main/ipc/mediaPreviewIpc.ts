import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewRequest,
  MediaPreviewResult,
  MediaPreviewResultResponse,
  MediaPreviewStartResponse,
  PreviewFrameRequest,
  PreviewFrameResultResponse
} from '../../shared/types/mediaPreview';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import {
  clearMediaPreviewCache,
  generatePreviewFrames,
  generateThumbnails,
  validateMediaPreviewRequest
} from '../services/mediaPreviewService';
import { getSettings } from '../services/settingsService';

const mediaPreviewJobs = new JobRegistry<MediaPreviewRequest, MediaPreviewJobSnapshot, MediaPreviewResult>();

export function registerMediaPreviewIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.mediaPreviewStart,
    async (event, request: MediaPreviewRequest): Promise<MediaPreviewStartResponse> => {
      const validation = await validateMediaPreviewRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = mediaPreviewJobs.create(validation.request, {
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalVideos: validation.request.videos.length,
        processedVideos: 0,
        generatedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        currentFile: null,
        message: 'Starting thumbnail generation.',
        error: null
      });

      sendMediaPreviewProgress(browserWindow, job.snapshot);
      void runMediaPreviewJob(job, browserWindow);

      return {
        jobId: job.id,
        status: 'started',
        message: 'Thumbnail generation started.',
        totalVideos: validation.request.videos.length
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.mediaPreviewCancel, (_event, jobId: string): MediaPreviewJobSnapshot => {
    const job = mediaPreviewJobs.get(jobId);

    if (!job) {
      return createMissingMediaPreviewJobSnapshot(jobId);
    }

    if (
      job.snapshot.status === 'complete' ||
      job.snapshot.status === 'error' ||
      job.snapshot.status === 'canceled'
    ) {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = mediaPreviewJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      message: 'Thumbnail generation canceled.'
    });

    sendMediaPreviewProgress(BrowserWindow.fromWebContents(_event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.mediaPreviewGetResult, (_event, jobId: string): MediaPreviewResultResponse => {
    const job = mediaPreviewJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Media preview job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Media preview result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.mediaPreviewGenerateFrames,
    async (_event, request: PreviewFrameRequest): Promise<PreviewFrameResultResponse> => {
      try {
        const settings = await getSettings();
        const result = await generatePreviewFrames({
          ...request,
          ffmpegPath: settings.ffmpegPathOverride
        });

        return {
          status: 'complete',
          result
        };
      } catch (error: unknown) {
        return {
          status: error instanceof Error && error.message.includes('must') ? 'invalid_request' : 'error',
          message: error instanceof Error ? error.message : 'Unable to generate preview frames.'
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.mediaPreviewClearCache, async (): Promise<{ status: string; message: string }> => {
    await clearMediaPreviewCache();

    return {
      status: 'complete',
      message: 'Media preview cache cleared.'
    };
  });
}

async function runMediaPreviewJob(
  job: JobRecord<MediaPreviewRequest, MediaPreviewJobSnapshot, MediaPreviewResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await generateThumbnails({
      ...job.request,
      ffmpegPath: settings.ffmpegPathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateMediaPreviewProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });
    const result: MediaPreviewResult = {
      jobId: job.id,
      status: 'complete',
      message: 'Thumbnail generation complete.',
      ...serviceResult
    };

    mediaPreviewJobs.setResult(job, result);
    updateMediaPreviewProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      totalVideos: result.summary.requested,
      processedVideos: result.summary.requested,
      generatedCount: result.summary.generated,
      cachedCount: result.summary.cached,
      failedCount: result.summary.failed,
      currentFile: null,
      message: 'Thumbnail generation complete.',
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled ? 'Thumbnail generation canceled.' : 'Thumbnail generation failed.';

    updateMediaPreviewProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      message,
      error: error instanceof Error ? error.message : message
    });
  }
}

function updateMediaPreviewProgress(
  job: JobRecord<MediaPreviewRequest, MediaPreviewJobSnapshot, MediaPreviewResult>,
  browserWindow: BrowserWindow | null,
  progress: MediaPreviewJobSnapshot
): void {
  mediaPreviewJobs.patchSnapshot(job, progress);
  sendMediaPreviewProgress(browserWindow, job.snapshot);
}

function sendMediaPreviewProgress(
  browserWindow: BrowserWindow | null,
  snapshot: MediaPreviewJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.mediaPreviewProgress, snapshot);
}

function createMissingMediaPreviewJobSnapshot(jobId: string): MediaPreviewJobSnapshot {
  return {
    jobId,
    status: 'error',
    phase: 'error',
    totalVideos: null,
    processedVideos: 0,
    generatedCount: 0,
    cachedCount: 0,
    failedCount: 0,
    currentFile: null,
    message: 'Media preview job not found.',
    error: 'Media preview job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
