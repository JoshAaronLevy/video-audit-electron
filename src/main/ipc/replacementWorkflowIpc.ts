import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { FileOperationResult } from '../../shared/types/fileOperations';
import type {
  CreateReplacementPlanRequest,
  CreateReplacementPlanResponse,
  ExecuteReplacementPlanRequest,
  ReplacementExecutionJobSnapshot,
  ReplacementExecutionResultResponse,
  ReplacementExecutionStartResponse
} from '../../shared/types/replacementWorkflow';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import { notifyLongJobComplete } from '../services/notificationService';
import {
  prepareReplacementExecution,
  runReplacementExecution,
  type PreparedReplacementExecution
} from '../services/replacementExecutionService';
import { createReplacementPlan } from '../services/replacementPlanService';

const replacementExecutionJobs = new JobRegistry<
  PreparedReplacementExecution,
  ReplacementExecutionJobSnapshot,
  FileOperationResult
>();

export function registerReplacementWorkflowIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.replacementCreatePlan,
    async (_event, request: CreateReplacementPlanRequest): Promise<CreateReplacementPlanResponse> => {
      try {
        return await createReplacementPlan(request);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to create replacement plan.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.replacementExecuteStart,
    async (event, request: ExecuteReplacementPlanRequest): Promise<ReplacementExecutionStartResponse> => {
      const prepared = prepareReplacementExecution(request);

      if (!prepared.ok) {
        return {
          status: prepared.status,
          message: prepared.message
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = replacementExecutionJobs.create(prepared.prepared, {
        jobId: null,
        planId: prepared.prepared.plan.id,
        status: 'starting',
        phase: 'validating',
        totalItems: prepared.prepared.plan.items.length,
        processedItems: 0,
        succeededCount: 0,
        skippedCount: 0,
        failedCount: 0,
        currentFile: null,
        message: 'Starting replacement execution.',
        error: null
      });

      sendReplacementProgress(browserWindow, job.snapshot);
      void runReplacementExecutionJob(job, browserWindow);

      return {
        jobId: job.id,
        planId: prepared.prepared.plan.id,
        status: 'started',
        message: 'Replacement execution started.',
        totalItems: prepared.prepared.plan.items.length
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.replacementExecuteCancel, (event, jobId: string): ReplacementExecutionJobSnapshot => {
    const job = replacementExecutionJobs.get(jobId);

    if (!job) {
      return createMissingReplacementJobSnapshot(jobId);
    }

    if (job.snapshot.status === 'complete' || job.snapshot.status === 'error' || job.snapshot.status === 'canceled') {
      return job.snapshot;
    }

    job.abortController.abort();
    const snapshot = replacementExecutionJobs.patchSnapshot(job, {
      status: 'canceled',
      phase: 'canceled',
      currentFile: null,
      message: 'Replacement execution will stop before the next item.'
    });

    sendReplacementProgress(BrowserWindow.fromWebContents(event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.replacementExecuteGetResult, (_event, jobId: string): ReplacementExecutionResultResponse => {
    const job = replacementExecutionJobs.get(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Replacement execution job not found.'
      };
    }

    if (!job.result) {
      return {
        jobId,
        status: 'not_ready',
        message: 'Replacement execution result is not ready.'
      };
    }

    return {
      jobId,
      status: job.result.status,
      result: job.result
    };
  });
}

async function runReplacementExecutionJob(
  job: JobRecord<PreparedReplacementExecution, ReplacementExecutionJobSnapshot, FileOperationResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const result = await runReplacementExecution({
      ...job.request,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateReplacementProgress(job, browserWindow, {
          ...job.snapshot,
          ...progress,
          jobId: job.id,
          status: job.abortController.signal.aborted ? 'canceled' : 'running',
          planId: job.request.plan.id
        })
    });

    replacementExecutionJobs.setResult(job, result);
    notifyLongJobComplete(
      result.status === 'canceled' ? 'Replacement canceled' : 'Replacement complete',
      `${result.summary.succeeded.toLocaleString()} replaced, ${(
        result.summary.failed + result.summary.skipped
      ).toLocaleString()} need attention.`
    );
    updateReplacementProgress(job, browserWindow, {
      jobId: job.id,
      planId: job.request.plan.id,
      status: result.status === 'canceled' ? 'canceled' : 'complete',
      phase: result.status === 'canceled' ? 'canceled' : 'complete',
      totalItems: result.summary.total,
      processedItems: result.summary.total,
      succeededCount: result.summary.succeeded,
      skippedCount: result.summary.skipped,
      failedCount: result.summary.failed,
      currentFile: null,
      message: getReplacementResultMessage(result),
      error: null,
      result
    });
  } catch (error: unknown) {
    updateReplacementProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      planId: job.request.plan.id,
      status: 'error',
      phase: 'error',
      currentFile: null,
      message: 'Replacement execution failed.',
      error: error instanceof Error ? error.message : 'Replacement execution failed.'
    });
  }
}

function updateReplacementProgress(
  job: JobRecord<PreparedReplacementExecution, ReplacementExecutionJobSnapshot, FileOperationResult>,
  browserWindow: BrowserWindow | null,
  progress: ReplacementExecutionJobSnapshot
): void {
  replacementExecutionJobs.patchSnapshot(job, progress);
  sendReplacementProgress(browserWindow, job.snapshot);
}

function sendReplacementProgress(
  browserWindow: BrowserWindow | null,
  snapshot: ReplacementExecutionJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.replacementExecuteProgress, snapshot);
}

function createMissingReplacementJobSnapshot(jobId: string): ReplacementExecutionJobSnapshot {
  return {
    jobId,
    planId: null,
    status: 'error',
    phase: 'error',
    totalItems: null,
    processedItems: 0,
    succeededCount: 0,
    skippedCount: 0,
    failedCount: 0,
    currentFile: null,
    message: 'Replacement execution job not found.',
    error: 'Replacement execution job not found.'
  };
}

function getReplacementResultMessage(result: FileOperationResult): string {
  if (result.status === 'success') {
    return `${result.summary.succeeded.toLocaleString()} file(s) replaced.`;
  }

  if (result.status === 'canceled') {
    return 'Replacement execution canceled.';
  }

  if (result.status === 'failed') {
    return 'No files were replaced.';
  }

  return `${result.summary.succeeded.toLocaleString()} file(s) replaced; ${(
    result.summary.failed + result.summary.skipped
  ).toLocaleString()} item(s) need attention.`;
}
