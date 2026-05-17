import { spawn } from 'node:child_process';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, parse, resolve } from 'node:path';
import type {
  AutoFixAction,
  AutoFixProfileId,
  AutoFixProgress,
  AutoFixRequest,
  AutoFixResult,
  AutoFixResultItem
} from '../../shared/types/autoFix';
import type { CropRectangle, VideoRow } from '../../shared/types/video';
import { isSupportedVideoExtension, normalizeVideoExtension } from '../../shared/constants/videoExtensions';

const NORMALIZE_FILTER =
  'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,setdar=16/9';
const MIN_VISIBLE_WIDTH = 640;
const MIN_VISIBLE_HEIGHT = 360;
const ASPECT_RATIO_16_9 = 16 / 9;
const AUTO_CROP_ASPECT_TOLERANCE = 0.03;

const HIGH_QUALITY_PROFILE = Object.freeze({
  id: 'high-quality' satisfies AutoFixProfileId,
  label: 'High quality normalize',
  preset: 'medium',
  crf: '18'
});

const STANDARD_PROFILE = Object.freeze({
  id: 'standard' satisfies AutoFixProfileId,
  label: 'Standard normalize',
  preset: 'fast',
  crf: '20'
});

interface ValidAutoFixRequest {
  videos: VideoRow[];
  outputDirectory: string;
}

interface AutoFixProfile {
  id: AutoFixProfileId;
  label: string;
  preset: string;
  crf: string;
}

interface AutoFixCrop {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface VideoValidationResult {
  ok: boolean;
  sourcePath: string;
  fileName: string;
  sourceSizeBytes?: number;
  error?: string;
}

export async function validateAutoFixRequest(
  request: Partial<AutoFixRequest> | null | undefined
): Promise<{ ok: true; request: ValidAutoFixRequest } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Auto-Fix request is required.'
    };
  }

  if (!Array.isArray(request.videos) || request.videos.length === 0) {
    return {
      ok: false,
      error: 'Select at least one video before running Auto-Fix.'
    };
  }

  const outputDirectory = normalizePathString(request.outputDirectory);

  if (!outputDirectory || !isAbsolute(outputDirectory)) {
    return {
      ok: false,
      error: 'Choose an absolute output folder before running Auto-Fix.'
    };
  }

  try {
    await mkdir(outputDirectory, { recursive: true });
    const outputStats = await stat(outputDirectory);

    if (!outputStats.isDirectory()) {
      return {
        ok: false,
        error: 'Auto-Fix output path must be a folder.'
      };
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: `Unable to create output folder: ${getErrorMessage(error)}`
    };
  }

  return {
    ok: true,
    request: {
      videos: request.videos,
      outputDirectory
    }
  };
}

