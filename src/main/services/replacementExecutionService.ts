import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { basename, isAbsolute, normalize } from 'node:path';
import { shell } from 'electron';
import type {
  FileOperationErrorCode,
  FileOperationPlanStatus,
  FileOperationResult,
  FileOperationResultItem,
  FileOperationWarningCode,
  ReplacementOperationPlan,
  ReplacementOperationPlanItem
} from '../../shared/types/fileOperations';
import type {
  ExecuteReplacementPlanRequest,
  ReplacementOriginalDisposition,
  ReplacementPlan,
  ReplacementPlanErrorCode,
  ReplacementPlanItem,
  ReplacementPlanWarningCode
} from '../../shared/types/replacementWorkflow';
import { pathExists } from '../utils/fileNameConflicts';
import { validateKnownPath } from '../utils/fileOperationSafety';
import {
  appendOperationItemResult,
  createOperationRecord,
  markOperationCompleted,
  markOperationFailed
} from './operationHistoryService';
import {
  deleteStoredReplacementPlan,
  getStoredReplacementPlan
} from './replacementPlanService';

const REPLACE_CONFIRMATION_PHRASE = 'REPLACE';
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

export interface PreparedReplacementExecution {
  plan: ReplacementPlan;
  originalDisposition: ReplacementOriginalDisposition;
}

export type PrepareReplacementExecutionResult =
  | {
      ok: true;
      prepared: PreparedReplacementExecution;
    }
  | {
      ok: false;
      status: 'invalid_request' | 'not_found' | 'error';
      message: string;
    };

export interface ReplacementExecutionProgressUpdate {
  phase: string | null;
  processedItems: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface RunReplacementExecutionOptions extends PreparedReplacementExecution {
  signal?: AbortSignal;
  onProgress?: (progress: ReplacementExecutionProgressUpdate) => void;
}

export function prepareReplacementExecution(
  request: Partial<ExecuteReplacementPlanRequest> | null | undefined
): PrepareReplacementExecutionResult {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      status: 'invalid_request',
      message: 'Replacement execution request is required.'
    };
  }

  const planId = typeof request.planId === 'string' ? request.planId.trim() : '';

  if (!planId) {
    return {
      ok: false,
      status: 'invalid_request',
      message: 'Replacement plan id is required.'
    };
  }

  const plan = getStoredReplacementPlan(planId);

  if (!plan) {
    return {
      ok: false,
      status: 'not_found',
      message: 'Replacement plan not found. Create a fresh replacement plan before executing.'
    };
  }

  if (request.confirmed !== true) {
    return {
      ok: false,
      status: 'invalid_request',
      message: 'Confirm replacement before executing this plan.'
    };
  }

  const originalDisposition = normalizeOriginalDisposition(request.originalDisposition);

  if (!originalDisposition) {
    return {
      ok: false,
      status: 'invalid_request',
      message: 'Unsupported original disposal option.'
    };
  }

  if (getExecutableItems(plan).length === 0) {
    return {
      ok: false,
      status: 'invalid_request',
      message: 'No replacement items are ready to execute.'
    };
  }

  if (requiresReplacementConfirmation(plan) && request.typedConfirmation !== REPLACE_CONFIRMATION_PHRASE) {
    return {
      ok: false,
      status: 'invalid_request',
      message: `Type "${REPLACE_CONFIRMATION_PHRASE}" to confirm this replacement operation.`
    };
  }

  return {
    ok: true,
    prepared: {
      plan,
      originalDisposition
    }
  };
}

