import type { TrashOperationPlan } from './fileOperations';
import type { JobStatus } from './jobs';

export type DuplicateExactMatchType = 'exact_filename';

export type DuplicateMatchType =
  | DuplicateExactMatchType
  | 'visual_near_duplicate'
  | 'contained_clip'
  | 'shared_segment';

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

export type DuplicateScanMode =
  | 'filename-exact'
  | 'visual-fingerprint'
  | 'contained-clip';

export type DuplicateScanProfile = 'fast' | 'deep';

export type ImprovedDuplicateScanSourceScope = 'selected-result-rows';

export type VisualFingerprintAlgorithm = 'dhash-v1' | 'phash-v1' | 'orb-v1';

export type DuplicateCandidateMatchType =
  | 'exact-filename'
  | 'near-duplicate'
  | 'contained-clip'
  | 'shared-segment';

export type DuplicateCandidateReviewStatus =
  | 'unreviewed'
  | 'ignored'
  | 'keep'
  | 'marked-for-trash'
  | 'marked-for-archive'
  | 'moved-to-trash'
  | 'archived'
  | 'removed-from-table'
  | 'failed';

export type ImprovedDuplicateScanPhase =
  | 'validating'
  | 'walking'
  | 'metadata'
  | 'fingerprint-cache'
  | 'fingerprinting'
  | 'matching-filename'
  | 'matching-visual'
  | 'matching-contained-clips'
  | 'complete'
  | 'error'
  | 'canceled';

export const DUPLICATE_SCAN_MATCH_TYPE: DuplicateExactMatchType = 'exact_filename';
export const DUPLICATE_SCAN_FILENAME_MATCH_SCOPE: DuplicateFilenameMatchScope =
  'basename_with_extension';
export const DUPLICATE_SCAN_FILENAME_CASE_MODE: DuplicateFilenameCaseMode =
  'case_insensitive_on_macos';
export const DUPLICATE_SCAN_EXCLUDES_SAME_PATH_SOURCE_MATCHES = true;
export const IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE: ImprovedDuplicateScanSourceScope =
  'selected-result-rows';
export const IMPROVED_DUPLICATE_SCAN_FAST_PROFILE: DuplicateScanProfile = 'fast';
export const IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE: DuplicateScanProfile = 'deep';
export const IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE: DuplicateScanProfile =
  IMPROVED_DUPLICATE_SCAN_FAST_PROFILE;

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
  metadataWarnings: string[];
  metadataError?: string | null;
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

export interface ImprovedDuplicateScanOptions {
  sourceScope: ImprovedDuplicateScanSourceScope;
  modes: DuplicateScanMode[];
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  maxSamplesPerVideo: number;
  minSequentialMatches: number;
  hashDistanceThreshold: number;
  includeExistingExactFilenameMatches: boolean;
  useCachedFingerprints: boolean;
}

export interface ImprovedDuplicateScanRequest {
  scanFolder: string;
  sources: DuplicateScanSourceInput[];
  options: ImprovedDuplicateScanOptions;
}

export interface VisualFingerprintCacheKey {
  filePath: string;
  sizeBytes: number;
  modifiedTimeMs: number;
  durationSeconds: number | null;
  algorithm: VisualFingerprintAlgorithm;
  algorithmVersion: string;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  maxSamplesPerVideo: number;
}

export interface VisualFingerprintSample {
  timeSeconds: number;
  hash: string;
  frameMean?: number | null;
  frameStdDev?: number | null;
  isLowInformation?: boolean;
}

export interface VisualFingerprint {
  cacheKey: string;
  filePath: string;
  fileName: string;
  directory: string;
  sizeBytes: number;
  modifiedTimeMs: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  algorithm: VisualFingerprintAlgorithm;
  algorithmVersion: string;
  generatedAt: string;
  samples: VisualFingerprintSample[];
  warnings: string[];
}

export interface DuplicateCandidateFile {
  id: string;
  role: 'source' | 'candidate';
  filePath: string;
  fileName: string;
  directory: string;
  durationSeconds: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  modifiedAtMs?: number | null;
  matchedStartSeconds?: number;
  matchedEndSeconds?: number;
  reviewStatus?: DuplicateCandidateReviewStatus;
}

export interface DuplicateCandidateEvidence {
  matchedFrameCount?: number;
  sequentialMatchCount?: number;
  matchedDurationSeconds?: number;
  shorterVideoCoverageRatio?: number;
  averageHashDistance?: number;
  medianHashDistance?: number;
  offsetSeconds?: number;
  offsetToleranceSeconds?: number;
  filenameMatchKey?: string;
  sampleIntervalSeconds?: number;
  algorithm?: VisualFingerprintAlgorithm;
  notes?: string[];
}

export interface DuplicateCandidateGroup {
  id: string;
  mode: DuplicateScanMode;
  confidence: number;
  matchType: DuplicateCandidateMatchType;
  files: DuplicateCandidateFile[];
  evidence: DuplicateCandidateEvidence;
}

export interface ImprovedDuplicateScanSummary {
  exactFilenameGroupCount: number;
  visualGroupCount: number;
  containedClipGroupCount: number;
  sharedSegmentGroupCount: number;
  candidateFileCount: number;
}

export interface ImprovedDuplicateScanResult {
  scanId: string;
  status: Extract<JobStatus, 'complete'>;
  startedAt: string;
  completedAt: string;
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  fingerprintedFileCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStaleCount: number;
  cacheErrorCount: number;
  groups: DuplicateCandidateGroup[];
  warnings: string[];
  summary: ImprovedDuplicateScanSummary;
}

export interface ImprovedDuplicateScanProgress {
  jobId: string | null;
  scanId: string | null;
  status: JobStatus;
  phase: ImprovedDuplicateScanPhase;
  totalFiles: number | null;
  processedFiles: number;
  fingerprintedFiles: number;
  cacheHits: number;
  cacheMisses: number;
  cacheStale: number;
  cacheErrors: number;
  candidateGroupCount: number;
  currentFile: string | null;
  message: string | null;
  error?: string | null;
}

export interface ImprovedDuplicateScanJobSnapshot extends ImprovedDuplicateScanProgress {
  result?: ImprovedDuplicateScanResult;
  error?: string | null;
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