export async function runAutoFix({
  videos,
  outputDirectory,
  ffmpegPath,
  signal,
  onProgress
}: ValidAutoFixRequest & {
  ffmpegPath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: Omit<AutoFixProgress, 'jobId' | 'status'>) => void;
}): Promise<Omit<AutoFixResult, 'jobId' | 'status'>> {
  assertNotCanceled(signal);
  await mkdir(outputDirectory, { recursive: true });

  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';
  const items: AutoFixResultItem[] = [];
  const summary: AutoFixResult['summary'] = {
    requested: videos.length,
    succeeded: 0,
    failed: 0,
    standardProfileCount: 0,
    highQualityProfileCount: 0,
    croppedCount: 0,
    normalizedOnlyCount: 0
  };

  emitProgress(onProgress, {
    phase: 'normalizing',
    totalVideos: videos.length,
    processedVideos: 0,
    succeeded: 0,
    failed: 0,
    currentFile: null,
    currentProfile: null,
    currentAction: null,
    message: 'Auto-Fix started.',
    outputDirectory
  });

  for (let index = 0; index < videos.length; index += 1) {
    assertNotCanceled(signal);

    const video = videos[index];
    const startedAt = nowIsoString();
    const validation = await validateAutoFixVideo(video);
    const { sourcePath, fileName } = validation;

    if (!validation.ok) {
      summary.failed += 1;
      items.push(
        createFailedItem({
          video,
          sourcePath,
          fileName,
          outputPath: null,
          error: validation.error ?? 'Video could not be processed.',
          startedAt
        })
      );
      emitProgress(onProgress, {
        phase: 'normalizing',
        totalVideos: videos.length,
        processedVideos: index + 1,
        succeeded: summary.succeeded,
        failed: summary.failed,
        currentFile: fileName,
        currentProfile: null,
        currentAction: null,
        message: validation.error ?? 'Video could not be processed.',
        outputDirectory
      });
      continue;
    }

    const profile = chooseNormalizeProfile(video);
    const crop = getSafeCrop(video);
    const filter = buildFfmpegFilter(crop);
    const action: AutoFixAction = crop ? 'crop-normalize' : 'normalize';
    const outputPath = await createSafeOutputPath({
      sourcePath,
      fileName,
      outputDirectory
    });
    const outputFileName = basename(outputPath);

    if (profile.id === STANDARD_PROFILE.id) {
      summary.standardProfileCount += 1;
    } else {
      summary.highQualityProfileCount += 1;
    }

    if (crop) {
      summary.croppedCount += 1;
    } else {
      summary.normalizedOnlyCount += 1;
    }

    emitProgress(onProgress, {
      phase: 'normalizing',
      totalVideos: videos.length,
      processedVideos: index,
      succeeded: summary.succeeded,
      failed: summary.failed,
      currentFile: fileName,
      currentProfile: profile.id,
      currentAction: action,
      message: `Auto-fixing ${fileName}.`,
      outputDirectory
    });

    const item: AutoFixResultItem = {
      id: typeof video.id === 'string' ? video.id : null,
      sourcePath,
      outputPath,
      fileName,
      outputFileName,
      status: 'running',
      profileId: profile.id,
      profileLabel: profile.label,
      cropped: Boolean(crop),
      crop,
      action,
      filter,
      sourceSizeBytes: validation.sourceSizeBytes ?? null,
      outputSizeBytes: null,
      outputExtensionConverted: extname(fileName).toLowerCase() !== '.mp4',
      startedAt,
      completedAt: null,
      error: null
    };

    items.push(item);

    const result = await runFfmpegAutoFix({
      inputPath: sourcePath,
      outputPath,
      filter,
      profile,
      ffmpegPath: binaryPath,
      signal
    });

    if (result.canceled) {
      await removePartialOutput(outputPath);
      throw createAutoFixCancelError();
    }

    item.completedAt = nowIsoString();

    if (result.ok) {
      const outputStats = await stat(outputPath).catch(() => null);
      item.status = 'success';
      item.outputSizeBytes = outputStats?.size ?? null;
      summary.succeeded += 1;
    } else {
      await removePartialOutput(outputPath);
      item.status = 'failed';
      item.error = result.error ?? 'Auto-Fix failed.';
      summary.failed += 1;
    }

    emitProgress(onProgress, {
      phase: 'normalizing',
      totalVideos: videos.length,
      processedVideos: index + 1,
      succeeded: summary.succeeded,
      failed: summary.failed,
      currentFile: fileName,
      currentProfile: profile.id,
      currentAction: action,
      message: result.ok ? 'Auto-Fix output written.' : 'Auto-Fix failed.',
      outputDirectory
    });
  }

  emitProgress(onProgress, {
    phase: 'complete',
    totalVideos: videos.length,
    processedVideos: videos.length,
    succeeded: summary.succeeded,
    failed: summary.failed,
    currentFile: null,
    currentProfile: null,
    currentAction: null,
    message: 'Auto-Fix complete.',
    outputDirectory
  });

  return {
    outputDirectory,
    summary,
    items
  };
}

function chooseNormalizeProfile(video: VideoRow): AutoFixProfile {
  const width = readFiniteNumber(video.width);
  const height = readFiniteNumber(video.height);
  const bitRate = getBitRate(video);

  if (height !== null && height < 720) {
    return STANDARD_PROFILE;
  }

  if (width !== null && width < 1280) {
    return STANDARD_PROFILE;
  }

  if (bitRate !== null) {
    if (height !== null && height >= 1000 && bitRate < 3_000_000) {
      return STANDARD_PROFILE;
    }

    if (height !== null && height >= 700 && height < 1000 && bitRate < 1_500_000) {
      return STANDARD_PROFILE;
    }
  }

  return HIGH_QUALITY_PROFILE;
}

