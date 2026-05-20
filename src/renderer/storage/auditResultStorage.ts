import type { AuditRequest, AuditResult } from '../../shared/types/audit';

const DATABASE_NAME = 'collie-video';
const DATABASE_VERSION = 2;
const AUDIT_RESULT_STORE_NAME = 'audit-results';
const AUDIT_HISTORY_STORE_NAME = 'audit-history';
const CURRENT_AUDIT_KEY = 'current';

// Duplicate review sessions are intentionally not persisted with audit results.
export interface StoredAuditResultState {
  key: typeof CURRENT_AUDIT_KEY;
  schemaVersion: 1;
  savedAt: string;
  request: AuditRequest;
  result: AuditResult;
  showThumbnails: boolean;
}

export interface StoredAuditHistoryEntry {
  id: string;
  schemaVersion: 1;
  archivedAt: string;
  savedAt: string | null;
  jobId: string;
  request: AuditRequest;
  outputFolder: string | null;
  summary: AuditResult['summary'];
  rowCount: number;
  visibleRowCount: number;
  totalFiles: number;
  flaggedCount: number;
  errorCount: number;
}

export async function loadStoredAuditResult(): Promise<StoredAuditResultState | null> {
  return withStore(AUDIT_RESULT_STORE_NAME, 'readonly', (store) =>
    requestToPromise<StoredAuditResultState | undefined>(store.get(CURRENT_AUDIT_KEY))
  ).then((value) => (isStoredAuditResultState(value) ? value : null));
}

export async function saveStoredAuditResult(
  state: Omit<StoredAuditResultState, 'key' | 'schemaVersion' | 'savedAt'> & { savedAt?: string }
): Promise<StoredAuditResultState> {
  const storedState: StoredAuditResultState = {
    key: CURRENT_AUDIT_KEY,
    schemaVersion: 1,
    savedAt: state.savedAt ?? new Date().toISOString(),
    request: state.request,
    result: state.result,
    showThumbnails: state.showThumbnails
  };

  await withStore(AUDIT_RESULT_STORE_NAME, 'readwrite', (store) => requestToPromise(store.put(storedState)));
  return storedState;
}

export async function saveStoredAuditHistoryEntry({
  request,
  result,
  outputFolder,
  savedAt
}: {
  request: AuditRequest;
  result: AuditResult;
  outputFolder: string | null;
  savedAt: string | null;
}): Promise<StoredAuditHistoryEntry> {
  const archivedAt = new Date().toISOString();
  const historyEntry: StoredAuditHistoryEntry = {
    id: createHistoryEntryId(archivedAt, result.jobId),
    schemaVersion: 1,
    archivedAt,
    savedAt,
    jobId: result.jobId,
    request,
    outputFolder,
    summary: result.summary,
    rowCount: result.videos.length,
    visibleRowCount: result.videos.filter((row) => row.visible !== false).length,
    totalFiles: result.summary.totalFiles,
    flaggedCount: result.summary.flaggedCount,
    errorCount: result.summary.errorCount
  };

  await withStore(AUDIT_HISTORY_STORE_NAME, 'readwrite', (store) => requestToPromise(store.put(historyEntry)));
  return historyEntry;
}

export async function loadStoredAuditHistoryEntries(): Promise<StoredAuditHistoryEntry[]> {
  const entries = await withStore(AUDIT_HISTORY_STORE_NAME, 'readonly', (store) =>
    requestToPromise<StoredAuditHistoryEntry[]>(store.getAll())
  );

  return entries
    .filter(isStoredAuditHistoryEntry)
    .sort((first, second) => second.archivedAt.localeCompare(first.archivedAt));
}

export async function clearStoredAuditResult(): Promise<void> {
  await withStore(AUDIT_RESULT_STORE_NAME, 'readwrite', (store) => requestToPromise(store.delete(CURRENT_AUDIT_KEY)));
}

async function withStore<Result>(
  storeName: typeof AUDIT_RESULT_STORE_NAME | typeof AUDIT_HISTORY_STORE_NAME,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<Result>
): Promise<Result> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = await callback(store);
    await transactionToPromise(transaction);
    return result;
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(AUDIT_RESULT_STORE_NAME)) {
        database.createObjectStore(AUDIT_RESULT_STORE_NAME, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(AUDIT_HISTORY_STORE_NAME)) {
        const historyStore = database.createObjectStore(AUDIT_HISTORY_STORE_NAME, { keyPath: 'id' });
        historyStore.createIndex('archivedAt', 'archivedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open audit storage.'));
    request.onblocked = () => reject(new Error('Audit storage is blocked by another app window.'));
  });
}

function createHistoryEntryId(archivedAt: string, jobId: string): string {
  const randomId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${archivedAt}:${jobId}:${randomId}`;
}

function requestToPromise<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Audit storage request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Audit storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Audit storage transaction aborted.'));
  });
}

function isStoredAuditResultState(value: unknown): value is StoredAuditResultState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredAuditResultState>;

  return (
    candidate.key === CURRENT_AUDIT_KEY &&
    candidate.schemaVersion === 1 &&
    typeof candidate.savedAt === 'string' &&
    Boolean(candidate.request) &&
    Boolean(candidate.result)
  );
}

function isStoredAuditHistoryEntry(value: unknown): value is StoredAuditHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredAuditHistoryEntry>;

  return (
    typeof candidate.id === 'string' &&
    candidate.schemaVersion === 1 &&
    typeof candidate.archivedAt === 'string' &&
    typeof candidate.jobId === 'string' &&
    Boolean(candidate.request) &&
    Boolean(candidate.summary) &&
    typeof candidate.rowCount === 'number'
  );
}