export async function runReplacementExecution({
  plan,
  originalDisposition,
  signal,
  onProgress
}: RunReplacementExecutionOptions): Promise<FileOperationResult> {
  const startedAt = nowIsoString();
  const operationPlan = toReplacementOperationPlan(plan);
  const historyRecord = await createOperationRecord({
    plan: operationPlan,
    startedAt
  });
  const resultItems: FileOperationResultItem[] = [];

  onProgress?.({
    phase: 'executing',
    processedItems: 0,
    succeededCount: 0,
    skippedCount: 0,
    failedCount: 0,
    currentFile: null,
    message: 'Starting replacement execution.'
  });

  for (const item of plan.items) {
    let resultItem: FileOperationResultItem;

    if (signal?.aborted) {
      resultItem = createCanceledResultItem(item);
    } else {
      onProgress?.({
        phase: 'executing',
        processedItems: resultItems.length,
        succeededCount: countStatus(resultItems, 'success'),
        skippedCount: countStatus(resultItems, 'skipped'),
        failedCount: countStatus(resultItems, 'failed'),
        currentFile: item.originalFileName,
        message: `Replacing ${item.originalFileName}.`
      });
      resultItem = await executeReplacementItem(item, originalDisposition);
    }

    resultItems.push(resultItem);
    await appendOperationItemResult(historyRecord.id, resultItem);

    onProgress?.({
      phase: signal?.aborted ? 'canceled' : 'executing',
      processedItems: resultItems.length,
      succeededCount: countStatus(resultItems, 'success'),
      skippedCount: countStatus(resultItems, 'skipped'),
      failedCount: countStatus(resultItems, 'failed'),
      currentFile: null,
      message: signal?.aborted ? 'Replacement execution canceled.' : 'Replacement item complete.'
    });
  }

  const completedAt = nowIsoString();
  const result: FileOperationResult = {
    id: randomUUID(),
    planId: plan.id,
    type: 'replace-original-with-output',
    status: signal?.aborted ? 'canceled' : summarizeResultStatus(resultItems),
    createdAt: plan.createdAt,
    startedAt,
    completedAt,
    summary: summarizeResultItems(resultItems),
    items: resultItems
  };

  if (result.status === 'failed') {
    await markOperationFailed(historyRecord.id, result);
  } else {
    await markOperationCompleted(historyRecord.id, result);
  }

  deleteStoredReplacementPlan(plan.id);
  return result;
}

