import type { AuditOptions, AuditRequest, AuditResult } from '../../shared/types/audit';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import {
  PROJECT_SCHEMA_VERSION,
  type VideoProject,
  type VideoProjectSettingsSnapshot
} from '../../shared/types/project';
import type { AppSettings } from '../../shared/types/settings';
import type { VideoRow } from '../../shared/types/video';
import type { ResultsViewFilter } from '../types/resultsView';

export type DraftVideoProjectSnapshot = Omit<VideoProject, 'id' | 'name' | 'createdAt' | 'updatedAt'>;

export interface BuildVideoProjectSnapshotInput {
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  folderTreeRootPath: string | null;
  folderTreeLastScannedAt: string | null;
  selectedFiles: string[];
  outputFolder: string | null;
  auditOptions: AuditOptions;
  auditRequest: AuditRequest | null;
  auditResult: AuditResult | null;
  auditRows: VideoRow[];
  auditSavedAt: string | null;
  searchQuery: string;
  activeViewFilter: ResultsViewFilter;
  showThumbnails: boolean;
  settings: AppSettings | null;
  appVersion: string | null;
}

export type BuildVideoProjectDirtySignatureInput = Omit<
  BuildVideoProjectSnapshotInput,
  'settings' | 'appVersion'
>;

export interface BuildNamedVideoProjectSnapshotInput extends BuildVideoProjectSnapshotInput {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function buildVideoProjectSnapshot(input: BuildVideoProjectSnapshotInput): DraftVideoProjectSnapshot {
  // Duplicate review results and marks are destructive intent, so they remain transient.
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    sources: {
      selectedFolders: [...input.selectedFolders],
      selectedFolderSummary: cloneSelectedFolderSummary(input.selectedFolderSummary),
      folderTreeRootPath: input.folderTreeRootPath,
      folderTreeLastScannedAt: input.folderTreeLastScannedAt,
      selectedFiles: [...input.selectedFiles],
      outputFolder: input.outputFolder
    },
    audit: {
      request: getProjectAuditRequest(input),
      result: cloneAuditResult(input.auditResult, input.auditRows),
      savedAt: input.auditSavedAt
    },
    workspace: {
      searchQuery: input.searchQuery,
      activeViewFilter: input.activeViewFilter,
      showThumbnails: input.showThumbnails
    },
    settingsSnapshot: buildSettingsSnapshot(input.settings),
    metadata: {
      appVersion: input.appVersion,
      savedBy: 'collie-video'
    }
  };
}

export function buildNamedVideoProjectSnapshot(input: BuildNamedVideoProjectSnapshotInput): VideoProject {
  return {
    ...buildVideoProjectSnapshot(input),
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

export function buildVideoProjectDirtySignature(input: BuildVideoProjectDirtySignatureInput): string {
  // Duplicate review state is intentionally excluded from dirty signatures.
  return JSON.stringify({
    sources: {
      selectedFolders: [...input.selectedFolders],
      selectedFolderSummary: cloneSelectedFolderSummary(input.selectedFolderSummary),
      folderTreeRootPath: input.folderTreeRootPath,
      folderTreeLastScannedAt: input.folderTreeLastScannedAt,
      selectedFiles: [...input.selectedFiles],
      outputFolder: input.outputFolder
    },
    audit: {
      request: getProjectAuditRequest(input),
      result: cloneAuditResult(input.auditResult, input.auditRows),
      savedAt: input.auditSavedAt
    },
    workspace: {
      searchQuery: input.searchQuery,
      activeViewFilter: input.activeViewFilter,
      showThumbnails: input.showThumbnails
    }
  });
}

export function buildVideoProjectDirtySignatureFromProject(project: VideoProject): string {
  return JSON.stringify({
    sources: {
      selectedFolders: [...project.sources.selectedFolders],
      selectedFolderSummary: cloneSelectedFolderSummary(project.sources.selectedFolderSummary),
      folderTreeRootPath: project.sources.folderTreeRootPath,
      folderTreeLastScannedAt: project.sources.folderTreeLastScannedAt,
      selectedFiles: [...project.sources.selectedFiles],
      outputFolder: project.sources.outputFolder
    },
    audit: {
      request: cloneAuditRequest(project.audit.request),
      result: cloneAuditResult(project.audit.result, project.audit.result?.videos ?? []),
      savedAt: project.audit.savedAt
    },
    workspace: {
      searchQuery: project.workspace.searchQuery,
      activeViewFilter: project.workspace.activeViewFilter,
      showThumbnails: project.workspace.showThumbnails
    }
  });
}

function getProjectAuditRequest(input: BuildVideoProjectDirtySignatureInput): AuditRequest | null {
  if (input.selectedFolders.length > 0 || input.selectedFiles.length > 0) {
    return {
      folderPaths: [...input.selectedFolders],
      filePaths: [...input.selectedFiles],
      options: {
        ...input.auditOptions
      }
    };
  }

  return cloneAuditRequest(input.auditRequest);
}

function cloneAuditRequest(request: AuditRequest | null): AuditRequest | null {
  if (!request) {
    return null;
  }

  return {
    folderPaths: [...request.folderPaths],
    filePaths: [...request.filePaths],
    options: {
      ...request.options
    }
  };
}

function cloneAuditResult(result: AuditResult | null, rows: VideoRow[]): AuditResult | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    summary: {
      ...result.summary
    },
    videos: rows.map(cloneProjectVideoRow),
    errors: result.errors.map((error) => ({ ...error }))
  };
}

function cloneProjectVideoRow(row: VideoRow): VideoRow {
  const { fileAvailability: _fileAvailability, ...projectRow } = row;

  return {
    ...projectRow,
    visible: row.visible !== false
  };
}

function cloneSelectedFolderSummary(summary: SelectedFolderSummary | null): SelectedFolderSummary | null {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    selectedFolderPaths: [...summary.selectedFolderPaths],
    dedupedFolderPaths: [...summary.dedupedFolderPaths]
  };
}

function buildSettingsSnapshot(settings: AppSettings | null): VideoProjectSettingsSnapshot | null {
  if (!settings) {
    return null;
  }

  return {
    defaultAutoFixDestinationRoot: settings.defaultAutoFixDestinationRoot,
    previewClipDurationSecondsDefault: settings.previewClipDurationSecondsDefault,
    previewClipWidthDefault: settings.previewClipWidthDefault,
    defaultOriginalDisposition: settings.defaultOriginalDisposition,
    fileManagementConflictStrategy: settings.fileManagementConflictStrategy,
    showPostConversionDialogAutomatically: settings.showPostConversionDialogAutomatically,
    defaultPostConversionAction: settings.defaultPostConversionAction
  };
}
