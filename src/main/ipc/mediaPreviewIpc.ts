import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewRequest,
  MediaPreviewResult,
  MediaPreviewResultResponse,
  MediaPreviewStartResponse,
  PreviewClipJobSnapshot,
  PreviewClipRequest,
  PreviewClipResult,
  PreviewClipResultResponse,
  PreviewClipStartResponse,
  PreviewFrameRequest,
  PreviewFrameResultResponse
} from '../../shared/types/mediaPreview';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import {
  clearMediaPreviewCache,
  generatePreviewClips,
  generatePreviewFrames,
  generateThumbnails,
  validateMediaPreviewRequest,
  validatePreviewClipRequest
} from '../services/mediaPreviewService';
import { notifyLongJobComplete } from '../services/notificationService';
import { getSettings } from '../services/settingsService';

const mediaPreviewJobs = new JobRegistry<MediaPreviewRequest, MediaPreviewJobSnapshot, MediaPreviewResult>();
type PreviewClipJobRequest = PreviewClipRequest & {
  frames: NonNullable<PreviewClipRequest['frames']>;
  clipDurationSeconds: number;
  width: number;
};

const previewClipJobs = new JobRegistry<PreviewClipJobRequest, PreviewClipJobSnapshot, PreviewClipResult>();

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

  ipcMain.handle(
    IPC_CHANNELS.mediaPreviewClipStart,
    async (event, request: PreviewClipRequest): Promise<PreviewClipStartResponse> => {
      const validation = await validatePreviewClipRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const totalClips = validation.request.frames.length || null;
      const job = previewClipJobs.create(validation.request, {
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalClips,
        processedClips: 0,
        generatedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        currentFile: validation.request.video.fileName ?? null,
        currentTimestampLabel: null,
        message: 'Starting preview clip generation.',
        error: null
      });

      sendPreviewClipProgress(browserWindow, job.snapshot);
      void runPreviewClipJob(job, browserWindow);

      return {
        jobId: job.id,
        status: 'started',
        message: 'Preview clip generation started.',
        totalClips
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.mediaPreviewClipCancel, (_event, jobId: string): PreviewClipJobSnapshot => {
    const job = previewClipJobs.get(jobId);

    if (!job) {
      return createMissingPreviewClipJobSnapshot(jobId);
    }

    if (
      job.snapshot.status === 'complete' ||
      job.snapshot.status === 'error' ||
      job.snapshot.status === 'canceled'
    ) {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = previewClipJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      currentTimestampLabel: null,
      message: 'Preview clip generation canceled.'
    });

    sendPreviewClipProgress(BrowserWindow.fromWebContents(_event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.mediaPreviewClipGetResult, (_event, jobId: string): PreviewClipResultResponse => {
    const job = previewClipJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Preview clip job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Preview clip result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });

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
    notifyLongJobComplete(
      'Thumbnail generation complete',
      `${result.summary.generated.toLocaleString()} generated, ${result.summary.cached.toLocaleString()} cached.`
    );
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

async function runPreviewClipJob(
  job: JobRecord<PreviewClipJobRequest, PreviewClipJobSnapshot, PreviewClipResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await generatePreviewClips({
      ...job.request,
      clipDurationSeconds: job.request.clipDurationSeconds ?? settings.previewClipDurationSecondsDefault,
      width: job.request.width ?? settings.previewClipWidthDefault,
      ffmpegPath: settings.ffmpegPathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updatePreviewClipProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });
    const result: PreviewClipResult = {
      jobId: job.id,
      status: 'complete',
      message: 'Preview clip generation complete.',
      ...serviceResult
    };

    previewClipJobs.setResult(job, result);
    notifyLongJobComplete(
      'Preview clip generation complete',
      `${result.summary.generated.toLocaleString()} generated, ${result.summary.cached.toLocaleString()} cached.`
    );
    updatePreviewClipProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      totalClips: result.summary.requested,
      processedClips: result.summary.requested,
      generatedCount: result.summary.generated,
      cachedCount: result.summary.cached,
      failedCount: result.summary.failed,
      currentFile: null,
      currentTimestampLabel: null,
      message: 'Preview clip generation complete.',
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled ? 'Preview clip generation canceled.' : 'Preview clip generation failed.';

    updatePreviewClipProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      currentTimestampLabel: null,
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

function updatePreviewClipProgress(
  job: JobRecord<PreviewClipJobRequest, PreviewClipJobSnapshot, PreviewClipResult>,
  browserWindow: BrowserWindow | null,
  progress: PreviewClipJobSnapshot
): void {
  previewClipJobs.patchSnapshot(job, progress);
  sendPreviewClipProgress(browserWindow, job.snapshot);
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

function sendPreviewClipProgress(
  browserWindow: BrowserWindow | null,
  snapshot: PreviewClipJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.mediaPreviewClipProgress, snapshot);
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

function createMissingPreviewClipJobSnapshot(jobId: string): PreviewClipJobSnapshot {
  return {
    jobId,
    status: 'error',
    phase: 'error',
    totalClips: null,
    processedClips: 0,
    generatedCount: 0,
    cachedCount: 0,
    failedCount: 0,
    currentFile: null,
    currentTimestampLabel: null,
    message: 'Preview clip job not found.',
    error: 'Preview clip job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
