import { createHash } from 'node:crypto';
import {
  access,
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { isSupportedVideoFileName } from '../../shared/constants/videoExtensions';
import type {
  MigrationExecuteRequest,
  MigrationMatch,
  MigrationProgress,
  MigrationResult,
  MigrationResultItem,
  MigrationScanItem,
  MigrationScanRequest,
  MigrationScanResponse,
  MigrationScanResult
} from '../../shared/types/migration';

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.collie-video-temp',
  '.collie-video-trash',
  '.collie-video-cleanup-runs',
  'Archive',
  'archived-files',
  'node_modules'
]);

const migrationPlans = new Map<string, MigrationScanResult>();

interface CollectedVideoFile {
  path: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt: string | null;
  createdAt: string | null;
}

interface CollectionResult {
  files: CollectedVideoFile[];
  warnings: string[];
}

interface ValidScanRequest {
  newEditedDir: string;
  destinationRoot: string;
  archiveRoot: string;
}

interface MigrationManifestMatch extends MigrationMatch {
  archived?: boolean;
  error?: string | null;
}

interface MigrationManifestItem {
  fileName: string;
  sourcePath: string;
  tempDestinationPath: string;
  finalDestinationPath: string;
  status: 'running' | 'success' | 'failed';
  phase: string;
  sourceSizeBytes: number;
  finalSizeBytes: number | null;
  verified: boolean;
  verificationMethod: 'size';
  archivedMatches: MigrationManifestMatch[];
  warnings: string[];
  error: string | null;
}

interface MigrationManifest {
  schemaVersion: 1;
  runId: string;
  createdAt?: string;
  startedAt: string;
  completedAt: string | null;
  mode: 'flat-copy-new-and-archive-existing-matches';
  newEditedDir: string;
  destinationRoot: string;
  archiveRoot: string;
  archiveRunDir: string;
  summary: MigrationResult['summary'];
  warnings: string[];
  items: MigrationManifestItem[];
}

type ServiceProgress = Omit<MigrationProgress, 'jobId' | 'status' | 'error'>;

export async function scanMigration(
  request: Partial<MigrationScanRequest> | null | undefined
): Promise<MigrationScanResponse> {
  const validation = await validateScanRequest(request);

  if (!validation.ok) {
    return {
      status: 'invalid_request',
      message: validation.error
    };
  }

  const result = await createMigrationPlan(validation.request);
  migrationPlans.set(result.migrationId, result);

  return {
    status: 'complete',
    result
  };
}

export function validateMigrationExecuteRequest(
  request: Partial<MigrationExecuteRequest> | null | undefined
): { ok: true; request: MigrationExecuteRequest; plan: MigrationScanResult } | { ok: false; error: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Migration execute request is required.'
    };
  }

  if (typeof request.migrationId !== 'string' || request.migrationId.trim() === '') {
    return {
      ok: false,
      error: 'Run a migration scan before executing.'
    };
  }

  const migrationId = request.migrationId.trim();
  const plan = migrationPlans.get(migrationId);

  if (!plan) {
    return {
      ok: false,
      error: 'Migration plan not found. Run a fresh migration scan before executing.'
    };
  }

  return {
    ok: true,
    request: {
      migrationId
    },
    plan
  };
}

