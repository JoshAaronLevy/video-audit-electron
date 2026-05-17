import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import { refreshAppMenu } from '../services/appMenuService';
import { getSettings, resetSettings, updateSettings } from '../services/settingsService';

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, async (): Promise<AppSettings> => getSettings());

  ipcMain.handle(
    IPC_CHANNELS.settingsUpdate,
    async (_event, partialSettings: AppSettingsUpdate): Promise<AppSettings> => {
      const settings = await updateSettings(partialSettings);
      await refreshAppMenu();
      return settings;
    }
  );

  ipcMain.handle(IPC_CHANNELS.settingsReset, async (): Promise<AppSettings> => {
    const settings = await resetSettings();
    await refreshAppMenu();
    return settings;
  });
}
