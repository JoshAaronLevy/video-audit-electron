import type { JobStatus } from './jobs';
import type { VideoPreviewFrameResult, VideoRow, VideoThumbnail } from './video';

export type ThumbnailScope = 'selected' | 'all';

export interface ThumbnailRequest {
  scope: ThumbnailScope;
  videos: VideoRow[];
}

export interface ThumbnailProgress {
  jobId: string | null;
  status: Exclude<JobStatus, 'canceled'>;
  phase: string | null;
  totalVideos: number | null;
  processedVideos: number;
  generatedCount: number;
  cachedCount: number;
  failedCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface ThumbnailStartResponse {
  jobId?: string;
  message?: string;
  status?: string;
  totalVideos?: number;
}

export interface ThumbnailResultItem {
  id?: string;
  fileName?: string;
  path?: string;
  absolutePath?: string;
  thumbnail: VideoThumbnail;
}

export interface ThumbnailResult {
  jobId: string;
  status: 'complete' | 'error';
  thumbnailDir?: string;
  summary: {
    requested: number;
    generated: number;
    cached: number;
    failed: number;
  };
  items: ThumbnailResultItem[];
}

export interface PreviewFrameRequest {
  video: VideoRow;
  mode: 'additional' | 'fresh';
}

export type PreviewFrameResult = VideoPreviewFrameResult;
