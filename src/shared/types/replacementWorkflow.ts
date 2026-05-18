import type { AutoCropResult, AutoCropResultItem } from './autoCrop';
import type { AutoFixResult, AutoFixResultItem } from './autoFix';
import type { FileIdentity, FileOperationResult } from './fileOperations';
import type { JobStatus } from './jobs';

export type ReplacementPlanSource = 'auto-fix-result' | 'auto-crop-result' | 'items';

export type ReplacementAction =
  | 'replace-original'
  | 'keep-output'
  | 'move-output'
  | 'trash-original'
  | 'archive-original'
  | 'skip';

export type ReplacementPlanItemStatus =
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'missing-original'
  | 'missing-output'
  | 'destination-conflict'
  | 'invalid-original'
  | 'invalid-output';

export type ReplacementPlanWarningCode =
  | 'final-path-matches-original'
  | 'output-already-at-final-path'
  | 'extension-changed'
  | 'conversion-not-successful'
  | 'missing-original-kept-output';

export type ReplacementPlanErrorCode =
  | 'missing-original'
  | 'missing-output'
  | 'invalid-original'
  | 'invalid-output'
  | 'destination-conflict'
  | 'invalid-request';

export interface ReplacementPlanInputItem {
  id?: string | null;
  source?: ReplacementPlanSource;
  originalPath: string;
  originalFileName?: string | null;
  originalSizeBytes?: number | null;
  originalModifiedAtMs?: number | null;
  outputPath?: string | null;
  outputFileName?: string | null;
  outputSizeBytes?: number | null;
  outputModifiedAtMs?: number | null;
  selectedAction?: ReplacementAction | null;
  conversionStatus?: string | null;
}

export interface ReplacementPlanItem {
  id: string;
  source: ReplacementPlanSource;
  originalPath: string;
  originalFileName: string;
  originalDirectory: string;
  originalExtension: string;
  originalSizeBytes: number | null;
  originalModifiedAtMs: number | null;
  originalIdentity: FileIdentity | null;
  outputPath: string;
  outputFileName: string;
  outputDirectory: string;
  outputExtension: string;
  outputSizeBytes: number | null;
  outputModifiedAtMs: number | null;
  outputIdentity: FileIdentity | null;
  proposedFinalPath: string;
  selectedAction: ReplacementAction;
  status: ReplacementPlanItemStatus;
  warnings: string[];
  warningCodes: ReplacementPlanWarningCode[];
  errors: string[];
  errorCodes: ReplacementPlanErrorCode[];
  conversionStatus?: string | null;
}

export interface ReplacementPlanSummary {
  total: number;
  ready: number;
  warning: number;
  blocked: number;
  missingOriginal: number;
  missingOutput: number;
  destinationConflicts: number;
  totalOriginalSizeBytes: number;
  totalOutputSizeBytes: number;
}

export interface ReplacementPlan {
  id: string;
  source: ReplacementPlanSource;
  createdAt: string;
  defaultAction: ReplacementAction;
  items: ReplacementPlanItem[];
  summary: ReplacementPlanSummary;
}

export interface CreateReplacementPlanRequest {
  source: ReplacementPlanSource;
  defaultAction?: ReplacementAction;
  autoFixResult?: AutoFixResult | null;
  autoCropResult?: AutoCropResult | null;
  items?: ReplacementPlanInputItem[];
}

export interface CreateReplacementPlanResponse {
  status: 'planned' | 'invalid_request' | 'error';
  plan?: ReplacementPlan;
  message?: string;
}

export interface ReplacementPlanActionUpdate {
  itemId: string;
  selectedAction: ReplacementAction;
}

export type ReplacementPlanBulkAction =
  | 'ready-replace'
  | 'warning-skip'
  | 'keep-output'
  | 'clear-actions';

export interface UpdateReplacementPlanActionsRequest {
  planId: string;
  actions: ReplacementPlanActionUpdate[];
}

export interface UpdateReplacementPlanActionsResponse {
  status: 'updated' | 'invalid_request' | 'not_found' | 'error';
  plan?: ReplacementPlan;
  message?: string;
}

export type ReplacementOriginalDisposition = 'move-original-to-trash';

export interface ExecuteReplacementPlanRequest {
  planId: string;
  confirmed: boolean;
  typedConfirmation?: string | null;
  originalDisposition?: ReplacementOriginalDisposition;
}

export interface ReplacementExecutionStartResponse {
  jobId?: string;
  planId?: string;
  status: 'started' | 'invalid_request' | 'not_found' | 'error' | string;
  message?: string;
  totalItems?: number;
}

export interface ReplacementExecutionJobSnapshot {
  jobId: string | null;
  planId: string | null;
  status: JobStatus;
  phase: string | null;
  totalItems: number | null;
  processedItems: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
  currentFile: string | null;
  message: string | null;
  error?: string | null;
  result?: FileOperationResult;
}

export interface ReplacementExecutionResultResponse {
  jobId?: string;
  status: FileOperationResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: FileOperationResult;
}

export type ReplacementConversionResultItem = AutoFixResultItem | AutoCropResultItem;