async function executeReplacementItem(
  item: ReplacementPlanItem,
  originalDisposition: ReplacementOriginalDisposition
): Promise<FileOperationResultItem> {
  const startedAt = nowIsoString();
  const baseResult = toBaseResultItem(item, startedAt);

  if (item.selectedAction !== 'replace-original') {
    return {
      ...baseResult,
      status: 'skipped',
      completedAt: nowIsoString(),
      errorCode: 'operation-not-allowed',
      error: 'Replacement item action is not replace-original.'
    };
  }

  if (item.status !== 'ready' && item.status !== 'warning') {
    return {
      ...baseResult,
      status: 'skipped',
      completedAt: nowIsoString(),
      errorCode: toFileOperationErrorCode(item.errorCodes[0]) ?? 'operation-not-allowed',
      error: item.errors[0] ?? 'Replacement item is blocked by the plan.'
    };
  }

  if (originalDisposition !== 'move-original-to-trash') {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      errorCode: 'operation-not-allowed',
      error: 'Only moving originals to macOS Trash is supported.'
    };
  }

  if (!item.proposedFinalPath || !isAbsolute(item.proposedFinalPath)) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      errorCode: 'invalid-destination-path',
      error: 'Replacement final path is missing or invalid.'
    };
  }

  if (isSamePath(item.originalPath, item.outputPath)) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      errorCode: 'destination-conflict',
      error: 'Original and converted output paths match.'
    };
  }

  const originalValidation = await validateKnownPath({
    id: item.id,
    path: item.originalPath,
    expectedKind: 'file',
    expectedFileName: item.originalFileName,
    expectedSizeBytes: item.originalSizeBytes,
    expectedModifiedAtMs: item.originalModifiedAtMs,
    requireSupportedVideoExtension: true
  });

  if (!originalValidation.isValid) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      errorCode: getValidationErrorCode(originalValidation, 'source'),
      error: originalValidation.errors[0] ?? 'Original file no longer matches the replacement plan.'
    };
  }

  const outputValidation = await validateKnownPath({
    id: item.id,
    path: item.outputPath,
    expectedKind: 'file',
    expectedFileName: item.outputFileName,
    expectedSizeBytes: item.outputSizeBytes,
    expectedModifiedAtMs: item.outputModifiedAtMs,
    requireSupportedVideoExtension: true
  });

  if (!outputValidation.isValid) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      errorCode: getValidationErrorCode(outputValidation, 'output'),
      error: outputValidation.errors[0] ?? 'Converted output no longer matches the replacement plan.'
    };
  }

  const directoryValidation = await validateKnownPath({
    path: item.originalDirectory,
    expectedKind: 'directory'
  });

  if (!directoryValidation.isValid) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      errorCode: 'invalid-destination-path',
      error: directoryValidation.errors[0] ?? 'Original source folder is no longer available.'
    };
  }

  const finalMatchesOriginal = isSamePath(item.proposedFinalPath, item.originalPath);
  const finalMatchesOutput = isSamePath(item.proposedFinalPath, item.outputPath);

  if ((await pathExists(item.proposedFinalPath)) && !finalMatchesOriginal && !finalMatchesOutput) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      errorCode: 'destination-conflict',
      error: 'Final destination already exists. Refusing to overwrite it.'
    };
  }

  try {
    await shell.trashItem(item.originalPath);
  } catch (error: unknown) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      errorCode: 'operation-not-allowed',
      error: getErrorMessage(error, 'Unable to move original file to Trash.')
    };
  }

  const originalAfter = await validateKnownPath({
    id: item.id,
    path: item.originalPath,
    expectedKind: 'file',
    expectedFileName: item.originalFileName,
    requireSupportedVideoExtension: true
  });

  if (originalAfter.exists) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      sourceAfter: originalAfter.identity,
      errorCode: 'operation-not-allowed',
      error: 'Original path was not clear after moving the original to Trash.'
    };
  }

  if (finalMatchesOutput) {
    return verifyFinalReplacement({
      baseResult,
      item,
      originalValidation,
      originalAfterIdentity: originalAfter.identity,
      fallbackError: 'Converted output was already at the final destination.'
    });
  }

  if (await pathExists(item.proposedFinalPath)) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      sourceAfter: originalAfter.identity,
      errorCode: 'destination-conflict',
      error: 'Final destination became occupied after the original was moved to Trash.'
    };
  }

  const moveResult = await moveOutputIntoPlace({
    outputPath: item.outputPath,
    finalPath: item.proposedFinalPath,
    expectedSizeBytes: item.outputSizeBytes
  });

  if (!moveResult.ok) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: originalValidation.identity ?? item.originalIdentity,
      sourceAfter: originalAfter.identity,
      errorCode: moveResult.errorCode,
      error: moveResult.message
    };
  }

  return verifyFinalReplacement({
    baseResult: {
      ...baseResult,
      warnings: moveResult.warning ? [...baseResult.warnings, moveResult.warning] : baseResult.warnings
    },
    item,
    originalValidation,
    originalAfterIdentity: originalAfter.identity,
    fallbackError: 'Final destination verification failed after moving the converted output.'
  });
}

async function moveOutputIntoPlace({
  outputPath,
  finalPath,
  expectedSizeBytes
}: {
  outputPath: string;
  finalPath: string;
  expectedSizeBytes: number | null;
}): Promise<
  | { ok: true; warning?: string }
  | { ok: false; errorCode: FileOperationErrorCode; message: string }
> {
  try {
    await copyFile(outputPath, finalPath, fsConstants.COPYFILE_EXCL);
  } catch (error: unknown) {
    return {
      ok: false,
      errorCode: 'operation-not-allowed',
      message: getErrorMessage(error, 'Unable to copy converted output into place.')
    };
  }

  const finalValidation = await validateKnownPath({
    path: finalPath,
    expectedKind: 'file',
    expectedFileName: basename(finalPath),
    expectedSizeBytes,
    requireSupportedVideoExtension: true
  });

  if (!finalValidation.isValid) {
    return {
      ok: false,
      errorCode: getValidationErrorCode(finalValidation, 'destination'),
      message: finalValidation.errors[0] ?? 'Copied final file could not be verified.'
    };
  }

  try {
    await shell.trashItem(outputPath);
    return {
      ok: true,
      warning: 'Converted output was copied into place and moved to Trash after copying.'
    };
  } catch (error: unknown) {
    return {
      ok: false,
      errorCode: 'operation-not-allowed',
      message: getErrorMessage(error, 'Final file was copied, but the converted output could not be moved to Trash.')
    };
  }
}

