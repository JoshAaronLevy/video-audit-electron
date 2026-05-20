import { randomUUID } from 'node:crypto';
import { lstat, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, normalize, resolve } from 'node:path';
import {
  DUPLICATE_SCAN_FILENAME_CASE_MODE,
  DUPLICATE_SCAN_MATCH_TYPE
} from '../../shared/types/duplicateScan';
import type {
  DuplicateScanCandidate,
  DuplicateScanGroup,
  DuplicateScanProgress,
  DuplicateScanRequest,
  DuplicateScanResult,
  DuplicateScanSource,
  DuplicateScanSourceInput
} from '../../shared/types/duplicateScan';
import type { DiscoveredVideoFile } from '../../shared/types/audit';
import type { FfprobeResult } from '../../shared/types/video';
import { discoverVideoFiles } from './fileDiscoveryService';
import { runFfprobe } from './ffprobeService';
import { getSettings } from './settingsService';

export type DuplicateScanServiceProgress = Omit<DuplicateScanProgress, 'jobId' | 'status'>;

export interface RunDuplicateScanOptions {
  request: Partial<DuplicateScanRequest> | null | undefined;
  scanId?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: DuplicateScanServiceProgress) => void;
}

export interface DuplicateScanCandidateSelection {
  scan: DuplicateScanResult;
  candidates: DuplicateScanCandidate[];
}

const duplicateScanResults = new Map<string, DuplicateScanResult>();

export async function runDuplicateScan({
  request,
  scanId = null,
  signal,
  onProgress
}: RunDuplicateScanOptions): Promise<DuplicateScanResult> {
  const startedAt = nowIsoString();
  const effectiveScanId = scanId?.trim() || randomUUID();

  throwIfAborted(signal);
  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'validating',
    scannedFileCount: 0,
    checkedVideoFileCount: 0,
    filenameMatchesFound: 0,
    metadataProcessedCount: 0,
    metadataTotalCount: null,
    currentFile: null,
    message: 'Validating duplicate scan request.'
  });

  const validation = await normalizeDuplicateScanRequest(request);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { scanFolder, sources } = validation.request;

  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'walking',
    scannedFileCount: 0,
    checkedVideoFileCount: 0,
    filenameMatchesFound: 0,
    metadataProcessedCount: 0,
    metadataTotalCount: null,
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
        scannedFileCount: progress.processedFiles,
        checkedVideoFileCount: progress.foundCount,
        filenameMatchesFound: 0,
        metadataProcessedCount: 0,
        metadataTotalCount: null,
        currentFile: progress.currentPath ? basename(progress.currentPath) : null,
        message: progress.message
      });
    }
  });

  const scannedFileCount = getScannedFileCount(discoveryResult);
  const checkedVideoFileCount = discoveryResult.files.length;

  throwIfAborted(signal);
  emitProgress(onProgress, {
    scanId: effectiveScanId,
    phase: 'matching',
    scannedFileCount,
    checkedVideoFileCount,
    filenameMatchesFound: 0,
    metadataProcessedCount: 0,
    metadataTotalCount: null,
    currentFile: null,
    message: 'Matching exact filenames.'
  });

  const candidateGroups = buildCandidateGroups({
    sources,
    scannedFiles: discoveryResult.files
  });
  const flatCandidateCount = candidateGroups.reduce(
    (total, group) => total + group.candidates.length,
    0
  );
  const warnings = getDiscoveryWarnings(discoveryResult.skippedFiles);

  if (flatCandidateCount === 0) {
    const result = buildDuplicateScanResult({
      scanId: effectiveScanId,
      scannedFolder: scanFolder,
      startedAt,
      completedAt: nowIsoString(),
      sourceCount: sources.length,
      scannedFileCount,
      checkedVideoFileCount,
      groups: [],
      warnings
    });

    duplicateScanResults.set(result.scanId, result);
    emitCompleteProgress(onProgress, result);
    return result;
  }

  const settings = await getSettings();
  const groupsWithMetadata = await addCandidateMetadata({
    groups: candidateGroups,
    ffprobePath: settings.ffprobePathOverride,
    signal,
    onProgress: (update) => {
      emitProgress(onProgress, {
        scanId: effectiveScanId,
        phase: 'metadata',
        scannedFileCount,
        checkedVideoFileCount,
        filenameMatchesFound: flatCandidateCount,
        metadataProcessedCount: update.processedCount,
        metadataTotalCount: flatCandidateCount,
        currentFile: update.currentFile,
        message: update.message
      });
    },
    warnings
  });
  const result = buildDuplicateScanResult({
    scanId: effectiveScanId,
    scannedFolder: scanFolder,
    startedAt,
    completedAt: nowIsoString(),
    sourceCount: sources.length,
    scannedFileCount,
    checkedVideoFileCount,
    groups: groupsWithMetadata,
    warnings
  });

  duplicateScanResults.set(result.scanId, result);
  emitCompleteProgress(onProgress, result);
  return result;
}

