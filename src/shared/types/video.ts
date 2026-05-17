export type VideoStatus = 'Pending' | 'Queued' | 'Completed' | 'Dismissed';

export type BlackBorderClassification =
  | 'clean'
  | 'pillarboxed'
  | 'letterboxed'
  | 'nested_borders'
  | 'asymmetric_border'
  | 'uncertain'
  | 'analysis_error';

export type BlackBorderConfidence = 'high' | 'medium' | 'low' | null;

export interface AspectRatioBox {
  width: number;
  height: number;
  aspectRatio: number;
  aspectRatioLabel: string;
}

export interface CropRectangle extends AspectRatioBox {
  x: number;
  y: number;
}

export interface BorderPixels {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BorderPercent extends BorderPixels {
  blackFrameEstimate: number;
}

export interface BlackBorderRecommendedFix {
  eligible: boolean;
  type: 'crop-scale' | 'manual-review' | 'none';
  targetWidth?: number;
  targetHeight?: number;
  reason?: string;
}

export interface BlackBorderAdjustment {
  analyzed: boolean;
  detected: boolean;
  classification: BlackBorderClassification;
  confidence: BlackBorderConfidence;
  source?: AspectRatioBox;
  visibleArea?: CropRectangle;
  borders?: BorderPixels;
  borderPercent?: BorderPercent;
  recommendedFix?: BlackBorderRecommendedFix;
  error?: string;
}

export interface VideoAdjustments {
  blackBorder?: BlackBorderAdjustment;
}

export interface VideoThumbnail {
  generated: boolean;
  cached?: boolean;
  fileName?: string;
  url?: string;
  path?: string;
  timestampSeconds?: number;
  error?: string;
}

export interface VideoPreviewFrame {
  index: number;
  timestampSeconds: number;
  timestampLabel: string;
  batchId: string;
  thumbnail: VideoThumbnail;
}

export interface VideoPreviewFrameResult {
  durationSeconds: number | null;
  maxPreviewFrameCount: number;
  mode: 'additional' | 'fresh';
  batchId: string;
  summary: {
    requested: number;
    existing: number;
    generated: number;
    cached: number;
    failed: number;
    returned: number;
  };
  frames: VideoPreviewFrame[];
}

export interface VideoMetadata {
  durationSeconds: number | null;
  durationFormatted?: string;
  width: number | null;
  height: number | null;
  resolution: string;
  displayAspectRatio: string;
  sampleAspectRatio: string;
  calculatedAspectRatio: number | null;
  targetAspectRatio: string;
  codecName: string;
  codecLongName: string;
  profile: string;
  pixFmt: string;
  level: number | null;
  bitRate: number | null;
  bitRateMbps: number | null;
  streamBitRate: number | null;
  formatBitRate: number | null;
  avgFrameRate: string;
  rawFrameRate: string;
  frameRate: number | null;
  nbFrames: number | null;
  formatName: string;
  formatLongName: string;
}

export interface VideoRow extends VideoMetadata {
  id?: string;
  displayFile: string;
  displayDirectory: string;
  path: string;
  directory: string;
  fileName: string;
  extension: string;
  fileExtension: string;
  fileType: string;
  sizeBytes: number | null;
  sizeMB: number | null;
  sizeGB: number | null;
  fileSystemSizeBytes: number | null;
  ffprobeFormatSizeBytes: number | null;
  createdAt: string;
  modifiedAt: string;
  createdAtMs?: number | null;
  modifiedAtMs?: number | null;
  streamDurationSeconds?: number | null;
  formatDurationSeconds?: number | null;
  isLowResolution: boolean;
  isWrongAspectRatio: boolean;
  reasons: string;
  status: VideoStatus;
  visible: boolean;
  sourceSizeBytes?: number | null;
  adjustments?: VideoAdjustments;
  thumbnail?: VideoThumbnail;
  previewFrames?: VideoPreviewFrame[];
  previewFrameBatchId?: string;
  maxPreviewFrameCount?: number;
}

export interface SelectedVideoRow {
  id?: string;
  fileName: string;
  absolutePath: string;
  path: string;
  directory: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  displayAspectRatio: string;
  frameRate: number | null;
  adjustments?: VideoAdjustments;
}

export interface StoredVideoData {
  fileName: string | null;
  payload: string | null;
  rows: VideoRow[];
}

export interface FfprobeVideoStream {
  index?: number;
  codec_name?: string;
  codec_long_name?: string;
  codec_type?: string;
  profile?: string;
  pix_fmt?: string;
  level?: number | string;
  width?: number;
  height?: number;
  display_aspect_ratio?: string;
  sample_aspect_ratio?: string;
  duration?: number | string;
  bit_rate?: number | string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  nb_frames?: number | string;
}

export interface FfprobeFormat {
  filename?: string;
  nb_streams?: number;
  format_name?: string;
  format_long_name?: string;
  duration?: number | string;
  size?: number | string;
  bit_rate?: number | string;
}

export interface FfprobeResult {
  path: string;
  ok: boolean;
  stream?: FfprobeVideoStream;
  format?: FfprobeFormat;
  error?: string;
  canceled?: boolean;
}
