import { spawn } from 'node:child_process';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type {
  AutoCropProgress,
  AutoCropRequest,
  AutoCropResult,
  AutoCropResultItem
} from '../../shared/types/autoCrop';
import type { CropRectangle, VideoRow } from '../../shared/types/video';

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;
const MIN_VISIBLE_WIDTH = 640;
const MIN_VISIBLE_HEIGHT = 360;
const ASPECT_RATIO_16_9 = 16 / 9;
const AUTO_CROP_ASPECT_TOLERANCE = 0.03;

interface ValidAutoCropRequest {
  videos: VideoRow[];
  outputRootDir: string;
}

interface AutoCropRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface VideoPreparationResult {
  ok: boolean;
  sourcePath: string;
  fileName: string;
  sourceSizeBytes: number | null;
  crop: AutoCropRect | null;
  skipReason?: string;
  error?: string;
}

interface AutoCropManifest {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  completedAt: string | null;
  mode: 'ffmpeg-auto-crop';
  outputDir: string;
  summary: AutoCropResult['summary'];
  items: AutoCropResultItem[];
}

export async function validateAutoCropRequest(
  request: Partial<AutoCropRequest> | null | undefined
): Promise<{ ok: true; request: ValidAutoCropRequest } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Auto-Crop request is required.'
    };
  }

  if (!Array.isArray(request.videos) || request.videos.length === 0) {
    return {
      ok: false,
      error: 'Select at least one video before running Auto-Crop.'
    };
  }

  const outputRootDir = normalizePathString(request.outputRootDir);

  if (!outputRootDir || !isAbsolute(outputRootDir)) {
    return {
      ok: false,
      error: 'Choose an absolute output folder before running Auto-Crop.'
    };
  }

  try {
    await mkdir(outputRootDir, { recursive: true });
    const outputStats = await stat(outputRootDir);

    if (!outputStats.isDirectory()) {
      return {
        ok: false,
        error: 'Auto-Crop output path must be a folder.'
      };
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: `Unable to create Auto-Crop output folder: ${getErrorMessage(error)}`
    };
  }

  return {
    ok: true,
    request: {
      videos: request.videos,
      outputRootDir
    }
  };
}