export async function executeMigrationPlan({
  plan,
  signal,
  onProgress
}: {
  plan: MigrationScanResult;
  signal?: AbortSignal;
  onProgress?: (progress: ServiceProgress) => void;
}): Promise<MigrationResult> {
  throwIfAborted(signal);
  await mkdir(plan.archiveRoot, { recursive: true });
  await mkdir(plan.archiveRunDir, { recursive: false });

  const archivedFilesDir = join(plan.archiveRunDir, 'archived-files');
  const tempRunDir = join(plan.destinationRoot, '.collie-video-temp', plan.migrationId);
  const manifestInProgressPath = join(plan.archiveRunDir, 'manifest.in-progress.json');
  const manifestPath = join(plan.archiveRunDir, 'manifest.json');
  const operationLogPath = join(plan.archiveRunDir, 'operation.log');
  const manifest = createManifest(plan);

  await mkdir(archivedFilesDir, { recursive: true });
  await mkdir(tempRunDir, { recursive: true });
  await appendOperationLog(operationLogPath, `Started migration ${plan.migrationId}`);
  await writeJson(manifestInProgressPath, manifest);

  for (const item of plan.items) {
    throwIfAborted(signal);

    const manifestItem: MigrationManifestItem = {
      fileName: item.fileName,
      sourcePath: item.sourcePath,
      tempDestinationPath: join(tempRunDir, item.fileName),
      finalDestinationPath: item.finalDestinationPath,
      status: 'running',
      phase: 'copying_temp',
      sourceSizeBytes: item.sourceSizeBytes,
      finalSizeBytes: null,
      verified: false,
      verificationMethod: 'size',
      archivedMatches: item.matches.map((match) => ({ ...match })),
      warnings: [...item.warnings],
      error: null
    };

    manifest.items.push(manifestItem);
    emitProgress(onProgress, serializeProgress({
      plan,
      manifest,
      phase: 'copying_temp',
      currentFile: item.fileName,
      message: 'Copying new file to a verified temp location...'
    }));
    await writeJson(manifestInProgressPath, manifest);

    try {
      if (item.status === 'blocked') {
        throw new Error('Item is blocked by scan warnings and was not modified.');
      }

      await ensureSourceStillMatchesPlan(item);
      await copyFile(item.sourcePath, manifestItem.tempDestinationPath);

      const tempVerified = await verifyFileSize({
        filePath: manifestItem.tempDestinationPath,
        expectedSize: item.sourceSizeBytes
      });

      if (!tempVerified) {
        throw new Error('Temp copy size verification failed.');
      }

      manifestItem.verified = true;
      manifestItem.phase = 'archiving_matches';
      await appendOperationLog(operationLogPath, `Verified temp copy for ${item.sourcePath}`);
      emitProgress(onProgress, serializeProgress({
        plan,
        manifest,
        phase: 'archiving_matches',
        currentFile: item.fileName,
        message: 'Archiving matching old destination files...'
      }));
      await writeJson(manifestInProgressPath, manifest);

      const archiveResult = await archiveMatches({
        manifestItem,
        operationLogPath
      });

      manifest.summary.destinationMatchesArchived += archiveResult.archivedCount;
      manifest.summary.oldBytesArchived += archiveResult.archivedBytes;

      if (archiveResult.errors.length > 0) {
        throw new Error(`Unable to archive all destination matches: ${archiveResult.errors.join('; ')}`);
      }

      manifestItem.phase = 'finalizing_destination';
      emitProgress(onProgress, serializeProgress({
        plan,
        manifest,
        phase: 'finalizing_destination',
        currentFile: item.fileName,
        message: 'Moving verified temp file into the flat destination...'
      }));

      if (await pathExists(manifestItem.finalDestinationPath)) {
        throw new Error('Final destination still exists after archiving planned matches. Refusing to overwrite it.');
      }

      await appendOperationLog(
        operationLogPath,
        `Finalizing ${manifestItem.tempDestinationPath} -> ${manifestItem.finalDestinationPath}`
      );
      await rename(manifestItem.tempDestinationPath, manifestItem.finalDestinationPath);

      const finalStats = await stat(manifestItem.finalDestinationPath);

      if (!finalStats.isFile() || finalStats.size !== item.sourceSizeBytes) {
        throw new Error('Final destination size verification failed.');
      }

      manifestItem.status = 'success';
      manifestItem.phase = 'complete';
      manifestItem.finalSizeBytes = finalStats.size;
      manifest.summary.filesCopiedToDestination += 1;
      manifest.summary.newBytesCopied += finalStats.size;
      await appendOperationLog(operationLogPath, `Completed ${item.fileName} (${finalStats.size} bytes)`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      manifestItem.status = 'failed';
      manifestItem.phase = 'error';
      manifestItem.error = message;
      manifest.summary.failedItems += 1;

      const archivedAnyMatch = manifestItem.archivedMatches.some((match) => match.archived);

      if (!archivedAnyMatch && (await pathExists(manifestItem.tempDestinationPath))) {
        await safeRemoveTempFile(manifestItem.tempDestinationPath, operationLogPath);
      }

      await appendOperationLog(operationLogPath, `Failed ${item.fileName}: ${message}`);
    }

    emitProgress(onProgress, serializeProgress({
      plan,
      manifest,
      phase: manifestItem.phase,
      currentFile: item.fileName,
      message: manifestItem.status === 'success' ? 'Migration item complete.' : 'Migration item failed.'
    }));
    await writeJson(manifestInProgressPath, manifest);
  }

  manifest.completedAt = nowIsoString();
  await writeJson(manifestInProgressPath, manifest);
  await rename(manifestInProgressPath, manifestPath);
  await appendOperationLog(operationLogPath, `Completed migration ${plan.migrationId}`);

  return {
    migrationId: plan.migrationId,
    status: 'complete',
    archiveRunDir: plan.archiveRunDir,
    manifestPath,
    operationLogPath,
    summary: manifest.summary,
    items: manifest.items.map(toResultItem)
  };
}

async function validateScanRequest(
  request: Partial<MigrationScanRequest> | null | undefined
): Promise<{ ok: true; request: ValidScanRequest } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Migration scan request is required.'
    };
  }

  let newEditedDir: string;
  let destinationRoot: string;

  try {
    newEditedDir = await assertAbsoluteDirectory({
      label: 'newEditedDir',
      value: request.newEditedDir
    });
    destinationRoot = await assertAbsoluteDirectory({
      label: 'destinationRoot',
      value: request.destinationRoot
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: getErrorMessage(error)
    };
  }

  if (isSamePath(newEditedDir, destinationRoot)) {
    return {
      ok: false,
      error: 'newEditedDir and destinationRoot must be different directories.'
    };
  }

  if (isPathInside(destinationRoot, newEditedDir)) {
    return {
      ok: false,
      error: 'newEditedDir must not be inside destinationRoot.'
    };
  }

  if (isPathInside(newEditedDir, destinationRoot)) {
    return {
      ok: false,
      error: 'destinationRoot must not be inside newEditedDir.'
    };
  }

  const archiveRoot = request.archiveRoot
    ? normalizePathString(request.archiveRoot)
    : join(dirname(destinationRoot), 'Archive');

  if (!isAbsolute(archiveRoot)) {
    return {
      ok: false,
      error: 'archiveRoot must be an absolute path when provided.'
    };
  }

  try {
    const archiveStats = await lstat(archiveRoot);

    if (archiveStats.isSymbolicLink()) {
      return {
        ok: false,
        error: 'archiveRoot must not be a symlink.'
      };
    }

    if (!archiveStats.isDirectory()) {
      return {
        ok: false,
        error: 'archiveRoot must point to a directory when it already exists.'
      };
    }
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return {
        ok: false,
        error: `Unable to inspect archiveRoot: ${getErrorMessage(error)}`
      };
    }
  }

  if (isSamePath(archiveRoot, destinationRoot)) {
    return {
      ok: false,
      error: 'archiveRoot must not be the same as destinationRoot.'
    };
  }

  if (isPathInside(destinationRoot, archiveRoot)) {
    return {
      ok: false,
      error: 'archiveRoot must not be inside destinationRoot.'
    };
  }

  return {
    ok: true,
    request: {
      newEditedDir,
      destinationRoot,
      archiveRoot
    }
  };
}

