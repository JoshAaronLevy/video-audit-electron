import { stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type {
  AuditOptions,
  AuditProgress,
  AuditSummary,
  AuditError,
  DiscoveredVideoFile
} from '../../shared/types/audit';
import type {
  BlackBorderAdjustment,
  FfprobeResult,
  FfprobeVideoStream,
  VideoRow
} from '../../shared/types/video';
import {
  analyzeBlackBorders,
  getBlackBorderReviewReason,
  isBlackBorderReviewCandidate
} from './blackBorderAnalysisService';
import { discoverVideoFiles } from './fileDiscoveryService';
import { runFfprobe } from './ffprobeService';
import { generateThumbnails } from './mediaPreviewService';

export const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  includeSubfolders: true,
  includeLowResolutionAnalysis: true,
  includeBlackBorderAnalysis: false,
  minHeight: 720,
  targetAspectRatio: 16 / 9,
  aspectRatioTolerance: 0.01
};

export interface RunAuditOptions {
  folderPaths: string[];
  filePaths: string[];
  options: AuditOptions;
  ffprobePath?: string | null;
  ffmpegPath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: Omit<AuditProgress, 'jobId' | 'status'>) => void;
}

export interface AuditServiceResult {
  summary: AuditSummary;
  videos: VideoRow[];
  errors: AuditError[];
}

interface AuditFileInfo {
  directory: string;
  extension: string;
  fileExtension: string;
  fileType: string;
  sizeBytes: number | null;
  sizeMB: number | null;
  sizeGB: number | null;
  createdAt: string;
  modifiedAt: string;
  createdAtMs: number | null;
  modifiedAtMs: number | null;
}

