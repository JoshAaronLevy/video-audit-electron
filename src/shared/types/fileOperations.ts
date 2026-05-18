export type FileOperationType =
  | 'trash'
  | 'move'
  | 'copy'
  | 'archive'
  | 'replace-original-with-output';

export type FileOperationPlanStatus =
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'missing-source'
  | 'missing-output'
  | 'destination-conflict'
  | 'invalid-path'
  | 'unsupported-file'
  | 'would-overwrite';

export type FileOperationExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed';

export type FileOperationWarningCode =
  | 'stale-source-metadata'
  | 'stale-output-metadata'
  | 'destination-exists'
  | 'source-is-not-video'
  | 'source-outside-audit'
  | 'output-outside-managed-folder'
  | 'external-volume'
  | 'outside-known-roots'
  | 'requires-user-confirmation'
  | 'partial-plan';

export type FileOperationErrorCode =
  | 'missing-source'
  | 'missing-output'
  | 'destination-conflict'
  | 'invalid-source-path'
  | 'invalid-destination-path'
  | 'unsupported-file'
  | 'would-overwrite'
  | 'directory-operation-blocked'
  | 'operation-not-allowed';

export type FileOperationItemRole = 'source' | 'output' | 'destination' | 'archive';

export type ReplacementFileAction =
  | 'skip'
  | 'keep-original'
  | 'trash-original'
  | 'archive-original'
  | 'replace-original-with-output'
  | 'move-output-to-source-directory';

export type DestinationConflictStrategy = 'skip' | 'rename-with-suffix';

export interface FileIdentity {
  path: string;
  fileName: string;
  extension: string;
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  createdAtMs?: number | null;
  isDirectory: boolean;
  isFile: boolean;
}

export type KnownPathKind = 'file' | 'directory' | 'any';

export interface KnownPathValidationItem {
  id?: string;
  path: string;
  expectedKind: KnownPathKind;
  expectedFileName?: string | null;
  expectedSizeBytes?: number | null;
  expectedModifiedAtMs?: number | null;
  requireSupportedVideoExtension?: boolean;
}

export interface KnownPathValidationRequest {
  items: KnownPathValidationItem[];
}

export interface KnownPathValidationResult {
  id?: string;
  path: string;
  expectedKind: KnownPathKind;
  exists: boolean;
  isValid: boolean;
  identity: FileIdentity | null;
  warnings: string[];
  errors: string[];
}

export interface KnownPathValidationResponse {
  status: 'success' | 'error';
  items: KnownPathValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  };
  message?: string;
}

export type RevealKnownPathRequest = KnownPathValidationItem;

export interface RevealKnownPathResponse {
  ok: boolean;
  path: string;
  identity?: FileIdentity | null;
  message?: string;
  validation?: KnownPathValidationResult;
}

export interface KnownFileOperationItem {
  id?: string;
  sourcePath: string;
  fileName?: string;
  expectedSizeBytes?: number | null;
  expectedModifiedAtMs?: number | null;
  allowUnsupportedFileType?: boolean;
  identity?: FileIdentity | null;
}

export interface KnownOutputFileOperationItem extends KnownFileOperationItem {
  outputPath: string;
  expectedOutputSizeBytes?: number | null;
  expectedOutputModifiedAtMs?: number | null;
  outputIdentity?: FileIdentity | null;
}

export interface FileOperationPlanItem {
  id: string;
  operationType: FileOperationType;
  sourcePath: string;
  destinationPath?: string | null;
  outputPath?: string | null;
  archivePath?: string | null;
  fileName: string;
  expectedSizeBytes?: number | null;
  expectedModifiedAtMs?: number | null;
  allowUnsupportedFileType?: boolean;
  sourceIdentity?: FileIdentity | null;
  outputIdentity?: FileIdentity | null;
  destinationIdentity?: FileIdentity | null;
  status: FileOperationPlanStatus;
  warningCodes: FileOperationWarningCode[];
  warnings: string[];
  errorCodes: FileOperationErrorCode[];
  errors: string[];
}

export interface FileOperationPlanSummary {
  total: number;
  ready: number;
  warning: number;
  blocked: number;
  totalSizeBytes: number;
}

export interface FileOperationPlanConfirmation {
  isRequired: boolean;
  phrase: 'Move to Trash';
  reasons: string[];
}

export interface FileOperationPlan {
  id: string;
  type: FileOperationType;
  createdAt: string;
  items: FileOperationPlanItem[];
  summary: FileOperationPlanSummary;
}

export interface TrashOperationPlan extends FileOperationPlan {
  type: 'trash';
  confirmation: FileOperationPlanConfirmation;
}

export interface MoveOperationPlan extends FileOperationPlan {
  type: 'move';
  destinationDirectory: string;
  conflictStrategy: DestinationConflictStrategy;
}

