import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  VisualFingerprint,
  VisualFingerprintCacheKey,
  VisualFingerprintSample
} from '../../shared/types/duplicateScan';

const FINGERPRINT_CACHE_SCHEMA_VERSION = 1;
const FINGERPRINT_CACHE_SUBDIR = 'fingerprints-v1';

export type VisualFingerprintCacheStatus = 'hit' | 'miss' | 'stale' | 'error';

export interface VisualFingerprintCacheLookupResult {
  status: VisualFingerprintCacheStatus;
  cacheKey: string;
  cachePath: string;
  fingerprint?: VisualFingerprint;
  message?: string;
}

export interface VisualFingerprintCacheWriteResult {
  ok: boolean;
  cacheKey: string;
  cachePath: string;
  error?: string;
}

export interface VisualFingerprintCacheOptions {
  cacheDir?: string | null;
}

interface VisualFingerprintCacheEntry {
  schemaVersion: typeof FINGERPRINT_CACHE_SCHEMA_VERSION;
  cacheKey: string;
  cacheIdentity: VisualFingerprintCacheKey;
  cachedAt: string;
  fingerprint: VisualFingerprint;
}

export function createVisualFingerprintCacheKey(cacheIdentity: VisualFingerprintCacheKey): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeCacheIdentity(cacheIdentity)))
    .digest('hex');
}

export async function readCachedVisualFingerprint(
  cacheIdentity: VisualFingerprintCacheKey,
  options: VisualFingerprintCacheOptions = {}
): Promise<VisualFingerprintCacheLookupResult> {
  const cacheKey = createVisualFingerprintCacheKey(cacheIdentity);
  const cachePath = await getVisualFingerprintCachePath(cacheKey, options);

  try {
    const rawEntry = await readFile(cachePath, 'utf8');
    const entry = toCacheEntry(JSON.parse(rawEntry));

    if (!entry) {
      return {
        status: 'stale',
        cacheKey,
        cachePath,
        message: 'Cached visual fingerprint has an unexpected shape.'
      };
    }

    if (
      entry.schemaVersion !== FINGERPRINT_CACHE_SCHEMA_VERSION ||
      entry.cacheKey !== cacheKey ||
      !cacheIdentityEquals(entry.cacheIdentity, cacheIdentity) ||
      !isValidCachedFingerprint(entry.fingerprint, cacheIdentity, cacheKey)
    ) {
      return {
        status: 'stale',
        cacheKey,
        cachePath,
        message: 'Cached visual fingerprint no longer matches the requested file identity.'
      };
    }

    return {
      status: 'hit',
      cacheKey,
      cachePath,
      fingerprint: entry.fingerprint
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        status: 'miss',
        cacheKey,
        cachePath
      };
    }

    return {
      status: 'error',
      cacheKey,
      cachePath,
      message:
        error instanceof Error
          ? `Failed to read cached visual fingerprint: ${error.message}`
          : 'Failed to read cached visual fingerprint.'
    };
  }
}

export async function writeCachedVisualFingerprint(
  cacheIdentity: VisualFingerprintCacheKey,
  fingerprint: VisualFingerprint,
  options: VisualFingerprintCacheOptions = {}
): Promise<VisualFingerprintCacheWriteResult> {
  const cacheKey = createVisualFingerprintCacheKey(cacheIdentity);
  const cachePath = await getVisualFingerprintCachePath(cacheKey, options);
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  const entry: VisualFingerprintCacheEntry = {
    schemaVersion: FINGERPRINT_CACHE_SCHEMA_VERSION,
    cacheKey,
    cacheIdentity: normalizeCacheIdentity(cacheIdentity),
    cachedAt: new Date().toISOString(),
    fingerprint: {
      ...fingerprint,
      cacheKey
    }
  };

  try {
    await mkdir(await getVisualFingerprintCacheDir(options), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    await rename(tempPath, cachePath);

    return {
      ok: true,
      cacheKey,
      cachePath
    };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);

    return {
      ok: false,
      cacheKey,
      cachePath,
      error:
        error instanceof Error
          ? `Failed to write cached visual fingerprint: ${error.message}`
          : 'Failed to write cached visual fingerprint.'
    };
  }
}

