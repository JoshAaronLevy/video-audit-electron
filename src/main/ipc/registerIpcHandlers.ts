import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { AppInfo } from '../../shared/types/app';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import { registerAuditIpcHandlers } from './auditIpc';
import { registerAutoCropIpcHandlers } from './autoCropIpc';
import { registerAutoFixIpcHandlers } from './autoFixIpc';
import { registerDialogIpcHandlers } from './dialogIpc';
import { registerFileOperationIpcHandlers } from './fileOperationIpc';
import { registerFolderTreeIpcHandlers } from './folderTreeIpc';
import { registerMediaPreviewIpcHandlers } from './mediaPreviewIpc';
import { registerMigrationIpcHandlers } from './migrationIpc';
import { registerOperationHistoryIpcHandlers } from './operationHistoryIpc';
import { registerPremiereIpcHandlers } from './premiereIpc';
import { registerReplacementWorkflowIpcHandlers } from './replacementWorkflowIpc';
import { registerSettingsIpcHandlers } from './settingsIpc';
import { checkMediaToolAvailability } from '../services/toolDiagnosticsService';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appGetInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  }));

  ipcMain.handle(IPC_CHANNELS.diagnosticsCheckTools, async (): Promise<ToolDiagnosticsResult> => {
    try {
      return await checkMediaToolAvailability();
    } catch (error: unknown) {
      return {
        status: 'error',
        checkedAt: new Date().toISOString(),
        tools: [],
        message: error instanceof Error ? error.message : 'Unable to check media tool availability.'
      };
    }
  });

  registerAuditIpcHandlers();
  registerAutoCropIpcHandlers();
  registerAutoFixIpcHandlers();
  registerDialogIpcHandlers();
  registerFileOperationIpcHandlers();
  registerFolderTreeIpcHandlers();
  registerMediaPreviewIpcHandlers();
  registerMigrationIpcHandlers();
  registerOperationHistoryIpcHandlers();
  registerPremiereIpcHandlers();
  registerReplacementWorkflowIpcHandlers();
  registerSettingsIpcHandlers();
}
