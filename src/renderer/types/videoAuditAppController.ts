import type { AppInfo } from '../../shared/types/app';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditResult,
  AuditSummary,
  FileDiscoveryJobSnapshot,
  FfprobeMetadataJobSnapshot
} from '../../shared/types/audit';
import type { AutoCropJobSnapshot, AutoCropResult } from '../../shared/types/autoCrop';
import type { AutoFixJobSnapshot, AutoFixResult } from '../../shared/types/autoFix';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type {
  ArchiveOperationPlan,
  DestinationConflictStrategy,
  FileOperationResult,
  KnownPathValidationItem,
  MoveOperationPlan,
  TrashOperationPlan
} from '../../shared/types/fileOperations';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewScope,
  PreviewClipJobSnapshot,
  PreviewClipResult
} from '../../shared/types/mediaPreview';
import type { MigrationJobSnapshot, MigrationResult, MigrationScanResult } from '../../shared/types/migration';
import type { OperationHistoryRecord } from '../../shared/types/operationHistory';
import type {
  PremiereRequestResponse,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import type {
  ReplacementAction,
  ReplacementExecutionJobSnapshot,
  ReplacementPlan,
  ReplacementPlanBulkAction
} from '../../shared/types/replacementWorkflow';
import type { AppSettings } from '../../shared/types/settings';
import type { FfprobeResult, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import type { AuditStartOutcome } from '../hooks/useAuditWorkflow';
import type { PostConversionDialogMode } from '../hooks/usePostConversionWorkflow';

export type ActiveAction =
  | 'folders'
  | 'files'
  | 'output'
  | 'settings'
  | 'reveal'
  | 'discovery'
  | 'ffprobe'
  | 'autoFix'
  | 'autoCrop'
  | 'mediaPreview'
  | 'previewClip'
  | 'migrationScan'
  | 'migrationExecute'
  | 'trashPlan'
  | 'trashExecute'
  | 'movePlan'
  | 'moveExecute'
  | 'archivePlan'
  | 'archiveExecute'
  | 'replacementPlan'
  | 'replacementUpdate'
  | 'replacementExecute'
  | 'operationHistory'
  | 'premiereStatus'
  | 'premiereLaunch'
  | 'premiereImport'
  | 'clearCache'
  | null;

export interface VideoAuditAppController {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  settingsOpenRequestCount: number;
  folderTreeOpenRequestCount: number;
  toolDiagnostics: ToolDiagnosticsResult | null;
  toolDiagnosticsError: string | null;
  isToolDiagnosticsLoading: boolean;
  selectionMessage: string | null;
  workflowMessage: string | null;
  activeAction: ActiveAction;
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  folderTreeRootPath: string | null;
  folderTreeLastScannedAt: string | null;
  selectedFiles: string[];
  outputFolder: string | null;
  auditOptions: AuditOptions;
  auditProgress: AuditJobSnapshot | null;
  auditPercent: number | null;
  auditSummary: AuditSummary | null;
  auditErrors: AuditResult['errors'];
  videoRows: VideoRow[] | null;
  visibleVideoRows: VideoRow[];
  removedVideoCount: number;
  selectedVideos: VideoRow[];
  isAuditActive: boolean;
  isDiscoveryActive: boolean;
  isFfprobeActive: boolean;
  canRunAudit: boolean;
  canRefreshAudit: boolean;
  isStorageLoading: boolean;
  storageMessage: string | null;
  storageSavedAt: string | null;
  discoveryProgress: FileDiscoveryJobSnapshot | null;
  discoveryPercent: number | null;
  discoveredPaths: string[];
  metadataItems: FfprobeResult[];
  ffprobeProgress: FfprobeMetadataJobSnapshot | null;
  ffprobePercent: number | null;
  autoFixProgress: AutoFixJobSnapshot | null;
  autoFixPercent: number | null;
  autoFixResult: AutoFixResult | null;
  autoFixError: string | null;
  isAutoFixDialogVisible: boolean;
  isAutoFixActive: boolean;
  canAutoFixSelected: boolean;
  autoFixOutputDirectory: string | null;
  autoCropProgress: AutoCropJobSnapshot | null;
  autoCropPercent: number | null;
  autoCropResult: AutoCropResult | null;
  autoCropError: string | null;
  isAutoCropDialogVisible: boolean;
  isAutoCropActive: boolean;
  canOpenCropOptions: boolean;
  autoCropOutputRootDir: string | null;
  mediaPreviewProgress: MediaPreviewJobSnapshot | null;
  mediaPreviewPercent: number | null;
  mediaPreviewResult: MediaPreviewResult | null;
  mediaPreviewError: string | null;
  mediaPreviewScope: MediaPreviewScope;
  isThumbnailDialogVisible: boolean;
  isMediaPreviewActive: boolean;
  previewClipProgress: PreviewClipJobSnapshot | null;
  previewClipPercent: number | null;
  previewClipResult: PreviewClipResult | null;
  previewClipError: string | null;
  isPreviewClipActive: boolean;
  isPreviewFrameFetching: boolean;
  previewFrameError: string | null;
  migrationNewEditedDir: string;
  migrationScan: MigrationScanResult | null;
  migrationScanError: string | null;
  migrationProgress: MigrationJobSnapshot | null;
  migrationPercent: number | null;
  migrationResult: MigrationResult | null;
  migrationResultError: string | null;
  auditedRootDirectory: string | null;
  isMigrationScanDialogVisible: boolean;
  isMigrationResultDialogVisible: boolean;
  isMigrationScanning: boolean;
  isMigrationExecuting: boolean;
  isMigrationActive: boolean;
  trashPlan: TrashOperationPlan | null;
  trashPlanError: string | null;
  trashResult: FileOperationResult | null;
  trashResultError: string | null;
  isTrashConfirmDialogVisible: boolean;
  isTrashResultDialogVisible: boolean;
  isTrashPlanning: boolean;
  isTrashExecuting: boolean;
  canMoveSelectedToTrash: boolean;
  movePlan: MoveOperationPlan | null;
  movePlanError: string | null;
  moveResult: FileOperationResult | null;
  moveResultError: string | null;
  isMoveConfirmDialogVisible: boolean;
  isMoveResultDialogVisible: boolean;
  isMovePlanning: boolean;
  isMoveExecuting: boolean;
  canMoveSelectedToFolder: boolean;
  archivePlan: ArchiveOperationPlan | null;
  archivePlanError: string | null;
  archiveResult: FileOperationResult | null;
  archiveResultError: string | null;
  isArchiveConfirmDialogVisible: boolean;
  isArchiveResultDialogVisible: boolean;
  isArchivePlanning: boolean;
  isArchiveExecuting: boolean;
  canArchiveSelectedOriginals: boolean;
  postConversionPlan: ReplacementPlan | null;
  postConversionSourceLabel: string | null;
  postConversionMode: PostConversionDialogMode;
  postConversionError: string | null;
  postConversionMessage: string | null;
  isPostConversionDialogVisible: boolean;
  isReplacementPlanning: boolean;
  isReplacementActionUpdating: boolean;
  replacementProgress: ReplacementExecutionJobSnapshot | null;
  replacementPercent: number | null;
  replacementResult: FileOperationResult | null;
  replacementResultError: string | null;
  isReplacementExecuting: boolean;
  isReplacementResultDialogVisible: boolean;
  operationHistoryRecords: OperationHistoryRecord[];
  selectedOperationHistoryRecord: OperationHistoryRecord | null;
  operationHistoryError: string | null;
  isOperationHistoryVisible: boolean;
  isOperationHistoryLoading: boolean;
  canStartMigration: boolean;
  premiereStatus: PremiereStatusResponse | null;
  premiereStatusError: string | null;
  premiereLaunchMessage: string | null;
  isPremiereStatusLoading: boolean;
  isPremiereImportSubmitting: boolean;
  premiereImportResult: PremiereRequestResponse | null;
  premiereImportError: string | null;
  canEditSelectedInPremiere: boolean;
  canGenerateThumbnails: boolean;
  applyFolderTreeSelection: (
    folderPaths: string[],
    rootPath: string,
    summary: SelectedFolderSummary,
    lastScannedAt: string | null
  ) => Promise<void>;
  chooseFolders: () => Promise<void>;
  chooseFiles: () => Promise<void>;
  chooseOutputFolder: () => Promise<void>;
  chooseRecentFolder: (path: string) => Promise<void>;
  clearSelectedSources: () => void;
  revealPath: (path: string) => Promise<void>;
  revealKnownFile: (item: KnownPathValidationItem) => Promise<void>;
  revealKnownFolder: (item: KnownPathValidationItem) => Promise<void>;
  updateAuditOption: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => Promise<void>;
  updateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>;
  resetSettings: () => Promise<void>;
  runToolDiagnostics: () => Promise<void>;
  runAudit: () => Promise<AuditStartOutcome>;
  refreshAudit: () => Promise<void>;
  cancelAudit: () => Promise<void>;
  clearAuditData: () => Promise<void>;
  removeSelectedVideos: () => Promise<void>;
  restoreRemovedVideos: () => Promise<void>;
  setSelectedVideos: (videos: VideoRow[]) => void;
  startDiscovery: () => Promise<void>;
  cancelDiscovery: () => Promise<void>;
  startFfprobe: () => Promise<void>;
  cancelFfprobe: () => Promise<void>;
  openAutoFixDialog: () => void;
  closeAutoFixDialog: () => void;
  startAutoFix: () => Promise<void>;
  cancelAutoFix: () => Promise<void>;
  openAutoCropDialog: () => void;
  closeAutoCropDialog: () => void;
  startAutoCrop: () => Promise<void>;
  cancelAutoCrop: () => Promise<void>;
  openThumbnailDialog: () => void;
  closeThumbnailDialog: () => void;
  setMediaPreviewScope: (scope: MediaPreviewScope) => void;
  startThumbnailGeneration: () => Promise<void>;
  cancelThumbnailGeneration: () => Promise<void>;
  clearPreviewFrameError: () => void;
  getFreshThumbnailsForVideo: (video: VideoRow) => Promise<void>;
  startPreviewClipGeneration: (video: VideoRow, frames: VideoPreviewFrame[]) => Promise<void>;
  cancelPreviewClipGeneration: () => Promise<void>;
  setMigrationNewEditedDir: (value: string) => void;
  openMigrationDialog: () => void;
  closeMigrationDialog: () => void;
  selectMigrationFolder: () => Promise<void>;
  startMigrationScan: () => Promise<void>;
  executeMigration: () => Promise<void>;
  closeMigrationResultDialog: () => void;
  openTrashDialog: () => Promise<void>;
  closeTrashDialog: () => void;
  executeTrashPlan: (typedConfirmation: string | null) => Promise<void>;
  closeTrashResultDialog: () => void;
  openMoveDialog: (conflictStrategy?: DestinationConflictStrategy) => Promise<void>;
  closeMoveDialog: () => void;
  executeMovePlan: () => Promise<void>;
  closeMoveResultDialog: () => void;
  openArchiveDialog: () => Promise<void>;
  closeArchiveDialog: () => void;
  executeArchivePlan: () => Promise<void>;
  closeArchiveResultDialog: () => void;
  changePostConversionPlanAction: (itemId: string, selectedAction: ReplacementAction) => Promise<void>;
  applyPostConversionPlanBulkAction: (action: ReplacementPlanBulkAction) => Promise<void>;
  replacePostConversionOriginals: (typedConfirmation: string | null) => Promise<void>;
  reviewPostConversionPlan: () => void;
  leavePostConversionOutputs: () => void;
  backToPostConversionChoices: () => void;
  closePostConversionDialog: () => void;
  cancelReplacementExecution: () => Promise<void>;
  closeReplacementResultDialog: () => void;
  openOperationHistory: () => Promise<void>;
  closeOperationHistory: () => void;
  refreshOperationHistory: () => Promise<void>;
  selectOperationHistoryRecord: (operationId: string) => Promise<void>;
  refreshPremiereStatus: () => Promise<void>;
  openPremiereBridgeApps: () => Promise<void>;
  editSelectedInPremiere: () => Promise<void>;
}