export function getDuplicateScanResult(scanId: string): DuplicateScanResult | null {
  return duplicateScanResults.get(scanId) ?? null;
}

export function clearDuplicateScanResult(scanId: string): boolean {
  return duplicateScanResults.delete(scanId);
}

export function clearDuplicateScanResults(): void {
  duplicateScanResults.clear();
}

export function getDuplicateScanCandidatesForTrash({
  scanId,
  candidateIds
}: {
  scanId: string;
  candidateIds: string[];
}): DuplicateScanCandidateSelection | { error: string } {
  const scan = getDuplicateScanResult(scanId);

  if (!scan) {
    return {
      error: 'Duplicate scan result not found. Run a fresh duplicate scan before moving candidates to Trash.'
    };
  }

  const requestedIds = [...new Set(candidateIds.filter((id) => id.trim() !== ''))];

  if (requestedIds.length === 0) {
    return {
      error: 'Mark at least one duplicate candidate before creating a Move to Trash plan.'
    };
  }

  const sourceIds = new Set(scan.groups.flatMap((group) => [group.source.id, group.source.path]));

  if (requestedIds.some((id) => sourceIds.has(id))) {
    return {
      error: 'Project source files are protected and cannot be moved to Trash from duplicate review.'
    };
  }

  const candidatesById = new Map<string, DuplicateScanCandidate>();

  for (const group of scan.groups) {
    for (const candidate of group.candidates) {
      candidatesById.set(candidate.id, candidate);
      candidatesById.set(candidate.path, candidate);
    }
  }

  const candidates: DuplicateScanCandidate[] = [];
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
      error: `${missingIds.length.toLocaleString()} marked duplicate candidate(s) were not found in the scan result.`
    };
  }

  return {
    scan,
    candidates
  };
}

export function getDuplicateFilenameKey(fileName: string): string {
  return DUPLICATE_SCAN_FILENAME_CASE_MODE === 'case_insensitive_on_macos' &&
    process.platform === 'darwin'
    ? fileName.toLowerCase()
    : fileName;
}

async function normalizeDuplicateScanRequest(
  request: Partial<DuplicateScanRequest> | null | undefined
): Promise<{ ok: true; request: { scanFolder: string; sources: DuplicateScanSource[] } } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Duplicate scan request is required.'
    };
  }

  let scanFolder: string;

  try {
    scanFolder = await assertAbsoluteDirectory(request.scanFolder);
  } catch (error: unknown) {
    return {
      ok: false,
      error: getErrorMessage(error, 'Choose a valid folder before starting a duplicate scan.')
    };
  }

  const sourceInputs = Array.isArray(request.sources) ? request.sources : [];
  const sources = sourceInputs.map(normalizeSourceInput).filter((source): source is DuplicateScanSource =>
    source !== null
  );

  if (sources.length === 0) {
    return {
      ok: false,
      error: 'Select at least one project video before starting a duplicate scan.'
    };
  }

  return {
    ok: true,
    request: {
      scanFolder,
      sources
    }
  };
}

