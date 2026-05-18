import type { AuditRequest, AuditResult } from '../../shared/types/audit';

const DATABASE_NAME = 'collie-video';
const DATABASE_VERSION = 1;
const STORE_NAME = 'audit-results';
const CURRENT_AUDIT_KEY = 'current';

export interface StoredAuditResultState {
  key: typeof CURRENT_AUDIT_KEY;
  schemaVersion: 1;
  savedAt: string;
  request: AuditRequest;
  result: AuditResult;
  showThumbnails: boolean;
}

export async function loadStoredAuditResult(): Promise<StoredAuditResultState | null> {
  return withStore('readonly', (store) => requestToPromise<StoredAuditResultState | undefined>(
    store.get(CURRENT_AUDIT_KEY)
  )).then((value) => (isStoredAuditResultState(value) ? value : null));
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

  await withStore('readwrite', (store) => requestToPromise(store.put(storedState)));
  return storedState;
}

export async function clearStoredAuditResult(): Promise<void> {
  await withStore('readwrite', (store) => requestToPromise(store.delete(CURRENT_AUDIT_KEY)));
}

async function withStore<Result>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<Result>
): Promise<Result> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
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

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open audit storage.'));
    request.onblocked = () => reject(new Error('Audit storage is blocked by another app window.'));
  });
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