export async function runAutoCrop({
  videos,
  outputRootDir,
  ffmpegPath,
  signal,
  onProgress
}: ValidAutoCropRequest & {
  ffmpegPath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: Omit<AutoCropProgress, 'jobId' | 'status'>) => void;
}): Promise<Omit<AutoCropResult, 'jobId' | 'status'>> {
  assertNotCanceled(signal);
  await mkdir(outputRootDir, { recursive: true });

  const outputDir = outputRootDir;
  const manifestInProgressPath = join(outputDir, 'manifest.in-progress.json');
  const manifestPath = join(outputDir, 'manifest.json');
  const manifest: AutoCropManifest = {
    schemaVersion: 1,
    runId: 'auto-crop',
    createdAt: nowIsoString(),
    completedAt: null,
    mode: 'ffmpeg-auto-crop',
    outputDir,
    summary: {
      requested: videos.length,
      eligible: 0,
      skipped: 0,
      succeeded: 0,
      failed: 0,
      sourceBytes: 0,
      outputBytes: 0
    },
    items: []
  };
  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';

  await writeManifest(manifestInProgressPath, manifest);
  emitProgress(onProgress, {
    phase: 'cropping',
    outputRootDir,
    outputDir,
    totalFiles: videos.length,
    processedFiles: 0,
    succeededCount: 0,
    skippedCount: 0,
    errorCount: 0,
    currentFile: null,
    message: 'Cropping selected videos.'
  });

  for (let index = 0; index < videos.length; index += 1) {
    assertNotCanceled(signal);

    const video = videos[index];
    const startedAt = nowIsoString();
    const prepared = await prepareAutoCropVideo(video);

    if (prepared.sourceSizeBytes) {
      manifest.summary.sourceBytes = (manifest.summary.sourceBytes ?? 0) + prepared.sourceSizeBytes;
    }

    emitProgress(onProgress, {
      phase: 'cropping',
      outputRootDir,
      outputDir,
      totalFiles: videos.length,
      processedFiles: index,
      succeededCount: manifest.summary.succeeded,
      skippedCount: manifest.summary.skipped,
      errorCount: manifest.summary.failed,
      currentFile: prepared.fileName,
      message: 'Cropping selected videos.'
    });

    if (!prepared.ok) {
      manifest.summary.failed += 1;
      manifest.items.push(
        createResultItem({
          fileName: prepared.fileName,
          sourcePath: prepared.sourcePath,
          outputPath: null,
          status: 'failed',
          crop: null,
          ffmpegFilter: null,
          sourceSizeBytes: prepared.sourceSizeBytes,
          outputSizeBytes: null,
          startedAt,
          completedAt: nowIsoString(),
          error: prepared.error ?? 'Video could not be processed.'
        })
      );
      await writeManifest(manifestInProgressPath, manifest);
      emitProgress(onProgress, {
        phase: 'cropping',
        outputRootDir,
        outputDir,
        totalFiles: videos.length,
        processedFiles: index + 1,
        succeededCount: manifest.summary.succeeded,
        skippedCount: manifest.summary.skipped,
        errorCount: manifest.summary.failed,
        currentFile: prepared.fileName,
        message: prepared.error ?? 'Auto-Crop failed.'
      });
      continue;
    }

    if (!prepared.crop) {
      manifest.summary.skipped += 1;
      manifest.items.push(
        createResultItem({
          fileName: prepared.fileName,
          sourcePath: prepared.sourcePath,
          outputPath: null,
          status: 'skipped',
          crop: null,
          ffmpegFilter: null,
          sourceSizeBytes: prepared.sourceSizeBytes,
          outputSizeBytes: null,
          startedAt,
          completedAt: nowIsoString(),
          error: prepared.skipReason ?? 'Video is not an Auto-Crop candidate.'
        })
      );
      await writeManifest(manifestInProgressPath, manifest);
      emitProgress(onProgress, {
        phase: 'cropping',
        outputRootDir,
        outputDir,
        totalFiles: videos.length,
        processedFiles: index + 1,
        succeededCount: manifest.summary.succeeded,
        skippedCount: manifest.summary.skipped,
        errorCount: manifest.summary.failed,
        currentFile: prepared.fileName,
        message: 'Skipped ineligible video.'
      });
      continue;
    }

    manifest.summary.eligible += 1;

    let outputPath: string;

    try {
      outputPath = await getOutputPath({
        outputRootDir,
        fileName: prepared.fileName,
        sourcePath: prepared.sourcePath
      });
    } catch (error: unknown) {
      manifest.summary.failed += 1;
      manifest.items.push(
        createResultItem({
          fileName: prepared.fileName,
          sourcePath: prepared.sourcePath,
          outputPath: null,
          status: 'failed',
          crop: prepared.crop,
          ffmpegFilter: null,
          sourceSizeBytes: prepared.sourceSizeBytes,
          outputSizeBytes: null,
          startedAt,
          completedAt: nowIsoString(),
          error: getErrorMessage(error)
        })
      );
      await writeManifest(manifestInProgressPath, manifest);
      emitProgress(onProgress, {
        phase: 'cropping',
        outputRootDir,
        outputDir,
        totalFiles: videos.length,
        processedFiles: index + 1,
        succeededCount: manifest.summary.succeeded,
        skippedCount: manifest.summary.skipped,
        errorCount: manifest.summary.failed,
        currentFile: prepared.fileName,
        message: 'Auto-Crop output path could not be prepared.'
      });
      continue;
    }

    const target = { width: TARGET_WIDTH, height: TARGET_HEIGHT };
    const ffmpegFilter = buildFfmpegFilter({ crop: prepared.crop, target });
    const item = createResultItem({
      fileName: prepared.fileName,
      sourcePath: prepared.sourcePath,
      outputPath,
      status: 'running',
      crop: prepared.crop,
      ffmpegFilter,
      sourceSizeBytes: prepared.sourceSizeBytes,
      outputSizeBytes: null,
      startedAt,
      completedAt: null,
      error: null
    });

    manifest.items.push(item);
    await writeManifest(manifestInProgressPath, manifest);

    const result = await runFfmpegCrop({
      inputPath: prepared.sourcePath,
      outputPath,
      filter: ffmpegFilter,
      ffmpegPath: binaryPath,
      signal
    });

    if (result.canceled) {
      await removePartialOutput(outputPath);
      throw createAutoCropCancelError();
    }

    item.completedAt = nowIsoString();

    if (result.ok) {
      const outputStats = await stat(outputPath).catch(() => null);
      item.status = 'success';
      item.outputSizeBytes = outputStats?.size ?? null;
      manifest.summary.succeeded += 1;
      manifest.summary.outputBytes = (manifest.summary.outputBytes ?? 0) + (item.outputSizeBytes ?? 0);
    } else {
      await removePartialOutput(outputPath);
      item.status = 'failed';
      item.error = result.error ?? 'Auto-Crop failed.';
      manifest.summary.failed += 1;
    }

    await writeManifest(manifestInProgressPath, manifest);
    emitProgress(onProgress, {
      phase: 'cropping',
      outputRootDir,
      outputDir: dirname(outputPath),
      totalFiles: videos.length,
      processedFiles: index + 1,
      succeededCount: manifest.summary.succeeded,
      skippedCount: manifest.summary.skipped,
      errorCount: manifest.summary.failed,
      currentFile: prepared.fileName,
      message: result.ok ? 'Cropped video.' : 'Auto-Crop failed.'
    });
  }

  manifest.completedAt = nowIsoString();
  await writeManifest(manifestInProgressPath, manifest);
  await rename(manifestInProgressPath, manifestPath);

  emitProgress(onProgress, {
    phase: 'complete',
    outputRootDir,
    outputDir,
    totalFiles: videos.length,
    processedFiles: videos.length,
    succeededCount: manifest.summary.succeeded,
    skippedCount: manifest.summary.skipped,
    errorCount: manifest.summary.failed,
    currentFile: null,
    message: 'Auto-Crop complete.'
  });

  return {
    message: 'Auto-Crop complete.',
    summary: manifest.summary,
    outputDir,
    manifestPath,
    items: manifest.items
  };
}