function getBitRate(video: VideoRow): number | null {
  const directBitRate =
    readFiniteNumber(video.bitRate) ??
    readFiniteNumber(video.formatBitRate) ??
    readFiniteNumber(video.streamBitRate);

  if (directBitRate !== null) {
    return directBitRate;
  }

  const bitRateMbps = readFiniteNumber(video.bitRateMbps);
  return bitRateMbps === null ? null : bitRateMbps * 1_000_000;
}

function getSafeCrop(video: VideoRow): AutoFixCrop | null {
  const blackBorder = video.adjustments?.blackBorder;
  const visibleArea = blackBorder?.visibleArea;
  const recommendedFix = blackBorder?.recommendedFix;

  if (
    blackBorder?.classification !== 'nested_borders' ||
    blackBorder.confidence !== 'high' ||
    recommendedFix?.eligible !== true ||
    recommendedFix.type !== 'crop-scale'
  ) {
    return null;
  }

  const crop = normalizeCrop(visibleArea);

  if (!crop) {
    return null;
  }

  if (crop.width < MIN_VISIBLE_WIDTH || crop.height < MIN_VISIBLE_HEIGHT) {
    return null;
  }

  const visibleAspectRatio = crop.width / crop.height;

  if (Math.abs(visibleAspectRatio - ASPECT_RATIO_16_9) > AUTO_CROP_ASPECT_TOLERANCE) {
    return null;
  }

  const sourceWidth = readFiniteNumber(blackBorder.source?.width) ?? readFiniteNumber(video.width);
  const sourceHeight = readFiniteNumber(blackBorder.source?.height) ?? readFiniteNumber(video.height);

  if (!cropFitsSource({ crop, sourceWidth, sourceHeight })) {
    return null;
  }

  return crop;
}

function buildFfmpegFilter(crop: AutoFixCrop | null): string {
  if (!crop) {
    return NORMALIZE_FILTER;
  }

  return `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},${NORMALIZE_FILTER}`;
}

async function validateAutoFixVideo(video: VideoRow): Promise<VideoValidationResult> {
  const sourcePath = normalizePathString(video.path);
  const fileName = getOriginalFileName(video, sourcePath);

  if (!sourcePath || !isAbsolute(sourcePath)) {
    return {
      ok: false,
      sourcePath,
      fileName,
      error: 'Video must include an absolute source path.'
    };
  }

  const sourceStats = await stat(sourcePath).catch(() => null);

  if (!sourceStats) {
    return {
      ok: false,
      sourcePath,
      fileName,
      error: 'Source video does not exist or is unreadable.'
    };
  }

  if (!sourceStats.isFile()) {
    return {
      ok: false,
      sourcePath,
      fileName,
      error: 'Source path must point to a file.'
    };
  }

  if (!isSupportedVideoExtension(normalizeVideoExtension(sourcePath))) {
    return {
      ok: false,
      sourcePath,
      fileName,
      error: 'Unsupported video file extension.'
    };
  }

  return {
    ok: true,
    sourcePath,
    fileName,
    sourceSizeBytes: sourceStats.size
  };
}