async function assertAbsoluteDirectory({
  label,
  value
}: {
  label: string;
  value: unknown;
}): Promise<string> {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required.`);
  }

  if (!isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path.`);
  }

  const absolutePath = normalizePathString(value);
  const pathStats = await lstat(absolutePath);

  if (pathStats.isSymbolicLink()) {
    throw new Error(`${label} must not be a symlink.`);
  }

  if (!pathStats.isDirectory()) {
    throw new Error(`${label} must point to a directory.`);
  }

  return absolutePath;
}

async function createMigrationPlan({
  newEditedDir,
  destinationRoot,
  archiveRoot
}: ValidScanRequest): Promise<MigrationScanResult> {
  const migrationId = createMigrationId();
  const archiveRunDir = join(archiveRoot, migrationId);
  const sourceResult = await collectVideoFiles({ rootDir: newEditedDir, archiveRoot });
  const destinationResult = await collectVideoFiles({ rootDir: destinationRoot, archiveRoot });
  const destinationByFileName = new Map<string, CollectedVideoFile[]>();

  for (const destinationFile of destinationResult.files) {
    const files = destinationByFileName.get(destinationFile.fileName) ?? [];
    files.push(destinationFile);
    destinationByFileName.set(destinationFile.fileName, files);
  }

  const items: MigrationScanItem[] = sourceResult.files
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((sourceFile) => {
      const matches = (destinationByFileName.get(sourceFile.fileName) ?? [])
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((destinationFile): MigrationMatch => {
          const originalRelativePath = getDestinationRelativePath({
            destinationRoot,
            filePath: destinationFile.path
          });
          const archiveRelativePath = getArchiveRelativePath(originalRelativePath);

          return {
            originalPath: destinationFile.path,
            originalRelativePath,
            archivePath: join(archiveRunDir, archiveRelativePath),
            archiveRelativePath,
            sizeBytes: destinationFile.sizeBytes,
            modifiedAt: destinationFile.modifiedAt ?? undefined,
            createdAt: destinationFile.createdAt ?? undefined
          };
        });

      return {
        fileName: sourceFile.fileName,
        sourcePath: sourceFile.path,
        finalDestinationPath: join(destinationRoot, sourceFile.fileName),
        sourceSizeBytes: sourceFile.sizeBytes,
        matchCount: matches.length,
        matches,
        action: matches.length > 0 ? 'copy_new_flat_and_archive_matches' : 'copy_new_flat',
        status: 'planned',
        warnings: []
      };
    });

  addDuplicateSourceWarnings(items);

  return {
    migrationId,
    status: 'planned',
    createdAt: nowIsoString(),
    newEditedDir,
    destinationRoot,
    archiveRoot,
    archiveRunDir,
    summary: buildSummary(items),
    items,
    warnings: [...sourceResult.warnings, ...destinationResult.warnings]
  };
}

