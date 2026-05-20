import type { TrashOperationPlan } from './fileOperations';
import type { JobStatus } from './jobs';

export type DuplicateMatchType = 'exact_filename';

// v1 intentionally matches exact basenames including extension only.
export type DuplicateFilenameMatchScope = 'basename_with_extension';

// v1 uses case-insensitive exact filename keys on macOS and exact-case keys elsewhere.
export type DuplicateFilenameCaseMode = 'case_insensitive_on_macos';

export interface DuplicateScanMatchingSemantics {
  matchType: DuplicateMatchType;
  matchScope: DuplicateFilenameMatchScope;
  caseMode: DuplicateFilenameCaseMode;
  excludesSamePathSourceMatches: true;
  usesDurationForMatching: false;
  usesFileSizeForMatching: false;
  usesResolutionForMatching: false;
  usesBitrateForMatching: false;
  usesModifiedDateForMatching: false;
}

export type DuplicateTrashStatus =
  | 'unmarked'
  | 'planned'
  | 'moved_to_trash'
  | 'skipped'
  | 'failed';

export type DuplicateScanPhase =
  | 'validating'
  | 'walking'
  | 'matching'
  | 'metadata'
  | 'complete'
  | 'error'
  | 'canceled';

export const DUPLICATE_SCAN_MATCH_TYPE: DuplicateMatchType = 'exact_filename';
export const DUPLICATE_SCAN_FILENAME_MATCH_SCOPE: DuplicateFilenameMatchScope =
  'basename_with_extension';
export const DUPLICATE_SCAN_FILENAME_CASE_MODE: DuplicateFilenameCaseMode =
  'case_insensitive_on_macos';
export const DUPLICATE_SCAN_EXCLUDES_SAME_PATH_SOURCE_MATCHES = true;

export interface DuplicateScanSourceInput {
  id: string;
  path: string;
  fileName: string;
  directory: string;
  durationSeconds?: number | null;
  durationFormatted?: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  resolution?: string;
  bitRate?: number | null;
  bitRateMbps?: number | null;
  modifiedAt?: string | null;
  modifiedAtMs?: number | null;
  fileSystemSizeBytes?: number | null;
  fileType?: string;
  extension?: string;
  fileExtension?: string;
}

export interface DuplicateScanRequest {
  scanFolder: string;
  sources: DuplicateScanSourceInput[];
}

export interface DuplicateScanSource extends DuplicateScanSourceInput {
  matchKey: string;
}

export interface DuplicateScanCandidate {
  id: string;
  sourceId: string;
  path: string;
  fileName: string;
  directory: string;
  durationSeconds: number | null;
  durationFormatted: string;
  durationDeltaSeconds: number | null;
  sizeBytes: number | null;
  sizeDeltaBytes: number | null;
  width: number | null;
  height: number | null;
  resolution: string;
  bitRate: number | null;
  bitRateMbps: number | null;
  modifiedAt: string | null;
  modifiedAtMs: number | null;
  fileType: string;
  extension: string;
  matchType: DuplicateMatchType;
  trashStatus: DuplicateTrashStatus;
  trashError?: string | null;
}

export interface DuplicateScanGroup {
  id: string;
  source: DuplicateScanSource;
  candidates: DuplicateScanCandidate[];
}

export interface DuplicateScanSummary {
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  matchCount: number;
  groupCount: number;
}

export interface DuplicateScanResult {
  scanId: string;
  status: Extract<JobStatus, 'complete'>;
  scannedFolder: string;
  startedAt: string;
  completedAt: string;
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  matchCount: number;
  groups: DuplicateScanGroup[];
  warnings: string[];
  summary: DuplicateScanSummary;
}

export interface DuplicateScanProgress {
  jobId: string | null;
  scanId: string | null;
  status: JobStatus;
  phase: DuplicateScanPhase;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  filenameMatchesFound: number;
  metadataProcessedCount: number;
  metadataTotalCount: number | null;
  currentFile: string | null;
  message: string | null;
}

export interface DuplicateScanJobSnapshot extends DuplicateScanProgress {
  result?: DuplicateScanResult;
  error?: string | null;
}

export interface DuplicateScanStartResponse {
  jobId?: string;
  scanId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
}

export interface DuplicateScanCancelResponse extends DuplicateScanJobSnapshot {}

export interface DuplicateScanResultResponse {
  jobId?: string;
  scanId?: string;
  status: DuplicateScanResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: DuplicateScanResult;
}

export interface DuplicateScanTrashPlanRequest {
  scanId: string;
  candidateIds: string[];
}

export interface DuplicateScanTrashPlanResponse {
  status: 'planned' | 'invalid_request' | 'not_found' | 'error' | string;
  plan?: TrashOperationPlan;
  message?: string;
}

export interface DuplicateScanFilenameSemantics {
  matchType: DuplicateMatchType;
  matchScope: DuplicateFilenameMatchScope;
  caseMode: DuplicateFilenameCaseMode;
}

export const DUPLICATE_SCAN_FILENAME_SEMANTICS: DuplicateScanFilenameSemantics = {
  matchType: DUPLICATE_SCAN_MATCH_TYPE,
  matchScope: DUPLICATE_SCAN_FILENAME_MATCH_SCOPE,
  caseMode: DUPLICATE_SCAN_FILENAME_CASE_MODE
};

export const DUPLICATE_SCAN_MATCHING_SEMANTICS: DuplicateScanMatchingSemantics = {
  matchType: DUPLICATE_SCAN_MATCH_TYPE,
  matchScope: DUPLICATE_SCAN_FILENAME_MATCH_SCOPE,
  caseMode: DUPLICATE_SCAN_FILENAME_CASE_MODE,
  excludesSamePathSourceMatches: DUPLICATE_SCAN_EXCLUDES_SAME_PATH_SOURCE_MATCHES,
  usesDurationForMatching: false,
  usesFileSizeForMatching: false,
  usesResolutionForMatching: false,
  usesBitrateForMatching: false,
  usesModifiedDateForMatching: false
};
