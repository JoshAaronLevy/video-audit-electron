import type { AuditError, AuditOptions, AuditRequest, AuditResult, AuditSummary } from '../types/audit';
import type { SelectedFolderSummary } from '../types/folderTree';
import type {
  ProjectIndex,
  ProjectIndexItem,
  VideoProject,
  VideoProjectSettingsSnapshot
} from '../types/project';
import { PROJECT_SCHEMA_VERSION } from '../types/project';
import type { DefaultOriginalDisposition, PostConversionDefaultAction } from '../types/settings';
import type { VideoRow } from '../types/video';

export const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const DEFAULT_WORKSPACE = {
  searchQuery: '',
  activeViewFilter: 'all',
  showThumbnails: true
};

export function isSafeProjectId(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_ID_PATTERN.test(value);
}

export function normalizeProjectIndex(value: unknown): ProjectIndex {
  if (!isRecord(value)) {
    return createEmptyProjectIndex();
  }

  const projects = normalizeProjectIndexItems(value.projects);
  const lastActiveProjectId = isSafeProjectId(value.lastActiveProjectId) ? value.lastActiveProjectId : null;
  const projectIds = new Set(projects.map((project) => project.id));

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    lastActiveProjectId: lastActiveProjectId && projectIds.has(lastActiveProjectId) ? lastActiveProjectId : null,
    projects
  };
}

export function normalizeProjectIndexItem(value: unknown): ProjectIndexItem | null {
  if (!isRecord(value) || !isSafeProjectId(value.id)) {
    return null;
  }

  const name = normalizeRequiredString(value.name);
  const createdAt = normalizeRequiredString(value.createdAt);
  const updatedAt = normalizeRequiredString(value.updatedAt);

  if (!name || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id: value.id,
    name,
    createdAt,
    updatedAt,
    sourceSummary: normalizeString(value.sourceSummary),
    outputFolder: normalizeNullableString(value.outputFolder),
    rowCount: normalizeNonNegativeInteger(value.rowCount),
    visibleRowCount: normalizeNonNegativeInteger(value.visibleRowCount),
    removedRowCount: normalizeNonNegativeInteger(value.removedRowCount),
    flaggedCount: normalizeNonNegativeInteger(value.flaggedCount),
    errorCount: normalizeNonNegativeInteger(value.errorCount),
    lastRunAt: normalizeNullableString(value.lastRunAt)
  };
}

export function normalizeVideoProject(value: unknown): VideoProject | null {
  if (!isRecord(value) || !isSafeProjectId(value.id)) {
    return null;
  }

  const name = normalizeRequiredString(value.name);
  const createdAt = normalizeRequiredString(value.createdAt);
  const updatedAt = normalizeRequiredString(value.updatedAt);

  if (!name || !createdAt || !updatedAt) {
    return null;
  }

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: value.id,
    name,
    createdAt,
    updatedAt,
    sources: normalizeProjectSources(value.sources),
    audit: normalizeProjectAuditState(value.audit),
    workspace: normalizeProjectWorkspace(value.workspace),
    settingsSnapshot: normalizeSettingsSnapshot(value.settingsSnapshot),
    metadata: normalizeProjectMetadata(value.metadata)
  };
}

export function createEmptyProjectIndex(): ProjectIndex {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    lastActiveProjectId: null,
    projects: []
  };
}

function normalizeProjectIndexItems(value: unknown): ProjectIndexItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = value
    .map(normalizeProjectIndexItem)
    .filter((item): item is ProjectIndexItem => item !== null);
  const seenIds = new Set<string>();

  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function normalizeProjectSources(value: unknown): VideoProject['sources'] {
  const candidate = isRecord(value) ? value : {};

  return {
    selectedFolders: normalizeStringArray(candidate.selectedFolders),
    selectedFolderSummary: normalizeSelectedFolderSummary(candidate.selectedFolderSummary),
    folderTreeRootPath: normalizeNullableString(candidate.folderTreeRootPath),
    folderTreeLastScannedAt: normalizeNullableString(candidate.folderTreeLastScannedAt),
    selectedFiles: normalizeStringArray(candidate.selectedFiles),
    outputFolder: normalizeNullableString(candidate.outputFolder)
  };
}