export async function runAudit({
  folderPaths,
  filePaths,
  options,
  ffprobePath,
  ffmpegPath,
  signal,
  onProgress
}: RunAuditOptions): Promise<AuditServiceResult> {
  const auditOptions = normalizeAuditOptions(options);
  const resolvedDirectory = getResolvedDirectoryLabel(folderPaths, filePaths);
  const ffprobeBinaryPath = ffprobePath?.trim() || 'ffprobe';
  const ffmpegBinaryPath = ffmpegPath?.trim() || 'ffmpeg';

  throwIfAborted(signal);
  emitProgress(onProgress, {
    phase: 'validating',
    resolvedDirectory,
    totalFiles: null,
    processedFiles: 0,
    skippedFiles: 0,
    flaggedCount: 0,
    errorCount: 0,
    currentFile: null,
    message: 'Validating audit sources.'
  });

  const discoveryResult = await discoverVideoFiles({
    folderPaths,
    filePaths,
    includeSubfolders: auditOptions.includeSubfolders,
    signal,
    onProgress: (progress) =>
      emitProgress(onProgress, {
        phase: progress.phase,
        resolvedDirectory,
        totalFiles: null,
        processedFiles: progress.processedFiles,
        skippedFiles: progress.skippedFiles,
        flaggedCount: 0,
        errorCount: 0,
        currentFile: progress.currentPath ? basename(progress.currentPath) : null,
        message: progress.message
      })
  });

  const files = discoveryResult.files;
  const flagged: VideoRow[] = [];
  const errors: AuditError[] = [];

  emitProgress(onProgress, {
    phase: 'analyzing',
    resolvedDirectory,
    totalFiles: files.length,
    processedFiles: 0,
    skippedFiles: discoveryResult.skippedFiles,
    flaggedCount: 0,
    errorCount: 0,
    currentFile: null,
    message: files.length === 0 ? 'No matching video files found.' : 'Analyzing videos.'
  });

  for (let index = 0; index < files.length; index += 1) {
    throwIfAborted(signal);

    const file = files[index];

    emitProgress(onProgress, {
      phase: 'analyzing',
      resolvedDirectory,
      totalFiles: files.length,
      processedFiles: index,
      skippedFiles: discoveryResult.skippedFiles,
      flaggedCount: flagged.length,
      errorCount: errors.length,
      currentFile: file.fileName,
      message: 'Analyzing videos.'
    });

    let fileInfo: AuditFileInfo;

    try {
      fileInfo = await getFileInfo(file);
    } catch (error: unknown) {
      errors.push(createAuditError(file, `Failed to read file info: ${getErrorMessage(error)}`));
      emitAnalysisProgress(onProgress, resolvedDirectory, files.length, index + 1, discoveryResult.skippedFiles, flagged, errors, file);
      continue;
    }

    const ffprobeResult = await runFfprobe(file.path, {
      ffprobePath: ffprobeBinaryPath,
      signal
    });

    if (ffprobeResult.canceled) {
      throw createAuditCancelError();
    }

    if (!ffprobeResult.ok || !ffprobeResult.stream) {
      errors.push(createAuditError(file, ffprobeResult.error ?? 'ffprobe failed.', fileInfo));
      emitAnalysisProgress(onProgress, resolvedDirectory, files.length, index + 1, discoveryResult.skippedFiles, flagged, errors, file);
      continue;
    }

    const blackBorder = auditOptions.includeBlackBorderAnalysis
      ? await analyzeVideoBlackBorders({
          file,
          ffprobeResult,
          ffmpegPath: ffmpegBinaryPath,
          signal,
          onProgress,
          resolvedDirectory,
          totalFiles: files.length,
          processedFiles: index,
          skippedFiles: discoveryResult.skippedFiles,
          flagged,
          errors
        })
      : null;

    throwIfAborted(signal);

    const row = buildVideoRow({
      file,
      fileInfo,
      ffprobeResult,
      options: auditOptions,
      blackBorder
    });

    const lowResolutionDetected =
      auditOptions.includeLowResolutionAnalysis &&
      (row.isLowResolution || row.isWrongAspectRatio);

    const blackBorderNeedsReview =
      auditOptions.includeBlackBorderAnalysis && isBlackBorderReviewCandidate(blackBorder);

    if (lowResolutionDetected || blackBorderNeedsReview) {
      const rowWithThumbnail = await addPosterThumbnailToFlaggedRow({
        row,
        ffmpegPath: ffmpegBinaryPath,
        signal,
        onProgress,
        resolvedDirectory,
        totalFiles: files.length,
        processedFiles: index,
        skippedFiles: discoveryResult.skippedFiles,
        flagged,
        errors,
        file
      });

      flagged.push(rowWithThumbnail);
    }

    emitAnalysisProgress(onProgress, resolvedDirectory, files.length, index + 1, discoveryResult.skippedFiles, flagged, errors, file);
  }

  const summary: AuditSummary = {
    directoryPath: resolvedDirectory,
    resolvedDirectory,
    totalFiles: files.length,
    scannedVideos: files.length,
    flaggedCount: flagged.length,
    errorCount: errors.length
  };

  emitProgress(onProgress, {
    phase: 'complete',
    resolvedDirectory,
    totalFiles: files.length,
    processedFiles: files.length,
    skippedFiles: discoveryResult.skippedFiles,
    flaggedCount: flagged.length,
    errorCount: errors.length,
    currentFile: null,
    message: 'Audit complete.'
  });

  return {
    summary,
    videos: flagged,
    errors
  };
}

async function addPosterThumbnailToFlaggedRow({
  row,
  ffmpegPath,
  signal,
  onProgress,
  resolvedDirectory,
  totalFiles,
  processedFiles,
  skippedFiles,
  flagged,
  errors,
  file
}: {
  row: VideoRow;
  ffmpegPath: string;
  signal?: AbortSignal;
  onProgress: RunAuditOptions['onProgress'];
  resolvedDirectory: string | null;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  flagged: VideoRow[];
  errors: AuditError[];
  file: DiscoveredVideoFile;
}): Promise<VideoRow> {
  emitProgress(onProgress, {
    phase: 'analyzing',
    resolvedDirectory,
    totalFiles,
    processedFiles,
    skippedFiles,
    flaggedCount: flagged.length,
    errorCount: errors.length,
    currentFile: file.fileName,
    message: 'Generating thumbnail.'
  });

  try {
    const result = await generateThumbnails({
      videos: [row],
      ffmpegPath,
      signal
    });
    const thumbnail = result.items.find((item) => (item.path ?? item.absolutePath) === row.path)?.thumbnail;

    return thumbnail ? { ...row, thumbnail } : row;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    return {
      ...row,
      thumbnail: {
        generated: false,
        error: getErrorMessage(error)
      }
    };
  }
}

