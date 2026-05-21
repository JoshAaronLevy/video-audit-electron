import { createHash, randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, normalize, resolve } from 'node:path';
import type { DiscoveredVideoFile } from '../../shared/types/audit';
import type {
  DuplicateCandidateFile,
  DuplicateCandidateGroup,
  DuplicateScanTrashPlanRequest,
  DuplicateScanMode,
  DuplicateScanProfile,
  DuplicateScanSource,
  DuplicateScanSourceInput,
  ImprovedDuplicateScanOptions,
  ImprovedDuplicateScanProgress,
  ImprovedDuplicateScanRequest,
  ImprovedDuplicateScanResult,
  VisualFingerprint
} from '../../shared/types/duplicateScan';
import {
  IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE,
  IMPROVED_DUPLICATE_SCAN_FAST_PROFILE,
  IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE
} from '../../shared/types/duplicateScan';
import { discoverVideoFiles } from './fileDiscoveryService';
import { buildContainedClipCandidateGroups } from './duplicateContainedClipMatcher';
import { generateVisualFingerprints } from './duplicateFingerprintService';
import { getDuplicateFilenameKey } from './duplicateScanService';
import {
  buildVisualDuplicateCandidateGroups,
  createDuplicatePairKey
} from './duplicateVisualMatcher';

const FAST_SAMPLE_INTERVAL_SECONDS = 10;
const FAST_MAX_SAMPLES = 120;
const DEEP_SAMPLE_INTERVAL_SECONDS = 2;
const DEEP_MAX_SAMPLES = 600;
const DEFAULT_MIN_SEQUENTIAL_MATCHES = 8;
const DEFAULT_HASH_DISTANCE_THRESHOLD = 8;

export type ImprovedDuplicateScanServiceProgress = Omit<
  ImprovedDuplicateScanProgress,
  'jobId' | 'status'
>;

export interface RunImprovedDuplicateScanOptions {
  request: Partial<ImprovedDuplicateScanRequest> | null | undefined;
  scanId?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: ImprovedDuplicateScanServiceProgress) => void;
}

interface NormalizedImprovedDuplicateScanRequest {
  scanFolder: string;
  sources: DuplicateScanSource[];
  options: ImprovedDuplicateScanOptions;
}

interface ExactFilenameCandidateGroupsResult {
  groups: DuplicateCandidateGroup[];
  pairKeys: Set<string>;
}

interface FingerprintStats {
  fingerprintedFileCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheStaleCount: number;
  cacheErrorCount: number;
}

export interface ImprovedDuplicateScanCandidateSelection {
  scan: ImprovedDuplicateScanResult;
  candidates: DuplicateCandidateFile[];
}

const improvedDuplicateScanResults = new Map<string, ImprovedDuplicateScanResult>();