async function getVisualFingerprintCachePath(
  cacheKey: string,
  options: VisualFingerprintCacheOptions
): Promise<string> {
  return join(await getVisualFingerprintCacheDir(options), `${cacheKey}.json`);
}

async function getVisualFingerprintCacheDir(
  options: VisualFingerprintCacheOptions
): Promise<string> {
  const override = options.cacheDir?.trim();
  if (override) {
    return join(override, FINGERPRINT_CACHE_SUBDIR);
  }

  const { getDuplicateFingerprintCacheDir } = await import('./appPaths');
  return join(getDuplicateFingerprintCacheDir(), FINGERPRINT_CACHE_SUBDIR);
}

function normalizeCacheIdentity(cacheIdentity: VisualFingerprintCacheKey): VisualFingerprintCacheKey {
  return {
    filePath: cacheIdentity.filePath,
    sizeBytes: cacheIdentity.sizeBytes,
    modifiedTimeMs: cacheIdentity.modifiedTimeMs,
    durationSeconds: cacheIdentity.durationSeconds,
    algorithm: cacheIdentity.algorithm,
    algorithmVersion: cacheIdentity.algorithmVersion,
    profile: cacheIdentity.profile,
    sampleIntervalSeconds: cacheIdentity.sampleIntervalSeconds,
    maxSamplesPerVideo: cacheIdentity.maxSamplesPerVideo
  };
}

function cacheIdentityEquals(
  left: VisualFingerprintCacheKey,
  right: VisualFingerprintCacheKey
): boolean {
  const normalizedLeft = normalizeCacheIdentity(left);
  const normalizedRight = normalizeCacheIdentity(right);

  return (
    normalizedLeft.filePath === normalizedRight.filePath &&
    normalizedLeft.sizeBytes === normalizedRight.sizeBytes &&
    normalizedLeft.modifiedTimeMs === normalizedRight.modifiedTimeMs &&
    normalizedLeft.durationSeconds === normalizedRight.durationSeconds &&
    normalizedLeft.algorithm === normalizedRight.algorithm &&
    normalizedLeft.algorithmVersion === normalizedRight.algorithmVersion &&
    normalizedLeft.profile === normalizedRight.profile &&
    normalizedLeft.sampleIntervalSeconds === normalizedRight.sampleIntervalSeconds &&
    normalizedLeft.maxSamplesPerVideo === normalizedRight.maxSamplesPerVideo
  );
}

function isValidCachedFingerprint(
  fingerprint: VisualFingerprint,
  cacheIdentity: VisualFingerprintCacheKey,
  cacheKey: string
): boolean {
  return (
    fingerprint.cacheKey === cacheKey &&
    fingerprint.filePath === cacheIdentity.filePath &&
    fingerprint.sizeBytes === cacheIdentity.sizeBytes &&
    fingerprint.modifiedTimeMs === cacheIdentity.modifiedTimeMs &&
    fingerprint.algorithm === cacheIdentity.algorithm &&
    fingerprint.algorithmVersion === cacheIdentity.algorithmVersion &&
    fingerprint.profile === cacheIdentity.profile &&
    fingerprint.sampleIntervalSeconds === cacheIdentity.sampleIntervalSeconds &&
    Array.isArray(fingerprint.samples) &&
    fingerprint.samples.length > 0 &&
    fingerprint.samples.length <= cacheIdentity.maxSamplesPerVideo &&
    fingerprint.samples.every(isValidFingerprintSample) &&
    Array.isArray(fingerprint.warnings)
  );
}

function toCacheEntry(value: unknown): VisualFingerprintCacheEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const cacheIdentity = toCacheIdentity(value.cacheIdentity);
  const fingerprint = toVisualFingerprint(value.fingerprint);

  if (
    value.schemaVersion !== FINGERPRINT_CACHE_SCHEMA_VERSION ||
    typeof value.cacheKey !== 'string' ||
    typeof value.cachedAt !== 'string' ||
    !cacheIdentity ||
    !fingerprint
  ) {
    return null;
  }

  return {
    schemaVersion: value.schemaVersion,
    cacheKey: value.cacheKey,
    cacheIdentity,
    cachedAt: value.cachedAt,
    fingerprint
  };
}

