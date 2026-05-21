import { access, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type {
  DuplicateScanProfile,
  VisualFingerprint,
  VisualFingerprintAlgorithm,
  VisualFingerprintCacheKey,
  VisualFingerprintSample
} from '../../shared/types/duplicateScan';
import {
  IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE,
  IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE,
  IMPROVED_DUPLICATE_SCAN_FAST_PROFILE
} from '../../shared/types/duplicateScan';
import { runChildProcess } from '../utils/childProcess';
import {
  createVisualFingerprintCacheKey,
  readCachedVisualFingerprint,
  writeCachedVisualFingerprint
} from './duplicateFingerprintCacheService';
import type { VisualFingerprintCacheStatus } from './duplicateFingerprintCacheService';

const DEFAULT_ALGORITHM: VisualFingerprintAlgorithm = 'dhash-v1';
const ALGORITHM_VERSION = '1';
const FAST_SAMPLE_INTERVAL_SECONDS = 10;
const FAST_MAX_SAMPLES = 120;
const DEEP_SAMPLE_INTERVAL_SECONDS = 2;
const DEEP_MAX_SAMPLES = 600;

export interface GenerateVisualFingerprintOptions {
  filePath: string;
  profile?: DuplicateScanProfile;
  durationSeconds?: number | null;
  sampleIntervalSeconds?: number;
  maxSamplesPerVideo?: number;
  useCachedFingerprints?: boolean;
  cacheDir?: string | null;
  pythonPath?: string | null;
  helperScriptPath?: string | null;
  signal?: AbortSignal;
}

export interface GenerateVisualFingerprintsOptions
  extends Omit<GenerateVisualFingerprintOptions, 'filePath'> {
  filePaths: string[];
  onProgress?: (progress: GenerateVisualFingerprintsProgress) => void;
}

export interface GenerateVisualFingerprintsProgress {
  totalFiles: number;
  processedFiles: number;
  succeededCount: number;
  failedCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStaleCount: number;
  cacheErrorCount: number;
  cacheWriteErrorCount: number;
  currentFile: string | null;
  message: string | null;
}

export type GenerateVisualFingerprintCacheStatus =
  | VisualFingerprintCacheStatus
  | 'disabled';

export type GenerateVisualFingerprintResult =
  | GenerateVisualFingerprintSuccess
  | GenerateVisualFingerprintFailure;

export interface GenerateVisualFingerprintSuccess {
  ok: true;
  filePath: string;
  fingerprint: VisualFingerprint;
  warnings: string[];
  helperScriptPath: string;
  pythonPath: string;
  cacheStatus: GenerateVisualFingerprintCacheStatus;
  cacheKey: string;
  cachePath?: string;
  cacheMessage?: string;
  cacheWriteError?: string;
}

export interface GenerateVisualFingerprintFailure {
  ok: false;
  filePath: string;
  error: string;
  canceled: boolean;
  helperScriptPath: string;
  pythonPath: string;
  cacheStatus?: GenerateVisualFingerprintCacheStatus;
  cacheKey?: string;
  cachePath?: string;
  cacheMessage?: string;
  stdout?: string;
  stderr?: string;
}

export interface GenerateVisualFingerprintsResult {
  items: GenerateVisualFingerprintResult[];
  succeededCount: number;
  failedCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStaleCount: number;
  cacheErrorCount: number;
  cacheWriteErrorCount: number;
  canceled: boolean;
}

interface FingerprintSourceStats {
  sizeBytes: number;
  modifiedTimeMs: number;
}

interface FingerprintHelperSuccessPayload {
  ok: true;
  filePath: string;
  fileName: string;
  directory: string;
  sizeBytes: number;
  modifiedTimeMs: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  algorithm: VisualFingerprintAlgorithm;
  algorithmVersion: string;
  samples: VisualFingerprintSample[];
  warnings: string[];
}

interface FingerprintHelperFailurePayload {
  ok: false;
  error: string;
  filePath?: string;
  warnings?: string[];
}

type FingerprintHelperPayload = FingerprintHelperSuccessPayload | FingerprintHelperFailurePayload;

export async function generateVisualFingerprints({
  filePaths,
  onProgress,
  ...options
}: GenerateVisualFingerprintsOptions): Promise<GenerateVisualFingerprintsResult> {
  const items: GenerateVisualFingerprintResult[] = [];
  let succeededCount = 0;
  let failedCount = 0;
  let cacheHitCount = 0;
  let cacheMissCount = 0;
  let cacheStaleCount = 0;
  let cacheErrorCount = 0;
  let cacheWriteErrorCount = 0;

  emitProgress(onProgress, {
    totalFiles: filePaths.length,
    processedFiles: 0,
    succeededCount,
    failedCount,
    cacheHitCount,
    cacheMissCount,
    cacheStaleCount,
    cacheErrorCount,
    cacheWriteErrorCount,
    currentFile: null,
    message: 'Starting visual fingerprint generation.'
  });

  for (let index = 0; index < filePaths.length; index += 1) {
    const filePath = filePaths[index];

    emitProgress(onProgress, {
      totalFiles: filePaths.length,
      processedFiles: index,
      succeededCount,
      failedCount,
      cacheHitCount,
      cacheMissCount,
      cacheStaleCount,
      cacheErrorCount,
      cacheWriteErrorCount,
      currentFile: basename(filePath),
      message: `Generating fingerprint for ${basename(filePath)}...`
    });

    const item = await generateVisualFingerprint({ ...options, filePath });
    items.push(item);

    if (item.ok) {
      succeededCount += 1;
    } else {
      failedCount += 1;
    }

    if (item.cacheStatus === 'hit') {
      cacheHitCount += 1;
    } else if (item.cacheStatus === 'miss') {
      cacheMissCount += 1;
    } else if (item.cacheStatus === 'stale') {
      cacheStaleCount += 1;
    } else if (item.cacheStatus === 'error') {
      cacheErrorCount += 1;
    }

    if (item.ok && item.cacheWriteError) {
      cacheWriteErrorCount += 1;
    }

    emitProgress(onProgress, {
      totalFiles: filePaths.length,
      processedFiles: index + 1,
      succeededCount,
      failedCount,
      cacheHitCount,
      cacheMissCount,
      cacheStaleCount,
      cacheErrorCount,
      cacheWriteErrorCount,
      currentFile: basename(filePath),
      message: item.ok
        ? item.cacheStatus === 'hit'
          ? 'Fingerprint loaded from cache.'
          : 'Fingerprint ready.'
        : 'Fingerprint failed.'
    });

    if (!item.ok && item.canceled) {
      break;
    }
  }

  emitProgress(onProgress, {
    totalFiles: filePaths.length,
    processedFiles: items.length,
    succeededCount,
    failedCount,
    cacheHitCount,
    cacheMissCount,
    cacheStaleCount,
    cacheErrorCount,
    cacheWriteErrorCount,
    currentFile: null,
    message: 'Visual fingerprint generation complete.'
  });

  return {
    items,
    succeededCount,
    failedCount,
    cacheHitCount,
    cacheMissCount,
    cacheStaleCount,
    cacheErrorCount,
    cacheWriteErrorCount,
    canceled: items.some((item) => !item.ok && item.canceled)
  };
}

export async function generateVisualFingerprint({
  filePath,
  profile = IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE,
  durationSeconds = null,
  sampleIntervalSeconds,
  maxSamplesPerVideo,
  useCachedFingerprints = true,
  cacheDir,
  pythonPath,
  helperScriptPath,
  signal
}: GenerateVisualFingerprintOptions): Promise<GenerateVisualFingerprintResult> {
  const resolvedPythonPath = pythonPath?.trim() || getProjectPythonPath();
  const resolvedHelperScriptPath = helperScriptPath?.trim() || getOpenCvFingerprintScriptPath();
  const resolvedProfile = normalizeProfile(profile);
  const resolvedSampleIntervalSeconds =
    sampleIntervalSeconds ?? getDefaultSampleIntervalSeconds(resolvedProfile);
  const resolvedMaxSamples = maxSamplesPerVideo ?? getDefaultMaxSamples(resolvedProfile);
  const resolvedDurationSeconds = Number.isFinite(durationSeconds) ? durationSeconds : null;

  if (signal?.aborted) {
    return {
      ok: false,
      filePath,
      error: 'Visual fingerprint generation canceled.',
      canceled: true,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath
    };
  }

  const requestError = validateFingerprintOptions({
    sampleIntervalSeconds: resolvedSampleIntervalSeconds,
    maxSamplesPerVideo: resolvedMaxSamples
  });

  if (requestError) {
    return {
      ok: false,
      filePath,
      error: requestError,
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath
    };
  }

  const sourceStatsResult = await getFingerprintSourceStats(filePath);
  if (!sourceStatsResult.ok) {
    return {
      ok: false,
      filePath,
      error: sourceStatsResult.error,
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath
    };
  }

  const cacheIdentity = buildVisualFingerprintCacheIdentity({
    filePath,
    sourceStats: sourceStatsResult.sourceStats,
    durationSeconds: resolvedDurationSeconds,
    profile: resolvedProfile,
    sampleIntervalSeconds: resolvedSampleIntervalSeconds,
    maxSamplesPerVideo: resolvedMaxSamples
  });
  const cacheKey = createVisualFingerprintCacheKey(cacheIdentity);
  let cacheStatus: GenerateVisualFingerprintCacheStatus = useCachedFingerprints
    ? 'miss'
    : 'disabled';
  let cachePath: string | undefined;
  let cacheMessage: string | undefined;

  if (useCachedFingerprints) {
    const cachedFingerprint = await readCachedVisualFingerprint(cacheIdentity, { cacheDir });
    cacheStatus = cachedFingerprint.status;
    cachePath = cachedFingerprint.cachePath;
    cacheMessage = cachedFingerprint.message;

    if (cachedFingerprint.status === 'hit' && cachedFingerprint.fingerprint) {
      return {
        ok: true,
        filePath: cachedFingerprint.fingerprint.filePath,
        fingerprint: cachedFingerprint.fingerprint,
        warnings: cachedFingerprint.fingerprint.warnings,
        pythonPath: resolvedPythonPath,
        helperScriptPath: resolvedHelperScriptPath,
        cacheStatus: cachedFingerprint.status,
        cacheKey: cachedFingerprint.cacheKey,
        cachePath,
        cacheMessage
      };
    }

    if (signal?.aborted) {
      return {
        ok: false,
        filePath,
        error: 'Visual fingerprint generation canceled.',
        canceled: true,
        pythonPath: resolvedPythonPath,
        helperScriptPath: resolvedHelperScriptPath,
        cacheStatus,
        cacheKey: cachedFingerprint.cacheKey,
        cachePath,
        cacheMessage
      };
    }
  }

  const helperPreflightError = await validateFingerprintHelperAvailability({
    pythonPath: resolvedPythonPath,
    helperScriptPath: resolvedHelperScriptPath
  });

  if (helperPreflightError) {
    return {
      ok: false,
      filePath,
      error: helperPreflightError,
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage
    };
  }

  if (signal?.aborted) {
    return {
      ok: false,
      filePath,
      error: 'Visual fingerprint generation canceled.',
      canceled: true,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage
    };
  }

  const result = await runChildProcess(
    resolvedPythonPath,
    [
      resolvedHelperScriptPath,
      filePath,
      String(resolvedSampleIntervalSeconds),
      '--max-samples',
      String(resolvedMaxSamples),
      '--profile',
      resolvedProfile,
      '--algorithm',
      DEFAULT_ALGORITHM
    ],
    { signal }
  );

  if (result.canceled) {
    return {
      ok: false,
      filePath,
      error: 'Visual fingerprint generation canceled.',
      canceled: true,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  const parsed = parseHelperPayload(result.stdout);
  if (!parsed.ok) {
    return {
      ok: false,
      filePath,
      error: parsed.error || result.error || 'Visual fingerprint helper failed.',
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  if (!parsed.payload.ok) {
    return {
      ok: false,
      filePath,
      error: parsed.payload.error,
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  const sourceChangedError = await getSourceChangedError(filePath, sourceStatsResult.sourceStats);
  if (sourceChangedError) {
    return {
      ok: false,
      filePath,
      error: sourceChangedError,
      canceled: false,
      pythonPath: resolvedPythonPath,
      helperScriptPath: resolvedHelperScriptPath,
      cacheStatus,
      cacheKey,
      cachePath,
      cacheMessage,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  const fingerprint = buildVisualFingerprint(parsed.payload, cacheIdentity, cacheKey);
  const cacheWriteResult = useCachedFingerprints
    ? await writeCachedVisualFingerprint(cacheIdentity, fingerprint, { cacheDir })
    : null;

  return {
    ok: true,
    filePath: fingerprint.filePath,
    fingerprint,
    warnings: fingerprint.warnings,
    pythonPath: resolvedPythonPath,
    helperScriptPath: resolvedHelperScriptPath,
    cacheStatus,
    cacheKey,
    cachePath: cacheWriteResult?.cachePath,
    cacheMessage,
    cacheWriteError: cacheWriteResult && !cacheWriteResult.ok ? cacheWriteResult.error : undefined
  };
}

export function getProjectPythonPath(): string {
  return join(process.cwd(), '.venv', 'bin', 'python');
}

export function getOpenCvFingerprintScriptPath(): string {
  return join(process.cwd(), 'scripts', 'opencv', 'fingerprint_video.py');
}

function getDefaultSampleIntervalSeconds(profile: DuplicateScanProfile): number {
  return profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
    ? DEEP_SAMPLE_INTERVAL_SECONDS
    : FAST_SAMPLE_INTERVAL_SECONDS;
}

function getDefaultMaxSamples(profile: DuplicateScanProfile): number {
  return profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE ? DEEP_MAX_SAMPLES : FAST_MAX_SAMPLES;
}

function normalizeProfile(profile: DuplicateScanProfile): DuplicateScanProfile {
  return profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
    ? IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
    : IMPROVED_DUPLICATE_SCAN_FAST_PROFILE;
}

function validateFingerprintOptions({
  sampleIntervalSeconds,
  maxSamplesPerVideo
}: {
  sampleIntervalSeconds: number;
  maxSamplesPerVideo: number;
}): string | null {
  if (!Number.isFinite(sampleIntervalSeconds) || sampleIntervalSeconds <= 0) {
    return 'sampleIntervalSeconds must be greater than 0.';
  }

  if (!Number.isInteger(maxSamplesPerVideo) || maxSamplesPerVideo <= 0) {
    return 'maxSamplesPerVideo must be a positive integer.';
  }

  return null;
}

async function getFingerprintSourceStats(
  filePath: string
): Promise<
  | { ok: true; sourceStats: FingerprintSourceStats }
  | { ok: false; error: string }
> {
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return { ok: false, error: 'Video path is not a file.' };
    }

    return {
      ok: true,
      sourceStats: {
        sizeBytes: fileStats.size,
        modifiedTimeMs: fileStats.mtimeMs
      }
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Video file is not available: ${error.message}`
          : 'Video file is not available.'
    };
  }
}

async function validateFingerprintHelperAvailability({
  pythonPath,
  helperScriptPath
}: {
  pythonPath: string;
  helperScriptPath: string;
}): Promise<string | null> {
  try {
    await access(pythonPath);
  } catch {
    return `Project-local Python interpreter was not found at ${pythonPath}. Run npm run opencv:install after creating .venv.`;
  }

  try {
    await access(helperScriptPath);
  } catch {
    return `OpenCV fingerprint helper was not found at ${helperScriptPath}.`;
  }

  return null;
}

function buildVisualFingerprintCacheIdentity({
  filePath,
  sourceStats,
  durationSeconds,
  profile,
  sampleIntervalSeconds,
  maxSamplesPerVideo
}: {
  filePath: string;
  sourceStats: FingerprintSourceStats;
  durationSeconds: number | null;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  maxSamplesPerVideo: number;
}): VisualFingerprintCacheKey {
  return {
    filePath,
    sizeBytes: sourceStats.sizeBytes,
    modifiedTimeMs: sourceStats.modifiedTimeMs,
    durationSeconds,
    algorithm: DEFAULT_ALGORITHM,
    algorithmVersion: ALGORITHM_VERSION,
    profile,
    sampleIntervalSeconds,
    maxSamplesPerVideo
  };
}

async function getSourceChangedError(
  filePath: string,
  originalStats: FingerprintSourceStats
): Promise<string | null> {
  const currentStats = await getFingerprintSourceStats(filePath);

  if (!currentStats.ok) {
    return currentStats.error;
  }

  if (
    currentStats.sourceStats.sizeBytes !== originalStats.sizeBytes ||
    currentStats.sourceStats.modifiedTimeMs !== originalStats.modifiedTimeMs
  ) {
    return 'Video file changed while fingerprint generation was running. Try again to avoid caching stale analysis.';
  }

  return null;
}

function parseHelperPayload(
  stdout: string
): { ok: true; payload: FingerprintHelperPayload } | { ok: false; error: string } {
  if (!stdout.trim()) {
    return { ok: false, error: 'Visual fingerprint helper produced no JSON output.' };
  }

  try {
    const value = JSON.parse(stdout) as unknown;
    const payload = toFingerprintHelperPayload(value);
    if (!payload) {
      return { ok: false, error: 'Visual fingerprint helper returned an unexpected JSON shape.' };
    }
    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to parse visual fingerprint JSON: ${error.message}`
          : 'Failed to parse visual fingerprint JSON.'
    };
  }
}

function toFingerprintHelperPayload(value: unknown): FingerprintHelperPayload | null {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return null;
  }

  if (!value.ok) {
    return {
      ok: false,
      error: readString(value.error) || 'Visual fingerprint helper failed.',
      filePath: readOptionalString(value.filePath) ?? undefined,
      warnings: readStringArray(value.warnings)
    };
  }

  const samples = readSamples(value.samples);
  if (!samples.length) {
    return null;
  }

  const filePath = readString(value.filePath);
  const fileName = readString(value.fileName);
  const directory = readString(value.directory);
  const sizeBytes = readNumber(value.sizeBytes);
  const modifiedTimeMs = readNumber(value.modifiedTimeMs);
  const sampleIntervalSeconds = readNumber(value.sampleIntervalSeconds);
  const profile = readProfile(value.profile);
  const algorithm = readAlgorithm(value.algorithm);
  const algorithmVersion = readString(value.algorithmVersion);

  if (
    !filePath ||
    !fileName ||
    !directory ||
    sizeBytes === null ||
    modifiedTimeMs === null ||
    sampleIntervalSeconds === null ||
    !profile ||
    !algorithm ||
    algorithmVersion !== ALGORITHM_VERSION
  ) {
    return null;
  }

  return {
    ok: true,
    filePath,
    fileName,
    directory,
    sizeBytes,
    modifiedTimeMs,
    durationSeconds: readNullableNumber(value.durationSeconds),
    width: readNullableNumber(value.width),
    height: readNullableNumber(value.height),
    frameRate: readNullableNumber(value.frameRate),
    profile,
    sampleIntervalSeconds,
    algorithm,
    algorithmVersion,
    samples,
    warnings: readStringArray(value.warnings)
  };
}

function buildVisualFingerprint(
  payload: FingerprintHelperSuccessPayload,
  cacheIdentity: VisualFingerprintCacheKey,
  cacheKey: string
): VisualFingerprint {
  return {
    cacheKey,
    filePath: cacheIdentity.filePath,
    fileName: basename(cacheIdentity.filePath),
    directory: dirname(cacheIdentity.filePath),
    sizeBytes: cacheIdentity.sizeBytes,
    modifiedTimeMs: cacheIdentity.modifiedTimeMs,
    durationSeconds: payload.durationSeconds,
    width: payload.width,
    height: payload.height,
    frameRate: payload.frameRate,
    profile: payload.profile,
    sampleIntervalSeconds: payload.sampleIntervalSeconds,
    algorithm: payload.algorithm,
    algorithmVersion: payload.algorithmVersion,
    generatedAt: new Date().toISOString(),
    samples: payload.samples,
    warnings: payload.warnings
  };
}

function readSamples(value: unknown): VisualFingerprintSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): VisualFingerprintSample | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const timeSeconds = readNumber(entry.timeSeconds);
      const hash = readString(entry.hash);

      if (timeSeconds === null || !hash) {
        return null;
      }

      return {
        timeSeconds,
        hash,
        frameMean: readNullableNumber(entry.frameMean),
        frameStdDev: readNullableNumber(entry.frameStdDev),
        isLowInformation:
          typeof entry.isLowInformation === 'boolean' ? entry.isLowInformation : undefined
      };
    })
    .filter((entry): entry is VisualFingerprintSample => entry !== null);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return value === null ? null : readNumber(value);
}

function readProfile(value: unknown): DuplicateScanProfile | null {
  if (value === IMPROVED_DUPLICATE_SCAN_FAST_PROFILE) {
    return IMPROVED_DUPLICATE_SCAN_FAST_PROFILE;
  }

  if (value === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE) {
    return IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE;
  }

  return null;
}

function readAlgorithm(value: unknown): VisualFingerprintAlgorithm | null {
  return value === DEFAULT_ALGORITHM ? DEFAULT_ALGORITHM : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function emitProgress(
  onProgress: GenerateVisualFingerprintsOptions['onProgress'],
  progress: GenerateVisualFingerprintsProgress
): void {
  onProgress?.(progress);
}