export async function runImprovedDuplicateScan({
  request,
  scanId = null,
  signal,
  onProgress
}: RunImprovedDuplicateScanOptions): Promise<ImprovedDuplicateScanResult> {
  const startedAt = nowIsoString();
  const effectiveScanId = scanId?.trim() || randomUUID();

  throwIfAborted(signal);
  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'validating',
    totalFiles: null,
    processedFiles: 0,
    fingerprintedFiles: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheStale: 0,
    cacheErrors: 0,
    candidateGroupCount: 0,
    currentFile: null,
    message: 'Validating improved duplicate scan request.'
  });

  const validation = await normalizeImprovedDuplicateScanRequest(request);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { scanFolder, sources, options } = validation.request;

  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'walking',
    totalFiles: null,
    processedFiles: 0,
    fingerprintedFiles: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheStale: 0,
    cacheErrors: 0,
    candidateGroupCount: 0,
    currentFile: null,
    message: 'Scanning folder for video files.'
  });

  const discoveryResult = await discoverVideoFiles({
    folderPaths: [scanFolder],
    filePaths: [],
    includeSubfolders: true,
    signal,
    onProgress: (progress) => {
      emitProgress(onProgress, {
        scanId: effectiveScanId,
        phase: progress.phase === 'validating' ? 'validating' : 'walking',
        totalFiles: progress.totalFiles,
        processedFiles: progress.processedFiles,
        fingerprintedFiles: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheStale: 0,
        cacheErrors: 0,
        candidateGroupCount: 0,
        currentFile: progress.currentPath ? basename(progress.currentPath) : null,
        message: progress.message
      });
    }
  });
  const scannedFileCount = discoveryResult.files.length + discoveryResult.skippedFiles;
  const checkedVideoFileCount = discoveryResult.files.length;
  const warnings = getDiscoveryWarnings(discoveryResult.skippedFiles);

  throwIfAborted(signal);
  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'matching-filename',
    totalFiles: checkedVideoFileCount,
    processedFiles: checkedVideoFileCount,
    fingerprintedFiles: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheStale: 0,
    cacheErrors: 0,
    candidateGroupCount: 0,
    currentFile: null,
    message: 'Matching exact filenames.'
  });

  const shouldIncludeExactFilenameMatches =
    options.includeExistingExactFilenameMatches || options.modes.includes('filename-exact');
  const exactFilenameResult = buildExactFilenameCandidateGroups({
    sources,
    scannedFiles: discoveryResult.files
  });
  const exactFilenameGroups = shouldIncludeExactFilenameMatches ? exactFilenameResult.groups : [];
  const exactPairKeysForVisual = shouldIncludeExactFilenameMatches
    ? exactFilenameResult.pairKeys
    : new Set<string>();
  let visualGroups: DuplicateCandidateGroup[] = [];
  let containedClipGroups: DuplicateCandidateGroup[] = [];
  let fingerprintStats: FingerprintStats = {
    fingerprintedFileCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cacheStaleCount: 0,
    cacheErrorCount: 0
  };
  const needsFingerprints =
    options.modes.includes('visual-fingerprint') || options.modes.includes('contained-clip');

  if (needsFingerprints) {
    emitProgress(onProgress, {
      scanId: effectiveScanId,
      phase: 'fingerprint-cache',
      totalFiles: null,
      processedFiles: 0,
      fingerprintedFiles: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheStale: 0,
      cacheErrors: 0,
      candidateGroupCount: exactFilenameGroups.length,
      currentFile: null,
      message: 'Preparing visual fingerprint cache lookups.'
    });

    const fingerprintPaths = getVisualFingerprintPaths({
      sources,
      scannedFiles: discoveryResult.files
    });
    const fingerprintResult = await generateVisualFingerprints({
      filePaths: fingerprintPaths,
      profile: options.profile,
      sampleIntervalSeconds: options.sampleIntervalSeconds,
      maxSamplesPerVideo: options.maxSamplesPerVideo,
      useCachedFingerprints: options.useCachedFingerprints,
      signal,
      onProgress: (progress) => {
        emitProgress(onProgress, {
          scanId: effectiveScanId,
          phase: 'fingerprinting',
          totalFiles: progress.totalFiles,
          processedFiles: progress.processedFiles,
          fingerprintedFiles: progress.succeededCount,
          cacheHits: progress.cacheHitCount,
          cacheMisses: progress.cacheMissCount,
          cacheStale: progress.cacheStaleCount,
          cacheErrors: progress.cacheErrorCount,
          candidateGroupCount: exactFilenameGroups.length,
          currentFile: progress.currentFile,
          message: progress.message
        });
      }
    });

    if (fingerprintResult.canceled) {
      throw createImprovedDuplicateScanCancelError();
    }

    fingerprintStats = {
      fingerprintedFileCount: fingerprintResult.succeededCount,
      cacheHitCount: fingerprintResult.cacheHitCount,
      cacheMissCount: fingerprintResult.cacheMissCount,
      cacheStaleCount: fingerprintResult.cacheStaleCount,
      cacheErrorCount: fingerprintResult.cacheErrorCount
    };

    const fingerprintsByPath = new Map<string, VisualFingerprint>();

    for (const item of fingerprintResult.items) {
      if (item.ok) {
        fingerprintsByPath.set(item.fingerprint.filePath, item.fingerprint);
        fingerprintsByPath.set(normalizePathForComparison(item.fingerprint.filePath), item.fingerprint);
      }
    }

    for (const item of fingerprintResult.items) {
      if (!item.ok && !item.canceled) {
        warnings.push(`${basename(item.filePath)}: ${item.error}`);
      }

      if (item.ok && item.cacheWriteError) {
        warnings.push(`${basename(item.filePath)}: ${item.cacheWriteError}`);
      }
    }

    if (options.modes.includes('visual-fingerprint')) {
      throwIfAborted(signal);
      emitProgress(onProgress, {
        scanId: effectiveScanId,
        phase: 'matching-visual',
        totalFiles: fingerprintPaths.length,
        processedFiles: fingerprintPaths.length,
        fingerprintedFiles: fingerprintStats.fingerprintedFileCount,
        cacheHits: fingerprintStats.cacheHitCount,
        cacheMisses: fingerprintStats.cacheMissCount,
        cacheStale: fingerprintStats.cacheStaleCount,
        cacheErrors: fingerprintStats.cacheErrorCount,
        candidateGroupCount: exactFilenameGroups.length,
        currentFile: null,
        message: 'Matching visual fingerprints.'
      });

      visualGroups = buildVisualDuplicateCandidateGroups({
        sources,
        scannedFiles: discoveryResult.files,
        fingerprintsByPath,
        exactMatchPairKeys: exactPairKeysForVisual,
        profile: options.profile,
        hashDistanceThreshold: options.hashDistanceThreshold,
        minSequentialMatches: options.minSequentialMatches,
        signal
      });
    }

    if (options.modes.includes('contained-clip')) {
      const groupsFoundBeforeContainedClipMatching =
        exactFilenameGroups.length + visualGroups.length;

      throwIfAborted(signal);
      emitProgress(onProgress, {
        scanId: effectiveScanId,
        phase: 'matching-contained-clips',
        totalFiles: fingerprintPaths.length,
        processedFiles: fingerprintPaths.length,
        fingerprintedFiles: fingerprintStats.fingerprintedFileCount,
        cacheHits: fingerprintStats.cacheHitCount,
        cacheMisses: fingerprintStats.cacheMissCount,
        cacheStale: fingerprintStats.cacheStaleCount,
        cacheErrors: fingerprintStats.cacheErrorCount,
        candidateGroupCount: groupsFoundBeforeContainedClipMatching,
        currentFile: null,
        message: 'Matching contained clips by offset.'
      });

      containedClipGroups = buildContainedClipCandidateGroups({
        sources,
        scannedFiles: discoveryResult.files,
        fingerprintsByPath,
        exactMatchPairKeys: exactPairKeysForVisual,
        profile: options.profile,
        hashDistanceThreshold: options.hashDistanceThreshold,
        minSequentialMatches: options.minSequentialMatches,
        signal
      });
    }
  }

  const groups = [...exactFilenameGroups, ...visualGroups, ...containedClipGroups];
  const result = buildImprovedDuplicateScanResult({
    scanId: effectiveScanId,
    scannedFolder: scanFolder,
    startedAt,
    completedAt: nowIsoString(),
    sourceCount: sources.length,
    scannedFileCount,
    checkedVideoFileCount,
    fingerprintStats,
    groups,
    warnings
  });

  improvedDuplicateScanResults.set(result.scanId, result);
  emitProgress(onProgress, {
    scanId: result.scanId,
    phase: 'complete',
    totalFiles: result.checkedVideoFileCount,
    processedFiles: result.checkedVideoFileCount,
    fingerprintedFiles: result.fingerprintedFileCount,
    cacheHits: result.cacheHitCount,
    cacheMisses: result.cacheMissCount,
    cacheStale: result.cacheStaleCount,
    cacheErrors: result.cacheErrorCount,
    candidateGroupCount: result.groups.length,
    currentFile: null,
    message: 'Improved duplicate scan complete.'
  });

  return result;
}

