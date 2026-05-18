import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  CancelFolderTreeScanResponse,
  ChooseFolderTreeRootResult,
  FolderTreeScanJobSnapshot,
  FolderTreeScanProgress,
  FolderTreeScanResult,
  ScanFolderTreeResultResponse,
  ScanFolderTreeStartResponse
} from '../../shared/types/folderTree';
import { scanFolderTree } from '../services/folderTreeService';
import { getSettings } from '../services/settingsService';

interface FolderTreeScanJob {
  id: string;
  rootPath: string;
  abortController: AbortController;
  snapshot: FolderTreeScanJobSnapshot;
  result: FolderTreeScanResult | null;
}

const selectedRootPaths = new Set<string>();
const folderTreeScanJobs = new Map<string, FolderTreeScanJob>();

export function registerFolderTreeIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.folderTreeChooseRootFolder,
    async (event): Promise<ChooseFolderTreeRootResult> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const dialogOptions: OpenDialogOptions = {
        title: 'Choose folder tree root',
        properties: ['openDirectory']
      };
      const result = browserWindow
        ? await dialog.showOpenDialog(browserWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return {
          canceled: true,
          path: null
        };
      }

      let selectedPath: string;

      try {
        selectedPath = normalizeRootPath(result.filePaths[0]);
        await validateChosenRoot(selectedPath);
      } catch (error: unknown) {
        return {
          canceled: false,
          path: null,
          message: getErrorMessage(error, 'Selected folder cannot be used as a folder tree root.')
        };
      }

      selectedRootPaths.add(selectedPath);

      return {
        canceled: false,
        path: selectedPath
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.folderTreeScanRoot,
    async (event, rootPath: string): Promise<ScanFolderTreeStartResponse> => {
      let normalizedRootPath: string;

      try {
        normalizedRootPath = normalizeRootPath(rootPath);
      } catch (error: unknown) {
        return {
          status: 'invalid_request',
          message: getErrorMessage(error, 'Folder tree root path is invalid.')
        };
      }

      if (!(await isAuthorizedFolderTreeRoot(normalizedRootPath))) {
        return {
          status: 'invalid_request',
          message: 'Choose a folder tree root before scanning it.'
        };
      }

      const scanId = randomUUID();
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job: FolderTreeScanJob = {
        id: scanId,
        rootPath: normalizedRootPath,
        abortController: new AbortController(),
        result: null,
        snapshot: {
          scanId,
          status: 'scanning',
          rootPath: normalizedRootPath,
          currentPath: null,
          foldersScanned: 0,
          foldersSkipped: 0,
          videoFilesFound: 0,
          videoSizeBytes: 0,
          message: 'Starting folder tree scan.',
          warning: null,
          error: null
        }
      };

      folderTreeScanJobs.set(scanId, job);
      sendFolderTreeProgress(browserWindow, job.snapshot);
      void runFolderTreeScanJob(job, browserWindow);

      return {
        scanId,
        status: 'started',
        message: 'Folder tree scan started.'
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.folderTreeCancelScan,
    (event, scanId: string): CancelFolderTreeScanResponse => {
      const job = folderTreeScanJobs.get(scanId);

      if (!job) {
        return {
          scanId,
          ok: false,
          message: 'Folder tree scan not found.'
        };
      }

      if (
        job.snapshot.status === 'complete' ||
        job.snapshot.status === 'error' ||
        job.snapshot.status === 'canceled'
      ) {
        return {
          scanId,
          ok: true,
          progress: job.snapshot,
          message: job.snapshot.message
        };
      }

      job.abortController.abort();
      job.snapshot = {
        ...job.snapshot,
        status: 'canceled',
        currentPath: null,
        message: 'Folder tree scan canceled.',
        error: null
      };

      sendFolderTreeProgress(BrowserWindow.fromWebContents(event.sender), job.snapshot);

      return {
        scanId,
        ok: true,
        progress: job.snapshot,
        message: job.snapshot.message
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.folderTreeGetResult,
    (_event, scanId: string): ScanFolderTreeResultResponse => {
      const job = folderTreeScanJobs.get(scanId);

      if (!job) {
        return {
          scanId,
          status: 'not_found',
          message: 'Folder tree scan not found.'
        };
      }

      if (job.result) {
        return {
          scanId,
          status: 'complete',
          result: job.result
        };
      }

      if (job.snapshot.status === 'error' || job.snapshot.status === 'canceled') {
        return {
          scanId,
          status: job.snapshot.status,
          message: job.snapshot.message
        };
      }

      return {
        scanId,
        status: 'not_ready',
        message: 'Folder tree scan result is not ready.'
      };
    }
  );
}

async function isAuthorizedFolderTreeRoot(rootPath: string): Promise<boolean> {
  if (selectedRootPaths.has(rootPath)) {
    return true;
  }

  try {
    const settings = await getSettings();
    const persistedRootPath = settings.latestFolderTreeSource?.rootPath;
    return persistedRootPath ? normalizeRootPath(persistedRootPath) === rootPath : false;
  } catch {
    return false;
  }
}

async function runFolderTreeScanJob(
  job: FolderTreeScanJob,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const result = await scanFolderTree({
      rootPath: job.rootPath,
      scanId: job.id,
      signal: job.abortController.signal,
      onProgress: (progress) => updateFolderTreeProgress(job, browserWindow, progress)
    });

    job.result = result;
    updateFolderTreeProgress(job, browserWindow, {
      scanId: job.id,
      status: 'complete',
      rootPath: job.rootPath,
      currentPath: null,
      foldersScanned: result.summary.foldersScanned,
      foldersSkipped: result.summary.foldersSkipped,
      videoFilesFound: result.summary.videoFilesFound,
      videoSizeBytes: result.summary.videoSizeBytes,
      message: 'Folder tree scan complete.',
      warning: null,
      error: null,
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    updateFolderTreeProgress(job, browserWindow, {
      ...job.snapshot,
      status: wasCanceled ? 'canceled' : 'error',
      currentPath: null,
      message: wasCanceled ? 'Folder tree scan canceled.' : 'Folder tree scan failed.',
      error: wasCanceled ? null : getErrorMessage(error, 'Folder tree scan failed.')
    });
  }
}

function updateFolderTreeProgress(
  job: FolderTreeScanJob,
  browserWindow: BrowserWindow | null,
  progress: FolderTreeScanJobSnapshot | FolderTreeScanProgress
): void {
  job.snapshot = {
    ...job.snapshot,
    ...progress
  };
  sendFolderTreeProgress(browserWindow, job.snapshot);
}

function sendFolderTreeProgress(
  browserWindow: BrowserWindow | null,
  snapshot: FolderTreeScanJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.folderTreeProgress, snapshot);
}

async function validateChosenRoot(rootPath: string): Promise<void> {
  const stats = await lstat(rootPath);

  if (stats.isSymbolicLink()) {
    throw new Error('Folder tree root cannot be a symbolic link.');
  }

  if (!stats.isDirectory()) {
    throw new Error('Folder tree root must be a directory.');
  }
}

function normalizeRootPath(rootPath: unknown): string {
  if (typeof rootPath !== 'string') {
    throw new Error('Folder tree root path must be a string.');
  }

  const trimmedRootPath = rootPath.trim();

  if (trimmedRootPath === '') {
    throw new Error('Folder tree root path is required.');
  }

  if (!isAbsolute(trimmedRootPath)) {
    throw new Error('Folder tree root path must be absolute.');
  }

  return resolve(trimmedRootPath);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
