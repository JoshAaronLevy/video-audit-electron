import type { JobStatus } from './jobs';
import type { VideoRow } from './video';

export type AutoFixProfileId = 'standard' | 'high-quality';
export type AutoFixAction = 'normalize' | 'crop-normalize';

export interface AutoFixRequest {
  videos: VideoRow[];
  outputDirectory: string;
}

export interface AutoFixProgress {
  jobId: string | null;
  status: JobStatus;
  phase: string | null;
  totalVideos: number | null;
  processedVideos: number;
  currentFile: string | null;
  currentProfile: AutoFixProfileId | null;
  currentAction: AutoFixAction | null;
  message: string | null;
  succeeded: number;
  failed: number;
  outputDirectory: string | null;
}

export interface AutoFixJobSnapshot extends AutoFixProgress {
  result?: AutoFixResult;
  error?: string | null;
}

export interface AutoFixStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
  outputDirectory?: string | null;
  totalVideos?: number;
}

export interface AutoFixResultItem {
  id?: string | null;
  sourcePath?: string | null;
  outputPath?: string | null;
  fileName: string;
  outputFileName?: string | null;
  status: 'success' | 'failed' | 'running' | string;
  profileId?: AutoFixProfileId | null;
  profileLabel?: string | null;
  cropped?: boolean;
  action?: AutoFixAction | null;
  crop?: {
    width: number;
    height: number;
    x: number;
    y: number;
  } | null;
  filter?: string | null;
  sourceSizeBytes?: number | null;
  outputSizeBytes?: number | null;
  outputExtensionConverted?: boolean;
  startedAt?: string;
  completedAt?: string | null;
  error?: string | null;
}

export interface AutoFixResult {
  jobId: string;
  status: 'complete' | 'error' | 'canceled';
  message?: string;
  outputDirectory: string;
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
    standardProfileCount: number;
    highQualityProfileCount: number;
    croppedCount: number;
    normalizedOnlyCount: number;
  };
  items: AutoFixResultItem[];
}

export interface AutoFixResultResponse {
  jobId?: string;
  status: AutoFixResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: AutoFixResult;
}
