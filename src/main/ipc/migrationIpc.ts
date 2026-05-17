import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  MigrationExecuteRequest,
  MigrationJobSnapshot,
  MigrationProgress,
  MigrationResult,
  MigrationResultResponse,
  MigrationScanRequest,
  MigrationScanResponse,
  MigrationStartResponse
} from '../../shared/types/migration';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import {
  executeMigrationPlan,
  scanMigration,
  validateMigrationExecuteRequest
} from '../services/migrationService';
import { notifyLongJobComplete } from '../services/notificationService';

const migrationJobs = new JobRegistry<MigrationExecuteRequest, MigrationJobSnapshot, MigrationResult>();

export function registerMigrationIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.migrationScan,
    async (_event, request: MigrationScanRequest): Promise<MigrationScanResponse> => {
      try {
        return await scanMigration(request);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Migration scan failed.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.migrationExecuteStart,
    (event, request: MigrationExecuteRequest): MigrationStartResponse => {
      const validation = validateMigrationExecuteRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = migrationJobs.create(validation.request, {
        jobId: null,
        migrationId: validation.plan.migrationId,
        status: 'starting',
        phase: 'validating',
        totalFiles: validation.plan.items.length,
        processedFiles: 0,
        copiedCount: 0,
        archivedCount: 0,
        failedCount: 0,
        currentFile: null,
        message: 'Starting migration.',
        error: null
      });

      sendMigrationProgress(browserWindow, job.snapshot);
      void runMigrationJob(job, validation.plan, browserWindow);

      return {
        jobId: job.id,
        migrationId: validation.plan.migrationId,
        status: 'started',
        message: 'Migration started.',
        totalFiles: validation.plan.items.length
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.migrationExecuteGetResult, (_event, jobId: string): MigrationResultResponse => {
    const job = migrationJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Migration job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Migration result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });
}

async function runMigrationJob(
  job: JobRecord<MigrationExecuteRequest, MigrationJobSnapshot, MigrationResult>,
  plan: Parameters<typeof executeMigrationPlan>[0]['plan'],
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const serviceResult = await executeMigrationPlan({
      plan,
      signal: job.abortController.signal,
      onProgress: (progress) => updateMigrationProgress(job, browserWindow, toRunningSnapshot(job.id, progress))
    });
    const result: MigrationResult = {
      ...serviceResult,
      jobId: job.id,
      status: 'complete'
    };

    migrationJobs.setResult(job, result);
    notifyLongJobComplete(
      'Migration complete',
      `${result.summary.filesCopiedToDestination.toLocaleString()} copied, ${result.summary.destinationMatchesArchived.toLocaleString()} archived.`
    );
    updateMigrationProgress(job, browserWindow, {
      jobId: job.id,
      migrationId: result.migrationId,
      status: 'complete',
      phase: 'complete',
      totalFiles: plan.items.length,
      processedFiles: plan.items.length,
      copiedCount: result.summary.filesCopiedToDestination,
      archivedCount: result.summary.destinationMatchesArchived,
      failedCount: result.summary.failedItems,
      currentFile: null,
      message: 'Migration complete.',
      error: null,
      result
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration failed.';

    updateMigrationProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      status: job.abortController.signal.aborted ? 'canceled' : 'error',
      phase: job.abortController.signal.aborted ? 'canceled' : 'error',
      currentFile: null,
      message: job.abortController.signal.aborted ? 'Migration canceled.' : 'Migration failed.',
      error: message
    });
  }
}

function toRunningSnapshot(jobId: string, progress: Omit<MigrationProgress, 'jobId' | 'status' | 'error'>): MigrationJobSnapshot {
  return {
    ...progress,
    jobId,
    status: 'running',
    error: null
  };
}

function updateMigrationProgress(
  job: JobRecord<MigrationExecuteRequest, MigrationJobSnapshot, MigrationResult>,
  browserWindow: BrowserWindow | null,
  progress: MigrationJobSnapshot
): void {
  migrationJobs.patchSnapshot(job, progress);
  sendMigrationProgress(browserWindow, job.snapshot);
}

function sendMigrationProgress(
  browserWindow: BrowserWindow | null,
  snapshot: MigrationJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.migrationExecuteProgress, snapshot);
}
