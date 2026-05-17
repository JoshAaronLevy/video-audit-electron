import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  AutoCropJobSnapshot,
  AutoCropRequest,
  AutoCropResult,
  AutoCropResultResponse,
  AutoCropStartResponse
} from '../../shared/types/autoCrop';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import { runAutoCrop, validateAutoCropRequest } from '../services/autoCropService';
import { getSettings } from '../services/settingsService';

const autoCropJobs = new JobRegistry<AutoCropRequest, AutoCropJobSnapshot, AutoCropResult>();

export function registerAutoCropIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.autoCropStart,
    async (event, request: AutoCropRequest): Promise<AutoCropStartResponse> => {
      const validation = await validateAutoCropRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = autoCropJobs.create(validation.request, {
        jobId: null,
        status: 'starting',
        phase: 'validating',
        outputRootDir: validation.request.outputRootDir,
        outputDir: null,
        totalFiles: validation.request.videos.length,
        processedFiles: 0,
        succeededCount: 0,
        skippedCount: 0,
        errorCount: 0,
        currentFile: null,
        message: 'Starting Auto-Crop.',
        error: null
      });

      sendAutoCropProgress(browserWindow, job.snapshot);
      void runAutoCropJob(job, browserWindow);

      return {
        jobId: job.id,
        status: 'started',
        message: 'Auto-Crop started.',
        outputRootDir: validation.request.outputRootDir,
        totalFiles: validation.request.videos.length
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.autoCropCancel, (_event, jobId: string): AutoCropJobSnapshot => {
    const job = autoCropJobs.get(jobId);

    if (!job) {
      return createMissingAutoCropJobSnapshot(jobId);
    }

    if (
      job.snapshot.status === 'complete' ||
      job.snapshot.status === 'error' ||
      job.snapshot.status === 'canceled'
    ) {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = autoCropJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      message: 'Auto-Crop canceled.'
    });

    sendAutoCropProgress(BrowserWindow.fromWebContents(_event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.autoCropGetResult, (_event, jobId: string): AutoCropResultResponse => {
    const job = autoCropJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Auto-Crop job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Auto-Crop result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });
}

async function runAutoCropJob(
  job: JobRecord<AutoCropRequest, AutoCropJobSnapshot, AutoCropResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await runAutoCrop({
      ...job.request,
      ffmpegPath: settings.ffmpegPathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateAutoCropProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });
    const result: AutoCropResult = {
      jobId: job.id,
      status: 'complete',
      message: 'Auto-Crop complete.',
      ...serviceResult
    };

    autoCropJobs.setResult(job, result);
    updateAutoCropProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      outputRootDir: job.request.outputRootDir,
      outputDir: result.outputDir,
      totalFiles: result.summary.requested,
      processedFiles: result.summary.requested,
      succeededCount: result.summary.succeeded,
      skippedCount: result.summary.skipped,
      errorCount: result.summary.failed,
      currentFile: null,
      message: 'Auto-Crop complete.',
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled ? 'Auto-Crop canceled.' : 'Auto-Crop failed.';

    updateAutoCropProgress(job, browserWindow, {
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

function updateAutoCropProgress(
  job: JobRecord<AutoCropRequest, AutoCropJobSnapshot, AutoCropResult>,
  browserWindow: BrowserWindow | null,
  progress: AutoCropJobSnapshot
): void {
  autoCropJobs.patchSnapshot(job, progress);
  sendAutoCropProgress(browserWindow, job.snapshot);
}

function sendAutoCropProgress(
  browserWindow: BrowserWindow | null,
  snapshot: AutoCropJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.autoCropProgress, snapshot);
}

function createMissingAutoCropJobSnapshot(jobId: string): AutoCropJobSnapshot {
  return {
    jobId,
    status: 'error',
    phase: 'error',
    outputRootDir: null,
    outputDir: null,
    totalFiles: null,
    processedFiles: 0,
    succeededCount: 0,
    skippedCount: 0,
    errorCount: 0,
    currentFile: null,
    message: 'Auto-Crop job not found.',
    error: 'Auto-Crop job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