export function getImprovedDuplicateScanResult(scanId: string): ImprovedDuplicateScanResult | null {
  return improvedDuplicateScanResults.get(scanId) ?? null;
}

export function clearImprovedDuplicateScanResult(scanId: string): boolean {
  return improvedDuplicateScanResults.delete(scanId);
}

export function clearImprovedDuplicateScanResults(): void {
  improvedDuplicateScanResults.clear();
}

export function getImprovedDuplicateScanCandidatesForTrash({
  scanId,
  candidateIds
}: DuplicateScanTrashPlanRequest): ImprovedDuplicateScanCandidateSelection | { error: string } {
  const scan = getImprovedDuplicateScanResult(scanId);

  if (!scan) {
    return {
      error: 'Improved duplicate scan result not found. Run a fresh duplicate scan before moving candidates to Trash.'
    };
  }

  const requestedIds = [...new Set(candidateIds.filter((id) => id.trim() !== ''))];

  if (requestedIds.length === 0) {
    return {
      error: 'Mark at least one duplicate candidate before creating a Move to Trash plan.'
    };
  }

  const sourceIds = new Set(
    scan.groups.flatMap((group) =>
      group.files
        .filter((file) => file.role === 'source')
        .flatMap((file) => [file.id, file.filePath])
    )
  );

  if (requestedIds.some((id) => sourceIds.has(id))) {
    return {
      error: 'Project source files are protected and cannot be moved to Trash from duplicate review.'
    };
  }

  const candidatesById = new Map<string, DuplicateCandidateFile>();

  for (const group of scan.groups) {
    for (const file of group.files) {
      if (file.role !== 'candidate') {
        continue;
      }

      candidatesById.set(file.id, file);
      candidatesById.set(file.filePath, file);
    }
  }

  const candidates: DuplicateCandidateFile[] = [];
  const missingIds: string[] = [];

  for (const id of requestedIds) {
    const candidate = candidatesById.get(id);

    if (!candidate) {
      missingIds.push(id);
      continue;
    }

    candidates.push(candidate);
  }

  if (missingIds.length > 0) {
    return {
      error: `${missingIds.length.toLocaleString()} marked duplicate candidate(s) were not found in the improved scan result.`
    };
  }

  return {
    scan,
    candidates
  };
}