function getAutoCropSkipReason(video: VideoRow): string | null {
  const blackBorder = video.adjustments?.blackBorder;
  const visibleArea = blackBorder?.visibleArea;

  if (!blackBorder?.analyzed) {
    return 'black-border analysis has not run';
  }

  if (blackBorder.classification === 'analysis_error') {
    return 'black-border analysis errored';
  }

  if (blackBorder.classification !== 'nested_borders') {
    return 'not high-confidence nested borders';
  }

  if (blackBorder.confidence !== 'high') {
    return 'low/medium confidence';
  }

  if (blackBorder.recommendedFix?.eligible !== true || blackBorder.recommendedFix.type !== 'crop-scale') {
    return 'not eligible for crop-scale';
  }

  const crop = normalizeCrop(visibleArea);

  if (!crop) {
    return 'missing usable crop rectangle';
  }

  if (crop.width < MIN_VISIBLE_WIDTH || crop.height < MIN_VISIBLE_HEIGHT) {
    return 'visible area is too small';
  }

  if (Math.abs(crop.width / crop.height - ASPECT_RATIO_16_9) > AUTO_CROP_ASPECT_TOLERANCE) {
    return 'visible area is not close to 16:9';
  }

  const sourceWidth = readFiniteNumber(blackBorder.source?.width) ?? readFiniteNumber(video.width);
  const sourceHeight = readFiniteNumber(blackBorder.source?.height) ?? readFiniteNumber(video.height);

  if (!cropFitsSource({ crop, sourceWidth, sourceHeight })) {
    return 'crop rectangle is outside the source dimensions';
  }

  return null;
}

async function prepareAutoCropVideo(video: VideoRow): Promise<VideoPreparationResult> {
  const sourcePath = normalizePathString(video.path);
  const fileName = getOriginalFileName(video, sourcePath);

  if (!sourcePath || !isAbsolute(sourcePath)) {
    return {
      ok: false,
      sourcePath,
      fileName,
      sourceSizeBytes: null,
      crop: null,
      error: 'Video must include an absolute source path.'
    };
  }

  const sourceStats = await stat(sourcePath).catch(() => null);

  if (!sourceStats) {
    return {
      ok: false,
      sourcePath,
      fileName,
      sourceSizeBytes: null,
      crop: null,
      error: 'Source video does not exist or is unreadable.'
    };
  }

  if (!sourceStats.isFile()) {
    return {
      ok: false,
      sourcePath,
      fileName,
      sourceSizeBytes: null,
      crop: null,
      error: 'Source path must point to a file.'
    };
  }

  const skipReason = getAutoCropSkipReason(video);

  if (skipReason) {
    return {
      ok: true,
      sourcePath,
      fileName,
      sourceSizeBytes: sourceStats.size,
      crop: null,
      skipReason
    };
  }

  return {
    ok: true,
    sourcePath,
    fileName,
    sourceSizeBytes: sourceStats.size,
    crop: normalizeCrop(video.adjustments?.blackBorder?.visibleArea)
  };
}

