import type {
  FileIdentity,
  FileOperationExecutionStatus,
  FileOperationPlan,
  FileOperationResult,
  FileOperationType
} from './fileOperations';

export type OperationHistoryStatus =
  | 'running'
  | 'complete'
  | 'partial'
  | 'failed'
  | 'canceled';

export interface OperationHistorySummary {
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  totalSizeBytes: number;
}

export interface OperationHistoryItemRecord {
  id: string;
  planItemId: string;
  sourcePath: string;
  destinationPath?: string | null;
  outputPath?: string | null;
  archivePath?: string | null;
  operationType: FileOperationType;
  fileName: string;
  status: FileOperationExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  sourceBefore?: FileIdentity | null;
  sourceAfter?: FileIdentity | null;
  destinationAfter?: FileIdentity | null;
  warnings?: string[];
  error?: string | null;
}

export interface OperationHistoryRecord {
  id: string;
  planId: string;
  type: FileOperationType;
  status: OperationHistoryStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  summary: OperationHistorySummary;
  planSnapshot: FileOperationPlan;
  resultSnapshot?: FileOperationResult | null;
  items: OperationHistoryItemRecord[];
  logPath?: string | null;
}

export interface OperationHistoryListRequest {
  limit?: number;
  offset?: number;
}

export interface OperationHistoryListResponse {
  status: 'success' | 'error';
  records: OperationHistoryRecord[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
}

export interface OperationHistoryDetailsResponse {
  status: 'success' | 'not_found' | 'error';
  record?: OperationHistoryRecord;
  message?: string;
}
