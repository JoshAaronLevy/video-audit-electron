import { randomUUID } from 'node:crypto';
import { lstat, readdir, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  FOLDER_TREE_SKIPPED_APP_FOLDER_NAMES,
  FOLDER_TREE_SKIPPED_FILE_NAMES,
  FOLDER_TREE_SKIPPED_FILE_PREFIXES,
  FOLDER_TREE_SKIPPED_FOLDER_NAMES,
  FOLDER_TREE_SKIPPED_SYSTEM_FOLDER_NAMES
} from '../../shared/constants/folderTree';
import { isSupportedVideoFileName } from '../../shared/constants/videoExtensions';
import type {
  FolderTreeNode,
  FolderTreeScanProgress,
  FolderTreeScanResult,
  FolderTreeSkipReason,
  FolderTreeWarning
} from '../../shared/types/folderTree';

const DEFAULT_PROGRESS_INTERVAL_MS = 250;
const SKIPPED_FOLDER_NAMES = new Set<string>(FOLDER_TREE_SKIPPED_FOLDER_NAMES);
const SYSTEM_FOLDER_NAMES = new Set<string>(FOLDER_TREE_SKIPPED_SYSTEM_FOLDER_NAMES);
const APP_FOLDER_NAMES = new Set<string>(FOLDER_TREE_SKIPPED_APP_FOLDER_NAMES);
const SKIPPED_FILE_NAMES = new Set<string>(FOLDER_TREE_SKIPPED_FILE_NAMES);

export interface ScanFolderTreeOptions {
  rootPath: string;
  scanId?: string;
  signal?: AbortSignal;
  progressIntervalMs?: number;
  onProgress?: (progress: FolderTreeScanProgress) => void;
}

interface ScanCounters {
  foldersScanned: number;
  foldersSkipped: number;
  videoFilesFound: number;
  videoSizeBytes: number;
  errorCount: number;
}

export async function scanFolderTree({
  rootPath,
  scanId = randomUUID(),
  signal,
  progressIntervalMs = DEFAULT_PROGRESS_INTERVAL_MS,
  onProgress
}: ScanFolderTreeOptions): Promise<FolderTreeScanResult> {
  const absoluteRootPath = normalizeRootPath(rootPath);
  const counters: ScanCounters = {
    foldersScanned: 0,
    foldersSkipped: 0,
    videoFilesFound: 0,
    videoSizeBytes: 0,
    errorCount: 0
  };
  const warnings: FolderTreeWarning[] = [];
  let lastProgressAt = 0;

  const emitProgress = (
    currentPath: string | null,
    message: string,
    options: {
      force?: boolean;
      warning?: FolderTreeWarning | null;
      error?: string | null;
      status?: FolderTreeScanProgress['status'];
    } = {}
  ): void => {
    if (!onProgress) {
      return;
    }

    const now = Date.now();

    if (!options.force && now - lastProgressAt < progressIntervalMs) {
      return;
    }

    lastProgressAt = now;
    onProgress({
      scanId,
      status: options.status ?? 'scanning',
      rootPath: absoluteRootPath,
      currentPath,
      foldersScanned: counters.foldersScanned,
      foldersSkipped: counters.foldersSkipped,
      videoFilesFound: counters.videoFilesFound,
      videoSizeBytes: counters.videoSizeBytes,
      message,
      warning: options.warning ?? null,
      error: options.error ?? null
    });
  };

  try {
    throwIfAborted(signal);
    await validateRootDirectory(absoluteRootPath);
    emitProgress(absoluteRootPath, 'Starting folder tree scan.', { force: true });

    const root = await scanFolder({
      folderPath: absoluteRootPath,
      rootPath: absoluteRootPath,
      signal,
      counters,
      warnings,
      emitProgress
    });

    emitProgress(null, 'Folder tree scan complete.', {
      force: true,
      status: 'complete'
    });

    return {
      scanId,
      rootPath: absoluteRootPath,
      generatedAt: new Date().toISOString(),
      root,
      summary: {
        foldersScanned: counters.foldersScanned,
        foldersSkipped: counters.foldersSkipped,
        videoFilesFound: counters.videoFilesFound,
        videoSizeBytes: counters.videoSizeBytes,
        skippedFolderCount: counters.foldersSkipped,
        errorCount: counters.errorCount,
        warningCount: warnings.length
      },
      warnings
    };
  } catch (error: unknown) {
    const wasCanceled = isAbortError(error);
    const message = wasCanceled
      ? 'Folder tree scan canceled.'
      : getErrorMessage(error, 'Folder tree scan failed.');

    emitProgress(null, message, {
      force: true,
      status: wasCanceled ? 'canceled' : 'error',
      error: wasCanceled ? null : message
    });

    throw error;
  }
}