export function normalizeAuditOptions(options: Partial<AuditOptions> | null | undefined): AuditOptions {
  const candidate = options ?? {};

  return {
    includeSubfolders:
      typeof candidate.includeSubfolders === 'boolean'
        ? candidate.includeSubfolders
        : DEFAULT_AUDIT_OPTIONS.includeSubfolders,
    includeLowResolutionAnalysis:
      typeof candidate.includeLowResolutionAnalysis === 'boolean'
        ? candidate.includeLowResolutionAnalysis
        : DEFAULT_AUDIT_OPTIONS.includeLowResolutionAnalysis,
    includeBlackBorderAnalysis:
      typeof candidate.includeBlackBorderAnalysis === 'boolean'
        ? candidate.includeBlackBorderAnalysis
        : DEFAULT_AUDIT_OPTIONS.includeBlackBorderAnalysis,
    minHeight: normalizePositiveNumber(candidate.minHeight, DEFAULT_AUDIT_OPTIONS.minHeight),
    targetAspectRatio: normalizePositiveNumber(
      candidate.targetAspectRatio,
      DEFAULT_AUDIT_OPTIONS.targetAspectRatio
    ),
    aspectRatioTolerance: normalizeNonNegativeNumber(
      candidate.aspectRatioTolerance,
      DEFAULT_AUDIT_OPTIONS.aspectRatioTolerance
    )
  };
}

function emitAnalysisProgress(
  onProgress: RunAuditOptions['onProgress'],
  resolvedDirectory: string | null,
  totalFiles: number,
  processedFiles: number,
  skippedFiles: number,
  flagged: VideoRow[],
  errors: AuditError[],
  file: DiscoveredVideoFile
): void {
  emitProgress(onProgress, {
    phase: 'analyzing',
    resolvedDirectory,
    totalFiles,
    processedFiles,
    skippedFiles,
    flaggedCount: flagged.length,
    errorCount: errors.length,
    currentFile: file.fileName,
    message: 'Analyzing videos.'
  });
}

async function analyzeVideoBlackBorders({
  file,
  ffprobeResult,
  ffmpegPath,
  signal,
  onProgress,
  resolvedDirectory,
  totalFiles,
  processedFiles,
  skippedFiles,
  flagged,
  errors
}: {
  file: DiscoveredVideoFile;
  ffprobeResult: FfprobeResult;
  ffmpegPath: string;
  signal?: AbortSignal;
  onProgress: RunAuditOptions['onProgress'];
  resolvedDirectory: string | null;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  flagged: VideoRow[];
  errors: AuditError[];
}): Promise<BlackBorderAdjustment> {
  const stream = ffprobeResult.stream ?? {};
  const format = ffprobeResult.format ?? {};
  const streamDurationSeconds = safeNumber(stream.duration);
  const formatDurationSeconds = safeNumber(format.duration);

  emitProgress(onProgress, {
    phase: 'analyzing',
    resolvedDirectory,
    totalFiles,
    processedFiles,
    skippedFiles,
    flaggedCount: flagged.length,
    errorCount: errors.length,
    currentFile: file.fileName,
    message: 'Checking black borders.'
  });

  return analyzeBlackBorders({
    filePath: file.path,
    width: safeNumber(stream.width),
    height: safeNumber(stream.height),
    durationSeconds: streamDurationSeconds ?? formatDurationSeconds,
    ffmpegPath,
    signal
  });
}

async function getFileInfo(file: DiscoveredVideoFile): Promise<AuditFileInfo> {
  const fileStats = await stat(file.path);
  const sizeBytes = Number.isFinite(fileStats.size) ? fileStats.size : file.sizeBytes;

  return {
    directory: file.directory,
    extension: file.extension,
    fileExtension: file.extension,
    fileType: file.fileType,
    sizeBytes,
    sizeMB: bytesToMB(sizeBytes),
    sizeGB: bytesToGB(sizeBytes),
    createdAt: toIsoStringOrEmpty(fileStats.birthtime),
    modifiedAt: toIsoStringOrEmpty(fileStats.mtime) || file.modifiedAt || '',
    createdAtMs: Number.isFinite(fileStats.birthtimeMs) ? fileStats.birthtimeMs : null,
    modifiedAtMs: Number.isFinite(fileStats.mtimeMs) ? fileStats.mtimeMs : null
  };
}

