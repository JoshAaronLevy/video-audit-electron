import type { AuditOptions } from './audit';

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
  latestSelectedFolder: string | null;
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
