import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import { getSettingsFilePath } from './appPaths';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  recentFolders: [],
  recentFiles: [],
  defaultOutputDirectory: null,
  includeSubfoldersDefault: true,
  lowResolutionAnalysisEnabledDefault: true,
  blackBorderAnalysisEnabledDefault: true,
  defaultAutoFixDestinationRoot: null,
  ffmpegPathOverride: null,
  ffprobePathOverride: null,
  previewClipDurationSecondsDefault: 5,
  previewClipWidthDefault: 640,
  latestSelectedFolder: null,
  windowState: null,
  lastAuditResultSummary: null
};

export async function getSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsFilePath();

  try {
    const rawSettings = await readFile(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(rawSettings));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function updateSettings(partialSettings: AppSettingsUpdate): Promise<AppSettings> {
  const currentSettings = await getSettings();
  const nextSettings = normalizeSettings({
    ...currentSettings,
    ...partialSettings
  });

  await writeSettings(nextSettings);
  return nextSettings;
}

export async function resetSettings(): Promise<AppSettings> {
  const settings = { ...DEFAULT_APP_SETTINGS };
  await writeSettings(settings);
  return settings;
}

async function writeSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsFilePath();
  const tempPath = `${settingsPath}.tmp`;

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await rename(tempPath, settingsPath);
}

function normalizeSettings(value: unknown): AppSettings {
  const candidate = isRecord(value) ? value : {};

  return {
    recentFolders: normalizeStringArray(candidate.recentFolders),
    recentFiles: normalizeStringArray(candidate.recentFiles),
    defaultOutputDirectory: normalizeNullableString(candidate.defaultOutputDirectory),
    includeSubfoldersDefault: normalizeBoolean(
      candidate.includeSubfoldersDefault,
      DEFAULT_APP_SETTINGS.includeSubfoldersDefault
    ),
    lowResolutionAnalysisEnabledDefault: normalizeBoolean(
      candidate.lowResolutionAnalysisEnabledDefault,
      DEFAULT_APP_SETTINGS.lowResolutionAnalysisEnabledDefault
    ),
    blackBorderAnalysisEnabledDefault: normalizeBoolean(
      candidate.blackBorderAnalysisEnabledDefault,
      DEFAULT_APP_SETTINGS.blackBorderAnalysisEnabledDefault
    ),
    defaultAutoFixDestinationRoot: normalizeNullableString(candidate.defaultAutoFixDestinationRoot),
    ffmpegPathOverride: normalizeNullableString(candidate.ffmpegPathOverride),
    ffprobePathOverride: normalizeNullableString(candidate.ffprobePathOverride),
    previewClipDurationSecondsDefault: normalizePreviewClipDurationSeconds(
      candidate.previewClipDurationSecondsDefault
    ),
    previewClipWidthDefault: normalizePreviewClipWidth(candidate.previewClipWidthDefault),
    latestSelectedFolder: normalizeNullableString(candidate.latestSelectedFolder),
    windowState: normalizeWindowState(candidate.windowState),
    lastAuditResultSummary: normalizeLastAuditResultSummary(candidate.lastAuditResultSummary)
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePreviewClipDurationSeconds(value: unknown): AppSettings['previewClipDurationSecondsDefault'] {
  return Number(value) === 10 ? 10 : DEFAULT_APP_SETTINGS.previewClipDurationSecondsDefault;
}

function normalizePreviewClipWidth(value: unknown): AppSettings['previewClipWidthDefault'] {
  return Number(value) === 480 ? 480 : DEFAULT_APP_SETTINGS.previewClipWidthDefault;
}

function normalizeLastAuditResultSummary(value: unknown): AppSettings['lastAuditResultSummary'] {
  if (!isRecord(value)) {
    return null;
  }

  const completedAt = normalizeNullableString(value.completedAt);
  const totalFiles = normalizeFiniteNumber(value.totalFiles);
  const flaggedCount = normalizeFiniteNumber(value.flaggedCount);
  const errorCount = normalizeFiniteNumber(value.errorCount);

  if (!completedAt || totalFiles === null || flaggedCount === null || errorCount === null) {
    return null;
  }

  return {
    jobId: normalizeNullableString(value.jobId) ?? undefined,
    completedAt,
    totalFiles,
    flaggedCount,
    errorCount
  };
}

function normalizeWindowState(value: unknown): AppSettings['windowState'] {
  if (!isRecord(value)) {
    return null;
  }

  const width = normalizeFiniteNumber(value.width);
  const height = normalizeFiniteNumber(value.height);

  if (width === null || height === null) {
    return null;
  }

  return {
    width: Math.max(920, Math.round(width)),
    height: Math.max(620, Math.round(height)),
    x: normalizeNullableNumber(value.x),
    y: normalizeNullableNumber(value.y),
    isMaximized: normalizeBoolean(value.isMaximized, false)
  };
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
