import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  DuplicateCandidateFile,
  DuplicateScanCancelResponse,
  DuplicateScanCandidate,
  DuplicateScanJobSnapshot,
  DuplicateScanRequest,
  DuplicateScanResult,
  DuplicateScanResultResponse,
  DuplicateScanStartResponse,
  DuplicateScanTrashPlanResponse,
  DuplicateScanTrashPlanRequest
} from '../../shared/types/duplicateScan';
import type { KnownFileOperationItem } from '../../shared/types/fileOperations';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import {
  getDuplicateScanCandidatesForTrash,
  runDuplicateScan
} from '../services/duplicateScanService';
import { createTrashPlan } from '../services/fileOperationService';
import { getImprovedDuplicateScanCandidatesForTrash } from '../services/improvedDuplicateScanService';
import { notifyLongJobComplete } from '../services/notificationService';

const duplicateScanJobs = new JobRegistry<
  DuplicateScanRequest,
  DuplicateScanJobSnapshot,
  DuplicateScanResult
>();

interface DuplicateTrashSelection {
  scannedFolder: string;
  candidates: Array<{
    id: string;
    path: string;
    fileName: string;
    sizeBytes?: number | null;
    modifiedAtMs?: number | null;
  }>;
}

export function registerDuplicateScanIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.duplicateScanStart,
    (event, request: DuplicateScanRequest): DuplicateScanStartResponse => {
      const validation = validateDuplicateScanStartRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = duplicateScanJobs.create(validation.request, {
        jobId: null,
        scanId: null,
        status: 'starting',
        phase: 'validating',
        scannedFileCount: 0,
        checkedVideoFileCount: 0,
        filenameMatchesFound: 0,
        metadataProcessedCount: 0,
        metadataTotalCount: null,
        currentFile: null,
        message: 'Starting Duplicate Scan.',
        error: null
      });

      duplicateScanJobs.patchSnapshot(job, {
        scanId: job.id
      });
      sendDuplicateScanProgress(browserWindow, job.snapshot);
      void runDuplicateScanJob(job, browserWindow);

      return {
        jobId: job.id,
        scanId: job.id,
        status: 'started',
        message: 'Duplicate Scan started.'
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.duplicateScanCancel,
    (event, jobId: string): DuplicateScanCancelResponse => {
      const job = duplicateScanJobs.get(jobId);

      if (!job) {
        return createMissingDuplicateScanJobSnapshot(jobId);
      }

      if (
        job.snapshot.status === 'complete' ||
        job.snapshot.status === 'error' ||
        job.snapshot.status === 'canceled'
      ) {
        return job.snapshot;
      }

      job.abortController.abort();
      const snapshot = duplicateScanJobs.patchSnapshot(job, {
        status: 'canceled',
        phase: 'canceled',
        currentFile: null,
        message: 'Duplicate Scan canceled.'
      });

      sendDuplicateScanProgress(BrowserWindow.fromWebContents(event.sender), snapshot);
      return snapshot;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.duplicateScanGetResult,
    (_event, jobId: string): DuplicateScanResultResponse => {
      const job = duplicateScanJobs.get(jobId);

      if (!job) {
        return {
          jobId,
          scanId: jobId,
          status: 'not_found',
          message: 'Duplicate Scan job not found.'
        };
      }

      if (!job.result) {
        return {
          jobId,
          scanId: job.snapshot.scanId ?? jobId,
          status: 'not_ready',
          message: 'Duplicate Scan result is not ready.'
        };
      }

      return {
        jobId,
        scanId: job.result.scanId,
        status: job.result.status,
        result: job.result
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.duplicateScanCreateTrashPlan,
    async (_event, request: DuplicateScanTrashPlanRequest): Promise<DuplicateScanTrashPlanResponse> => {
      try {
        return await createDuplicateScanTrashPlan(request);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to create duplicate scan Trash plan.'
        };
      }
    }
  );
}

async function runDuplicateScanJob(
  job: JobRecord<DuplicateScanRequest, DuplicateScanJobSnapshot, DuplicateScanResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const result = await runDuplicateScan({
      request: job.request,
      scanId: job.id,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateDuplicateScanProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running',
          error: null
        })
    });

    duplicateScanJobs.setResult(job, result);
    notifyLongJobComplete(
      'Duplicate Scan complete',
      `${result.matchCount.toLocaleString()} duplicate candidate(s) found.`
    );
    updateDuplicateScanProgress(job, browserWindow, {
      jobId: job.id,
      scanId: result.scanId,
      status: 'complete',
      phase: 'complete',
      scannedFileCount: result.scannedFileCount,
      checkedVideoFileCount: result.checkedVideoFileCount,
      filenameMatchesFound: result.matchCount,
      metadataProcessedCount: result.matchCount,
      metadataTotalCount: result.matchCount,
      currentFile: null,
      message: 'Duplicate Scan complete.',
      error: null,
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled ? 'Duplicate Scan canceled.' : 'Duplicate Scan failed.';

    updateDuplicateScanProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      scanId: job.snapshot.scanId ?? job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      message,
      error: error instanceof Error ? error.message : message
    });
  }
}