async function verifyFinalReplacement({
  baseResult,
  item,
  originalValidation,
  originalAfterIdentity,
  fallbackError
}: {
  baseResult: Omit<FileOperationResultItem, 'status' | 'completedAt'>;
  item: ReplacementPlanItem;
  originalValidation: Awaited<ReturnType<typeof validateKnownPath>>;
  originalAfterIdentity: FileOperationResultItem['sourceAfter'];
  fallbackError: string;
}): Promise<FileOperationResultItem> {
  const finalValidation = await validateKnownPath({
    id: item.id,
    path: item.proposedFinalPath,
    expectedKind: 'file',
    expectedFileName: basename(item.proposedFinalPath),
    expectedSizeBytes: item.outputSizeBytes,
    requireSupportedVideoExtension: true
  });

  return {
    ...baseResult,
    status: finalValidation.isValid ? 'success' : 'failed',
    completedAt: nowIsoString(),
    sourceBefore: originalValidation.identity ?? item.originalIdentity,
    sourceAfter: originalAfterIdentity,
    destinationAfter: finalValidation.identity,
    errorCode: finalValidation.isValid ? null : getValidationErrorCode(finalValidation, 'destination'),
    error: finalValidation.isValid ? null : finalValidation.errors[0] ?? fallbackError
  };
}

function toReplacementOperationPlan(plan: ReplacementPlan): ReplacementOperationPlan {
  return {
    id: plan.id,
    type: 'replace-original-with-output',
    createdAt: plan.createdAt,
    items: plan.items.map(toReplacementOperationPlanItem),
    summary: {
      total: plan.items.length,
      ready: plan.items.filter((item) => item.status === 'ready').length,
      warning: plan.items.filter((item) => item.status === 'warning').length,
      blocked: plan.items.filter((item) => item.status !== 'ready' && item.status !== 'warning').length,
      totalSizeBytes: plan.items.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0)
    }
  };
}

function toReplacementOperationPlanItem(item: ReplacementPlanItem): ReplacementOperationPlanItem {
  return {
    id: item.id,
    operationType: 'replace-original-with-output',
    originalPath: item.originalPath,
    sourcePath: item.originalPath,
    destinationPath: item.proposedFinalPath,
    outputPath: item.outputPath,
    fileName: item.originalFileName,
    expectedSizeBytes: item.originalSizeBytes,
    expectedModifiedAtMs: item.originalModifiedAtMs,
    sourceIdentity: item.originalIdentity,
    outputIdentity: item.outputIdentity,
    status: toFileOperationPlanStatus(item),
    warningCodes: mapWarningCodes(item.warningCodes),
    warnings: [...item.warnings],
    errorCodes: item.errorCodes.map(toFileOperationErrorCode).filter((code): code is FileOperationErrorCode => Boolean(code)),
    errors: [...item.errors],
    replacementAction: item.selectedAction === 'replace-original' ? 'replace-original-with-output' : 'skip'
  };
}

function toBaseResultItem(
  item: ReplacementPlanItem,
  startedAt: string
): Omit<FileOperationResultItem, 'status' | 'completedAt'> {
  return {
    id: randomUUID(),
    planItemId: item.id,
    operationType: 'replace-original-with-output',
    sourcePath: item.originalPath,
    destinationPath: item.proposedFinalPath,
    outputPath: item.outputPath,
    fileName: item.originalFileName,
    startedAt,
    sourceBefore: item.originalIdentity,
    destinationAfter: null,
    warningCodes: mapWarningCodes(item.warningCodes),
    warnings: [...item.warnings],
    errorCode: toFileOperationErrorCode(item.errorCodes[0]) ?? null,
    error: item.errors[0] ?? null
  };
}

function createCanceledResultItem(item: ReplacementPlanItem): FileOperationResultItem {
  return {
    ...toBaseResultItem(item, nowIsoString()),
    status: 'skipped',
    completedAt: nowIsoString(),
    errorCode: 'operation-not-allowed',
    error: 'Replacement execution was canceled before this item started.'
  };
}

