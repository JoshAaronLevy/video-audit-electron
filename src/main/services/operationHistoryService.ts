import { randomUUID } from 'node:crypto';
import type {
  FileOperationPlan,
  FileOperationResult,
  FileOperationResultItem
} from '../../shared/types/fileOperations';
import type {
  OperationHistoryDetailsResponse,
  OperationHistoryItemRecord,
  OperationHistoryListRequest,
  OperationHistoryListResponse,
  OperationHistoryRecord,
  OperationHistoryStatus,
  OperationHistorySummary
} from '../../shared/types/operationHistory';
import {
  readOperationHistoryStore,
  writeOperationHistoryStore
} from './fileOperationLogService';

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const MAX_STORED_HISTORY_RECORDS = 500;

let historyMutationQueue: Promise<unknown> = Promise.resolve();

export interface CreateOperationRecordInput {
  plan: FileOperationPlan;
  id?: string;
  startedAt?: string | null;
  logPath?: string | null;
}

export async function createOperationRecord(input: CreateOperationRecordInput): Promise<OperationHistoryRecord> {
  return mutateHistory(async (records) => {
    const record = createRecordFromPlan(input);
    const nextRecords = [record, ...records.filter((item) => item.id !== record.id)]
      .slice(0, MAX_STORED_HISTORY_RECORDS);

    return {
      records: nextRecords,
      result: record
    };
  });
}

export async function appendOperationItemResult(
  operationId: string,
  itemResult: FileOperationResultItem | OperationHistoryItemRecord
): Promise<OperationHistoryRecord | null> {
  return mutateHistory(async (records) => {
    const recordIndex = records.findIndex((record) => record.id === operationId);

    if (recordIndex < 0) {
      return {
        records,
        result: null
      };
    }

    const record = records[recordIndex];
    const item = normalizeResultItem(itemResult);
    const existingIndex = record.items.findIndex((candidate) => candidate.planItemId === item.planItemId);
    const items = [...record.items];

    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.push(item);
    }

    const nextRecord: OperationHistoryRecord = {
      ...record,
      summary: summarizeHistoryItems(record.summary.requested, items, record.summary.totalSizeBytes),
      items
    };
    const nextRecords = replaceRecord(records, recordIndex, nextRecord);

    return {
      records: nextRecords,
      result: nextRecord
    };
  });
}

export async function markOperationCompleted(
  operationId: string,
  resultSnapshot?: FileOperationResult | null
): Promise<OperationHistoryRecord | null> {
  return finishOperationRecord(operationId, resultSnapshot?.status === 'canceled' ? 'canceled' : null, resultSnapshot);
}

export async function markOperationFailed(
  operationId: string,
  resultSnapshot?: FileOperationResult | null
): Promise<OperationHistoryRecord | null> {
  return finishOperationRecord(operationId, 'failed', resultSnapshot);
}

export async function listRecentOperations(
  request: OperationHistoryListRequest = {}
): Promise<OperationHistoryListResponse> {
  try {
    const store = await readOperationHistoryStore();
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const sortedRecords = [...store.records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      status: 'success',
      records: sortedRecords.slice(offset, offset + limit),
      total: sortedRecords.length,
      limit,
      offset
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      records: [],
      total: 0,
      limit: DEFAULT_HISTORY_LIMIT,
      offset: 0,
      message: getErrorMessage(error)
    };
  }
}

export async function getOperationDetails(operationId: string): Promise<OperationHistoryDetailsResponse> {
  if (typeof operationId !== 'string' || operationId.trim() === '') {
    return {
      status: 'not_found',
      message: 'Operation id is required.'
    };
  }

  try {
    const store = await readOperationHistoryStore();
    const record = store.records.find((item) => item.id === operationId.trim());

    if (!record) {
      return {
        status: 'not_found',
        message: 'Operation history record not found.'
      };
    }

    return {
      status: 'success',
      record
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      message: getErrorMessage(error)
    };
  }
}