async function collectVideoFiles({
  rootDir,
  archiveRoot = null
}: {
  rootDir: string;
  archiveRoot?: string | null;
}): Promise<CollectionResult> {
  const files: CollectedVideoFile[] = [];
  const warnings: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;

    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error: unknown) {
      warnings.push(`Skipping unreadable directory: ${currentDir} (${getErrorMessage(error)})`);
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        warnings.push(`Skipping symlink: ${fullPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldSkipDirectory({ entryName: entry.name, fullPath, archiveRoot })) {
          continue;
        }

        await walk(fullPath);
        continue;
      }

      if (!entry.isFile() || shouldSkipFileName(entry.name) || !isSupportedVideoFileName(entry.name)) {
        continue;
      }

      try {
        const fileStats = await stat(fullPath);

        if (!fileStats.isFile()) {
          continue;
        }

        files.push({
          path: fullPath,
          fileName: entry.name,
          sizeBytes: fileStats.size,
          modifiedAt: toIsoStringOrNull(fileStats.mtime),
          createdAt: toIsoStringOrNull(fileStats.birthtime)
        });
      } catch (error: unknown) {
        warnings.push(`Skipping unreadable file: ${fullPath} (${getErrorMessage(error)})`);
      }
    }
  }

  await walk(rootDir);

  return {
    files,
    warnings
  };
}

function buildSummary(items: MigrationScanItem[]): MigrationScanResult['summary'] {
  const newFilesFound = items.length;
  const filesWithMatches = items.filter((item) => item.matchCount > 0).length;
  const totalDestinationMatchesToArchive = items.reduce(
    (total, item) => total + item.matchCount,
    0
  );
  const newBytesToCopy = items.reduce((total, item) => total + item.sourceSizeBytes, 0);
  const oldBytesToArchive = items.reduce(
    (total, item) => total + item.matches.reduce((matchTotal, match) => matchTotal + match.sizeBytes, 0),
    0
  );

  return {
    newFilesFound,
    filesWithMatches,
    filesWithoutMatches: newFilesFound - filesWithMatches,
    totalDestinationMatchesToArchive,
    multiMatchFiles: items.filter((item) => item.matchCount > 1).length,
    newBytesToCopy,
    oldBytesToArchive,
    netActiveFileDelta: newFilesFound - totalDestinationMatchesToArchive,
    netActiveBytesDelta: newBytesToCopy - oldBytesToArchive,
    potentialBytesReclaimableIfArchiveDeleted: oldBytesToArchive
  };
}

function addDuplicateSourceWarnings(items: MigrationScanItem[]): void {
  const fileNameCounts = new Map<string, number>();

  for (const item of items) {
    fileNameCounts.set(item.fileName, (fileNameCounts.get(item.fileName) ?? 0) + 1);
  }

  for (const item of items) {
    if ((fileNameCounts.get(item.fileName) ?? 0) <= 1) {
      continue;
    }

    item.action = 'blocked_duplicate_source_filename';
    item.status = 'blocked';
    item.warnings.push(
      'Multiple new source files have this filename. Resolve duplicates before executing this item.'
    );
  }
}

function createManifest(plan: MigrationScanResult): MigrationManifest {
  return {
    schemaVersion: 1,
    runId: plan.migrationId,
    createdAt: plan.createdAt,
    startedAt: nowIsoString(),
    completedAt: null,
    mode: 'flat-copy-new-and-archive-existing-matches',
    newEditedDir: plan.newEditedDir,
    destinationRoot: plan.destinationRoot,
    archiveRoot: plan.archiveRoot,
    archiveRunDir: plan.archiveRunDir,
    summary: {
      newFilesFound: plan.summary.newFilesFound,
      filesCopiedToDestination: 0,
      destinationMatchesArchived: 0,
      filesWithNoMatches: plan.summary.filesWithoutMatches,
      multiMatchFiles: plan.summary.multiMatchFiles,
      failedItems: 0,
      newBytesCopied: 0,
      oldBytesArchived: 0,
      netActiveFileDelta: plan.summary.netActiveFileDelta,
      netActiveBytesDelta: plan.summary.netActiveBytesDelta,
      potentialBytesReclaimableIfArchiveDeleted: plan.summary.potentialBytesReclaimableIfArchiveDeleted
    },
    warnings: plan.warnings,
    items: []
  };
}

async function ensureSourceStillMatchesPlan(item: MigrationScanItem): Promise<void> {
  const sourceStats = await lstat(item.sourcePath);

  if (sourceStats.isSymbolicLink()) {
    throw new Error('Source file is a symlink and will not be copied.');
  }

  if (!sourceStats.isFile()) {
    throw new Error('Source path no longer points to a file.');
  }

  if (sourceStats.size !== item.sourceSizeBytes) {
    throw new Error('Source file size changed after the scan plan was created.');
  }
}

async function archiveMatches({
  manifestItem,
  operationLogPath
}: {
  manifestItem: MigrationManifestItem;
  operationLogPath: string;
}): Promise<{ archivedCount: number; archivedBytes: number; errors: string[] }> {
  let archivedCount = 0;
  let archivedBytes = 0;
  const errors: string[] = [];

  for (const match of manifestItem.archivedMatches) {
    try {
      const matchStats = await lstat(match.originalPath);

      if (matchStats.isSymbolicLink()) {
        manifestItem.warnings.push(`Skipped symlink destination match: ${match.originalPath}`);
        continue;
      }

      if (!matchStats.isFile()) {
        manifestItem.warnings.push(`Skipped non-file destination match: ${match.originalPath}`);
        continue;
      }

      const archivePath = await getAvailableArchivePath(match.archivePath, match.originalPath);
      match.archivePath = archivePath;
      match.archiveRelativePath = getArchiveRelativePathFromAbsolute(archivePath);

      await mkdir(dirname(archivePath), { recursive: true });
      await appendOperationLog(operationLogPath, `Archiving ${match.originalPath} -> ${archivePath}`);
      await rename(match.originalPath, archivePath);

      match.archived = true;
      archivedCount += 1;
      archivedBytes += matchStats.size;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        manifestItem.warnings.push(`Old destination match was already missing: ${match.originalPath}`);
        continue;
      }

      const message = getErrorMessage(error);
      match.error = message;
      errors.push(`${match.originalPath}: ${message}`);
      await appendOperationLog(operationLogPath, `Failed to archive ${match.originalPath}: ${message}`);
    }
  }

  return {
    archivedCount,
    archivedBytes,
    errors
  };
}

async function verifyFileSize({
  filePath,
  expectedSize
}: {
  filePath: string;
  expectedSize: number;
}): Promise<boolean> {
  const fileStats = await stat(filePath);
  return fileStats.isFile() && fileStats.size === expectedSize;
}

async function safeRemoveTempFile(tempPath: string, operationLogPath: string): Promise<void> {
  try {
    await unlink(tempPath);
    await appendOperationLog(operationLogPath, `Removed temp file ${tempPath}`);
  } catch {
    // A leftover temp file is safer than touching source or destination data.
  }
}

function serializeProgress({
  plan,
  manifest,
  phase,
  currentFile,
  message
}: {
  plan: MigrationScanResult;
  manifest: MigrationManifest;
  phase: string;
  currentFile: string | null;
  message: string;
}): ServiceProgress {
  return {
    migrationId: plan.migrationId,
    phase,
    totalFiles: plan.items.length,
    processedFiles: manifest.summary.filesCopiedToDestination + manifest.summary.failedItems,
    copiedCount: manifest.summary.filesCopiedToDestination,
    archivedCount: manifest.summary.destinationMatchesArchived,
    failedCount: manifest.summary.failedItems,
    currentFile,
    message
  };
}

function toResultItem(item: MigrationManifestItem): MigrationResultItem {
  return {
    fileName: item.fileName,
    sourcePath: item.sourcePath,
    finalDestinationPath: item.finalDestinationPath,
    status: item.status,
    archivedMatches: item.archivedMatches.map((match) => ({
      originalPath: match.originalPath,
      archivePath: match.archivePath,
      sizeBytes: match.sizeBytes
    })),
    error: item.error,
    warnings: item.warnings
  };
}

function emitProgress(
  onProgress: ((progress: ServiceProgress) => void) | undefined,
  update: ServiceProgress
): void {
  onProgress?.(update);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

async function appendOperationLog(operationLogPath: string, message: string): Promise<void> {
  await appendFile(operationLogPath, `[${nowIsoString()}] ${message}\n`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getAvailableArchivePath(filePath: string, seed: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return filePath;
  }

  const collisionPath = createArchiveCollisionPath(filePath, seed);

  if (!(await pathExists(collisionPath))) {
    return collisionPath;
  }

  for (let index = 2; index < 1000; index += 1) {
    const parsed = parse(collisionPath);
    const candidate = join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);

    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate archive path for ${filePath}.`);
}