async function createDuplicateScanTrashPlan(
  request: DuplicateScanTrashPlanRequest
): Promise<DuplicateScanTrashPlanResponse> {
  const validation = validateDuplicateScanTrashPlanRequest(request);

  if (!validation.ok) {
    return {
      status: 'invalid_request',
      message: validation.error
    };
  }

  const selection = getDuplicateTrashSelection(validation.request);

  if ('error' in selection) {
    return {
      status: selection.error.includes('not found') ? 'not_found' : 'invalid_request',
      message: selection.error
    };
  }

  const dedupedCandidates = [
    ...new Map(selection.candidates.map((candidate) => [candidate.path, candidate])).values()
  ];
  const items: KnownFileOperationItem[] = dedupedCandidates.map((candidate) => ({
    id: candidate.id,
    sourcePath: candidate.path,
    fileName: candidate.fileName,
    expectedSizeBytes: candidate.sizeBytes,
    expectedModifiedAtMs: candidate.modifiedAtMs,
    allowUnsupportedFileType: false
  }));

  const response = await createTrashPlan({
    operationType: 'trash',
    items,
    knownRootDirectories: [selection.scannedFolder]
  });

  return response;
}

function getDuplicateTrashSelection(
  request: DuplicateScanTrashPlanRequest
): DuplicateTrashSelection | { error: string } {
  const exactSelection = getDuplicateScanCandidatesForTrash(request);

  if (!('error' in exactSelection)) {
    return {
      scannedFolder: exactSelection.scan.scannedFolder,
      candidates: exactSelection.candidates.map(exactCandidateToTrashCandidate)
    };
  }

  if (!isExactDuplicateScanResultNotFoundError(exactSelection.error)) {
    return exactSelection;
  }

  const improvedSelection = getImprovedDuplicateScanCandidatesForTrash(request);

  if ('error' in improvedSelection) {
    return improvedSelection;
  }

  return {
    scannedFolder: improvedSelection.scan.scannedFolder,
    candidates: improvedSelection.candidates.map(improvedCandidateToTrashCandidate)
  };
}

function exactCandidateToTrashCandidate(
  candidate: DuplicateScanCandidate
): DuplicateTrashSelection['candidates'][number] {
  return {
    id: candidate.id,
    path: candidate.path,
    fileName: candidate.fileName,
    sizeBytes: candidate.sizeBytes,
    modifiedAtMs: candidate.modifiedAtMs
  };
}

function improvedCandidateToTrashCandidate(
  candidate: DuplicateCandidateFile
): DuplicateTrashSelection['candidates'][number] {
  return {
    id: candidate.id,
    path: candidate.filePath,
    fileName: candidate.fileName,
    sizeBytes: candidate.sizeBytes,
    modifiedAtMs: candidate.modifiedAtMs
  };
}

function isExactDuplicateScanResultNotFoundError(error: string): boolean {
  return error.startsWith('Duplicate scan result not found.');
}

function validateDuplicateScanStartRequest(
  request: DuplicateScanRequest
): { ok: true; request: DuplicateScanRequest } | { ok: false; error: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Duplicate Scan request is required.'
    };
  }

  if (typeof request.scanFolder !== 'string' || request.scanFolder.trim() === '') {
    return {
      ok: false,
      error: 'Choose a folder before starting a Duplicate Scan.'
    };
  }

  if (!Array.isArray(request.sources) || request.sources.length === 0) {
    return {
      ok: false,
      error: 'Select at least one project video before starting a Duplicate Scan.'
    };
  }

  return {
    ok: true,
    request: {
      scanFolder: request.scanFolder,
      sources: request.sources
    }
  };
}

function validateDuplicateScanTrashPlanRequest(
  request: DuplicateScanTrashPlanRequest
): { ok: true; request: DuplicateScanTrashPlanRequest } | { ok: false; error: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Duplicate Scan Trash plan request is required.'
    };
  }

  const scanId = typeof request.scanId === 'string' ? request.scanId.trim() : '';

  if (!scanId) {
    return {
      ok: false,
      error: 'Duplicate Scan id is required before creating a Trash plan.'
    };
  }

  if (!Array.isArray(request.candidateIds) || request.candidateIds.length === 0) {
    return {
      ok: false,
      error: 'Mark at least one duplicate candidate before creating a Move to Trash plan.'
    };
  }

  return {
    ok: true,
    request: {
      scanId,
      candidateIds: request.candidateIds
    }
  };
}

function updateDuplicateScanProgress(
  job: JobRecord<DuplicateScanRequest, DuplicateScanJobSnapshot, DuplicateScanResult>,
  browserWindow: BrowserWindow | null,
  progress: DuplicateScanJobSnapshot
): void {
  duplicateScanJobs.patchSnapshot(job, progress);
  sendDuplicateScanProgress(browserWindow, job.snapshot);
}

function sendDuplicateScanProgress(
  browserWindow: BrowserWindow | null,
  snapshot: DuplicateScanJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.duplicateScanProgress, snapshot);
}

function createMissingDuplicateScanJobSnapshot(jobId: string): DuplicateScanJobSnapshot {
  return {
    jobId,
    scanId: jobId,
    status: 'error',
    phase: 'error',
    scannedFileCount: 0,
    checkedVideoFileCount: 0,
    filenameMatchesFound: 0,
    metadataProcessedCount: 0,
    metadataTotalCount: null,
    currentFile: null,
    message: 'Duplicate Scan job not found.',
    error: 'Duplicate Scan job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
