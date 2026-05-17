import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  AutoFixJobSnapshot,
  AutoFixRequest,
  AutoFixResult,
  AutoFixResultResponse,
  AutoFixStartResponse
} from '../../shared/types/autoFix';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import { runAutoFix, validateAutoFixRequest } from '../services/autoFixService';
import { getSettings } from '../services/settingsService';

const autoFixJobs = new JobRegistry<AutoFixRequest, AutoFixJobSnapshot, AutoFixResult>();

export function registerAutoFixIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.autoFixStart,
    async (event, request: AutoFixRequest): Promise<AutoFixStartResponse> => {
      const validation = await validateAutoFixRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = autoFixJobs.create(validation.request, {
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalVideos: validation.request.videos.length,
        processedVideos: 0,
        currentFile: null,
        currentProfile: null,
        currentAction: null,
        message: 'Starting Auto-Fix.',
        succeeded: 0,
        failed: 0,
        outputDirectory: validation.request.outputDirectory,
        error: null
      });

      sendAutoFixProgress(browserWindow, job.snapshot);
      void runAutoFixJob(job, browserWindow);

      return {
        jobId: job.id,
        status: 'started',
        message: 'Auto-Fix started.',
        outputDirectory: validation.request.outputDirectory,
        totalVideos: validation.request.videos.length
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.autoFixCancel, (_event, jobId: string): AutoFixJobSnapshot => {
    const job = autoFixJobs.get(jobId);

    if (!job) {
      return createMissingAutoFixJobSnapshot(jobId);
    }

    if (
      job.snapshot.status === 'complete' ||
      job.snapshot.status === 'error' ||
      job.snapshot.status === 'canceled'
    ) {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = autoFixJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message: 'Auto-Fix canceled.'
    });

    sendAutoFixProgress(BrowserWindow.fromWebContents(_event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.autoFixGetResult, (_event, jobId: string): AutoFixResultResponse => {
    const job = autoFixJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Auto-Fix job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Auto-Fix result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });
}

async function runAutoFixJob(
  job: JobRecord<AutoFixRequest, AutoFixJobSnapshot, AutoFixResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await runAutoFix({
      ...job.request,
      ffmpegPath: settings.ffmpegPathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateAutoFixProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });
    const result: AutoFixResult = {
      jobId: job.id,
      status: 'complete',
      message: 'Auto-Fix complete.',
      ...serviceResult
    };

    autoFixJobs.setResult(job, result);
    updateAutoFixProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      totalVideos: result.summary.requested,
      processedVideos: result.summary.requested,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message: 'Auto-Fix complete.',
      outputDirectory: result.outputDirectory,
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled ? 'Auto-Fix canceled.' : 'Auto-Fix failed.';

    updateAutoFixProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message,
      error: error instanceof Error ? error.message : message
    });
  }
}

function updateAutoFixProgress(
  job: JobRecord<AutoFixRequest, AutoFixJobSnapshot, AutoFixResult>,
  browserWindow: BrowserWindow | null,
  progress: AutoFixJobSnapshot
): void {
  autoFixJobs.patchSnapshot(job, progress);
  sendAutoFixProgress(browserWindow, job.snapshot);
}

function sendAutoFixProgress(
  browserWindow: BrowserWindow | null,
  snapshot: AutoFixJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.autoFixProgress, snapshot);
}

function createMissingAutoFixJobSnapshot(jobId: string): AutoFixJobSnapshot {
  return {
    jobId,
    status: 'error',
    phase: 'error',
    totalVideos: null,
    processedVideos: 0,
    currentFile: null,
    currentProfile: null,
    currentAction: null,
    message: 'Auto-Fix job not found.',
    succeeded: 0,
    failed: 0,
    outputDirectory: null,
    error: 'Auto-Fix job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