async function finishOperationRecord(
  operationId: string,
  forcedStatus: OperationHistoryStatus | null,
  resultSnapshot?: FileOperationResult | null
): Promise<OperationHistoryRecord | null> {
  return mutateHistory(async (records) => {
    const recordIndex = records.findIndex((record) => record.id === operationId);

    if (recordIndex < 0) {
      return {
        records,
        result: null
      };
    }

    const record = records[recordIndex];
    const summary = resultSnapshot ? summarizeFileOperationResult(resultSnapshot) : record.summary;
    const status = forcedStatus ?? summarizeCompletionStatus(summary);
    const nextRecord: OperationHistoryRecord = {
      ...record,
      status,
      completedAt: resultSnapshot?.completedAt ?? nowIsoString(),
      summary,
      resultSnapshot: resultSnapshot ?? record.resultSnapshot ?? null,
      items: resultSnapshot ? resultSnapshot.items.map(normalizeResultItem) : record.items
    };
    const nextRecords = replaceRecord(records, recordIndex, nextRecord);

    return {
      records: nextRecords,
      result: nextRecord
    };
  });
}

async function mutateHistory<T>(
  callback: (records: OperationHistoryRecord[]) => Promise<{
    records: OperationHistoryRecord[];
    result: T;
  }>
): Promise<T> {
  const runMutation = async (): Promise<T> => {
    const store = await readOperationHistoryStore();
    const mutation = await callback(store.records);

    await writeOperationHistoryStore({
      ...store,
      records: mutation.records.slice(0, MAX_STORED_HISTORY_RECORDS)
    });

    return mutation.result;
  };

  const nextMutation = historyMutationQueue.then(runMutation, runMutation);
  historyMutationQueue = nextMutation.catch(() => undefined);
  return nextMutation;
}

function createRecordFromPlan({
  plan,
  id = randomUUID(),
  startedAt = nowIsoString(),
  logPath = null
}: CreateOperationRecordInput): OperationHistoryRecord {
  return {
    id,
    planId: plan.id,
    type: plan.type,
    status: 'running',
    createdAt: nowIsoString(),
    startedAt,
    completedAt: null,
    summary: {
      requested: plan.summary.total,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      totalSizeBytes: plan.summary.totalSizeBytes
    },
    planSnapshot: plan,
    resultSnapshot: null,
    items: plan.items.map((item) => ({
      id: randomUUID(),
      planItemId: item.id,
      sourcePath: item.sourcePath,
      destinationPath: item.destinationPath ?? null,
      outputPath: item.outputPath ?? null,
      archivePath: item.archivePath ?? null,
      operationType: item.operationType,
      fileName: item.fileName,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      sourceBefore: item.sourceIdentity ?? null,
      destinationAfter: item.destinationIdentity ?? null,
      warnings: [...item.warnings],
      error: item.errors[0] ?? null
    })),
    logPath
  };
}

function normalizeResultItem(item: FileOperationResultItem | OperationHistoryItemRecord): OperationHistoryItemRecord {
  return {
    id: item.id,
    planItemId: item.planItemId,
    sourcePath: item.sourcePath,
    destinationPath: item.destinationPath ?? null,
    outputPath: item.outputPath ?? null,
    archivePath: item.archivePath ?? null,
    operationType: item.operationType,
    fileName: item.fileName,
    status: item.status,
    startedAt: item.startedAt ?? null,
    completedAt: item.completedAt ?? null,
    sourceBefore: item.sourceBefore ?? null,
    sourceAfter: item.sourceAfter ?? null,
    destinationAfter: item.destinationAfter ?? null,
    warnings: [...(item.warnings ?? [])],
    error: item.error ?? null
  };
}

function summarizeFileOperationResult(result: FileOperationResult): OperationHistorySummary {
  return {
    requested: result.summary.total,
    succeeded: result.summary.succeeded,
    skipped: result.summary.skipped,
    failed: result.summary.failed,
    totalSizeBytes: result.summary.totalSizeBytes
  };
}

function summarizeHistoryItems(
  requested: number,
  items: OperationHistoryItemRecord[],
  totalSizeBytes: number
): OperationHistorySummary {
  return {
    requested,
    succeeded: items.filter((item) => item.status === 'success').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    failed: items.filter((item) => item.status === 'failed').length,
    totalSizeBytes
  };
}

function summarizeCompletionStatus(summary: OperationHistorySummary): OperationHistoryStatus {
  if (summary.failed > 0 || summary.skipped > 0) {
    return summary.succeeded > 0 || summary.skipped > 0 ? 'partial' : 'failed';
  }

  return 'complete';
}

function replaceRecord(
  records: OperationHistoryRecord[],
  recordIndex: number,
  nextRecord: OperationHistoryRecord
): OperationHistoryRecord[] {
  return records.map((record, index) => (index === recordIndex ? nextRecord : record));
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(MAX_HISTORY_LIMIT, Math.max(1, Math.round(value)));
}

function normalizeOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to read operation history.';
}