function createArchiveCollisionPath(filePath: string, seed: string): string {
  const parsed = parse(filePath);
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 10);

  return join(parsed.dir, `${parsed.name}--${hash}${parsed.ext}`);
}

function getDestinationRelativePath({
  destinationRoot,
  filePath
}: {
  destinationRoot: string;
  filePath: string;
}): string {
  const relativePath = relative(destinationRoot, filePath);

  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Unable to build archive path for ${filePath}.`);
  }

  const parsed = parse(relativePath);

  if (parsed.dir === '') {
    return join('root', parsed.base);
  }

  return relativePath;
}

function getArchiveRelativePath(originalRelativePath: string): string {
  return join('archived-files', originalRelativePath);
}

function getArchiveRelativePathFromAbsolute(archivePath: string): string {
  const marker = `${sep}archived-files${sep}`;
  const index = archivePath.indexOf(marker);

  if (index === -1) {
    return basename(archivePath);
  }

  return archivePath.slice(index + 1);
}

function shouldSkipDirectory({
  entryName,
  fullPath,
  archiveRoot
}: {
  entryName: string;
  fullPath: string;
  archiveRoot: string | null;
}): boolean {
  if (EXCLUDED_DIRECTORY_NAMES.has(entryName)) {
    return true;
  }

  if (!archiveRoot) {
    return false;
  }

  const normalizedFullPath = normalizePathString(fullPath);
  const normalizedArchiveRoot = normalizePathString(archiveRoot);

  return (
    normalizedFullPath === normalizedArchiveRoot ||
    isPathInside(normalizedArchiveRoot, normalizedFullPath)
  );
}

function shouldSkipFileName(fileName: string): boolean {
  return fileName === '.DS_Store' || fileName.startsWith('._');
}

function createMigrationId(date = new Date()): string {
  return `collie-video-migration-${timestampForRunId(date)}`;
}

function timestampForRunId(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}-${milliseconds}`;
}

function normalizePathString(value: string): string {
  return resolve(value);
}

function isSamePath(left: string, right: string): boolean {
  return normalizePathString(left) === normalizePathString(right);
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = relative(normalizePathString(parentPath), normalizePathString(childPath));

  return Boolean(relativePath) && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function toIsoStringOrNull(value: Date): string | null {
  const timestamp = value.getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return value.toISOString();
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Migration canceled.');
    error.name = 'AbortError';
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Migration failed.';
}