async function assertAbsoluteDirectory(value: unknown): Promise<string> {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Duplicate scan folder is required.');
  }

  if (!isAbsolute(value)) {
    throw new Error('Duplicate scan folder must be an absolute path.');
  }

  const folderPath = resolve(value);
  const stats = await lstat(folderPath);

  if (stats.isSymbolicLink()) {
    throw new Error('Duplicate scan folder must not be a symlink.');
  }

  if (!stats.isDirectory()) {
    throw new Error('Duplicate scan folder must point to a directory.');
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
    durationFormatted: input.durationFormatted ?? formatDuration(input.durationSeconds ?? null),
    matchKey: getDuplicateFilenameKey(fileName)
  };
}

function buildCandidateGroups({
  sources,
  scannedFiles
}: {
  sources: DuplicateScanSource[];
  scannedFiles: DiscoveredVideoFile[];
}): DuplicateScanGroup[] {
  const sourcesByMatchKey = new Map<string, DuplicateScanSource[]>();
  const sourcePathSet = new Set(sources.map((source) => normalizePathForComparison(source.path)));

  for (const source of sources) {
    const matches = sourcesByMatchKey.get(source.matchKey) ?? [];
    matches.push(source);
    sourcesByMatchKey.set(source.matchKey, matches);
  }

  const candidatesBySourceId = new Map<string, DuplicateScanCandidate[]>();

  for (const file of scannedFiles) {
    if (sourcePathSet.has(normalizePathForComparison(file.path))) {
      continue;
    }

    const matchingSources = sourcesByMatchKey.get(getDuplicateFilenameKey(file.fileName)) ?? [];

    if (matchingSources.length === 0) {
      continue;
    }

    for (const source of matchingSources) {
      const candidates = candidatesBySourceId.get(source.id) ?? [];
      candidates.push(createCandidateShell(source, file));
      candidatesBySourceId.set(source.id, candidates);
    }
  }

  return sources
    .map((source): DuplicateScanGroup | null => {
      const candidates = (candidatesBySourceId.get(source.id) ?? []).sort((left, right) =>
        left.path.localeCompare(right.path)
      );

      if (candidates.length === 0) {
        return null;
      }

      return {
        id: source.id,
        source,
        candidates
      };
    })
    .filter((group): group is DuplicateScanGroup => group !== null)
    .sort((left, right) =>
      left.source.fileName.localeCompare(right.source.fileName) ||
      left.source.path.localeCompare(right.source.path)
    );
}

function createCandidateShell(
  source: DuplicateScanSource,
  file: DiscoveredVideoFile
): DuplicateScanCandidate {
  const sizeDeltaBytes = getSizeDelta(file.sizeBytes, source.fileSystemSizeBytes ?? source.sizeBytes ?? null);

  return {
    id: `${source.id}::${file.path}`,
    sourceId: source.id,
    path: file.path,
    fileName: file.fileName,
    directory: file.directory,
    durationSeconds: null,
    durationFormatted: '',
    durationDeltaSeconds: null,
    sizeBytes: file.sizeBytes,
    sizeDeltaBytes,
    width: null,
    height: null,
    resolution: '',
    bitRate: null,
    bitRateMbps: null,
    modifiedAt: file.modifiedAt,
    modifiedAtMs: null,
    fileType: file.fileType,
    extension: file.extension,
    matchType: DUPLICATE_SCAN_MATCH_TYPE,
    metadataWarnings: [],
    metadataError: null,
    trashStatus: 'unmarked',
    trashError: null
  };
}