function buildVideoRow({
  file,
  fileInfo,
  ffprobeResult,
  options,
  blackBorder
}: {
  file: DiscoveredVideoFile;
  fileInfo: AuditFileInfo;
  ffprobeResult: FfprobeResult;
  options: AuditOptions;
  blackBorder: BlackBorderAdjustment | null;
}): VideoRow {
  const stream = ffprobeResult.stream ?? {};
  const format = ffprobeResult.format ?? {};
  const width = safeNumber(stream.width);
  const height = safeNumber(stream.height);
  const streamDurationSeconds = safeNumber(stream.duration);
  const formatDurationSeconds = safeNumber(format.duration);
  const durationSeconds = streamDurationSeconds ?? formatDurationSeconds;
  const streamBitRate = safeNumber(stream.bit_rate);
  const formatBitRate = safeNumber(format.bit_rate);
  const bitRate = streamBitRate ?? formatBitRate;
  const formatSizeBytes = safeNumber(format.size);
  const sizeBytes = fileInfo.sizeBytes ?? formatSizeBytes;
  const aspectRatio = getEffectiveAspectRatio(stream);
  const isLowResolution = height === null || height < options.minHeight;
  const isWrongAspectRatio = !isApproximatelyTargetAspectRatio(
    aspectRatio,
    options.targetAspectRatio,
    options.aspectRatioTolerance
  );
  const blackBorderReviewReason = getBlackBorderReviewReason(blackBorder);
  const reasons = [
    options.includeLowResolutionAnalysis && isLowResolution
      ? getLowResolutionReason(height, options.minHeight)
      : null,
    options.includeLowResolutionAnalysis && isWrongAspectRatio
      ? getAspectRatioReason(options.targetAspectRatio)
      : null,
    blackBorderReviewReason
  ]
    .filter(Boolean)
    .join('; ');

  return {
    id: file.path,
    displayFile: file.fileName,
    displayDirectory: file.directory,
    path: file.path,
    directory: fileInfo.directory,
    fileName: file.fileName,
    extension: fileInfo.extension,
    fileExtension: fileInfo.fileExtension,
    fileType: fileInfo.fileType,
    sizeBytes,
    sizeMB: bytesToMB(sizeBytes),
    sizeGB: bytesToGB(sizeBytes),
    fileSystemSizeBytes: fileInfo.sizeBytes,
    ffprobeFormatSizeBytes: formatSizeBytes,
    createdAt: fileInfo.createdAt,
    modifiedAt: fileInfo.modifiedAt,
    createdAtMs: fileInfo.createdAtMs,
    modifiedAtMs: fileInfo.modifiedAtMs,
    durationSeconds: durationSeconds === null ? null : Number(durationSeconds.toFixed(3)),
    durationFormatted: formatDuration(durationSeconds),
    streamDurationSeconds:
      streamDurationSeconds === null ? null : Number(streamDurationSeconds.toFixed(3)),
    formatDurationSeconds:
      formatDurationSeconds === null ? null : Number(formatDurationSeconds.toFixed(3)),
    width,
    height,
    resolution: width && height ? `${width}x${height}` : '',
    displayAspectRatio: stream.display_aspect_ratio || '',
    sampleAspectRatio: stream.sample_aspect_ratio || '',
    calculatedAspectRatio: aspectRatio ? Number(aspectRatio.toFixed(6)) : null,
    targetAspectRatio: formatTargetAspectRatio(options.targetAspectRatio),
    codecName: stream.codec_name || '',
    codecLongName: stream.codec_long_name || '',
    profile: stream.profile || '',
    pixFmt: stream.pix_fmt || '',
    level: safeNumber(stream.level),
    bitRate,
    bitRateMbps: bitRateToMbps(bitRate),
    streamBitRate,
    formatBitRate,
    avgFrameRate: stream.avg_frame_rate || '',
    rawFrameRate: stream.r_frame_rate || '',
    frameRate: parseFrameRate(stream.avg_frame_rate || stream.r_frame_rate),
    nbFrames: safeNumber(stream.nb_frames),
    formatName: format.format_name || '',
    formatLongName: format.format_long_name || '',
    isLowResolution,
    isWrongAspectRatio,
    reasons,
    status: 'Pending',
    visible: true,
    sourceSizeBytes: fileInfo.sizeBytes,
    ...(blackBorder
      ? {
          adjustments: {
            blackBorder
          }
        }
      : {})
  };
}

