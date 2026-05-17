import type { JobStatus } from './jobs';
import type { FfprobeResult, VideoRow } from './video';

export interface AuditOptions {
  includeSubfolders: boolean;
  includeLowResolutionAnalysis: boolean;
  includeBlackBorderAnalysis: boolean;
  minHeight: number;
  targetAspectRatio: number;
  aspectRatioTolerance: number;
}

export interface AuditRequest {
  folderPaths: string[];
  filePaths: string[];
  options: AuditOptions;
}

export interface AuditStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
  resolvedDirectory?: string | null;
}

export interface AuditProgress {
  jobId: string | null;
  status: JobStatus;
  phase: string | null;
  resolvedDirectory: string | null;
  totalFiles: number | null;
  processedFiles: number;
  skippedFiles: number;
  flaggedCount: number;
  errorCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface AuditError {
  path: string;
  fileName: string;
  error: string;
  directory?: string;
  extension?: string;
  fileExtension?: string;
  fileType?: string;
  sizeBytes?: number | null;
  createdAt?: string;
  modifiedAt?: string;
}

export interface AuditSummary {
  directoryPath?: string | null;
  resolvedDirectory?: string | null;
  totalFiles: number;
  scannedVideos: number;
  flaggedCount: number;
  errorCount: number;
}

export interface AuditResult {
  jobId: string;
  status: Extract<JobStatus, 'complete'>;
  summary: AuditSummary;
  videos: VideoRow[];
  errors: AuditError[];
}

export interface FileDiscoveryRequest {
  folderPaths: string[];
  filePaths: string[];
  includeSubfolders: boolean;
}

export type FileDiscoveryPhase = 'validating' | 'walking' | 'complete' | 'error' | 'canceled';

export interface DiscoveredVideoFile {
  path: string;
  directory: string;
  fileName: string;
  extension: string;
  fileType: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
}

export interface FileDiscoveryProgress {
  jobId: string | null;
  status: JobStatus;
  phase: FileDiscoveryPhase;
  totalFiles: number | null;
  processedFiles: number;
  skippedFiles: number;
  foundCount: number;
  currentPath: string | null;
  message: string | null;
}

export interface FileDiscoveryResult {
  jobId: string;
  status: Extract<JobStatus, 'complete'>;
  summary: {
    folderCount: number;
    selectedFileCount: number;
    foundCount: number;
    skippedFiles: number;
  };
  files: DiscoveredVideoFile[];
}

export interface FileDiscoveryStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
}

export interface FileDiscoveryJobSnapshot extends FileDiscoveryProgress {
  result?: FileDiscoveryResult;
  error?: string | null;
}

export interface FfprobeMetadataRequest {
  filePaths: string[];
  ffprobePathOverride?: string | null;
}

export type FfprobeMetadataPhase = 'probing' | 'complete' | 'error' | 'canceled';

export interface FfprobeMetadataProgress {
  jobId: string | null;
  status: JobStatus;
  phase: FfprobeMetadataPhase;
  totalFiles: number | null;
  processedFiles: number;
  succeededCount: number;
  errorCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface FfprobeMetadataResult {
  jobId: string;
  status: Extract<JobStatus, 'complete'>;
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
  };
  items: FfprobeResult[];
}

export interface FfprobeMetadataStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
}

export interface FfprobeMetadataJobSnapshot extends FfprobeMetadataProgress {
  result?: FfprobeMetadataResult;
  error?: string | null;
}
