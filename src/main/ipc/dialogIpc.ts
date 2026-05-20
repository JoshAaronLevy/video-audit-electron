import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type OpenDialogReturnValue } from 'electron';
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import { SUPPORTED_VIDEO_EXTENSION_NAMES } from '../../shared/constants/videoExtensions';
import type {
  PathKind,
  PathSelectionResult,
  PathValidationResult
} from '../../shared/types/dialog';

export function registerDialogIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.dialogChooseFolders, async (event): Promise<PathSelectionResult> => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await showDialog(browserWindow, {
      title: 'Choose folders to audit',
      properties: ['openDirectory', 'multiSelections', 'createDirectory']
    });

    return buildSelectionResult(result.canceled, result.filePaths, 'directory');
  });

  ipcMain.handle(
    IPC_CHANNELS.dialogChooseVideoFiles,
    async (event): Promise<PathSelectionResult> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const result = await showDialog(browserWindow, {
        title: 'Choose video files to audit',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Video Files',
            extensions: [...SUPPORTED_VIDEO_EXTENSION_NAMES]
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      return buildSelectionResult(result.canceled, result.filePaths, 'file');
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.dialogChooseOutputFolder,
    async (event): Promise<PathSelectionResult> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const result = await showDialog(browserWindow, {
        title: 'Choose an output folder',
        properties: ['openDirectory', 'createDirectory']
      });

      return buildSelectionResult(result.canceled, result.filePaths, 'directory');
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.dialogChooseMoveDestinationFolder,
    async (event): Promise<PathSelectionResult> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const result = await showDialog(browserWindow, {
        title: 'Choose a destination folder',
        properties: ['openDirectory', 'createDirectory']
      });

      return buildSelectionResult(result.canceled, result.filePaths, 'directory');
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.dialogChooseDuplicateScanFolder,
    async (event): Promise<PathSelectionResult> => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const result = await showDialog(browserWindow, {
        title: 'Choose folder for Duplicate Scan',
        properties: ['openDirectory']
      });

      return buildSelectionResult(result.canceled, result.filePaths, 'directory');
    }
  );
}

function showDialog(
  browserWindow: BrowserWindow | undefined,
  options: OpenDialogOptions
): Promise<OpenDialogReturnValue> {
  return browserWindow ? dialog.showOpenDialog(browserWindow, options) : dialog.showOpenDialog(options);
}

async function buildSelectionResult(
  canceled: boolean,
  filePaths: string[],
  expected: PathKind
): Promise<PathSelectionResult> {
  if (canceled) {
    return {
      canceled: true,
      paths: [],
      invalidPaths: []
    };
  }

  const validations = await Promise.all(filePaths.map((filePath) => validatePath(filePath, expected)));
  const paths = validations.filter((validation) => validation.isValid).map((validation) => validation.path);
  const invalidPaths = validations.filter((validation) => !validation.isValid);

  return {
    canceled: false,
    paths,
    invalidPaths
  };
}

async function validatePath(path: string, expected: PathKind): Promise<PathValidationResult> {
  if (!isAbsolute(path)) {
    return {
      path,
      expected,
      exists: false,
      isValid: false,
      reason: 'Path is not absolute.'
    };
  }

  try {
    const stats = await stat(path);
    const hasExpectedType =
      expected === 'any' ||
      (expected === 'file' && stats.isFile()) ||
      (expected === 'directory' && stats.isDirectory());

    return {
      path,
      expected,
      exists: true,
      isValid: hasExpectedType,
      reason: hasExpectedType ? undefined : `Path is not a ${expected}.`
    };
  } catch {
    return {
      path,
      expected,
      exists: false,
      isValid: false,
      reason: 'Path does not exist.'
    };
  }
}