function createAuditError(
  file: DiscoveredVideoFile,
  error: string,
  fileInfo?: AuditFileInfo
): AuditError {
  return {
    path: file.path,
    fileName: file.fileName,
    directory: file.directory,
    extension: file.extension,
    fileExtension: file.extension,
    fileType: file.fileType,
    sizeBytes: fileInfo?.sizeBytes ?? file.sizeBytes,
    createdAt: fileInfo?.createdAt,
    modifiedAt: fileInfo?.modifiedAt ?? file.modifiedAt ?? undefined,
    error
  };
}

export function getEffectiveAspectRatio(stream: FfprobeVideoStream): number | null {
  const displayAspectRatio = parseRatioString(stream.display_aspect_ratio);

  if (displayAspectRatio) {
    return displayAspectRatio;
  }

  const width = safeNumber(stream.width);
  const height = safeNumber(stream.height);

  if (!width || !height) {
    return null;
  }

  const sampleAspectRatio = parseRatioString(stream.sample_aspect_ratio) || 1;

  return (width / height) * sampleAspectRatio;
}

function parseRatioString(value: unknown): number | null {
  if (!value || typeof value !== 'string' || value === '0:1') {
    return null;
  }

  const [left, right] = value.split(':').map(Number);

  if (!left || !right) {
    return null;
  }

  return left / right;
}

function isApproximatelyTargetAspectRatio(
  ratio: number | null,
  targetAspectRatio: number,
  tolerance: number
): boolean {
  if (!ratio) {
    return false;
  }

  return Math.abs(ratio - targetAspectRatio) <= tolerance;
}

function getLowResolutionReason(height: number | null, minHeight: number): string {
  return height === null ? 'height missing' : `height below ${minHeight}`;
}

function getAspectRatioReason(targetAspectRatio: number): string {
  return targetAspectRatio === DEFAULT_AUDIT_OPTIONS.targetAspectRatio
    ? 'not 16:9 aspect ratio'
    : `not ${formatTargetAspectRatio(targetAspectRatio)} aspect ratio`;
}

function formatTargetAspectRatio(targetAspectRatio: number): string {
  if (Math.abs(targetAspectRatio - DEFAULT_AUDIT_OPTIONS.targetAspectRatio) < 0.000001) {
    return '16:9';
  }

  return String(Number(targetAspectRatio.toFixed(6)));
}

function safeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bytesToMB(bytes: number | null | undefined): number | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
    return null;
  }

  return Number((bytes / 1024 / 1024).toFixed(2));
}

function bytesToGB(bytes: number | null | undefined): number | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
    return null;
  }

  return Number((bytes / 1024 / 1024 / 1024).toFixed(3));
}

function bitRateToMbps(bitRate: number | null): number | null {
  if (bitRate === null) {
    return null;
  }

  return Number((bitRate / 1_000_000).toFixed(3));
}

function parseFrameRate(value: unknown): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [numerator, denominator] = value.split('/').map(Number);

  if (!numerator || !denominator) {
    return null;
  }

  return Number((numerator / denominator).toFixed(3));
}

function formatDuration(seconds: number | null): string {
  const value = safeNumber(seconds);

  if (value === null) {
    return '';
  }

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function toIsoStringOrEmpty(value: Date): string {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? value.toISOString() : '';
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function getResolvedDirectoryLabel(folderPaths: string[], filePaths: string[]): string | null {
  if (folderPaths.length === 1 && filePaths.length === 0) {
    return folderPaths[0];
  }

  if (folderPaths.length > 0) {
    return folderPaths[0];
  }

  return filePaths.length > 0 ? 'Selected files' : null;
}

function emitProgress(
  onProgress: RunAuditOptions['onProgress'],
  progress: Omit<AuditProgress, 'jobId' | 'status'>
): void {
  onProgress?.(progress);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAuditCancelError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createAuditCancelError(): Error {
  const error = new Error('Audit canceled.');
  error.name = 'AbortError';
  return error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
