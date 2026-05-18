import { randomUUID } from 'node:crypto';
import { mkdir, rename } from 'node:fs/promises';
import { basename, dirname, join, normalize } from 'node:path';
import type {
  ArchiveOperationPlan,
  CreateArchiveOperationPlanRequest,
  CreateArchiveOperationPlanResponse,
  DestinationConflictStrategy,
  ExecuteArchiveOperationPlanRequest,
  ExecuteArchiveOperationPlanResponse,
  FileOperationErrorCode,
  FileOperationPlanItem,
  FileOperationResult,
  FileOperationResultItem,
  FileOperationWarningCode,
  KnownFileOperationItem
} from '../../shared/types/fileOperations';
import {
  appendOperationItemResult,
  createOperationRecord,
  markOperationCompleted,
  markOperationFailed
} from './operationHistoryService';
import { validateKnownPath } from '../utils/fileOperationSafety';
import {
  pathExists,
  resolveDestinationPath
} from '../utils/fileNameConflicts';

const ARCHIVE_FOLDER_NAME = '.video-audit-archive';
const archivePlans = new Map<string, ArchiveOperationPlan>();

export async function createArchivePlan(
  request: Partial<CreateArchiveOperationPlanRequest> | null | undefined
): Promise<CreateArchiveOperationPlanResponse> {
  const validation = normalizeArchivePlanRequest(request);

  if (!validation.ok) {
    return {
      status: 'invalid_request',
      message: validation.message
    };
  }

  const reservedDestinations = new Set<string>();
  const planItems: FileOperationPlanItem[] = [];

  for (const item of validation.items) {
    const planItem = await buildArchivePlanItem({
      item,
      archiveDate: validation.archiveDate,
      conflictStrategy: validation.conflictStrategy,
      reservedDestinations
    });

    if (planItem.archivePath && (planItem.status === 'ready' || planItem.status === 'warning')) {
      reservedDestinations.add(planItem.archivePath);
    }

    planItems.push(planItem);
  }

  const archiveDirectories = getArchiveDirectories(planItems);
  const plan: ArchiveOperationPlan = {
    id: randomUUID(),
    type: 'archive',
    createdAt: nowIsoString(),
    archiveDirectory: archiveDirectories.length === 1 ? archiveDirectories[0] : 'Per source directory',
    archiveDirectories,
    archiveDate: validation.archiveDate,
    conflictStrategy: validation.conflictStrategy,
    items: planItems,
    summary: summarizePlanItems(planItems)
  };

  archivePlans.set(plan.id, plan);

  return {
    status: 'planned',
    plan
  };
}