async function normalizeImprovedDuplicateScanRequest(
  request: Partial<ImprovedDuplicateScanRequest> | null | undefined
): Promise<
  { ok: true; request: NormalizedImprovedDuplicateScanRequest } | { ok: false; error: string }
> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Improved duplicate scan request is required.'
    };
  }

  let scanFolder: string;

  try {
    scanFolder = await assertAbsoluteDirectory(request.scanFolder);
  } catch (error: unknown) {
    return {
      ok: false,
      error: getErrorMessage(error, 'Choose a valid folder before starting improved duplicate scan.')
    };
  }

  const sourceInputs = Array.isArray(request.sources) ? request.sources : [];
  const sources = sourceInputs
    .map(normalizeSourceInput)
    .filter((source): source is DuplicateScanSource => source !== null);

  if (sources.length === 0) {
    return {
      ok: false,
      error: 'Select at least one project video before starting improved duplicate scan.'
    };
  }

  const options = normalizeImprovedDuplicateScanOptions(request.options);

  if (!options.ok) {
    return options;
  }

  return {
    ok: true,
    request: {
      scanFolder,
      sources,
      options: options.options
    }
  };
}

function normalizeImprovedDuplicateScanOptions(
  value: Partial<ImprovedDuplicateScanOptions> | null | undefined
): { ok: true; options: ImprovedDuplicateScanOptions } | { ok: false; error: string } {
  const candidate = value && typeof value === 'object' ? value : {};

  if (
    candidate.sourceScope &&
    candidate.sourceScope !== IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE
  ) {
    return {
      ok: false,
      error: 'Improved duplicate scan currently supports selected result rows only.'
    };
  }

  const modes = normalizeModes(candidate.modes);

  if (modes.length === 0) {
    return {
      ok: false,
      error: 'Choose filename or visual duplicate detection before starting improved duplicate scan.'
    };
  }

  const profile =
    candidate.profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
      ? IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
      : candidate.profile === IMPROVED_DUPLICATE_SCAN_FAST_PROFILE
        ? IMPROVED_DUPLICATE_SCAN_FAST_PROFILE
        : modes.includes('contained-clip')
          ? IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
          : IMPROVED_DUPLICATE_SCAN_FAST_PROFILE;

  return {
    ok: true,
    options: {
      sourceScope: IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE,
      modes,
      profile,
      sampleIntervalSeconds: normalizePositiveNumber(
        candidate.sampleIntervalSeconds,
        getDefaultSampleIntervalSeconds(profile)
      ),
      maxSamplesPerVideo: Math.floor(
        normalizePositiveNumber(candidate.maxSamplesPerVideo, getDefaultMaxSamples(profile))
      ),
      minSequentialMatches: Math.floor(
        normalizePositiveNumber(candidate.minSequentialMatches, DEFAULT_MIN_SEQUENTIAL_MATCHES)
      ),
      hashDistanceThreshold: normalizePositiveNumber(
        candidate.hashDistanceThreshold,
        DEFAULT_HASH_DISTANCE_THRESHOLD
      ),
      includeExistingExactFilenameMatches:
        candidate.includeExistingExactFilenameMatches !== false,
      useCachedFingerprints: candidate.useCachedFingerprints !== false
    }
  };
}

