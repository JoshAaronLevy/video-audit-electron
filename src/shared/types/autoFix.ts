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
  status: Exclude<JobStatus, 'canceled'>;
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

export interface AutoFixStartResponse {
  jobId?: string;
  message?: string;
  outputDirectory?: string;
  status?: string;
  totalVideos?: number;
}

export interface AutoFixResultItem {
  id?: string | null;
  sourcePath: string;
  outputPath?: string | null;
  fileName: string;
  outputFileName?: string | null;
  status: 'success' | 'failed' | 'running' | string;
  profileId?: AutoFixProfileId | null;
  profileLabel?: string | null;
  cropped?: boolean;
  action?: AutoFixAction;
  sourceSizeBytes?: number | null;
  outputSizeBytes?: number | null;
  error?: string | null;
}

export interface AutoFixResult {
  jobId: string;
  status: 'complete' | 'error';
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
