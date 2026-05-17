import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { AppInfo } from '../../shared/types/app';
import { registerAuditIpcHandlers } from './auditIpc';
import { registerAutoCropIpcHandlers } from './autoCropIpc';
import { registerAutoFixIpcHandlers } from './autoFixIpc';
import { registerDialogIpcHandlers } from './dialogIpc';
import { registerMediaPreviewIpcHandlers } from './mediaPreviewIpc';
import { registerSettingsIpcHandlers } from './settingsIpc';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appGetInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  }));

  registerAuditIpcHandlers();
  registerAutoCropIpcHandlers();
  registerAutoFixIpcHandlers();
  registerDialogIpcHandlers();
  registerMediaPreviewIpcHandlers();
  registerSettingsIpcHandlers();
}
