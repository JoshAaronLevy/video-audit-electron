import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  FileDiscoveryJobSnapshot,
  FileDiscoveryProgress,
  FileDiscoveryRequest,
  FileDiscoveryResult,
  FileDiscoveryStartResponse
} from '../../shared/types/audit';
import { discoverVideoFiles } from '../services/fileDiscoveryService';

interface FileDiscoveryJob {
  id: string;
  request: FileDiscoveryRequest;
  abortController: AbortController;
  snapshot: FileDiscoveryJobSnapshot;
  result: FileDiscoveryResult | null;
}

const discoveryJobs = new Map<string, FileDiscoveryJob>();

export function registerAuditIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.auditDiscoveryStart,
    async (event, request: FileDiscoveryRequest): Promise<FileDiscoveryStartResponse> => {
      const normalizedRequest = normalizeDiscoveryRequest(request);

      if (normalizedRequest.folderPaths.length === 0 && normalizedRequest.filePaths.length === 0) {
        return {
          status: 'invalid_request',
          message: 'Choose at least one folder or video file before scanning.'
        };
      }

      const jobId = randomUUID();
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job: FileDiscoveryJob = {
        id: jobId,
        request: normalizedRequest,
        abortController: new AbortController(),
        result: null,
        snapshot: {
          jobId,
          status: 'starting',
          phase: 'validating',
          totalFiles: null,
          processedFiles: 0,
          skippedFiles: 0,
          foundCount: 0,
          currentPath: null,
          message: 'Starting file discovery.',
          error: null
        }
      };

      discoveryJobs.set(jobId, job);
      sendProgress(browserWindow, job.snapshot);

      void runDiscoveryJob(job, browserWindow);

      return {
        jobId,
        status: 'started',
        message: 'File discovery started.'
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.auditDiscoveryCancel,
    (_event, jobId: string): FileDiscoveryJobSnapshot => {
      const job = discoveryJobs.get(jobId);

      if (!job) {
        return {
          jobId,
          status: 'error',
          phase: 'error',
          totalFiles: null,
          processedFiles: 0,
          skippedFiles: 0,
          foundCount: 0,
          currentPath: null,
          message: 'Discovery job not found.',
          error: 'Discovery job not found.'
        };
      }

      if (job.snapshot.status === 'complete' || job.snapshot.status === 'error') {
        return job.snapshot;
      }

      job.abortController.abort();
      job.snapshot = {
        ...job.snapshot,
        status: 'canceled',
        phase: 'canceled',
        currentPath: null,
        message: 'File discovery canceled.'
      };

      return job.snapshot;
    }
  );
}

async function runDiscoveryJob(
  job: FileDiscoveryJob,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    updateJobProgress(job, browserWindow, {
      jobId: job.id,
      status: 'running',
      phase: 'validating',
      totalFiles: null,
      processedFiles: 0,
      skippedFiles: 0,
      foundCount: 0,
      currentPath: null,
      message: 'Starting file discovery.'
    });

    const serviceResult = await discoverVideoFiles({
      ...job.request,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateJobProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });

    const result: FileDiscoveryResult = {
      jobId: job.id,
      status: 'complete',
      summary: {
        folderCount: job.request.folderPaths.length,
        selectedFileCount: job.request.filePaths.length,
        foundCount: serviceResult.files.length,
        skippedFiles: serviceResult.skippedFiles
      },
      files: serviceResult.files
    };

    job.result = result;
    updateJobProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      totalFiles: serviceResult.files.length,
      processedFiles: serviceResult.files.length,
      skippedFiles: serviceResult.skippedFiles,
      foundCount: serviceResult.files.length,
      currentPath: null,
      message: `Found ${serviceResult.files.length} video files.`,
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    updateJobProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentPath: null,
      message: wasCanceled ? 'File discovery canceled.' : 'File discovery failed.',
      error: error instanceof Error ? error.message : 'File discovery failed.'
    });
  }
}

function updateJobProgress(
  job: FileDiscoveryJob,
  browserWindow: BrowserWindow | null,
  progress: FileDiscoveryJobSnapshot | FileDiscoveryProgress
): void {
  job.snapshot = {
    ...job.snapshot,
    ...progress
  };
  sendProgress(browserWindow, job.snapshot);
}

function sendProgress(
  browserWindow: BrowserWindow | null,
  snapshot: FileDiscoveryJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.auditDiscoveryProgress, snapshot);
}

function normalizeDiscoveryRequest(request: FileDiscoveryRequest): FileDiscoveryRequest {
  return {
    folderPaths: normalizeStringArray(request?.folderPaths),
    filePaths: normalizeStringArray(request?.filePaths),
    includeSubfolders:
      typeof request?.includeSubfolders === 'boolean' ? request.includeSubfolders : true
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