export interface CopyOperationPlan extends FileOperationPlan {
  type: 'copy';
  destinationDirectory: string;
}

export interface ArchiveOperationPlan extends FileOperationPlan {
  type: 'archive';
  archiveDirectory: string;
  archiveDirectories: string[];
  archiveDate: string;
  conflictStrategy: DestinationConflictStrategy;
}

export interface ReplacementOperationPlan extends FileOperationPlan {
  type: 'replace-original-with-output';
  items: ReplacementOperationPlanItem[];
}

export interface ReplacementOperationPlanItem extends FileOperationPlanItem {
  operationType: 'replace-original-with-output';
  originalPath: string;
  outputPath: string;
  replacementAction: ReplacementFileAction;
}

export type AnyFileOperationPlan =
  | TrashOperationPlan
  | MoveOperationPlan
  | CopyOperationPlan
  | ArchiveOperationPlan
  | ReplacementOperationPlan;

export interface CreateTrashOperationPlanRequest {
  operationType: 'trash';
  items: KnownFileOperationItem[];
  knownRootDirectories?: string[];
  knownOutputDirectories?: string[];
}

export interface CreateMoveOperationPlanRequest {
  operationType: 'move';
  items: KnownFileOperationItem[];
  destinationDirectory: string;
  conflictStrategy?: DestinationConflictStrategy;
}

export interface CreateCopyOperationPlanRequest {
  operationType: 'copy';
  items: KnownFileOperationItem[];
  destinationDirectory: string;
}

export interface CreateArchiveOperationPlanRequest {
  operationType: 'archive';
  items: KnownFileOperationItem[];
  archiveDate?: string;
  conflictStrategy?: DestinationConflictStrategy;
}

export interface CreateReplacementOperationPlanRequest {
  operationType: 'replace-original-with-output';
  items: KnownOutputFileOperationItem[];
  defaultAction: ReplacementFileAction;
  archiveDirectory?: string | null;
}

export type CreateFileOperationPlanRequest =
  | CreateTrashOperationPlanRequest
  | CreateMoveOperationPlanRequest
  | CreateCopyOperationPlanRequest
  | CreateArchiveOperationPlanRequest
  | CreateReplacementOperationPlanRequest;

export interface FileOperationResultItem {
  id: string;
  planItemId: string;
  operationType: FileOperationType;
  sourcePath: string;
  destinationPath?: string | null;
  outputPath?: string | null;
  archivePath?: string | null;
  fileName: string;
  status: FileOperationExecutionStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  sourceBefore?: FileIdentity | null;
  sourceAfter?: FileIdentity | null;
  destinationAfter?: FileIdentity | null;
  warningCodes: FileOperationWarningCode[];
  warnings: string[];
  errorCode?: FileOperationErrorCode | null;
  error?: string | null;
}

export interface FileOperationResultSummary {
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  skipped: number;
  failed: number;
  totalSizeBytes: number;
}

export interface FileOperationResult {
  id: string;
  planId: string;
  type: FileOperationType;
  status: FileOperationExecutionStatus | 'complete-with-failures' | 'canceled';
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  summary: FileOperationResultSummary;
  items: FileOperationResultItem[];
}

export interface CreateTrashOperationPlanResponse {
  status: 'planned' | 'invalid_request' | 'error';
  plan?: TrashOperationPlan;
  message?: string;
}

export interface ExecuteTrashOperationPlanRequest {
  planId: string;
  confirmed: boolean;
  typedConfirmation?: string | null;
}

export interface ExecuteTrashOperationPlanResponse {
  status: 'complete' | 'partial' | 'failed' | 'not_found' | 'invalid_request' | 'error';
  result?: FileOperationResult;
  message?: string;
}

export interface CreateMoveOperationPlanResponse {
  status: 'planned' | 'invalid_request' | 'error';
  plan?: MoveOperationPlan;
  message?: string;
}

export interface ExecuteMoveOperationPlanRequest {
  planId: string;
  confirmed: boolean;
}

export interface ExecuteMoveOperationPlanResponse {
  status: 'complete' | 'partial' | 'failed' | 'not_found' | 'invalid_request' | 'error';
  result?: FileOperationResult;
  message?: string;
}

export interface CreateArchiveOperationPlanResponse {
  status: 'planned' | 'invalid_request' | 'error';
  plan?: ArchiveOperationPlan;
  message?: string;
}

export interface ExecuteArchiveOperationPlanRequest {
  planId: string;
  confirmed: boolean;
}

export interface ExecuteArchiveOperationPlanResponse {
  status: 'complete' | 'partial' | 'failed' | 'not_found' | 'invalid_request' | 'error';
  result?: FileOperationResult;
  message?: string;
}
