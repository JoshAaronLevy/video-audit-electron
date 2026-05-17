import type { JobStatus } from './jobs';
import type { CropRectangle, VideoRow } from './video';

export interface AutoCropRequest {
  videos: VideoRow[];
  outputRootDir: string;
}

export interface AutoCropProgress {
  jobId: string | null;
  status: JobStatus;
  phase: string | null;
  outputRootDir: string | null;
  outputDir: string | null;
  totalFiles: number | null;
  processedFiles: number;
  succeededCount: number;
  skippedCount: number;
  errorCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface AutoCropJobSnapshot extends AutoCropProgress {
  result?: AutoCropResult;
  error?: string | null;
}

export interface AutoCropStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
  outputDir?: string;
  outputRootDir?: string;
  totalFiles?: number;
}

export interface AutoCropResultItem {
  fileName: string;
  sourcePath: string;
  outputPath?: string | null;
  status: 'success' | 'skipped' | 'failed' | 'running' | string;
  crop?: Pick<CropRectangle, 'width' | 'height' | 'x' | 'y'>;
  target?: {
    width: number;
    height: number;
  };
  ffmpegFilter?: string | null;
  sourceSizeBytes?: number | null;
  outputSizeBytes?: number | null;
  startedAt?: string;
  completedAt?: string | null;
  error?: string | null;
}

export interface AutoCropResult {
  jobId: string;
  status: 'complete' | 'error' | 'canceled';
  message?: string;
  summary: {
    requested: number;
    eligible: number;
    skipped: number;
    succeeded: number;
    failed: number;
    sourceBytes?: number;
    outputBytes?: number;
  };
  outputDir: string;
  manifestPath?: string;
  items: AutoCropResultItem[];
}

export interface AutoCropResultResponse {
  jobId?: string;
  status: AutoCropResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: AutoCropResult;
}
