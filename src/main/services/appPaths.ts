import { app } from 'electron';
import { join } from 'node:path';

export function getAppDataDir(): string {
  return app.getPath('userData');
}

export function getSettingsFilePath(): string {
  return join(getAppDataDir(), 'settings.json');
}

export function getProjectsDir(): string {
  return join(getAppDataDir(), 'projects');
}

export function getProjectIndexFilePath(): string {
  return join(getProjectsDir(), 'project-index.json');
}

export function getProjectFilePath(projectId: string): string {
  const normalizedProjectId = projectId.trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(normalizedProjectId)) {
    throw new Error('Invalid project id.');
  }

  return join(getProjectsDir(), `${normalizedProjectId}.json`);
}

export function getMediaPreviewCacheDir(): string {
  return join(getAppDataDir(), 'media-preview');
}

export function getFileOperationHistoryDir(): string {
  return join(getAppDataDir(), 'file-operations');
}

export function getFileOperationHistoryFilePath(): string {
  return join(getFileOperationHistoryDir(), 'operation-history.json');
}
