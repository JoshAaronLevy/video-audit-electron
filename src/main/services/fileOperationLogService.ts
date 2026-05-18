import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OperationHistoryRecord } from '../../shared/types/operationHistory';
import { getFileOperationHistoryFilePath } from './appPaths';

const OPERATION_HISTORY_SCHEMA_VERSION = 1;

export interface OperationHistoryStore {
  schemaVersion: typeof OPERATION_HISTORY_SCHEMA_VERSION;
  records: OperationHistoryRecord[];
}

export async function readOperationHistoryStore(): Promise<OperationHistoryStore> {
  const historyPath = getFileOperationHistoryFilePath();

  try {
    const rawHistory = await readFile(historyPath, 'utf8');
    return normalizeOperationHistoryStore(JSON.parse(rawHistory));
  } catch {
    return createEmptyOperationHistoryStore();
  }
}

export async function writeOperationHistoryStore(store: OperationHistoryStore): Promise<void> {
  const historyPath = getFileOperationHistoryFilePath();
  const tempPath = `${historyPath}.tmp`;
  const normalizedStore = normalizeOperationHistoryStore(store);

  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(normalizedStore, null, 2)}\n`, 'utf8');
  await rename(tempPath, historyPath);
}

export function createEmptyOperationHistoryStore(): OperationHistoryStore {
  return {
    schemaVersion: OPERATION_HISTORY_SCHEMA_VERSION,
    records: []
  };
}

function normalizeOperationHistoryStore(value: unknown): OperationHistoryStore {
  if (!isRecord(value)) {
    return createEmptyOperationHistoryStore();
  }

  return {
    schemaVersion: OPERATION_HISTORY_SCHEMA_VERSION,
    records: Array.isArray(value.records)
      ? value.records.filter(isOperationHistoryRecord)
      : []
  };
}

function isOperationHistoryRecord(value: unknown): value is OperationHistoryRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.planId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    typeof value.createdAt === 'string' &&
    isRecord(value.summary) &&
    Array.isArray(value.items) &&
    isRecord(value.planSnapshot)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