export async function executeArchivePlan(
  request: Partial<ExecuteArchiveOperationPlanRequest> | null | undefined
): Promise<ExecuteArchiveOperationPlanResponse> {
  if (!request || typeof request !== 'object') {
    return {
      status: 'invalid_request',
      message: 'Archive execution request is required.'
    };
  }

  if (typeof request.planId !== 'string' || request.planId.trim() === '') {
    return {
      status: 'invalid_request',
      message: 'Archive plan id is required.'
    };
  }

  const plan = archivePlans.get(request.planId.trim());

  if (!plan) {
    return {
      status: 'not_found',
      message: 'Archive plan not found. Create a fresh plan before archiving files.'
    };
  }

  if (request.confirmed !== true) {
    return {
      status: 'invalid_request',
      message: 'Confirm Archive Originals before executing this plan.'
    };
  }

  const startedAt = nowIsoString();
  const historyRecord = await createOperationRecord({
    plan,
    startedAt
  });
  const resultItems: FileOperationResultItem[] = [];

  for (const item of plan.items) {
    const resultItem = await executeArchivePlanItem(item);
    resultItems.push(resultItem);
    await appendOperationItemResult(historyRecord.id, resultItem);
  }

  const completedAt = nowIsoString();
  const result: FileOperationResult = {
    id: randomUUID(),
    planId: plan.id,
    type: 'archive',
    status: summarizeResultStatus(resultItems),
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

  archivePlans.delete(plan.id);

  return {
    status: result.status === 'success' ? 'complete' : result.status === 'failed' ? 'failed' : 'partial',
    result,
    message: getArchiveResultMessage(result)
  };
}

async function buildArchivePlanItem({
  item,
  archiveDate,
  conflictStrategy,
  reservedDestinations
}: {
  item: KnownFileOperationItem;
  archiveDate: string;
  conflictStrategy: DestinationConflictStrategy;
  reservedDestinations: Set<string>;
}): Promise<FileOperationPlanItem> {
  const validation = await validateKnownPath({
    id: item.id,
    path: item.sourcePath,
    expectedKind: 'file',
    expectedFileName: item.fileName ?? item.identity?.fileName ?? null,
    expectedSizeBytes: item.expectedSizeBytes ?? item.identity?.sizeBytes ?? null,
    expectedModifiedAtMs: item.expectedModifiedAtMs ?? item.identity?.modifiedAtMs ?? null,
    requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
  });
  const sourcePath = validation.path || item.sourcePath;
  const sourceIdentity = validation.identity ?? item.identity ?? null;
  const fileName = sourceIdentity?.fileName ?? item.fileName ?? basename(item.sourcePath);
  const archiveDirectory = join(dirname(sourcePath), ARCHIVE_FOLDER_NAME, archiveDate);
  const destination = await resolveDestinationPath({
    destinationDirectory: archiveDirectory,
    fileName,
    conflictStrategy,
    reservedDestinations
  });
  const warnings = [...validation.warnings];
  const warningCodes: FileOperationWarningCode[] = [];
  const errors = [...validation.errors];
  const errorCodes = getValidationErrorCodes(validation);

  if (validation.exists && validation.isValid) {
    if (isSamePath(validation.path, destination.destinationPath)) {
      errors.push('Archive path matches the source path.');
      errorCodes.push('destination-conflict');
    } else if (destination.hasConflict && !destination.wasRenamed) {
      errors.push('Archive file already exists. Refusing to overwrite it.');
      errorCodes.push('destination-conflict');
    } else if (destination.wasRenamed) {
      warnings.push('Archive conflict will use a renamed file.');
      warningCodes.push('destination-exists');
    }
  }

  const status = getPlanItemStatus({
    exists: validation.exists,
    errors,
    warnings,
    errorCodes
  });

  return {
    id: item.id ?? randomUUID(),
    operationType: 'archive',
    sourcePath,
    destinationPath: destination.destinationPath,
    archivePath: destination.destinationPath,
    fileName,
    expectedSizeBytes: item.expectedSizeBytes ?? item.identity?.sizeBytes ?? sourceIdentity?.sizeBytes ?? null,
    expectedModifiedAtMs:
      item.expectedModifiedAtMs ?? item.identity?.modifiedAtMs ?? sourceIdentity?.modifiedAtMs ?? null,
    allowUnsupportedFileType: item.allowUnsupportedFileType === true,
    sourceIdentity,
    status,
    warningCodes,
    warnings,
    errorCodes,
    errors
  };
}

async function executeArchivePlanItem(item: FileOperationPlanItem): Promise<FileOperationResultItem> {
  const startedAt = nowIsoString();
  const baseResult: Omit<FileOperationResultItem, 'status' | 'completedAt'> = {
    id: randomUUID(),
    planItemId: item.id,
    operationType: 'archive',
    sourcePath: item.sourcePath,
    destinationPath: item.archivePath ?? item.destinationPath ?? null,
    archivePath: item.archivePath ?? null,
    fileName: item.fileName,
    startedAt,
    sourceBefore: item.sourceIdentity ?? null,
    warningCodes: [...item.warningCodes],
    warnings: [...item.warnings],
    errorCode: item.errorCodes[0] ?? null,
    error: item.errors[0] ?? null
  };

  if (item.status !== 'ready' && item.status !== 'warning') {
    return {
      ...baseResult,
      status: 'skipped',
      completedAt: nowIsoString(),
      errorCode: item.errorCodes[0] ?? 'operation-not-allowed',
      error: item.errors[0] ?? 'Item is blocked by the archive plan.'
    };
  }

  if (!item.archivePath) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      errorCode: 'invalid-destination-path',
      error: 'Archive path is missing.'
    };
  }

  const sourceValidation = await validateKnownPath({
    id: item.id,
    path: item.sourcePath,
    expectedKind: 'file',
    expectedFileName: item.fileName,
    expectedSizeBytes: item.expectedSizeBytes ?? null,
    expectedModifiedAtMs: item.expectedModifiedAtMs ?? null,
    requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
  });

  if (!sourceValidation.isValid) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
      errorCode: getValidationErrorCodes(sourceValidation)[0] ?? 'invalid-source-path',
      error: sourceValidation.errors[0] ?? 'File no longer matches the archive plan.'
    };
  }

  if (isSamePath(item.sourcePath, item.archivePath)) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
      errorCode: 'destination-conflict',
      error: 'Archive path matches the source path.'
    };
  }

  if (await pathExists(item.archivePath)) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
      errorCode: 'destination-conflict',
      error: 'Archive file exists. Refusing to overwrite it.'
    };
  }

  const archiveDirectory = dirname(item.archivePath);

  try {
    await mkdir(archiveDirectory, { recursive: true });

    const archiveDirectoryValidation = await validateKnownPath({
      path: archiveDirectory,
      expectedKind: 'directory'
    });

    if (!archiveDirectoryValidation.isValid) {
      return {
        ...baseResult,
        status: 'failed',
        completedAt: nowIsoString(),
        sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
        errorCode: 'invalid-destination-path',
        error: archiveDirectoryValidation.errors[0] ?? 'Archive folder is not available.'
      };
    }

    if (await pathExists(item.archivePath)) {
      return {
        ...baseResult,
        status: 'failed',
        completedAt: nowIsoString(),
        sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
        errorCode: 'destination-conflict',
        error: 'Archive file exists. Refusing to overwrite it.'
      };
    }

    await rename(item.sourcePath, item.archivePath);

    const sourceAfter = await validateKnownPath({
      id: item.id,
      path: item.sourcePath,
      expectedKind: 'file',
      expectedFileName: item.fileName,
      requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
    });
    const archiveAfter = await validateKnownPath({
      id: item.id,
      path: item.archivePath,
      expectedKind: 'file',
      expectedFileName: basename(item.archivePath),
      expectedSizeBytes: item.expectedSizeBytes ?? null,
      expectedModifiedAtMs: item.expectedModifiedAtMs ?? null,
      requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
    });

    return {
      ...baseResult,
      status: archiveAfter.isValid ? 'success' : 'failed',
      completedAt: nowIsoString(),
      sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
      sourceAfter: sourceAfter.identity,
      destinationAfter: archiveAfter.identity,
      errorCode: archiveAfter.isValid ? null : 'operation-not-allowed',
      error: archiveAfter.isValid
        ? null
        : archiveAfter.errors[0] ?? 'Archive verification failed after moving.'
    };
  } catch (error: unknown) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: sourceValidation.identity ?? item.sourceIdentity ?? null,
      errorCode: 'operation-not-allowed',
      error: error instanceof Error ? error.message : 'Unable to archive file.'
    };
  }
}

