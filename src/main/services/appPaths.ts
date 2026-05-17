import { app } from 'electron';
import { join } from 'node:path';

export function getAppDataDir(): string {
  return app.getPath('userData');
}

export function getSettingsFilePath(): string {
  return join(getAppDataDir(), 'settings.json');
}

export function getMediaPreviewCacheDir(): string {
  return join(getAppDataDir(), 'media-preview');
}
