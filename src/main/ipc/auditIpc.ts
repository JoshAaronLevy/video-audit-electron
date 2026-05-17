import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  AuditJobSnapshot,
  AuditProgress,
  AuditRequest,
  AuditResult,
  AuditResultResponse,
  AuditStartResponse,
  FileDiscoveryJobSnapshot,
  FileDiscoveryProgress,
  FileDiscoveryRequest,
  FileDiscoveryResult,
  FileDiscoveryStartResponse,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataProgress,
  FfprobeMetadataRequest,
  FfprobeMetadataResult,
  FfprobeMetadataStartResponse
} from '../../shared/types/audit';
import { normalizeAuditOptions, runAudit } from '../services/auditService';
import { discoverVideoFiles } from '../services/fileDiscoveryService';
import { probeVideoFiles } from '../services/ffprobeService';
import { JobRegistry, type JobRecord } from '../services/jobRegistry';
import { notifyLongJobComplete } from '../services/notificationService';
import { getSettings, updateSettings } from '../services/settingsService';

interface FileDiscoveryJob {
  id: string;
  request: FileDiscoveryRequest;
  abortController: AbortController;
  snapshot: FileDiscoveryJobSnapshot;
  result: FileDiscoveryResult | null;
}

const discoveryJobs = new Map<string, FileDiscoveryJob>();

interface FfprobeMetadataJob {
  id: string;
  request: FfprobeMetadataRequest;
  abortController: AbortController;
  snapshot: FfprobeMetadataJobSnapshot;
  result: FfprobeMetadataResult | null;
}

const ffprobeJobs = new Map<string, FfprobeMetadataJob>();

const auditJobs = new JobRegistry<AuditRequest, AuditJobSnapshot, AuditResult>();

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

  ipcMain.handle(
    IPC_CHANNELS.auditStart,
    async (event, request: AuditRequest): Promise<AuditStartResponse> => {
      const normalizedRequest = normalizeAuditRequest(request);
      const validationMessage = validateAuditRequest(normalizedRequest);

      if (validationMessage) {
        return {
          status: 'invalid_request',
          message: validationMessage
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = auditJobs.create(normalizedRequest, {
        jobId: null,
        status: 'starting',
        phase: 'validating',
        resolvedDirectory: getAuditResolvedDirectory(normalizedRequest),
        totalFiles: null,
        processedFiles: 0,
        skippedFiles: 0,
        flaggedCount: 0,
        errorCount: 0,
        currentFile: null,
        message: 'Starting audit.',
        error: null
      });

      sendAuditProgress(browserWindow, job.snapshot);
      void runAuditJob(job, browserWindow);

      return {
        jobId: job.id,
        status: 'started',
        message: 'Audit started.',
        resolvedDirectory: job.snapshot.resolvedDirectory
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.auditCancel, (_event, jobId: string): AuditJobSnapshot => {
    const job = auditJobs.get(jobId);

    if (!job) {
      return createMissingAuditJobSnapshot(jobId);
    }

    if (
      job.snapshot.status === 'complete' ||
      job.snapshot.status === 'error' ||
      job.snapshot.status === 'canceled'
    ) {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = auditJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      message: 'Audit canceled.'
    });

    sendAuditProgress(BrowserWindow.fromWebContents(_event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.auditGetResult, (_event, jobId: string): AuditResultResponse => {
    const job = auditJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Audit job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Audit result is not ready.'
      };
    }

    return {
      jobId,
      status: 'complete',
      result: job.result
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.ffprobeStart,
    async (event, request: FfprobeMetadataRequest): Promise<FfprobeMetadataStartResponse> => {
      const normalizedRequest = normalizeFfprobeRequest(request);

      if (normalizedRequest.filePaths.length === 0) {
        return {
          status: 'invalid_request',
          message: 'Discover videos before running ffprobe metadata extraction.'
        };
      }

      const jobId = randomUUID();
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job: FfprobeMetadataJob = {
        id: jobId,
        request: normalizedRequest,
        abortController: new AbortController(),
        result: null,
        snapshot: {
          jobId,
          status: 'starting',
          phase: 'probing',
          totalFiles: normalizedRequest.filePaths.length,
          processedFiles: 0,
          succeededCount: 0,
          errorCount: 0,
          currentFile: null,
          message: 'Starting ffprobe metadata extraction.',
          error: null
        }
      };

      ffprobeJobs.set(jobId, job);
      sendFfprobeProgress(browserWindow, job.snapshot);

      void runFfprobeJob(job, browserWindow);

      return {
        jobId,
        status: 'started',
        message: 'ffprobe metadata extraction started.'
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.ffprobeCancel, (_event, jobId: string): FfprobeMetadataJobSnapshot => {
    const job = ffprobeJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'error',
        phase: 'error',
        totalFiles: null,
        processedFiles: 0,
        succeededCount: 0,
        errorCount: 0,
        currentFile: null,
        message: 'ffprobe job not found.',
        error: 'ffprobe job not found.'
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
      currentFile: null,
      message: 'ffprobe metadata extraction canceled.'
    };

    return job.snapshot;
  });
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

async function runAuditJob(
  job: JobRecord<AuditRequest, AuditJobSnapshot, AuditResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await runAudit({
      ...job.request,
      ffprobePath: settings.ffprobePathOverride,
      ffmpegPath: settings.ffmpegPathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateAuditProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running'
        })
    });

    const result: AuditResult = {
      jobId: job.id,
      status: 'complete',
      ...serviceResult
    };

    auditJobs.setResult(job, result);
    notifyLongJobComplete(
      'Audit complete',
      `${result.summary.flaggedCount.toLocaleString()} flagged of ${result.summary.scannedVideos.toLocaleString()} scanned videos.`
    );
    updateAuditProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      resolvedDirectory: result.summary.resolvedDirectory ?? null,
      totalFiles: result.summary.totalFiles,
      processedFiles: result.summary.scannedVideos,
      skippedFiles: job.snapshot.skippedFiles,
      flaggedCount: result.summary.flaggedCount,
      errorCount: result.summary.errorCount,
      currentFile: null,
      message: 'Audit complete.',
      result
    });

    await persistLastAuditSummary(result);
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    updateAuditProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      message: wasCanceled ? 'Audit canceled.' : 'Audit failed.',
      error: error instanceof Error ? error.message : 'Audit failed.'
    });
  }
}