function normalizeModes(value: unknown): DuplicateScanMode[] {
  const requestedModes = Array.isArray(value) ? value : ['filename-exact', 'visual-fingerprint'];
  const supportedModes: DuplicateScanMode[] = [];

  for (const mode of requestedModes) {
    if (
      (mode === 'filename-exact' ||
        mode === 'visual-fingerprint' ||
        mode === 'contained-clip') &&
      !supportedModes.includes(mode)
    ) {
      supportedModes.push(mode);
    }
  }

  return supportedModes;
}

async function assertAbsoluteDirectory(value: unknown): Promise<string> {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Improved duplicate scan folder is required.');
  }

  if (!isAbsolute(value)) {
    throw new Error('Improved duplicate scan folder must be an absolute path.');
  }

  const folderPath = resolve(value);
  const stats = await lstat(folderPath);

  if (stats.isSymbolicLink()) {
    throw new Error('Improved duplicate scan folder must not be a symlink.');
  }

  if (!stats.isDirectory()) {
    throw new Error('Improved duplicate scan folder must point to a directory.');
  }

  return folderPath;
}

function normalizeSourceInput(input: DuplicateScanSourceInput): DuplicateScanSource | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const sourcePath = typeof input.path === 'string' ? input.path.trim() : '';

  if (!sourcePath || !isAbsolute(sourcePath)) {
    return null;
  }

  const resolvedPath = resolve(sourcePath);
  const fileName = normalizeNonEmptyString(input.fileName) ?? basename(resolvedPath);

  if (!fileName) {
    return null;
  }

  return {
    ...input,
    id: normalizeNonEmptyString(input.id) ?? resolvedPath,
    path: resolvedPath,
    fileName,
    directory: normalizeNonEmptyString(input.directory) ?? dirname(resolvedPath),
    matchKey: getDuplicateFilenameKey(fileName)
  };
}

function buildExactFilenameCandidateGroups({
  sources,
  scannedFiles
}: {
  sources: DuplicateScanSource[];
  scannedFiles: DiscoveredVideoFile[];
}): ExactFilenameCandidateGroupsResult {
  const sourcePathSet = new Set(sources.map((source) => normalizePathForComparison(source.path)));
  const groups: DuplicateCandidateGroup[] = [];
  const pairKeys = new Set<string>();

  for (const source of sources) {
    const matchingFiles = scannedFiles
      .filter((file) => !sourcePathSet.has(normalizePathForComparison(file.path)))
      .filter((file) => getDuplicateFilenameKey(file.fileName) === source.matchKey)
      .sort((left, right) => left.path.localeCompare(right.path));

    if (matchingFiles.length === 0) {
      continue;
    }

    for (const file of matchingFiles) {
      pairKeys.add(createDuplicatePairKey(source.path, file.path));
    }

    groups.push(createExactFilenameCandidateGroup(source, matchingFiles));
  }

  return {
    groups,
    pairKeys
  };
}

function createExactFilenameCandidateGroup(
  source: DuplicateScanSource,
  candidates: DiscoveredVideoFile[]
): DuplicateCandidateGroup {
  const groupHash = createHash('sha256')
    .update(JSON.stringify({ mode: 'filename-exact', sourcePath: source.path, candidates }))
    .digest('hex')
    .slice(0, 16);
  const filenameMatchKey = source.matchKey;

  return {
    id: `filename-exact:${groupHash}`,
    mode: 'filename-exact',
    confidence: 1,
    matchType: 'exact-filename',
    files: [
      {
        id: source.id,
        role: 'source',
        filePath: source.path,
        fileName: source.fileName,
        directory: source.directory,
        durationSeconds: source.durationSeconds ?? null,
        width: source.width ?? null,
        height: source.height ?? null,
        sizeBytes: source.fileSystemSizeBytes ?? source.sizeBytes ?? null,
        modifiedAtMs: source.modifiedAtMs ?? null
      },
      ...candidates.map((candidate) => createExactFilenameCandidateFile(source, candidate))
    ],
    evidence: {
      filenameMatchKey,
      notes: ['Exact filename candidate. Duration and metadata are not used for this match.']
    }
  };
}