function toCacheIdentity(value: unknown): VisualFingerprintCacheKey | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.filePath !== 'string' ||
    !isFiniteNumber(value.sizeBytes) ||
    !isFiniteNumber(value.modifiedTimeMs) ||
    !(value.durationSeconds === null || isFiniteNumber(value.durationSeconds)) ||
    !isKnownAlgorithm(value.algorithm) ||
    typeof value.algorithmVersion !== 'string' ||
    !isKnownProfile(value.profile) ||
    !isFiniteNumber(value.sampleIntervalSeconds) ||
    !isFiniteNumber(value.maxSamplesPerVideo)
  ) {
    return null;
  }

  return {
    filePath: value.filePath,
    sizeBytes: value.sizeBytes,
    modifiedTimeMs: value.modifiedTimeMs,
    durationSeconds: value.durationSeconds,
    algorithm: value.algorithm,
    algorithmVersion: value.algorithmVersion,
    profile: value.profile,
    sampleIntervalSeconds: value.sampleIntervalSeconds,
    maxSamplesPerVideo: value.maxSamplesPerVideo
  };
}

function toVisualFingerprint(value: unknown): VisualFingerprint | null {
  if (!isRecord(value) || !Array.isArray(value.samples)) {
    return null;
  }

  const samples = value.samples.filter(isValidFingerprintSample);

  if (
    typeof value.cacheKey !== 'string' ||
    typeof value.filePath !== 'string' ||
    typeof value.fileName !== 'string' ||
    typeof value.directory !== 'string' ||
    !isFiniteNumber(value.sizeBytes) ||
    !isFiniteNumber(value.modifiedTimeMs) ||
    !(value.durationSeconds === null || isFiniteNumber(value.durationSeconds)) ||
    !(value.width === null || isFiniteNumber(value.width)) ||
    !(value.height === null || isFiniteNumber(value.height)) ||
    !(value.frameRate === null || isFiniteNumber(value.frameRate)) ||
    !isKnownProfile(value.profile) ||
    !isFiniteNumber(value.sampleIntervalSeconds) ||
    !isKnownAlgorithm(value.algorithm) ||
    typeof value.algorithmVersion !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    samples.length !== value.samples.length ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === 'string')
  ) {
    return null;
  }

  return {
    cacheKey: value.cacheKey,
    filePath: value.filePath,
    fileName: value.fileName,
    directory: value.directory,
    sizeBytes: value.sizeBytes,
    modifiedTimeMs: value.modifiedTimeMs,
    durationSeconds: value.durationSeconds,
    width: value.width,
    height: value.height,
    frameRate: value.frameRate,
    profile: value.profile,
    sampleIntervalSeconds: value.sampleIntervalSeconds,
    algorithm: value.algorithm,
    algorithmVersion: value.algorithmVersion,
    generatedAt: value.generatedAt,
    samples,
    warnings: value.warnings
  };
}

function isValidFingerprintSample(value: unknown): value is VisualFingerprintSample {
  if (!isRecord(value) || !isFiniteNumber(value.timeSeconds) || typeof value.hash !== 'string') {
    return false;
  }

  return (
    (value.frameMean === undefined || value.frameMean === null || isFiniteNumber(value.frameMean)) &&
    (value.frameStdDev === undefined ||
      value.frameStdDev === null ||
      isFiniteNumber(value.frameStdDev)) &&
    (value.isLowInformation === undefined || typeof value.isLowInformation === 'boolean')
  );
}

function isKnownAlgorithm(value: unknown): value is VisualFingerprint['algorithm'] {
  return value === 'dhash-v1' || value === 'phash-v1' || value === 'orb-v1';
}

function isKnownProfile(value: unknown): value is VisualFingerprint['profile'] {
  return value === 'fast' || value === 'deep';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