function normalizeProjectAuditState(value: unknown): VideoProject['audit'] {
  const candidate = isRecord(value) ? value : {};

  return {
    request: normalizeAuditRequest(candidate.request),
    result: normalizeAuditResult(candidate.result),
    savedAt: normalizeNullableString(candidate.savedAt)
  };
}

function normalizeProjectWorkspace(value: unknown): VideoProject['workspace'] {
  const candidate = isRecord(value) ? value : {};

  return {
    searchQuery: normalizeString(candidate.searchQuery),
    activeViewFilter: normalizeString(candidate.activeViewFilter) || DEFAULT_WORKSPACE.activeViewFilter,
    showThumbnails: normalizeBoolean(candidate.showThumbnails, DEFAULT_WORKSPACE.showThumbnails)
  };
}

function normalizeProjectMetadata(value: unknown): VideoProject['metadata'] {
  const candidate = isRecord(value) ? value : {};

  return {
    appVersion: normalizeNullableString(candidate.appVersion),
    savedBy: 'collie-video'
  };
}

function normalizeSettingsSnapshot(value: unknown): VideoProjectSettingsSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const previewClipDurationSecondsDefault =
    value.previewClipDurationSecondsDefault === 10 ? 10 : value.previewClipDurationSecondsDefault === 5 ? 5 : null;
  const previewClipWidthDefault =
    value.previewClipWidthDefault === 480 ? 480 : value.previewClipWidthDefault === 640 ? 640 : null;
  const defaultOriginalDisposition = normalizeDefaultOriginalDisposition(value.defaultOriginalDisposition);
  const fileManagementConflictStrategy = normalizeConflictStrategy(value.fileManagementConflictStrategy);
  const defaultPostConversionAction = normalizePostConversionDefaultAction(value.defaultPostConversionAction);

  if (
    previewClipDurationSecondsDefault === null ||
    previewClipWidthDefault === null ||
    defaultOriginalDisposition === null ||
    fileManagementConflictStrategy === null ||
    typeof value.showPostConversionDialogAutomatically !== 'boolean' ||
    defaultPostConversionAction === null
  ) {
    return null;
  }

  return {
    defaultAutoFixDestinationRoot: normalizeNullableString(value.defaultAutoFixDestinationRoot),
    previewClipDurationSecondsDefault,
    previewClipWidthDefault,
    defaultOriginalDisposition,
    fileManagementConflictStrategy,
    showPostConversionDialogAutomatically: value.showPostConversionDialogAutomatically,
    defaultPostConversionAction
  };
}

function normalizeAuditRequest(value: unknown): AuditRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const options = normalizeAuditOptions(value.options);

  if (!options) {
    return null;
  }

  return {
    folderPaths: normalizeStringArray(value.folderPaths),
    filePaths: normalizeStringArray(value.filePaths),
    options
  };
}

function normalizeAuditOptions(value: unknown): AuditOptions | null {
  if (!isRecord(value)) {
    return null;
  }

  const minHeight = normalizePositiveNumber(value.minHeight);
  const targetAspectRatio = normalizePositiveNumber(value.targetAspectRatio);
  const aspectRatioTolerance = normalizeNonNegativeNumber(value.aspectRatioTolerance);

  if (
    typeof value.includeSubfolders !== 'boolean' ||
    typeof value.includeLowResolutionAnalysis !== 'boolean' ||
    typeof value.includeBlackBorderAnalysis !== 'boolean' ||
    minHeight === null ||
    targetAspectRatio === null ||
    aspectRatioTolerance === null
  ) {
    return null;
  }

  return {
    includeSubfolders: value.includeSubfolders,
    includeLowResolutionAnalysis: value.includeLowResolutionAnalysis,
    includeBlackBorderAnalysis: value.includeBlackBorderAnalysis,
    minHeight,
    targetAspectRatio,
    aspectRatioTolerance
  };
}

function normalizeAuditResult(value: unknown): AuditResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const jobId = normalizeRequiredString(value.jobId);
  const summary = normalizeAuditSummary(value.summary);
  const videos = normalizeVideoRows(value.videos);
  const errors = normalizeAuditErrors(value.errors);

  if (!jobId || value.status !== 'complete' || !summary) {
    return null;
  }

  return {
    jobId,
    status: 'complete',
    summary,
    videos,
    errors
  };
}