async function getOutputPath({
  outputRootDir,
  fileName,
  sourcePath
}: {
  outputRootDir: string;
  fileName: string;
  sourcePath: string;
}): Promise<string> {
  const directOutputPath = join(outputRootDir, fileName);

  if (resolve(directOutputPath) !== resolve(sourcePath) && !(await pathExists(directOutputPath))) {
    return directOutputPath;
  }

  const outputDir = await createUniqueRunFolder(outputRootDir);
  return join(outputDir, fileName);
}

async function createUniqueRunFolder(outputRootDir: string): Promise<string> {
  const baseRunId = `collie-video-crop-${timestampForRunId()}`;

  for (let index = 0; index < 100; index += 1) {
    const runId = index === 0 ? baseRunId : `${baseRunId}-${index + 1}`;
    const outputDir = join(outputRootDir, runId);

    try {
      await mkdir(outputDir, { recursive: false });
      return outputDir;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to create a unique Auto-Crop run folder.');
}

function buildFfmpegFilter({
  crop,
  target
}: {
  crop: AutoCropRect;
  target: { width: number; height: number };
}): string {
  return `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${target.width}:${target.height}:flags=lanczos`;
}

function createResultItem({
  fileName,
  sourcePath,
  outputPath,
  status,
  crop,
  ffmpegFilter,
  sourceSizeBytes,
  outputSizeBytes,
  startedAt,
  completedAt,
  error
}: {
  fileName: string;
  sourcePath: string;
  outputPath: string | null;
  status: AutoCropResultItem['status'];
  crop: AutoCropRect | null;
  ffmpegFilter: string | null;
  sourceSizeBytes: number | null;
  outputSizeBytes: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}): AutoCropResultItem {
  return {
    fileName,
    sourcePath,
    outputPath,
    status,
    crop: crop ?? undefined,
    target: crop ? { width: TARGET_WIDTH, height: TARGET_HEIGHT } : undefined,
    ffmpegFilter,
    sourceSizeBytes,
    outputSizeBytes,
    startedAt,
    completedAt,
    error
  };
}

function runFfmpegCrop({
  inputPath,
  outputPath,
  filter,
  ffmpegPath,
  signal
}: {
  inputPath: string;
  outputPath: string;
  filter: string;
  ffmpegPath: string;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({
        ok: false,
        canceled: true,
        error: 'Auto-Crop canceled.'
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
      'medium',
      '-crf',
      '18',
      '-c:a',
      'copy',
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
          error: 'Auto-Crop canceled.'
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

      settle({ ok: true });
    });
  });
}

function normalizeCrop(visibleArea: CropRectangle | undefined): AutoCropRect | null {
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
  crop: AutoCropRect;
  sourceWidth: number | null;
  sourceHeight: number | null;
}): boolean {
  if (sourceWidth === null || sourceHeight === null) {
    return true;
  }

  return crop.x + crop.width <= sourceWidth && crop.y + crop.height <= sourceHeight;
}

async function writeManifest(manifestPath: string, manifest: AutoCropManifest): Promise<void> {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function removePartialOutput(outputPath: string): Promise<void> {
  await unlink(outputPath).catch(() => undefined);
}

async function pathExists(filePath: string): Promise<boolean> {
  return stat(filePath)
    .then(() => true)
    .catch(() => false);
}

function emitProgress(
  onProgress: ((progress: Omit<AutoCropProgress, 'jobId' | 'status'>) => void) | undefined,
  progress: Omit<AutoCropProgress, 'jobId' | 'status'>
): void {
  onProgress?.(progress);
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

function timestampForRunId(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('-');
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function assertNotCanceled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createAutoCropCancelError();
  }
}

export function createAutoCropCancelError(): Error {
  const error = new Error('Auto-Crop canceled.');
  error.name = 'AbortError';
  return error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