async function createSafeOutputPath({
  sourcePath,
  fileName,
  outputDirectory
}: {
  sourcePath: string;
  fileName: string;
  outputDirectory: string;
}): Promise<string> {
  const parsed = parse(fileName || basename(sourcePath));
  const baseName = parsed.name || basename(sourcePath, extname(sourcePath));
  const firstCandidates = [`${baseName}.mp4`, `${baseName}-fixed.mp4`];

  for (const candidateName of firstCandidates) {
    const candidate = join(outputDirectory, candidateName);

    if (resolve(candidate) === resolve(sourcePath)) {
      continue;
    }

    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = join(outputDirectory, `${baseName}-fixed-${index}.mp4`);

    if (resolve(candidate) === resolve(sourcePath)) {
      continue;
    }

    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error('Unable to find a safe unused Auto-Fix output path.');
}

async function runFfmpegAutoFix({
  inputPath,
  outputPath,
  filter,
  profile,
  ffmpegPath,
  signal
}: {
  inputPath: string;
  outputPath: string;
  filter: string;
  profile: AutoFixProfile;
  ffmpegPath: string;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({
        ok: false,
        canceled: true,
        error: 'Auto-Fix canceled.'
      });
      return;
    }

    const args = [
      '-hide_banner',
      '-nostdin',
      '-n',
      '-i',
      inputPath,
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-preset',
      profile.preset,
      '-crf',
      profile.crf,
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      outputPath
    ];
    const child = spawn(ffmpegPath, args);
    let stderr = '';
    let didCancel = false;
    let didSettle = false;
    let forceKillTimeout: NodeJS.Timeout | null = null;

    const settle = (result: { ok: boolean; canceled?: boolean; error?: string }): void => {
      if (didSettle) {
        return;
      }

      didSettle = true;

      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }

      signal?.removeEventListener('abort', handleAbort);
      resolveResult(result);
    };

    const handleAbort = (): void => {
      didCancel = true;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        if (!didSettle) {
          child.kill('SIGKILL');
        }
      }, 5000);
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      settle({
        ok: false,
        error: error.message
      });
    });

    child.on('close', (code) => {
      if (didCancel || signal?.aborted) {
        settle({
          ok: false,
          canceled: true,
          error: 'Auto-Fix canceled.'
        });
        return;
      }

      if (code !== 0) {
        settle({
          ok: false,
          error: getConciseFfmpegError(stderr, code)
        });
        return;
      }

      settle({
        ok: true
      });
    });
  });
}

function normalizeCrop(visibleArea: CropRectangle | undefined): AutoFixCrop | null {
  if (!visibleArea) {
    return null;
  }

  const width = readFiniteNumber(visibleArea.width);
  const height = readFiniteNumber(visibleArea.height);
  const x = readFiniteNumber(visibleArea.x);
  const y = readFiniteNumber(visibleArea.y);

  if (
    width === null ||
    height === null ||
    x === null ||
    y === null ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0
  ) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y)
  };
}

function cropFitsSource({
  crop,
  sourceWidth,
  sourceHeight
}: {
  crop: AutoFixCrop;
  sourceWidth: number | null;
  sourceHeight: number | null;
}): boolean {
  if (sourceWidth === null || sourceHeight === null) {
    return true;
  }

  return crop.x + crop.width <= sourceWidth && crop.y + crop.height <= sourceHeight;
}

function createFailedItem({
  video,
  sourcePath,
  fileName,
  outputPath,
  error,
  startedAt
}: {
  video: VideoRow;
  sourcePath: string;
  fileName: string;
  outputPath: string | null;
  error: string;
  startedAt: string;
}): AutoFixResultItem {
  return {
    id: typeof video.id === 'string' ? video.id : null,
    sourcePath: sourcePath || null,
    outputPath,
    fileName,
    outputFileName: outputPath ? basename(outputPath) : null,
    status: 'failed',
    profileId: null,
    profileLabel: null,
    cropped: false,
    action: null,
    crop: null,
    filter: null,
    startedAt,
    completedAt: nowIsoString(),
    error
  };
}

function getOriginalFileName(video: VideoRow, sourcePath: string): string {
  const candidates = [video.fileName, video.displayFile, sourcePath ? basename(sourcePath) : ''];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const fileName = basename(candidate.trim().replace(/\\/g, '/'));

    if (fileName && fileName !== '.' && fileName !== '/') {
      return fileName;
    }
  }

  return 'video.mp4';
}

function getConciseFfmpegError(stderr: unknown, code: number | null): string {
  const lines = String(stderr || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const usefulLine = [...lines]
    .reverse()
    .find((line) => !line.startsWith('frame=') && !line.startsWith('size='));

  return usefulLine || `FFmpeg exited with code ${code ?? 'unknown'}.`;
}

async function removePartialOutput(outputPath: string): Promise<void> {
  await unlink(outputPath).catch(() => undefined);
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

function emitProgress(
  onProgress: ((progress: Omit<AutoFixProgress, 'jobId' | 'status'>) => void) | undefined,
  progress: Omit<AutoFixProgress, 'jobId' | 'status'>
): void {
  onProgress?.(progress);
}

function normalizePathString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function assertNotCanceled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAutoFixCancelError();
  }
}

export function createAutoFixCancelError(): Error {
  const error = new Error('Auto-Fix canceled.');
  error.name = 'AbortError';
  return error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
