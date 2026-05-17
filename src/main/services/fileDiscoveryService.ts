import { lstat, readdir, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import {
  getVideoFileType,
  isSupportedVideoFileName,
  normalizeVideoExtension
} from '../../shared/constants/videoExtensions';
import type {
  DiscoveredVideoFile,
  FileDiscoveryProgress,
  FileDiscoveryRequest
} from '../../shared/types/audit';

const SYSTEM_DIRECTORY_NAMES = new Set([
  '.Spotlight-V100',
  '.Trashes',
  '.fseventsd',
  '.TemporaryItems',
  'System Volume Information',
  '.git',
  'node_modules',
  '.video-audit-temp',
  '.video-audit-trash',
  '.video-audit-cleanup-runs',
  'Archive',
  'archived-files'
]);

export interface FileDiscoveryServiceResult {
  files: DiscoveredVideoFile[];
  skippedFiles: number;
}

export interface DiscoverVideoFilesOptions extends FileDiscoveryRequest {
  signal?: AbortSignal;
  onProgress?: (progress: Omit<FileDiscoveryProgress, 'jobId' | 'status'>) => void;
}

export async function discoverVideoFiles({
  folderPaths,
  filePaths,
  includeSubfolders,
  signal,
  onProgress
}: DiscoverVideoFilesOptions): Promise<FileDiscoveryServiceResult> {
  const files: DiscoveredVideoFile[] = [];
  const seenPaths = new Set<string>();
  let skippedFiles = 0;
  let processedFiles = 0;

  const emitProgress = (
    update: Partial<Omit<FileDiscoveryProgress, 'jobId' | 'status'>>
  ): void => {
    onProgress?.({
      phase: update.phase ?? 'walking',
      totalFiles: null,
      processedFiles: update.processedFiles ?? processedFiles,
      skippedFiles: update.skippedFiles ?? skippedFiles,
      foundCount: update.foundCount ?? files.length,
      currentPath: update.currentPath ?? null,
      message: update.message ?? 'Finding video files...'
    });
  };

  throwIfAborted(signal);
  emitProgress({
    phase: 'validating',
    message: 'Validating selected files...'
  });

  for (const filePath of filePaths) {
    throwIfAborted(signal);
    const discovered = await discoverSelectedFile(filePath);
    processedFiles += 1;

    if (!discovered) {
      skippedFiles += 1;
      emitProgress({
        phase: 'validating',
        currentPath: filePath,
        message: 'Skipping unsupported or unreadable selected file.'
      });
      continue;
    }

    addDiscoveredFile(discovered, files, seenPaths);
    emitProgress({
      phase: 'validating',
      currentPath: discovered.path,
      message: 'Selected video file ready.'
    });
  }

  emitProgress({
    phase: 'walking',
    currentPath: null,
    message: 'Finding video files...'
  });

  async function walkFolder(folderPath: string): Promise<void> {
    throwIfAborted(signal);

    let entries;

    try {
      entries = await readdir(folderPath, { withFileTypes: true });
    } catch {
      skippedFiles += 1;
      emitProgress({
        phase: 'walking',
        currentPath: folderPath,
        message: 'Skipping unreadable directory.'
      });
      return;
    }

    for (const entry of entries) {
      throwIfAborted(signal);

      const entryPath = resolve(folderPath, entry.name);

      if (entry.isSymbolicLink()) {
        skippedFiles += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (SYSTEM_DIRECTORY_NAMES.has(entry.name)) {
          skippedFiles += 1;
          continue;
        }

        if (includeSubfolders) {
          await walkFolder(entryPath);
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldSkipFileName(entry.name)) {
        skippedFiles += 1;
        continue;
      }

      processedFiles += 1;

      if (!isSupportedVideoFileName(entry.name)) {
        continue;
      }

      const discovered = await buildDiscoveredVideoFile(entryPath);

      if (!discovered) {
        skippedFiles += 1;
        continue;
      }

      addDiscoveredFile(discovered, files, seenPaths);
      emitProgress({
        phase: 'walking',
        currentPath: discovered.path,
        message: 'Finding video files...'
      });
    }
  }

  for (const folderPath of folderPaths) {
    throwIfAborted(signal);
    await walkFolder(resolve(folderPath));
  }

  emitProgress({
    phase: 'complete',
    currentPath: null,
    message: `Found ${files.length} video files.`
  });

  return {
    files,
    skippedFiles
  };
}

async function discoverSelectedFile(filePath: string): Promise<DiscoveredVideoFile | null> {
  const resolvedPath = resolve(filePath);
  const fileName = basename(resolvedPath);

  if (shouldSkipFileName(fileName) || !isSupportedVideoFileName(fileName)) {
    return null;
  }

  try {
    const linkStats = await lstat(resolvedPath);

    if (linkStats.isSymbolicLink() || !linkStats.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return buildDiscoveredVideoFile(resolvedPath);
}

async function buildDiscoveredVideoFile(filePath: string): Promise<DiscoveredVideoFile | null> {
  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return null;
    }

    return {
      path: resolve(filePath),
      directory: dirname(resolve(filePath)),
      fileName: basename(filePath),
      extension: normalizeVideoExtension(filePath),
      fileType: getVideoFileType(filePath),
      sizeBytes: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    };
  } catch {
    return null;
  }
}

function addDiscoveredFile(
  file: DiscoveredVideoFile,
  files: DiscoveredVideoFile[],
  seenPaths: Set<string>
): void {
  if (seenPaths.has(file.path)) {
    return;
  }

  seenPaths.add(file.path);
  files.push(file);
}

function shouldSkipFileName(fileName: string): boolean {
  return fileName === '.DS_Store' || fileName.startsWith('._');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createDiscoveryCancelError();
  }
}

export function createDiscoveryCancelError(): Error {
  const error = new Error('File discovery canceled.');
  error.name = 'AbortError';
  return error;
}
