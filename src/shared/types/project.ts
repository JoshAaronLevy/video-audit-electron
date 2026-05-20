import type { AuditRequest, AuditResult } from './audit';
import type { SelectedFolderSummary } from './folderTree';
import type { AppSettings } from './settings';

export const PROJECT_SCHEMA_VERSION = 1;

export type ProjectSchemaVersion = typeof PROJECT_SCHEMA_VERSION;

export type ProjectOpenMode = 'restore' | 'scan-again';

export type ProjectSavedBy = 'collie-video';

export interface ProjectIndex {
  schemaVersion: ProjectSchemaVersion;
  lastActiveProjectId: string | null;
  projects: ProjectIndexItem[];
}

export interface ProjectIndexItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary: string;
  outputFolder: string | null;
  rowCount: number;
  visibleRowCount: number;
  removedRowCount: number;
  flaggedCount: number;
  errorCount: number;
  lastRunAt: string | null;
}

export interface VideoProjectSources {
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  folderTreeRootPath: string | null;
  folderTreeLastScannedAt: string | null;
  selectedFiles: string[];
  outputFolder: string | null;
}

export interface VideoProjectAuditState {
  request: AuditRequest | null;
  result: AuditResult | null;
  savedAt: string | null;
}

export interface VideoProjectWorkspaceState {
  searchQuery: string;
  activeViewFilter: string;
  showThumbnails: boolean;
}

export type VideoProjectSettingsSnapshot = Pick<
  AppSettings,
  | 'defaultAutoFixDestinationRoot'
  | 'previewClipDurationSecondsDefault'
  | 'previewClipWidthDefault'
  | 'defaultOriginalDisposition'
  | 'fileManagementConflictStrategy'
  | 'showPostConversionDialogAutomatically'
  | 'defaultPostConversionAction'
>;

export interface VideoProject {
  schemaVersion: ProjectSchemaVersion;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sources: VideoProjectSources;
  audit: VideoProjectAuditState;
  workspace: VideoProjectWorkspaceState;
  settingsSnapshot: VideoProjectSettingsSnapshot | null;
  metadata: {
    appVersion: string | null;
    savedBy: ProjectSavedBy;
  };
}

export interface ProjectCreateRequest {
  name: string;
  project: Omit<VideoProject, 'id' | 'name' | 'createdAt' | 'updatedAt'>;
}

export interface ProjectSaveRequest {
  id: string;
  project: Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface ProjectLoadRequest {
  id: string;
}

export interface ProjectDeleteRequest {
  id: string;
}

export interface ProjectSetLastActiveRequest {
  id: string | null;
}
