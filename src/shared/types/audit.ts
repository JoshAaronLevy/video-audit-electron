import type { JobStatus } from './jobs';
import type { VideoRow } from './video';

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