async function addCandidateMetadata({
  groups,
  ffprobePath,
  signal,
  onProgress,
  warnings
}: {
  groups: DuplicateScanGroup[];
  ffprobePath: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: { processedCount: number; currentFile: string | null; message: string | null }) => void;
  warnings: string[];
}): Promise<DuplicateScanGroup[]> {
  let processedCount = 0;
  const totalCount = groups.reduce((total, group) => total + group.candidates.length, 0);
  const nextGroups: DuplicateScanGroup[] = [];

  for (const group of groups) {
    const nextCandidates: DuplicateScanCandidate[] = [];

    for (const candidate of group.candidates) {
      throwIfAborted(signal);
      onProgress?.({
        processedCount,
        currentFile: candidate.fileName,
        message: `Reading metadata for ${candidate.fileName}.`
      });

      const candidateWithMetadata = await readCandidateMetadata({
        source: group.source,
        candidate,
        ffprobePath,
        signal,
        warnings
      });

      processedCount += 1;
      nextCandidates.push(candidateWithMetadata);
      onProgress?.({
        processedCount,
        currentFile: candidate.fileName,
        message:
          processedCount === totalCount
            ? 'Duplicate candidate metadata complete.'
            : 'Duplicate candidate metadata ready.'
      });
    }

    nextGroups.push({
      ...group,
      candidates: nextCandidates
    });
  }

  return nextGroups;
}

async function readCandidateMetadata({
  source,
  candidate,
  ffprobePath,
  signal,
  warnings
}: {
  source: DuplicateScanSource;
  candidate: DuplicateScanCandidate;
  ffprobePath: string | null;
  signal?: AbortSignal;
  warnings: string[];
}): Promise<DuplicateScanCandidate> {
  const metadataWarnings: string[] = [];
  const fileInfo = await getCandidateFileInfo(candidate);
  const probeResult = await runFfprobe(candidate.path, {
    ffprobePath: ffprobePath?.trim() || 'ffprobe',
    signal
  });

  if (probeResult.canceled) {
    throw createDuplicateScanCancelError();
  }

  if (!probeResult.ok || !probeResult.stream) {
    const metadataError = probeResult.error ?? 'ffprobe metadata extraction failed.';
    metadataWarnings.push(metadataError);
    warnings.push(`${candidate.fileName}: ${metadataError}`);

    return {
      ...candidate,
      sizeBytes: fileInfo.sizeBytes,
      sizeDeltaBytes: getSizeDelta(fileInfo.sizeBytes, source.fileSystemSizeBytes ?? source.sizeBytes ?? null),
      modifiedAt: fileInfo.modifiedAt,
      modifiedAtMs: fileInfo.modifiedAtMs,
      metadataWarnings,
      metadataError
    };
  }

  const stream = probeResult.stream;
  const format = probeResult.format ?? {};
  const width = safeNumber(stream.width);
  const height = safeNumber(stream.height);
  const durationSeconds = getDurationSeconds(probeResult);
  const bitRate = safeNumber(stream.bit_rate) ?? safeNumber(format.bit_rate);
  const formatSizeBytes = safeNumber(format.size);
  const sizeBytes = fileInfo.sizeBytes ?? formatSizeBytes ?? candidate.sizeBytes;

  return {
    ...candidate,
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    durationDeltaSeconds: getDurationDelta(durationSeconds, source.durationSeconds ?? null),
    sizeBytes,
    sizeDeltaBytes: getSizeDelta(sizeBytes, source.fileSystemSizeBytes ?? source.sizeBytes ?? null),
    width,
    height,
    resolution: width && height ? `${width}x${height}` : '',
    bitRate,
    bitRateMbps: bitRateToMbps(bitRate),
    modifiedAt: fileInfo.modifiedAt,
    modifiedAtMs: fileInfo.modifiedAtMs,
    metadataWarnings,
    metadataError: null
  };
}