function createExactFilenameCandidateFile(
  source: DuplicateScanSource,
  candidate: DiscoveredVideoFile
): DuplicateCandidateFile {
  const candidateHash = createHash('sha256')
    .update(JSON.stringify({ sourcePath: source.path, candidatePath: candidate.path }))
    .digest('hex')
    .slice(0, 16);

  return {
    id: `filename-exact:${candidateHash}:candidate`,
    role: 'candidate',
    filePath: candidate.path,
    fileName: candidate.fileName,
    directory: candidate.directory,
    durationSeconds: null,
    sizeBytes: candidate.sizeBytes,
    modifiedAtMs: candidate.modifiedAt ? Date.parse(candidate.modifiedAt) : null,
    reviewStatus: 'unreviewed'
  };
}

function getVisualFingerprintPaths({
  sources,
  scannedFiles
}: {
  sources: DuplicateScanSource[];
  scannedFiles: DiscoveredVideoFile[];
}): string[] {
  const sourcePathSet = new Set(sources.map((source) => normalizePathForComparison(source.path)));
  const paths = new Map<string, string>();

  for (const source of sources) {
    paths.set(normalizePathForComparison(source.path), source.path);
  }

  for (const file of scannedFiles) {
    if (sourcePathSet.has(normalizePathForComparison(file.path))) {
      continue;
    }

    paths.set(normalizePathForComparison(file.path), file.path);
  }

  return [...paths.values()].sort((left, right) => left.localeCompare(right));
}

function buildImprovedDuplicateScanResult({
  scanId,
  scannedFolder,
  startedAt,
  completedAt,
  sourceCount,
  scannedFileCount,
  checkedVideoFileCount,
  fingerprintStats,
  groups,
  warnings
}: {
  scanId: string;
  scannedFolder: string;
  startedAt: string;
  completedAt: string;
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  fingerprintStats: FingerprintStats;
  groups: DuplicateCandidateGroup[];
  warnings: string[];
}): ImprovedDuplicateScanResult {
  return {
    scanId,
    status: 'complete',
    scannedFolder,
    startedAt,
    completedAt,
    sourceCount,
    scannedFileCount,
    checkedVideoFileCount,
    fingerprintedFileCount: fingerprintStats.fingerprintedFileCount,
    cacheHitCount: fingerprintStats.cacheHitCount,
    cacheMissCount: fingerprintStats.cacheMissCount,
    cacheStaleCount: fingerprintStats.cacheStaleCount,
    cacheErrorCount: fingerprintStats.cacheErrorCount,
    groups,
    warnings,
    summary: {
      exactFilenameGroupCount: groups.filter((group) => group.matchType === 'exact-filename').length,
      visualGroupCount: groups.filter((group) => group.matchType === 'near-duplicate').length,
      containedClipGroupCount: groups.filter((group) => group.matchType === 'contained-clip').length,
      sharedSegmentGroupCount: 0,
      candidateFileCount: groups.reduce(
        (total, group) => total + group.files.filter((file) => file.role === 'candidate').length,
        0
      )
    }
  };
}

function getDiscoveryWarnings(skippedFiles: number): string[] {
  return skippedFiles > 0
    ? [`${skippedFiles.toLocaleString()} file(s) or folder(s) were skipped during improved duplicate scan discovery.`]
    : [];
}

function getDefaultSampleIntervalSeconds(profile: DuplicateScanProfile): number {
  return profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
    ? DEEP_SAMPLE_INTERVAL_SECONDS
    : FAST_SAMPLE_INTERVAL_SECONDS;
}

function getDefaultMaxSamples(profile: DuplicateScanProfile): number {
  return profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE ? DEEP_MAX_SAMPLES : FAST_MAX_SAMPLES;
}

function emitProgress(
  onProgress: RunImprovedDuplicateScanOptions['onProgress'],
  progress: ImprovedDuplicateScanServiceProgress
): void {
  onProgress?.(progress);
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizePathForComparison(value: string): string {
  return normalize(resolve(value));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createImprovedDuplicateScanCancelError();
  }
}

function createImprovedDuplicateScanCancelError(): Error {
  const error = new Error('Improved duplicate scan canceled.');
  error.name = 'AbortError';
  return error;
}