async function scanFolder({
  folderPath,
  rootPath,
  signal,
  counters,
  warnings,
  emitProgress
}: {
  folderPath: string;
  rootPath: string;
  signal?: AbortSignal;
  counters: ScanCounters;
  warnings: FolderTreeWarning[];
  emitProgress: (
    currentPath: string | null,
    message: string,
    options?: {
      force?: boolean;
      warning?: FolderTreeWarning | null;
      error?: string | null;
      status?: FolderTreeScanProgress['status'];
    }
  ) => void;
}): Promise<FolderTreeNode> {
  throwIfAborted(signal);
  counters.foldersScanned += 1;
  emitProgress(folderPath, 'Scanning folders...');

  let entries;

  try {
    entries = await readdir(folderPath, { withFileTypes: true });
  } catch (error: unknown) {
    counters.errorCount += 1;
    const warning = createWarning(
      'unreadable-folder',
      folderPath,
      `Unable to read folder: ${getErrorMessage(error, 'Unknown error.')}`,
      'unreadable'
    );
    warnings.push(warning);
    emitProgress(folderPath, 'Skipping unreadable folder.', {
      force: true,
      warning
    });

    return createFolderNode({
      folderPath,
      rootPath,
      status: 'error',
      error: warning.message,
      warning
    });
  }

  entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  );

  const children: FolderTreeNode[] = [];
  let directVideoCount = 0;
  let directVideoSizeBytes = 0;

  for (const entry of entries) {
    throwIfAborted(signal);

    const entryPath = resolve(folderPath, entry.name);

    if (entry.isSymbolicLink()) {
      recordSkippedFolder({
        entryPath,
        reason: 'symlink',
        message: 'Skipping symbolic link.',
        counters,
        warnings,
        emitProgress
      });
      continue;
    }

    if (entry.isDirectory()) {
      const skipReason = getSkippedFolderReason(entry.name);

      if (skipReason) {
        recordSkippedFolder({
          entryPath,
          reason: skipReason,
          message: `Skipping ${skipReason === 'app-temp-folder' ? 'app-managed' : 'system'} folder.`,
          counters,
          warnings,
          emitProgress
        });
        continue;
      }

      children.push(
        await scanFolder({
          folderPath: entryPath,
          rootPath,
          signal,
          counters,
          warnings,
          emitProgress
        })
      );
      continue;
    }

    if (!entry.isFile() || shouldSkipFileName(entry.name) || !isSupportedVideoFileName(entry.name)) {
      continue;
    }

    try {
      const fileStats = await stat(entryPath);

      if (!fileStats.isFile()) {
        continue;
      }

      directVideoCount += 1;
      directVideoSizeBytes += fileStats.size;
      counters.videoFilesFound += 1;
      counters.videoSizeBytes += fileStats.size;
      emitProgress(entryPath, 'Counting supported video files...');
    } catch (error: unknown) {
      counters.errorCount += 1;
      const warning = createWarning(
        'unreadable-video-file',
        entryPath,
        `Unable to read video file metadata: ${getErrorMessage(error, 'Unknown error.')}`,
        'unreadable'
      );
      warnings.push(warning);
      emitProgress(entryPath, 'Skipping unreadable video file.', {
        force: true,
        warning
      });
    }
  }

  const totalVideoCount =
    directVideoCount + children.reduce((total, child) => total + child.totalVideoCount, 0);
  const totalVideoSizeBytes =
    directVideoSizeBytes +
    children.reduce((total, child) => total + child.totalVideoSizeBytes, 0);
  const totalFolderCount =
    1 + children.reduce((total, child) => total + child.totalFolderCount, 0);

  return createFolderNode({
    folderPath,
    rootPath,
    directVideoCount,
    totalVideoCount,
    directVideoSizeBytes,
    totalVideoSizeBytes,
    childFolderCount: children.length,
    totalFolderCount,
    children
  });
}