async function getCandidateFileInfo(candidate: DuplicateScanCandidate): Promise<{
  sizeBytes: number | null;
  modifiedAt: string | null;
  modifiedAtMs: number | null;
}> {
  try {
    const fileStats = await stat(candidate.path);

    if (!fileStats.isFile()) {
      return {
        sizeBytes: candidate.sizeBytes,
        modifiedAt: candidate.modifiedAt,
        modifiedAtMs: candidate.modifiedAtMs
      };
    }

    return {
      sizeBytes: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString(),
      modifiedAtMs: Number.isFinite(fileStats.mtimeMs) ? Math.round(fileStats.mtimeMs) : null
    };
  } catch {
    return {
      sizeBytes: candidate.sizeBytes,
      modifiedAt: candidate.modifiedAt,
      modifiedAtMs: candidate.modifiedAtMs
    };
  }
}

function buildDuplicateScanResult({
  scanId,
  scannedFolder,
  startedAt,
  completedAt,
  sourceCount,
  scannedFileCount,
  checkedVideoFileCount,
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
  groups: DuplicateScanGroup[];
  warnings: string[];
}): DuplicateScanResult {
  const matchCount = groups.reduce((total, group) => total + group.candidates.length, 0);
  const summary = {
    sourceCount,
    scannedFileCount,
    checkedVideoFileCount,
    matchCount,
    groupCount: groups.length
  };

  return {
    scanId,
    status: 'complete',
    scannedFolder,
    startedAt,
    completedAt,
    sourceCount,
    scannedFileCount,
    checkedVideoFileCount,
    matchCount,
    groups,
    warnings,
    summary
  };
}

function emitCompleteProgress(
  onProgress: RunDuplicateScanOptions['onProgress'],
  result: DuplicateScanResult
): void {
  emitProgress(onProgress, {
    scanId: result.scanId,
    phase: 'complete',
    scannedFileCount: result.scannedFileCount,
    checkedVideoFileCount: result.checkedVideoFileCount,
    filenameMatchesFound: result.matchCount,
    metadataProcessedCount: result.matchCount,
    metadataTotalCount: result.matchCount,
    currentFile: null,
    message: 'Duplicate scan complete.'
  });
}

function emitProgress(
  onProgress: RunDuplicateScanOptions['onProgress'],
  progress: DuplicateScanServiceProgress
): void {
  onProgress?.(progress);
}

function getDiscoveryWarnings(skippedFiles: number): string[] {
  return skippedFiles > 0
    ? [`${skippedFiles.toLocaleString()} file(s) or folder(s) were skipped during duplicate scan discovery.`]
    : [];
}

function getScannedFileCount(discoveryResult: {
  files: DiscoveredVideoFile[];
  skippedFiles: number;
}): number {
  return discoveryResult.files.length + discoveryResult.skippedFiles;
}

function getDurationSeconds(probeResult: FfprobeResult): number | null {
  const stream = probeResult.stream ?? {};
  const format = probeResult.format ?? {};
  const durationSeconds = safeNumber(stream.duration) ?? safeNumber(format.duration);

  return durationSeconds === null ? null : Number(durationSeconds.toFixed(3));
}

function getDurationDelta(
  candidateDurationSeconds: number | null,
  sourceDurationSeconds: number | null
): number | null {
  if (candidateDurationSeconds === null || sourceDurationSeconds === null) {
    return null;
  }

  return Number((candidateDurationSeconds - sourceDurationSeconds).toFixed(3));
}

function getSizeDelta(candidateSizeBytes: number | null, sourceSizeBytes: number | null): number | null {
  if (candidateSizeBytes === null || sourceSizeBytes === null) {
    return null;
  }

  return candidateSizeBytes - sourceSizeBytes;
}

function bitRateToMbps(bitRate: number | null): number | null {
  if (bitRate === null) {
    return null;
  }

  return Number((bitRate / 1_000_000).toFixed(3));
}

function safeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizePathForComparison(value: string): string {
  return normalize(resolve(value));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createDuplicateScanCancelError();
  }
}

function createDuplicateScanCancelError(): Error {
  const error = new Error('Duplicate scan canceled.');
  error.name = 'AbortError';
  return error;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