function normalizeArchivePlanRequest(
  request: Partial<CreateArchiveOperationPlanRequest> | null | undefined
):
  | {
      ok: true;
      items: KnownFileOperationItem[];
      archiveDate: string;
      conflictStrategy: DestinationConflictStrategy;
    }
  | { ok: false; message: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      message: 'Archive plan request is required.'
    };
  }

  if (!Array.isArray(request.items) || request.items.length === 0) {
    return {
      ok: false,
      message: 'Select at least one video before creating an archive plan.'
    };
  }

  const items = request.items.filter((item): item is KnownFileOperationItem =>
    Boolean(item) && typeof item === 'object' && typeof item.sourcePath === 'string'
  );

  if (items.length === 0) {
    return {
      ok: false,
      message: 'Archive plan must contain known file items.'
    };
  }

  const archiveDate = normalizeArchiveDate(request.archiveDate);

  if (!archiveDate) {
    return {
      ok: false,
      message: 'Archive date must use YYYY-MM-DD format.'
    };
  }

  const conflictStrategy = request.conflictStrategy ?? 'rename-with-suffix';

  if (conflictStrategy !== 'skip' && conflictStrategy !== 'rename-with-suffix') {
    return {
      ok: false,
      message: 'Unsupported archive conflict strategy.'
    };
  }

  return {
    ok: true,
    items,
    archiveDate,
    conflictStrategy
  };
}

