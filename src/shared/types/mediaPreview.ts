import type { JobStatus } from './jobs';
import type { VideoPreviewFrameResult, VideoRow, VideoThumbnail } from './video';

export type MediaPreviewScope = 'selected' | 'all';
export type MediaPreviewMode = 'thumbnail' | 'preview-frames';
export type MediaPreviewClipStatus = 'not-generated' | 'generating' | 'ready' | 'failed';
export type PreviewFrameMode = 'additional' | 'fresh';

export interface MediaPreviewSourceIdentity {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
  durationSeconds: number | null;
}

export interface MediaPreviewItem {
  id: string;
  timestampSeconds: number;
  timestampLabel: string;
  thumbnailPath: string;
  thumbnailUrl?: string;
  previewClipPath?: string;
  previewClipUrl?: string;
  previewClipStatus?: MediaPreviewClipStatus;
}

export interface MediaPreviewManifest {
  schemaVersion: 1;
  videoId?: string | null;
  fileName: string;
  source: MediaPreviewSourceIdentity;
  createdAt: string;
  updatedAt: string;
  items: MediaPreviewItem[];
}

export interface MediaPreviewRequest {
  videos: VideoRow[];
  mode?: MediaPreviewMode;
}

export interface MediaPreviewProgress {
  jobId: string | null;
  status: JobStatus;
  phase: string | null;
  totalVideos: number | null;
  processedVideos: number;
  generatedCount: number;
  cachedCount: number;
  failedCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface MediaPreviewJobSnapshot extends MediaPreviewProgress {
  result?: MediaPreviewResult;
  error?: string | null;
}

export interface MediaPreviewStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
  totalVideos?: number;
}

export interface MediaPreviewResultItem {
  id?: string;
  fileName?: string;
  path?: string;
  absolutePath?: string;
  thumbnail: VideoThumbnail;
  previewFrames?: VideoPreviewFrameResult;
  manifestPath?: string;
}

export interface MediaPreviewResult {
  jobId: string;
  status: 'complete' | 'error' | 'canceled';
  message?: string;
  previewCacheDir?: string;
  summary: {
    requested: number;
    generated: number;
    cached: number;
    failed: number;
  };
  items: MediaPreviewResultItem[];
}

export interface MediaPreviewResultResponse {
  jobId?: string;
  status: MediaPreviewResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: MediaPreviewResult;
}

export interface PreviewFrameRequest {
  video: VideoRow;
  mode?: PreviewFrameMode;
}

export interface PreviewFrameResultResponse {
  status: 'complete' | 'invalid_request' | 'error' | string;
  message?: string;
  result?: VideoPreviewFrameResult;
}
