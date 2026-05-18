import type { AuditOptions } from './audit';
import type { DestinationConflictStrategy } from './fileOperations';

export type DefaultOriginalDisposition = 'trash' | 'archive';
export type PostConversionDefaultAction = 'ask-every-time' | 'leave-outputs' | 'review-manually';

export interface AppWindowState {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  isMaximized: boolean;
}

export interface AppSettings {
  recentFolders: string[];
  recentFiles: string[];
  defaultOutputDirectory: string | null;
  includeSubfoldersDefault: boolean;
  lowResolutionAnalysisEnabledDefault: boolean;
  blackBorderAnalysisEnabledDefault: boolean;
  defaultAutoFixDestinationRoot: string | null;
  ffmpegPathOverride: string | null;
  ffprobePathOverride: string | null;
  previewClipDurationSecondsDefault: 5 | 10;
  previewClipWidthDefault: 480 | 640;
  defaultOriginalDisposition: DefaultOriginalDisposition;
  requireTypedConfirmationForLargeOperations: boolean;
  typedConfirmationFileCountThreshold: number;
  typedConfirmationSizeThresholdBytes: number;
  defaultArchiveFolderPattern: string;
  fileManagementConflictStrategy: DestinationConflictStrategy;
  showPostConversionDialogAutomatically: boolean;
  defaultPostConversionAction: PostConversionDefaultAction;
  previewOperationHistoryAfterExecution: boolean;
  latestSelectedFolder: string | null;
  windowState: AppWindowState | null;
  lastAuditResultSummary: {
    jobId?: string;
    completedAt: string;
    totalFiles: number;
    flaggedCount: number;
    errorCount: number;
  } | null;
}

export type AppSettingsUpdate = Partial<AppSettings>;

export interface SettingsResponse {
  settings: AppSettings;
}

export interface AuditDefaults {
  options: Pick<
    AuditOptions,
    'includeSubfolders' | 'includeLowResolutionAnalysis' | 'includeBlackBorderAnalysis'
  >;
}
