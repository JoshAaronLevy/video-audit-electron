import type {
  MediaPreviewJobSnapshot,
  MediaPreviewProgress,
  MediaPreviewRequest,
  MediaPreviewResult,
  MediaPreviewResultItem,
  MediaPreviewResultResponse,
  MediaPreviewScope,
  MediaPreviewStartResponse,
  PreviewFrameRequest as MediaPreviewFrameRequest,
  PreviewFrameResultResponse
} from './mediaPreview';
import type { VideoPreviewFrameResult } from './video';

export type ThumbnailScope = MediaPreviewScope;

export type ThumbnailRequest = MediaPreviewRequest & {
  scope?: ThumbnailScope;
};

export type ThumbnailProgress = MediaPreviewProgress;

export type ThumbnailJobSnapshot = MediaPreviewJobSnapshot;

export type ThumbnailStartResponse = MediaPreviewStartResponse;

export type ThumbnailResultItem = MediaPreviewResultItem;

export type ThumbnailResult = MediaPreviewResult;

export type ThumbnailResultResponse = MediaPreviewResultResponse;

export type PreviewFrameRequest = MediaPreviewFrameRequest;

export type PreviewFrameResult = VideoPreviewFrameResult;

export type PreviewFrameResponse = PreviewFrameResultResponse;