function normalizeArchiveDate(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getValidationErrorCodes(validation: {
  exists: boolean;
  errors: string[];
}): FileOperationErrorCode[] {
  if (!validation.exists) {
    return ['missing-source'];
  }

  return validation.errors.map((error) => {
    if (error.includes('supported video')) {
      return 'unsupported-file';
    }

    if (error.includes('file')) {
      return 'invalid-source-path';
    }

    return 'operation-not-allowed';
  });
}

function getPlanItemStatus({
  exists,
  errors,
  warnings,
  errorCodes = []
}: {
  exists: boolean;
  errors: string[];
  warnings: string[];
  errorCodes?: FileOperationErrorCode[];
}): FileOperationPlanItem['status'] {
  if (!exists) {
    return 'missing-source';
  }

  if (errorCodes.includes('destination-conflict')) {
    return 'destination-conflict';
  }

  if (errors.some((error) => error.includes('supported video'))) {
    return 'unsupported-file';
  }

  if (errors.length > 0) {
    return 'invalid-path';
  }

  return warnings.length > 0 ? 'warning' : 'ready';
}

function summarizePlanItems(items: FileOperationPlanItem[]): ArchiveOperationPlan['summary'] {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    warning: items.filter((item) => item.status === 'warning').length,
    blocked: items.filter((item) => item.status !== 'ready' && item.status !== 'warning').length,
    totalSizeBytes: items.reduce((total, item) => total + (item.sourceIdentity?.sizeBytes ?? item.expectedSizeBytes ?? 0), 0)
  };
}

function summarizeResultItems(items: FileOperationResultItem[]): FileOperationResult['summary'] {
  return {
    total: items.length,
    pending: 0,
    running: 0,
    succeeded: items.filter((item) => item.status === 'success').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    failed: items.filter((item) => item.status === 'failed').length,
    totalSizeBytes: items.reduce((total, item) => total + (item.sourceBefore?.sizeBytes ?? 0), 0)
  };
}

function summarizeResultStatus(items: FileOperationResultItem[]): FileOperationResult['status'] {
  const succeeded = items.filter((item) => item.status === 'success').length;
  const failedOrSkipped = items.filter((item) => item.status === 'failed' || item.status === 'skipped').length;

  if (failedOrSkipped === 0) {
    return 'success';
  }

  return succeeded > 0 ? 'complete-with-failures' : 'failed';
}

function getArchiveResultMessage(result: FileOperationResult): string {
  if (result.status === 'success') {
    return `${result.summary.succeeded.toLocaleString()} file(s) archived.`;
  }

  if (result.status === 'failed') {
    return 'No files were archived.';
  }

  return `${result.summary.succeeded.toLocaleString()} file(s) archived; ${(
    result.summary.failed + result.summary.skipped
  ).toLocaleString()} item(s) need attention.`;
}

function getArchiveDirectories(items: FileOperationPlanItem[]): string[] {
  return [
    ...new Set(
      items
        .map((item) => item.archivePath)
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
        .map((path) => dirname(path))
    )
  ];
}

function isSamePath(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

function nowIsoString(): string {
  return new Date().toISOString();
}