function updateAuditProgress(
  job: JobRecord<AuditRequest, AuditJobSnapshot, AuditResult>,
  browserWindow: BrowserWindow | null,
  progress: AuditJobSnapshot | AuditProgress
): void {
  auditJobs.patchSnapshot(job, progress);
  sendAuditProgress(browserWindow, job.snapshot);
}

function sendAuditProgress(
  browserWindow: BrowserWindow | null,
  snapshot: AuditJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.auditProgress, snapshot);
}

async function persistLastAuditSummary(result: AuditResult): Promise<void> {
  try {
    await updateSettings({
      lastAuditResultSummary: {
        jobId: result.jobId,
        completedAt: new Date().toISOString(),
        totalFiles: result.summary.totalFiles,
        flaggedCount: result.summary.flaggedCount,
        errorCount: result.summary.errorCount
      }
    });
  } catch {
    // A failed settings write should not change a completed audit into a failed audit.
  }
}

async function runFfprobeJob(
  job: FfprobeMetadataJob,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const settings = await getSettings();
    const serviceResult = await probeVideoFiles({
      filePaths: job.request.filePaths,
      ffprobePath: job.request.ffprobePathOverride ?? settings.ffprobePathOverride,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateFfprobeProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running',
          phase: 'probing',
          totalFiles: job.request.filePaths.length
        })
    });

    const result: FfprobeMetadataResult = {
      jobId: job.id,
      status: 'complete',
      summary: {
        requested: job.request.filePaths.length,
        succeeded: serviceResult.succeededCount,
        failed: serviceResult.errorCount
      },
      items: serviceResult.items
    };

    job.result = result;
    updateFfprobeProgress(job, browserWindow, {
      jobId: job.id,
      status: 'complete',
      phase: 'complete',
      totalFiles: job.request.filePaths.length,
      processedFiles: job.request.filePaths.length,
      succeededCount: serviceResult.succeededCount,
      errorCount: serviceResult.errorCount,
      currentFile: null,
      message: 'ffprobe metadata extraction complete.',
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    updateFfprobeProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      message: wasCanceled ? 'ffprobe metadata extraction canceled.' : 'ffprobe metadata extraction failed.',
      error: error instanceof Error ? error.message : 'ffprobe metadata extraction failed.'
    });
  }
}

function updateFfprobeProgress(
  job: FfprobeMetadataJob,
  browserWindow: BrowserWindow | null,
  progress: FfprobeMetadataJobSnapshot | FfprobeMetadataProgress
): void {
  job.snapshot = {
    ...job.snapshot,
    ...progress
  };
  sendFfprobeProgress(browserWindow, job.snapshot);
}

function sendFfprobeProgress(
  browserWindow: BrowserWindow | null,
  snapshot: FfprobeMetadataJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.ffprobeProgress, snapshot);
}

function normalizeDiscoveryRequest(request: FileDiscoveryRequest): FileDiscoveryRequest {
  return {
    folderPaths: normalizeStringArray(request?.folderPaths),
    filePaths: normalizeStringArray(request?.filePaths),
    includeSubfolders:
      typeof request?.includeSubfolders === 'boolean' ? request.includeSubfolders : true
  };
}

function normalizeAuditRequest(request: Partial<AuditRequest> | null | undefined): AuditRequest {
  const options = isRecord(request?.options) ? request.options : {};

  return {
    folderPaths: normalizeStringArray(request?.folderPaths),
    filePaths: normalizeStringArray(request?.filePaths),
    options: normalizeAuditOptions(options as Partial<AuditRequest['options']>)
  };
}

function validateAuditRequest(request: AuditRequest): string | null {
  if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
    return 'Choose at least one folder or video file before running an audit.';
  }

  if (
    !request.options.includeLowResolutionAnalysis &&
    !request.options.includeBlackBorderAnalysis
  ) {
    return 'At least one audit option must be selected.';
  }

  return null;
}

function getAuditResolvedDirectory(request: AuditRequest): string | null {
  if (request.folderPaths.length === 1 && request.filePaths.length === 0) {
    return request.folderPaths[0];
  }

  if (request.folderPaths.length > 0) {
    return request.folderPaths[0];
  }

  return request.filePaths.length > 0 ? 'Selected files' : null;
}

function createMissingAuditJobSnapshot(jobId: string): AuditJobSnapshot {
  return {
    jobId,
    status: 'error',
    phase: 'error',
    resolvedDirectory: null,
    totalFiles: null,
    processedFiles: 0,
    skippedFiles: 0,
    flaggedCount: 0,
    errorCount: 0,
    currentFile: null,
    message: 'Audit job not found.',
    error: 'Audit job not found.'
  };
}

function normalizeFfprobeRequest(request: FfprobeMetadataRequest): FfprobeMetadataRequest {
  return {
    filePaths: normalizeStringArray(request?.filePaths),
    ffprobePathOverride:
      typeof request?.ffprobePathOverride === 'string' && request.ffprobePathOverride.trim() !== ''
        ? request.ffprobePathOverride
        : null
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