function createFolderNode({
  folderPath,
  rootPath,
  directVideoCount = 0,
  totalVideoCount = 0,
  directVideoSizeBytes = 0,
  totalVideoSizeBytes = 0,
  childFolderCount = 0,
  totalFolderCount = 1,
  status = 'ready',
  children = [],
  warning = null,
  error = null
}: {
  folderPath: string;
  rootPath: string;
  directVideoCount?: number;
  totalVideoCount?: number;
  directVideoSizeBytes?: number;
  totalVideoSizeBytes?: number;
  childFolderCount?: number;
  totalFolderCount?: number;
  status?: FolderTreeNode['status'];
  children?: FolderTreeNode[];
  warning?: FolderTreeWarning | null;
  error?: string | null;
}): FolderTreeNode {
  return {
    key: folderPath,
    path: folderPath,
    name: basename(folderPath) || folderPath,
    relativePath: toRelativeTreePath(rootPath, folderPath),
    directVideoCount,
    totalVideoCount,
    directVideoSizeBytes,
    totalVideoSizeBytes,
    childFolderCount,
    totalFolderCount,
    status,
    children,
    warning,
    error,
    skipped: false,
    skipReason: null
  };
}

async function validateRootDirectory(rootPath: string): Promise<void> {
  let stats;

  try {
    stats = await lstat(rootPath);
  } catch (error: unknown) {
    throw new Error(`Folder tree root could not be read: ${getErrorMessage(error, 'Unknown error.')}`);
  }

  if (stats.isSymbolicLink()) {
    throw new Error('Folder tree root cannot be a symbolic link.');
  }

  if (!stats.isDirectory()) {
    throw new Error('Folder tree root must be a directory.');
  }
}

function normalizeRootPath(rootPath: string): string {
  const trimmedRootPath = rootPath.trim();

  if (trimmedRootPath === '') {
    throw new Error('Folder tree root path is required.');
  }

  if (!isAbsolute(trimmedRootPath)) {
    throw new Error('Folder tree root path must be absolute.');
  }

  return resolve(trimmedRootPath);
}

function recordSkippedFolder({
  entryPath,
  reason,
  message,
  counters,
  warnings,
  emitProgress
}: {
  entryPath: string;
  reason: FolderTreeSkipReason;
  message: string;
  counters: ScanCounters;
  warnings: FolderTreeWarning[];
  emitProgress: (
    currentPath: string | null,
    message: string,
    options?: {
      force?: boolean;
      warning?: FolderTreeWarning | null;
      error?: string | null;
      status?: FolderTreeScanProgress['status'];
    }
  ) => void;
}): void {
  counters.foldersSkipped += 1;
  const warning = createWarning(
    reason === 'symlink' ? 'symlink-skipped' : 'folder-skipped',
    entryPath,
    message,
    reason
  );
  warnings.push(warning);
  emitProgress(entryPath, message, {
    warning
  });
}

function getSkippedFolderReason(folderName: string): FolderTreeSkipReason | null {
  if (!SKIPPED_FOLDER_NAMES.has(folderName)) {
    return null;
  }

  return APP_FOLDER_NAMES.has(folderName) && !SYSTEM_FOLDER_NAMES.has(folderName)
    ? 'app-temp-folder'
    : 'system-folder';
}

function shouldSkipFileName(fileName: string): boolean {
  return (
    SKIPPED_FILE_NAMES.has(fileName) ||
    FOLDER_TREE_SKIPPED_FILE_PREFIXES.some((prefix) => fileName.startsWith(prefix))
  );
}

function toRelativeTreePath(rootPath: string, childPath: string): string {
  const relativePath = relative(rootPath, childPath);
  return relativePath ? relativePath.split(sep).join('/') : '';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createFolderTreeCancelError();
  }
}

export function createFolderTreeCancelError(): Error {
  const error = new Error('Folder tree scan canceled.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createWarning(
  code: FolderTreeWarning['code'],
  path: string,
  message: string,
  reason?: FolderTreeSkipReason
): FolderTreeWarning {
  return {
    code,
    path,
    message,
    reason
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