function getExecutableItems(plan: ReplacementPlan): ReplacementPlanItem[] {
  return plan.items.filter(
    (item) =>
      item.selectedAction === 'replace-original' &&
      (item.status === 'ready' || item.status === 'warning')
  );
}

function requiresReplacementConfirmation(plan: ReplacementPlan): boolean {
  const executableItems = getExecutableItems(plan);

  return (
    executableItems.length > 10 ||
    executableItems.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0) > TEN_GB_BYTES ||
    executableItems.some((item) => item.warnings.length > 0) ||
    executableItems.some((item) => isExternalVolumePath(item.originalPath) || isExternalVolumePath(item.outputPath)) ||
    executableItems.some((item) => item.warningCodes.includes('extension-changed')) ||
    plan.summary.destinationConflicts > 0
  );
}

function normalizeOriginalDisposition(value: unknown): ReplacementOriginalDisposition | null {
  if (value === undefined || value === null || value === 'move-original-to-trash') {
    return 'move-original-to-trash';
  }

  return null;
}

function toFileOperationPlanStatus(item: ReplacementPlanItem): FileOperationPlanStatus {
  if (item.status === 'ready' || item.status === 'warning') {
    return item.status;
  }

  if (item.status === 'missing-original') {
    return 'missing-source';
  }

  if (item.status === 'missing-output') {
    return 'missing-output';
  }

  if (item.status === 'destination-conflict') {
    return 'destination-conflict';
  }

  return 'invalid-path';
}

function mapWarningCodes(codes: ReplacementPlanWarningCode[]): FileOperationWarningCode[] {
  const mapped = codes.map((code): FileOperationWarningCode => {
    if (code === 'final-path-matches-original' || code === 'extension-changed') {
      return 'requires-user-confirmation';
    }

    return 'partial-plan';
  });

  return [...new Set(mapped)];
}

function toFileOperationErrorCode(code: ReplacementPlanErrorCode | undefined): FileOperationErrorCode | null {
  if (code === 'missing-original') {
    return 'missing-source';
  }

  if (code === 'missing-output') {
    return 'missing-output';
  }

  if (code === 'destination-conflict') {
    return 'destination-conflict';
  }

  if (code === 'invalid-original') {
    return 'invalid-source-path';
  }

  if (code === 'invalid-output') {
    return 'operation-not-allowed';
  }

  if (code === 'invalid-request') {
    return 'operation-not-allowed';
  }

  return null;
}

function getValidationErrorCode(
  validation: Awaited<ReturnType<typeof validateKnownPath>>,
  role: 'source' | 'output' | 'destination'
): FileOperationErrorCode {
  if (!validation.exists) {
    return role === 'output' ? 'missing-output' : 'missing-source';
  }

  if (validation.errors.some((error) => error.includes('supported video'))) {
    return 'unsupported-file';
  }

  if (role === 'destination') {
    return 'invalid-destination-path';
  }

  return role === 'source' ? 'invalid-source-path' : 'operation-not-allowed';
}

function summarizeResultItems(items: FileOperationResultItem[]): FileOperationResult['summary'] {
  return {
    total: items.length,
    pending: 0,
    running: 0,
    succeeded: countStatus(items, 'success'),
    skipped: countStatus(items, 'skipped'),
    failed: countStatus(items, 'failed'),
    totalSizeBytes: items.reduce((total, item) => total + (item.sourceBefore?.sizeBytes ?? 0), 0)
  };
}

function summarizeResultStatus(items: FileOperationResultItem[]): FileOperationResult['status'] {
  const succeeded = countStatus(items, 'success');
  const failedOrSkipped = items.filter((item) => item.status === 'failed' || item.status === 'skipped').length;

  if (failedOrSkipped === 0) {
    return 'success';
  }

  return succeeded > 0 ? 'complete-with-failures' : 'failed';
}

function countStatus(items: FileOperationResultItem[], status: FileOperationResultItem['status']): number {
  return items.filter((item) => item.status === status).length;
}

function isExternalVolumePath(path: string): boolean {
  return path.startsWith('/Volumes/');
}

function isSamePath(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function nowIsoString(): string {
  return new Date().toISOString();
}