function normalizeAuditSummary(value: unknown): AuditSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const totalFiles = normalizeNonNegativeIntegerOrNull(value.totalFiles);
  const scannedVideos = normalizeNonNegativeIntegerOrNull(value.scannedVideos);
  const flaggedCount = normalizeNonNegativeIntegerOrNull(value.flaggedCount);
  const errorCount = normalizeNonNegativeIntegerOrNull(value.errorCount);

  if (totalFiles === null || scannedVideos === null || flaggedCount === null || errorCount === null) {
    return null;
  }

  return {
    directoryPath: normalizeNullableString(value.directoryPath),
    resolvedDirectory: normalizeNullableString(value.resolvedDirectory),
    totalFiles,
    scannedVideos,
    flaggedCount,
    errorCount
  };
}

function normalizeVideoRows(value: unknown): VideoRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((row) => ({
    ...row,
    visible: row.visible !== false
  })) as VideoRow[];
}

function normalizeAuditErrors(value: unknown): AuditError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeAuditError)
    .filter((error): error is AuditError => error !== null);
}

function normalizeAuditError(value: unknown): AuditError | null {
  if (!isRecord(value)) {
    return null;
  }

  const path = normalizeRequiredString(value.path);
  const fileName = normalizeRequiredString(value.fileName);
  const error = normalizeRequiredString(value.error);

  if (!path || !fileName || !error) {
    return null;
  }

  return {
    path,
    fileName,
    error,
    directory: normalizeNullableString(value.directory) ?? undefined,
    extension: normalizeNullableString(value.extension) ?? undefined,
    fileExtension: normalizeNullableString(value.fileExtension) ?? undefined,
    fileType: normalizeNullableString(value.fileType) ?? undefined,
    sizeBytes: normalizeNullableNumber(value.sizeBytes),
    createdAt: normalizeNullableString(value.createdAt) ?? undefined,
    modifiedAt: normalizeNullableString(value.modifiedAt) ?? undefined
  };
}

function normalizeSelectedFolderSummary(value: unknown): SelectedFolderSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const selectedFolderCount = normalizeNonNegativeIntegerOrNull(value.selectedFolderCount);
  const dedupedFolderCount = normalizeNonNegativeIntegerOrNull(value.dedupedFolderCount);
  const directVideoCount = normalizeNonNegativeIntegerOrNull(value.directVideoCount);
  const directVideoSizeBytes = normalizeNonNegativeIntegerOrNull(value.directVideoSizeBytes);
  const totalVideoCount = normalizeNonNegativeIntegerOrNull(value.totalVideoCount);
  const totalVideoSizeBytes = normalizeNonNegativeIntegerOrNull(value.totalVideoSizeBytes);

  if (
    selectedFolderCount === null ||
    dedupedFolderCount === null ||
    directVideoCount === null ||
    directVideoSizeBytes === null ||
    totalVideoCount === null ||
    totalVideoSizeBytes === null
  ) {
    return null;
  }

  return {
    selectedFolderPaths: normalizeStringArray(value.selectedFolderPaths),
    dedupedFolderPaths: normalizeStringArray(value.dedupedFolderPaths),
    selectedFolderCount,
    dedupedFolderCount,
    directVideoCount,
    directVideoSizeBytes,
    totalVideoCount,
    totalVideoSizeBytes
  };
}

function normalizeDefaultOriginalDisposition(value: unknown): DefaultOriginalDisposition | null {
  return value === 'trash' || value === 'archive' ? value : null;
}

function normalizeConflictStrategy(value: unknown): VideoProjectSettingsSnapshot['fileManagementConflictStrategy'] | null {
  return value === 'skip' || value === 'rename-with-suffix' ? value : null;
}

function normalizePostConversionDefaultAction(value: unknown): PostConversionDefaultAction | null {
  return value === 'ask-every-time' || value === 'leave-outputs' || value === 'review-manually' ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRequiredString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNonNegativeInteger(value: unknown): number {
  return normalizeNonNegativeIntegerOrNull(value) ?? 0;
}

function normalizeNonNegativeIntegerOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function normalizePositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
