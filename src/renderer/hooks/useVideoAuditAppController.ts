import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppInfo } from '../../shared/types/app';
import type { AppCommand } from '../../shared/types/appCommands';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditRequest,
  AuditResult,
  AuditSummary,
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest
} from '../../shared/types/audit';
import type { AutoCropJobSnapshot, AutoCropResult } from '../../shared/types/autoCrop';
import type { PathSelectionResult } from '../../shared/types/dialog';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { AutoFixJobSnapshot, AutoFixResult } from '../../shared/types/autoFix';
import type {
  ArchiveOperationPlan,
  DestinationConflictStrategy,
  FileOperationResult,
  KnownFileOperationItem,
  KnownPathValidationItem,
  MoveOperationPlan,
  TrashOperationPlan
} from '../../shared/types/fileOperations';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewResultItem,
  MediaPreviewScope,
  PreviewClipJobSnapshot,
  PreviewClipResult,
  PreviewClipResultItem
} from '../../shared/types/mediaPreview';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type {
  PremiereRequestResponse,
  PremiereRequestVideo,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import type {
  MigrationJobSnapshot,
  MigrationResult,
  MigrationScanResult
} from '../../shared/types/migration';
import type { OperationHistoryRecord } from '../../shared/types/operationHistory';
import type {
  ReplacementAction,
  ReplacementExecutionJobSnapshot,
  ReplacementPlan,
  ReplacementPlanActionUpdate,
  ReplacementPlanBulkAction
} from '../../shared/types/replacementWorkflow';
import type {
  AppSettings,
  AppSettingsUpdate,
  PersistedFolderTreeSource
} from '../../shared/types/settings';
import type { FfprobeResult, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import {
  clearStoredAuditResult,
  loadStoredAuditResult,
  saveStoredAuditHistoryEntry,
  saveStoredAuditResult
} from '../storage/auditResultStorage';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

type ActiveAction =
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

type PostConversionDialogMode = 'choices' | 'manual-review';

const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  includeSubfolders: true,
  includeLowResolutionAnalysis: true,
  includeBlackBorderAnalysis: true,
  minHeight: 720,
  targetAspectRatio: 16 / 9,
  aspectRatioTolerance: 0.01
};

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
  filteredVideoRows: VideoRow[];
  removedVideoCount: number;
  selectedVideos: VideoRow[];
  globalFilter: string;
  resultsViewFilter: ResultsViewFilter;
  resultsViewCounts: ResultsViewCounts;
  showThumbnails: boolean;
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
  runAudit: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  cancelAudit: () => Promise<void>;
  clearAuditData: () => Promise<void>;
  removeSelectedVideos: () => Promise<void>;
  restoreRemovedVideos: () => Promise<void>;
  setSelectedVideos: (videos: VideoRow[]) => void;
  setGlobalFilter: (value: string) => void;
  setResultsViewFilter: (value: ResultsViewFilter) => void;
  setShowThumbnails: (value: boolean) => Promise<void>;
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

export function useVideoAuditAppController(): VideoAuditAppController {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoMessage, setAppInfoMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsOpenRequestCount, setSettingsOpenRequestCount] = useState(0);
  const [folderTreeOpenRequestCount, setFolderTreeOpenRequestCount] = useState(0);
  const [toolDiagnostics, setToolDiagnostics] = useState<ToolDiagnosticsResult | null>(null);
  const [toolDiagnosticsError, setToolDiagnosticsError] = useState<string | null>(null);
  const [isToolDiagnosticsLoading, setIsToolDiagnosticsLoading] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFolderSummary, setSelectedFolderSummary] = useState<SelectedFolderSummary | null>(null);
  const [folderTreeRootPath, setFolderTreeRootPath] = useState<string | null>(null);
  const [folderTreeLastScannedAt, setFolderTreeLastScannedAt] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [auditOptions, setAuditOptions] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditJobSnapshot | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [auditErrors, setAuditErrors] = useState<AuditResult['errors']>([]);
  const [videoRows, setVideoRows] = useState<VideoRow[] | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<VideoRow[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [resultsViewFilter, setResultsViewFilter] = useState<ResultsViewFilter>('all');
  const [showThumbnailsState, setShowThumbnailsState] = useState(true);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [storageSavedAt, setStorageSavedAt] = useState<string | null>(null);
  const [lastAuditRequest, setLastAuditRequest] = useState<AuditRequest | null>(null);
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<FileDiscoveryJobSnapshot | null>(null);
  const [ffprobeJobId, setFfprobeJobId] = useState<string | null>(null);
  const [ffprobeProgress, setFfprobeProgress] = useState<FfprobeMetadataJobSnapshot | null>(null);
  const [autoFixJobId, setAutoFixJobId] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<AutoFixJobSnapshot | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [autoFixError, setAutoFixError] = useState<string | null>(null);
  const [isAutoFixDialogVisible, setIsAutoFixDialogVisible] = useState(false);
  const [autoCropJobId, setAutoCropJobId] = useState<string | null>(null);
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropJobSnapshot | null>(null);
  const [autoCropResult, setAutoCropResult] = useState<AutoCropResult | null>(null);
  const [autoCropError, setAutoCropError] = useState<string | null>(null);
  const [isAutoCropDialogVisible, setIsAutoCropDialogVisible] = useState(false);
  const [mediaPreviewJobId, setMediaPreviewJobId] = useState<string | null>(null);
  const [mediaPreviewProgress, setMediaPreviewProgress] = useState<MediaPreviewJobSnapshot | null>(null);
  const [mediaPreviewResult, setMediaPreviewResult] = useState<MediaPreviewResult | null>(null);
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null);
  const [mediaPreviewScope, setMediaPreviewScope] = useState<MediaPreviewScope>('all');
  const [isThumbnailDialogVisible, setIsThumbnailDialogVisible] = useState(false);
  const [previewClipJobId, setPreviewClipJobId] = useState<string | null>(null);
  const [previewClipProgress, setPreviewClipProgress] = useState<PreviewClipJobSnapshot | null>(null);
  const [previewClipResult, setPreviewClipResult] = useState<PreviewClipResult | null>(null);
  const [previewClipError, setPreviewClipError] = useState<string | null>(null);
  const [migrationNewEditedDir, setMigrationNewEditedDirState] = useState('');
  const [migrationScan, setMigrationScan] = useState<MigrationScanResult | null>(null);
  const [migrationScanError, setMigrationScanError] = useState<string | null>(null);
  const [migrationJobId, setMigrationJobId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationJobSnapshot | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationResultError, setMigrationResultError] = useState<string | null>(null);
  const [isMigrationScanDialogVisible, setIsMigrationScanDialogVisible] = useState(false);
  const [isMigrationResultDialogVisible, setIsMigrationResultDialogVisible] = useState(false);
  const [trashPlan, setTrashPlan] = useState<TrashOperationPlan | null>(null);
  const [trashPlanError, setTrashPlanError] = useState<string | null>(null);
  const [trashResult, setTrashResult] = useState<FileOperationResult | null>(null);
  const [trashResultError, setTrashResultError] = useState<string | null>(null);
  const [isTrashConfirmDialogVisible, setIsTrashConfirmDialogVisible] = useState(false);
  const [isTrashResultDialogVisible, setIsTrashResultDialogVisible] = useState(false);
  const [movePlan, setMovePlan] = useState<MoveOperationPlan | null>(null);
  const [movePlanError, setMovePlanError] = useState<string | null>(null);
  const [moveResult, setMoveResult] = useState<FileOperationResult | null>(null);
  const [moveResultError, setMoveResultError] = useState<string | null>(null);
  const [isMoveConfirmDialogVisible, setIsMoveConfirmDialogVisible] = useState(false);
  const [isMoveResultDialogVisible, setIsMoveResultDialogVisible] = useState(false);
  const [archivePlan, setArchivePlan] = useState<ArchiveOperationPlan | null>(null);
  const [archivePlanError, setArchivePlanError] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState<FileOperationResult | null>(null);
  const [archiveResultError, setArchiveResultError] = useState<string | null>(null);
  const [isArchiveConfirmDialogVisible, setIsArchiveConfirmDialogVisible] = useState(false);
  const [isArchiveResultDialogVisible, setIsArchiveResultDialogVisible] = useState(false);
  const [postConversionPlan, setPostConversionPlan] = useState<ReplacementPlan | null>(null);
  const [postConversionSourceLabel, setPostConversionSourceLabel] = useState<string | null>(null);
  const [postConversionMode, setPostConversionMode] = useState<PostConversionDialogMode>('choices');
  const [postConversionError, setPostConversionError] = useState<string | null>(null);
  const [postConversionMessage, setPostConversionMessage] = useState<string | null>(null);
  const [isPostConversionDialogVisible, setIsPostConversionDialogVisible] = useState(false);
  const [replacementJobId, setReplacementJobId] = useState<string | null>(null);
  const [replacementProgress, setReplacementProgress] = useState<ReplacementExecutionJobSnapshot | null>(null);
  const [replacementResult, setReplacementResult] = useState<FileOperationResult | null>(null);
  const [replacementResultError, setReplacementResultError] = useState<string | null>(null);
  const [isReplacementResultDialogVisible, setIsReplacementResultDialogVisible] = useState(false);
  const [operationHistoryRecords, setOperationHistoryRecords] = useState<OperationHistoryRecord[]>([]);
  const [selectedOperationHistoryRecord, setSelectedOperationHistoryRecord] = useState<OperationHistoryRecord | null>(null);
  const [operationHistoryError, setOperationHistoryError] = useState<string | null>(null);
  const [isOperationHistoryVisible, setIsOperationHistoryVisible] = useState(false);
  const [premiereStatus, setPremiereStatus] = useState<PremiereStatusResponse | null>(null);
  const [premiereStatusError, setPremiereStatusError] = useState<string | null>(null);
  const [premiereLaunchMessage, setPremiereLaunchMessage] = useState<string | null>(null);
  const [isPremiereStatusLoading, setIsPremiereStatusLoading] = useState(false);
  const [isPremiereImportSubmitting, setIsPremiereImportSubmitting] = useState(false);
  const [premiereImportResult, setPremiereImportResult] = useState<PremiereRequestResponse | null>(null);
  const [premiereImportError, setPremiereImportError] = useState<string | null>(null);
  const pendingAuditRequestRef = useRef<AuditRequest | null>(null);

  const applyAuditResult = useCallback(
    async (
      result: AuditResult,
      request: AuditRequest | null,
      options: { persist: boolean; savedAt?: string; showThumbnails?: boolean }
    ): Promise<void> => {
      const normalizedRows = result.videos.map((row) => ({
        ...row,
        visible: row.visible !== false
      }));
      const normalizedResult = {
        ...result,
        videos: normalizedRows
      };

      setAuditResult(normalizedResult);
      setVideoRows(normalizedRows);
      setAuditSummary(normalizedResult.summary);
      setAuditErrors(normalizedResult.errors);
      setSelectedVideos([]);

      if (request) {
        setLastAuditRequest(request);
      }

      if (options.persist && request) {
        const storedState = await saveStoredAuditResult({
          request,
          result: normalizedResult,
          showThumbnails: options.showThumbnails ?? showThumbnailsState,
          savedAt: options.savedAt
        });

        setStorageSavedAt(storedState.savedAt);
        setStorageMessage(`Saved ${normalizedRows.length.toLocaleString()} flagged row(s).`);
      }
    },
    [showThumbnailsState]
  );

  useEffect(() => {
    let isMounted = true;

    window.videoAudit.app
      .getInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfo(info);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAppInfoMessage(getErrorMessage(error, 'Could not read app info.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshPremiereStatus = useCallback(async (): Promise<void> => {
    setIsPremiereStatusLoading(true);
    setPremiereStatusError(null);

    try {
      const status = await window.videoAudit.premiere.getStatus();
      setPremiereStatus(status);
    } catch (error: unknown) {
      setPremiereStatusError(getErrorMessage(error, 'Unable to check Premiere bridge status.'));
      setPremiereStatus({
        status: 'error',
        message: getErrorMessage(error, 'Unable to check Premiere bridge status.'),
        bridge: {
          connected: false,
          reason: 'status_check_failed'
        }
      });
    } finally {
      setIsPremiereStatusLoading(false);
    }
  }, []);

  const openPremiereBridgeApps = useCallback(async (): Promise<void> => {
    setActiveAction('premiereLaunch');
    setPremiereStatusError(null);
    setPremiereLaunchMessage(null);
    let launchError: string | null = null;

    try {
      const response = await window.videoAudit.premiere.openBridgeApps();
      setPremiereLaunchMessage(`${response.message} Bridge folder: ${response.bridgeDir || 'Unknown'}`);

      if (response.status !== 'opened') {
        launchError = response.message;
      }
    } catch (error: unknown) {
      launchError = getErrorMessage(error, 'Unable to open Premiere bridge apps.');
      setPremiereLaunchMessage(launchError);
    } finally {
      setActiveAction(null);
      await refreshPremiereStatus();

      if (launchError) {
        setPremiereStatusError(launchError);
      }
    }
  }, [refreshPremiereStatus]);

  useEffect(() => {
    void refreshPremiereStatus();
  }, [refreshPremiereStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState(): Promise<void> {
      try {
        const [loadedSettings, storedAudit] = await Promise.all([
          window.videoAudit.settings.get(),
          loadStoredAuditResult()
        ]);

        if (!isMounted) {
          return;
        }

        setSettings(loadedSettings);
        setOutputFolder(loadedSettings.defaultOutputDirectory);

        const restoredFolderTreeSource = loadedSettings.latestFolderTreeSource;
        const restoredFolderTreePaths = restoredFolderTreeSource
          ? getPersistedFolderTreeSourcePaths(restoredFolderTreeSource)
          : [];

        if (restoredFolderTreeSource) {
          setFolderTreeRootPath(restoredFolderTreeSource.rootPath);
          setFolderTreeLastScannedAt(restoredFolderTreeSource.lastScannedAt);
        }

        if (storedAudit) {
          setSelectedFolders(
            restoredFolderTreePaths.length > 0
              ? restoredFolderTreePaths
              : dedupeOverlappingFolderPaths(storedAudit.request.folderPaths)
          );
          setSelectedFolderSummary(restoredFolderTreeSource?.selectedFolderSummary ?? null);
          setSelectedFiles(storedAudit.request.filePaths);
          setAuditOptions({
            ...storedAudit.request.options,
            includeSubfolders:
              restoredFolderTreeSource?.includeSubfolders ?? storedAudit.request.options.includeSubfolders
          });
          setShowThumbnailsState(storedAudit.showThumbnails);
          setStorageSavedAt(storedAudit.savedAt);
          setStorageMessage(`Restored saved audit from ${formatDateTime(storedAudit.savedAt)}.`);
          await applyAuditResult(storedAudit.result, storedAudit.request, {
            persist: false,
            savedAt: storedAudit.savedAt,
            showThumbnails: storedAudit.showThumbnails
          });
        } else {
          const restoredAuditOptions = settingsToAuditOptions(loadedSettings);
          setSelectedFolders(restoredFolderTreePaths);
          setSelectedFolderSummary(restoredFolderTreeSource?.selectedFolderSummary ?? null);
          setAuditOptions({
            ...restoredAuditOptions,
            includeSubfolders:
              restoredFolderTreeSource?.includeSubfolders ?? restoredAuditOptions.includeSubfolders
          });
        }
      } catch (error: unknown) {
        if (isMounted) {
          setSettingsMessage(getErrorMessage(error, 'Could not load settings.'));
        }
      } finally {
        if (isMounted) {
          setIsStorageLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.audit.onProgress((progress) => {
      setAuditProgress(progress);

      if (progress.jobId) {
        setAuditJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit stopped.');
      }

      if (progress.result) {
        void applyAuditResult(progress.result, pendingAuditRequestRef.current, { persist: true });
      }
    });
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.discovery.onProgress((progress) => {
      setDiscoveryProgress(progress);

      if (progress.jobId) {
        setDiscoveryJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery stopped.');
      }
    });
  }, []);

  useEffect(() => {
    return window.videoAudit.ffprobe.onProgress((progress) => {
      setFfprobeProgress(progress);

      if (progress.jobId) {
        setFfprobeJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction stopped.');
      }
    });
  }, []);

  const visibleVideoRows = useMemo(
    () => (videoRows ?? []).filter((row) => row.visible !== false),
    [videoRows]
  );
  const resultsViewCounts = useMemo(
    () => getResultsViewCounts(visibleVideoRows),
    [visibleVideoRows]
  );
  const filteredVideoRows = useMemo(
    () => visibleVideoRows.filter((row) => matchesResultsViewFilter(row, resultsViewFilter)),
    [resultsViewFilter, visibleVideoRows]
  );
  const auditedRootDirectory = useMemo(
    () => getAuditedRootDirectory(lastAuditRequest, auditSummary),
    [auditSummary, lastAuditRequest]
  );
  const removedVideoCount = (videoRows?.length ?? 0) - visibleVideoRows.length;
  const isAuditActive = auditProgress?.status === 'starting' || auditProgress?.status === 'running';
  const isDiscoveryActive =
    activeAction === 'discovery' ||
    discoveryProgress?.status === 'starting' ||
    discoveryProgress?.status === 'running';
  const isFfprobeActive =
    activeAction === 'ffprobe' ||
    ffprobeProgress?.status === 'starting' ||
    ffprobeProgress?.status === 'running';
  const isAutoFixActive =
    activeAction === 'autoFix' ||
    autoFixProgress?.status === 'starting' ||
    autoFixProgress?.status === 'running';
  const isAutoCropActive =
    activeAction === 'autoCrop' ||
    autoCropProgress?.status === 'starting' ||
    autoCropProgress?.status === 'running';
  const isMediaPreviewActive =
    activeAction === 'mediaPreview' ||
    mediaPreviewProgress?.status === 'starting' ||
    mediaPreviewProgress?.status === 'running';
  const isPreviewClipActive =
    activeAction === 'previewClip' ||
    previewClipProgress?.status === 'starting' ||
    previewClipProgress?.status === 'running';
  const isMigrationScanning = activeAction === 'migrationScan';
  const isMigrationExecuting =
    activeAction === 'migrationExecute' ||
    migrationProgress?.status === 'starting' ||
    migrationProgress?.status === 'running';
  const isMigrationActive = isMigrationScanning || isMigrationExecuting;
  const isTrashPlanning = activeAction === 'trashPlan';
  const isTrashExecuting = activeAction === 'trashExecute';
  const isTrashActive = isTrashPlanning || isTrashExecuting;
  const isMovePlanning = activeAction === 'movePlan';
  const isMoveExecuting = activeAction === 'moveExecute';
  const isMoveActive = isMovePlanning || isMoveExecuting;
  const isArchivePlanning = activeAction === 'archivePlan';
  const isArchiveExecuting = activeAction === 'archiveExecute';
  const isArchiveActive = isArchivePlanning || isArchiveExecuting;
  const isReplacementPlanning = activeAction === 'replacementPlan';
  const isReplacementActionUpdating = activeAction === 'replacementUpdate';
  const isReplacementExecuting =
    activeAction === 'replacementExecute' ||
    replacementProgress?.status === 'starting' ||
    replacementProgress?.status === 'running';
  const isReplacementActive = isReplacementPlanning || isReplacementActionUpdating || isReplacementExecuting;
  const isOperationHistoryLoading = activeAction === 'operationHistory';
  const isPremiereImportActive = activeAction === 'premiereImport' || isPremiereImportSubmitting;
  const auditPercent = getProgressPercent(auditProgress?.processedFiles, auditProgress?.totalFiles);
  const discoveryPercent = getProgressPercent(
    discoveryProgress?.processedFiles,
    discoveryProgress?.totalFiles
  );
  const ffprobePercent = getProgressPercent(ffprobeProgress?.processedFiles, ffprobeProgress?.totalFiles);
  const autoFixPercent = getProgressPercent(autoFixProgress?.processedVideos, autoFixProgress?.totalVideos);
  const autoCropPercent = getProgressPercent(autoCropProgress?.processedFiles, autoCropProgress?.totalFiles);
  const mediaPreviewPercent = getProgressPercent(
    mediaPreviewProgress?.processedVideos,
    mediaPreviewProgress?.totalVideos
  );
  const previewClipPercent = getProgressPercent(
    previewClipProgress?.processedClips,
    previewClipProgress?.totalClips
  );
  const migrationPercent = getProgressPercent(migrationProgress?.processedFiles, migrationProgress?.totalFiles);
  const replacementPercent = getProgressPercent(
    replacementProgress?.processedItems,
    replacementProgress?.totalItems
  );
  const discoveredPaths = discoveryProgress?.result?.files.map((file) => file.path) ?? [];
  const metadataItems = ffprobeProgress?.result?.items ?? [];
  const autoFixOutputDirectory = outputFolder ?? settings?.defaultAutoFixDestinationRoot ?? null;
  const autoCropOutputRootDir = outputFolder ?? settings?.defaultOutputDirectory ?? null;
  const canRunAudit =
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive &&
    (selectedFolders.length > 0 || selectedFiles.length > 0) &&
    (auditOptions.includeLowResolutionAnalysis || auditOptions.includeBlackBorderAnalysis);
  const canRefreshAudit =
    Boolean(lastAuditRequest) &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canAutoFixSelected =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canOpenCropOptions =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canGenerateThumbnails =
    visibleVideoRows.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canMoveSelectedToTrash =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canMoveSelectedToFolder =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canArchiveSelectedOriginals =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canStartMigration =
    Boolean(auditedRootDirectory) &&
    Boolean(videoRows) &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;
  const canEditSelectedInPremiere =
    selectedVideos.length > 0 &&
    premiereStatus?.status === 'ready' &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isMigrationActive &&
    !isTrashActive &&
    !isMoveActive &&
    !isArchiveActive &&
    !isReplacementActive &&
    !isPremiereImportActive;

  const persistSettings = useCallback(async (partialSettings: AppSettingsUpdate): Promise<AppSettings | null> => {
    setActiveAction('settings');

    try {
      const updatedSettings = await window.videoAudit.settings.update(partialSettings);
      setSettings(updatedSettings);
      setSettingsMessage('Settings saved.');
      return updatedSettings;
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not save settings.'));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, []);

  const handleSelectionResult = useCallback(
    async (result: PathSelectionResult, onValidPaths: (paths: string[]) => void): Promise<void> => {
      if (result.canceled) {
        setSelectionMessage(null);
        return;
      }

      onValidPaths(result.paths);
      setSelectionMessage(
        result.invalidPaths.length > 0
          ? `${result.invalidPaths.length} selected path(s) could not be used.`
          : null
      );
    },
    []
  );

  const chooseFolders = useCallback(async (): Promise<void> => {
    setActiveAction('folders');

    try {
      const result = await window.videoAudit.dialog.chooseFolders();
      await handleSelectionResult(result, (paths) => {
        setSelectedFolders(dedupeOverlappingFolderPaths(paths));
        setSelectedFolderSummary(null);
        setFolderTreeRootPath(null);
        setFolderTreeLastScannedAt(null);
      });

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths(result.paths, settings?.recentFolders ?? []),
          latestSelectedFolder: result.paths[0],
          latestFolderTreeSource: null
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose folders.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFolders]);

  const applyFolderTreeSelection = useCallback(
    async (
      folderPaths: string[],
      rootPath: string,
      summary: SelectedFolderSummary,
      lastScannedAt: string | null
    ): Promise<void> => {
      const dedupedFolderPaths = dedupeOverlappingFolderPaths(folderPaths);
      const nextFolderTreeSource = createPersistedFolderTreeSource({
        rootPath,
        selectedFolderPaths: summary.selectedFolderPaths,
        dedupedSelectedFolderPaths: dedupedFolderPaths,
        summary: {
          ...summary,
          dedupedFolderPaths,
          dedupedFolderCount: dedupedFolderPaths.length
        },
        includeSubfolders: auditOptions.includeSubfolders,
        lastScannedAt
      });

      setSelectedFolders(dedupedFolderPaths);
      setSelectedFolderSummary(nextFolderTreeSource.selectedFolderSummary);
      setFolderTreeRootPath(rootPath);
      setFolderTreeLastScannedAt(lastScannedAt);
      setSelectionMessage(null);
      setWorkflowMessage(
        dedupedFolderPaths.length > 0
          ? `${dedupedFolderPaths.length.toLocaleString()} folder tree source(s) selected.`
          : 'No folder tree sources selected.'
      );

      if (dedupedFolderPaths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths([rootPath, ...dedupedFolderPaths], settings?.recentFolders ?? []),
          latestSelectedFolder: rootPath,
          latestFolderTreeSource: nextFolderTreeSource
        });
      }
    },
    [auditOptions.includeSubfolders, persistSettings, settings?.recentFolders]
  );

  const chooseRecentFolder = useCallback(
    async (path: string): Promise<void> => {
      if (!path) {
        return;
      }

      setSelectedFolders([path]);
      setSelectedFolderSummary(null);
      setFolderTreeRootPath(null);
      setFolderTreeLastScannedAt(null);
      setSelectedFiles([]);
      setSelectionMessage(null);
      await persistSettings({
        recentFolders: mergeRecentPaths([path], settings?.recentFolders ?? []),
        latestSelectedFolder: path,
        latestFolderTreeSource: null
      });
    },
    [persistSettings, settings?.recentFolders]
  );

  const chooseFiles = useCallback(async (): Promise<void> => {
    setActiveAction('files');

    try {
      const result = await window.videoAudit.dialog.chooseVideoFiles();
      await handleSelectionResult(result, setSelectedFiles);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFiles: mergeRecentPaths(result.paths, settings?.recentFiles ?? [])
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose files.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFiles]);

  const clearSelectedSources = useCallback((): void => {
    setSelectedFolders([]);
    setSelectedFolderSummary(null);
    setFolderTreeRootPath(null);
    setFolderTreeLastScannedAt(null);
    setSelectedFiles([]);
    setSelectionMessage(null);
    setWorkflowMessage('Selected sources cleared.');
    void persistSettings({
      latestFolderTreeSource: null,
      latestSelectedFolder: null
    });
  }, [persistSettings]);

  const chooseOutputFolder = useCallback(async (): Promise<void> => {
    setActiveAction('output');

    try {
      const result = await window.videoAudit.dialog.chooseOutputFolder();
      await handleSelectionResult(result, (paths) => setOutputFolder(paths[0] ?? null));

      if (!result.canceled && result.paths[0]) {
        await persistSettings({
          defaultOutputDirectory: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose an output folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings]);

  const revealPath = useCallback(async (path: string): Promise<void> => {
    setActiveAction('reveal');

    try {
      const validation = await window.videoAudit.fileOperations.validateKnownPaths({
        items: [
          {
            path,
            expectedKind: 'any'
          }
        ]
      });
      const item = validation.items[0];

      if (!item?.isValid || !item.identity) {
        setSelectionMessage(item?.errors[0] ?? validation.message ?? 'Could not reveal that path in Finder.');
        return;
      }

      const result = item.identity.isDirectory
        ? await window.videoAudit.fileOperations.revealFolder({
            path,
            expectedKind: 'directory',
            expectedFileName: item.identity.fileName
          })
        : await window.videoAudit.fileOperations.revealFile({
            path,
            expectedKind: 'file',
            expectedFileName: item.identity.fileName
          });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that path in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that path in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const revealKnownFile = useCallback(async (item: KnownPathValidationItem): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await window.videoAudit.fileOperations.revealFile({
        ...item,
        expectedKind: 'file'
      });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that file in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that file in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const revealKnownFolder = useCallback(async (item: KnownPathValidationItem): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await window.videoAudit.fileOperations.revealFolder({
        ...item,
        expectedKind: 'directory'
      });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that folder in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that folder in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const updateSettingsField = useCallback(
    async <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): Promise<void> => {
      await persistSettings({ [key]: value } as AppSettingsUpdate);
    },
    [persistSettings]
  );

  const updateAuditOption = useCallback(
    async <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]): Promise<void> => {
      const nextOptions = {
        ...auditOptions,
        [key]: value
      };

      setAuditOptions(nextOptions);

      if (key === 'includeSubfolders') {
        await persistSettings({
          includeSubfoldersDefault: Boolean(value),
          latestFolderTreeSource: settings?.latestFolderTreeSource
            ? {
                ...settings.latestFolderTreeSource,
                includeSubfolders: Boolean(value)
              }
            : null
        });
      }

      if (key === 'includeLowResolutionAnalysis') {
        await persistSettings({ lowResolutionAnalysisEnabledDefault: Boolean(value) });
      }

      if (key === 'includeBlackBorderAnalysis') {
        await persistSettings({ blackBorderAnalysisEnabledDefault: Boolean(value) });
      }
    },
    [auditOptions, persistSettings, settings?.latestFolderTreeSource]
  );

  const resetSettings = useCallback(async (): Promise<void> => {
    setActiveAction('settings');

    try {
      const reset = await window.videoAudit.settings.reset();
      setSettings(reset);
      setOutputFolder(reset.defaultOutputDirectory);
      setAuditOptions(settingsToAuditOptions(reset));
      setSelectedFolders([]);
      setSelectedFolderSummary(null);
      setFolderTreeRootPath(null);
      setFolderTreeLastScannedAt(null);
      setSettingsMessage('Settings reset.');
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not reset settings.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const runToolDiagnostics = useCallback(async (): Promise<void> => {
    setIsToolDiagnosticsLoading(true);
    setToolDiagnosticsError(null);

    try {
      const result = await window.videoAudit.diagnostics.checkTools();
      setToolDiagnostics(result);
      setSettingsMessage(result.message ?? 'Media tool diagnostic complete.');
    } catch (error: unknown) {
      setToolDiagnosticsError(getErrorMessage(error, 'Unable to check ffmpeg/ffprobe availability.'));
    } finally {
      setIsToolDiagnosticsLoading(false);
    }
  }, []);

  const startAuditRequest = useCallback(async (request: AuditRequest): Promise<void> => {
    setWorkflowMessage(null);
    setAuditProgress(null);
    setAuditResult(null);
    setAuditSummary(null);
    setAuditErrors([]);
    setVideoRows(null);
    setSelectedVideos([]);
    setActiveAction(null);
    pendingAuditRequestRef.current = request;
    setLastAuditRequest(request);

    const response = await window.videoAudit.audit.start(request);

    if (response.status !== 'started' || !response.jobId) {
      setWorkflowMessage(response.message ?? 'Could not start audit.');
      return;
    }

    setAuditJobId(response.jobId);
    setWorkflowMessage(response.message ?? 'Audit started.');
  }, []);

  const runAudit = useCallback(async (): Promise<void> => {
    const request = {
      folderPaths: dedupeOverlappingFolderPaths(selectedFolders),
      filePaths: selectedFiles,
      options: auditOptions
    };

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before running an audit.');
      return;
    }

    if (!request.options.includeLowResolutionAnalysis && !request.options.includeBlackBorderAnalysis) {
      setWorkflowMessage('At least one audit option must be selected.');
      return;
    }

    try {
      await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not start audit.'));
    }
  }, [auditOptions, selectedFiles, selectedFolders, startAuditRequest]);

  const refreshAudit = useCallback(async (): Promise<void> => {
    if (!lastAuditRequest) {
      setWorkflowMessage('No saved audit request is available.');
      return;
    }

    const dedupedFolderPaths = dedupeOverlappingFolderPaths(lastAuditRequest.folderPaths);
    const request = {
      ...lastAuditRequest,
      folderPaths: dedupedFolderPaths
    };

    setSelectedFolders(dedupedFolderPaths);
    setSelectedFolderSummary(null);
    setSelectedFiles(lastAuditRequest.filePaths);
    setAuditOptions(lastAuditRequest.options);

    try {
      await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not refresh audit.'));
    }
  }, [lastAuditRequest, startAuditRequest]);

  const cancelAudit = useCallback(async (): Promise<void> => {
    if (!auditJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.audit.cancel(auditJobId);
      setAuditProgress(progress);
      setWorkflowMessage(progress.message ?? 'Audit canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel audit.'));
    }
  }, [auditJobId]);

  const persistCurrentResult = useCallback(
    async (nextResult: AuditResult, thumbnailValue = showThumbnailsState): Promise<void> => {
      if (!lastAuditRequest) {
        return;
      }

      const storedState = await saveStoredAuditResult({
        request: lastAuditRequest,
        result: nextResult,
        showThumbnails: thumbnailValue
      });

      setStorageSavedAt(storedState.savedAt);
      setStorageMessage(`Saved ${nextResult.videos.length.toLocaleString()} flagged row(s).`);
    },
    [lastAuditRequest, showThumbnailsState]
  );

  const hideVideoPathsFromTable = useCallback(
    async (paths: string[]): Promise<number> => {
      if (!auditResult || paths.length === 0) {
        return 0;
      }

      const pathSet = new Set(paths);
      let hiddenCount = 0;
      const nextRows = auditResult.videos.map((row) => {
        if (!pathSet.has(row.path) || row.visible === false) {
          return row;
        }

        hiddenCount += 1;
        return {
          ...row,
          visible: false
        };
      });

      if (hiddenCount === 0) {
        return 0;
      }

      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) =>
        currentSelection.filter((video) => !pathSet.has(video.path))
      );
      await persistCurrentResult(nextResult);

      return hiddenCount;
    },
    [auditResult, persistCurrentResult]
  );

  const loadOperationHistory = useCallback(async (): Promise<void> => {
    setOperationHistoryError(null);
    setActiveAction('operationHistory');

    try {
      const response = await window.videoAudit.operationHistory.listRecent({
        limit: 50
      });

      if (response.status !== 'success') {
        setOperationHistoryError(response.message ?? 'Could not load operation history.');
        return;
      }

      setOperationHistoryRecords(response.records);
      setSelectedOperationHistoryRecord((current) => {
        if (current && response.records.some((record) => record.id === current.id)) {
          return current;
        }

        return response.records[0] ?? null;
      });
    } catch (error: unknown) {
      setOperationHistoryError(getErrorMessage(error, 'Could not load operation history.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const openOperationHistory = useCallback(async (): Promise<void> => {
    setIsOperationHistoryVisible(true);
    await loadOperationHistory();
  }, [loadOperationHistory]);

  const closeOperationHistory = useCallback((): void => {
    if (isOperationHistoryLoading) {
      return;
    }

    setIsOperationHistoryVisible(false);
    setOperationHistoryError(null);
  }, [isOperationHistoryLoading]);

  const refreshOperationHistory = useCallback(async (): Promise<void> => {
    await loadOperationHistory();
  }, [loadOperationHistory]);

  const selectOperationHistoryRecord = useCallback(async (operationId: string): Promise<void> => {
    setOperationHistoryError(null);
    setActiveAction('operationHistory');

    try {
      const response = await window.videoAudit.operationHistory.getDetails(operationId);

      if (response.status !== 'success' || !response.record) {
        setOperationHistoryError(response.message ?? 'Could not load operation details.');
        return;
      }

      setSelectedOperationHistoryRecord(response.record);
      setOperationHistoryRecords((records) =>
        records.map((record) => (record.id === response.record?.id ? response.record : record))
      );
    } catch (error: unknown) {
      setOperationHistoryError(getErrorMessage(error, 'Could not load operation details.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const openTrashDialog = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setWorkflowMessage('Select at least one video before moving files to Trash.');
      return;
    }

    setTrashPlan(null);
    setTrashPlanError(null);
    setTrashResult(null);
    setTrashResultError(null);
    setActiveAction('trashPlan');

    try {
      const response = await window.videoAudit.fileOperations.createTrashPlan({
        operationType: 'trash',
        items: selectedVideos.map(toKnownFileOperationItem),
        knownRootDirectories: getKnownDirectories({
          auditedRootDirectory,
          selectedFolders,
          selectedVideos
        }),
        knownOutputDirectories: outputFolder ? [outputFolder] : []
      });

      if (response.status !== 'planned' || !response.plan) {
        setTrashPlanError(response.message ?? 'Could not create a Move to Trash plan.');
        setWorkflowMessage(response.message ?? 'Could not create a Move to Trash plan.');
        return;
      }

      setTrashPlan(response.plan);
      setIsTrashConfirmDialogVisible(true);
      setWorkflowMessage(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not create a Move to Trash plan.');
      setTrashPlanError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [auditedRootDirectory, outputFolder, selectedFolders, selectedVideos]);

  const closeTrashDialog = useCallback((): void => {
    if (isTrashExecuting) {
      return;
    }

    setIsTrashConfirmDialogVisible(false);
    setTrashPlanError(null);
  }, [isTrashExecuting]);

  const executeTrashPlan = useCallback(
    async (typedConfirmation: string | null): Promise<void> => {
      if (!trashPlan) {
        setTrashPlanError('Create a Move to Trash plan before executing.');
        return;
      }

      setTrashPlanError(null);
      setTrashResult(null);
      setTrashResultError(null);
      setActiveAction('trashExecute');

      try {
        const response = await window.videoAudit.fileOperations.executeTrashPlan({
          planId: trashPlan.id,
          confirmed: true,
          typedConfirmation
        });

        if (!response.result) {
          const message = response.message ?? 'Move to Trash did not complete.';
          setTrashPlanError(message);
          setWorkflowMessage(message);
          return;
        }

        setTrashResult(response.result);
        setIsTrashConfirmDialogVisible(false);
        setIsTrashResultDialogVisible(true);
        setTrashPlan(null);
        setWorkflowMessage(response.message ?? 'Move to Trash complete.');

        const trashedPaths = response.result.items
          .filter((item) => item.status === 'success')
          .map((item) => item.sourcePath);
        await hideVideoPathsFromTable(trashedPaths);
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not move selected files to Trash.');
        setTrashPlanError(message);
        setTrashResultError(message);
        setWorkflowMessage(message);
      } finally {
        setActiveAction(null);
      }
    },
    [hideVideoPathsFromTable, trashPlan]
  );

  const closeTrashResultDialog = useCallback((): void => {
    setIsTrashResultDialogVisible(false);
    setTrashResultError(null);
    if (settings?.previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, settings?.previewOperationHistoryAfterExecution]);

  const openMoveDialog = useCallback(
    async (conflictStrategy?: DestinationConflictStrategy): Promise<void> => {
      if (selectedVideos.length === 0) {
        setWorkflowMessage('Select at least one video before moving files.');
        return;
      }

      const effectiveConflictStrategy = conflictStrategy ?? settings?.fileManagementConflictStrategy ?? 'skip';

      setMovePlan(null);
      setMovePlanError(null);
      setMoveResult(null);
      setMoveResultError(null);
      setActiveAction('movePlan');

      try {
        const destinationResult = await window.videoAudit.dialog.chooseMoveDestinationFolder();

        if (destinationResult.canceled) {
          return;
        }

        const destinationDirectory = destinationResult.paths[0];

        if (!destinationDirectory) {
          const reason = destinationResult.invalidPaths[0]?.reason ?? 'Choose a valid destination folder.';
          setMovePlanError(reason);
          setWorkflowMessage(reason);
          return;
        }

        const response = await window.videoAudit.fileOperations.createMovePlan({
          operationType: 'move',
          items: selectedVideos.map(toKnownFileOperationItem),
          destinationDirectory,
          conflictStrategy: effectiveConflictStrategy
        });

        if (response.status !== 'planned' || !response.plan) {
          setMovePlanError(response.message ?? 'Could not create a move plan.');
          setWorkflowMessage(response.message ?? 'Could not create a move plan.');
          return;
        }

        setMovePlan(response.plan);
        setIsMoveConfirmDialogVisible(true);
        setWorkflowMessage(null);
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not create a move plan.');
        setMovePlanError(message);
        setWorkflowMessage(message);
      } finally {
        setActiveAction(null);
      }
    },
    [selectedVideos, settings?.fileManagementConflictStrategy]
  );

  const closeMoveDialog = useCallback((): void => {
    if (isMoveExecuting) {
      return;
    }

    setIsMoveConfirmDialogVisible(false);
    setMovePlanError(null);
  }, [isMoveExecuting]);

  const executeMovePlan = useCallback(async (): Promise<void> => {
    if (!movePlan) {
      setMovePlanError('Create a move plan before executing.');
      return;
    }

    setMovePlanError(null);
    setMoveResult(null);
    setMoveResultError(null);
    setActiveAction('moveExecute');

    try {
      const response = await window.videoAudit.fileOperations.executeMovePlan({
        planId: movePlan.id,
        confirmed: true
      });

      if (!response.result) {
        const message = response.message ?? 'Move operation did not complete.';
        setMovePlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setMoveResult(response.result);
      setIsMoveConfirmDialogVisible(false);
      setIsMoveResultDialogVisible(true);
      setMovePlan(null);
      setWorkflowMessage(response.message ?? 'Move operation complete.');

      const movedPaths = response.result.items
        .filter((item) => item.status === 'success')
        .map((item) => item.sourcePath);
      await hideVideoPathsFromTable(movedPaths);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not move selected files.');
      setMovePlanError(message);
      setMoveResultError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [hideVideoPathsFromTable, movePlan]);

  const closeMoveResultDialog = useCallback((): void => {
    setIsMoveResultDialogVisible(false);
    setMoveResultError(null);
    if (settings?.previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, settings?.previewOperationHistoryAfterExecution]);

  const openArchiveDialog = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setWorkflowMessage('Select at least one video before archiving originals.');
      return;
    }

    setArchivePlan(null);
    setArchivePlanError(null);
    setArchiveResult(null);
    setArchiveResultError(null);
    setActiveAction('archivePlan');

    try {
      const response = await window.videoAudit.fileOperations.createArchivePlan({
        operationType: 'archive',
        items: selectedVideos.map(toKnownFileOperationItem),
        conflictStrategy: settings?.fileManagementConflictStrategy ?? 'rename-with-suffix'
      });

      if (response.status !== 'planned' || !response.plan) {
        setArchivePlanError(response.message ?? 'Could not create an archive plan.');
        setWorkflowMessage(response.message ?? 'Could not create an archive plan.');
        return;
      }

      setArchivePlan(response.plan);
      setIsArchiveConfirmDialogVisible(true);
      setWorkflowMessage(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not create an archive plan.');
      setArchivePlanError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [selectedVideos, settings?.fileManagementConflictStrategy]);

  const closeArchiveDialog = useCallback((): void => {
    if (isArchiveExecuting) {
      return;
    }

    setIsArchiveConfirmDialogVisible(false);
    setArchivePlanError(null);
  }, [isArchiveExecuting]);

  const executeArchivePlan = useCallback(async (): Promise<void> => {
    if (!archivePlan) {
      setArchivePlanError('Create an archive plan before executing.');
      return;
    }

    setArchivePlanError(null);
    setArchiveResult(null);
    setArchiveResultError(null);
    setActiveAction('archiveExecute');

    try {
      const response = await window.videoAudit.fileOperations.executeArchivePlan({
        planId: archivePlan.id,
        confirmed: true
      });

      if (!response.result) {
        const message = response.message ?? 'Archive operation did not complete.';
        setArchivePlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setArchiveResult(response.result);
      setIsArchiveConfirmDialogVisible(false);
      setIsArchiveResultDialogVisible(true);
      setArchivePlan(null);
      setWorkflowMessage(response.message ?? 'Archive operation complete.');

      const archivedPaths = response.result.items
        .filter((item) => item.status === 'success')
        .map((item) => item.sourcePath);
      await hideVideoPathsFromTable(archivedPaths);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not archive selected originals.');
      setArchivePlanError(message);
      setArchiveResultError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [archivePlan, hideVideoPathsFromTable]);

  const closeArchiveResultDialog = useCallback((): void => {
    setIsArchiveResultDialogVisible(false);
    setArchiveResultError(null);
    if (settings?.previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, settings?.previewOperationHistoryAfterExecution]);

  const createPostConversionPlan = useCallback(
    async ({
      sourceLabel,
      autoFixResult,
      autoCropResult
    }: {
      sourceLabel: string;
      autoFixResult?: AutoFixResult;
      autoCropResult?: AutoCropResult;
    }): Promise<boolean> => {
      const source = autoFixResult ? 'auto-fix-result' : 'auto-crop-result';

      if (!hasSuccessfulConversionOutputs(autoFixResult ?? autoCropResult ?? null)) {
        return false;
      }

      const postConversionAction = settings?.defaultPostConversionAction ?? 'ask-every-time';
      const shouldShowPostConversionDialog = settings?.showPostConversionDialogAutomatically ?? true;

      if (!shouldShowPostConversionDialog || postConversionAction === 'leave-outputs') {
        setPostConversionPlan(null);
        setPostConversionSourceLabel(null);
        setPostConversionMode('choices');
        setPostConversionError(null);
        setPostConversionMessage(null);
        setIsPostConversionDialogVisible(false);
        setWorkflowMessage(`${sourceLabel} complete. Converted files were left in the output folder.`);
        return true;
      }

      setPostConversionPlan(null);
      setPostConversionSourceLabel(sourceLabel);
      setPostConversionMode(postConversionAction === 'review-manually' ? 'manual-review' : 'choices');
      setPostConversionError(null);
      setPostConversionMessage(null);
      setIsPostConversionDialogVisible(true);
      setActiveAction('replacementPlan');

      try {
        const response = await window.videoAudit.replacement.createPlan({
          source,
          defaultAction: 'replace-original',
          autoFixResult: autoFixResult ?? null,
          autoCropResult: autoCropResult ?? null
        });

        if (response.status !== 'planned' || !response.plan) {
          setPostConversionError(response.message ?? 'Could not create a replacement plan.');
          return true;
        }

        setPostConversionPlan(response.plan);
        return true;
      } catch (error: unknown) {
        setPostConversionError(getErrorMessage(error, 'Could not create a replacement plan.'));
        return true;
      } finally {
        setActiveAction(null);
      }
    },
    [settings?.defaultPostConversionAction, settings?.showPostConversionDialogAutomatically]
  );

  const updatePostConversionPlanActions = useCallback(
    async (actions: ReplacementPlanActionUpdate[], successMessage: string): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before updating actions.');
        return;
      }

      if (actions.length === 0) {
        setPostConversionMessage('No matching replacement plan items to update.');
        return;
      }

      setPostConversionError(null);
      setPostConversionMessage(null);
      setActiveAction('replacementUpdate');

      try {
        const response = await window.videoAudit.replacement.updatePlanActions({
          planId: postConversionPlan.id,
          actions
        });

        if (response.status !== 'updated' || !response.plan) {
          setPostConversionError(response.message ?? 'Could not update replacement plan actions.');
          return;
        }

        setPostConversionPlan(response.plan);
        setPostConversionMessage(successMessage);
      } catch (error: unknown) {
        setPostConversionError(getErrorMessage(error, 'Could not update replacement plan actions.'));
      } finally {
        setActiveAction(null);
      }
    },
    [postConversionPlan]
  );

  const changePostConversionPlanAction = useCallback(
    async (itemId: string, selectedAction: ReplacementAction): Promise<void> => {
      await updatePostConversionPlanActions(
        [
          {
            itemId,
            selectedAction
          }
        ],
        'Replacement action updated.'
      );
    },
    [updatePostConversionPlanActions]
  );

  const applyPostConversionPlanBulkAction = useCallback(
    async (action: ReplacementPlanBulkAction): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before updating actions.');
        return;
      }

      const actions = getReplacementBulkActionUpdates(postConversionPlan, action);

      await updatePostConversionPlanActions(actions, getReplacementBulkActionMessage(action));
    },
    [postConversionPlan, updatePostConversionPlanActions]
  );

  const replacePostConversionOriginals = useCallback(
    async (typedConfirmation: string | null): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before replacing originals.');
        return;
      }

      const executableCount = getExecutableReplacementItemCount(postConversionPlan);

      if (executableCount === 0) {
        setPostConversionError('No replacement items are ready.');
        return;
      }

      if (
        requiresReplacementConfirmation(postConversionPlan, settings) &&
        typedConfirmation !== REPLACE_CONFIRMATION_PHRASE
      ) {
        setPostConversionError('Type REPLACE before replacing originals.');
        return;
      }

      setPostConversionError(null);
      setPostConversionMessage(null);
      setReplacementProgress({
        jobId: null,
        planId: postConversionPlan.id,
        status: 'starting',
        phase: 'validating',
        totalItems: postConversionPlan.items.length,
        processedItems: 0,
        succeededCount: 0,
        skippedCount: 0,
        failedCount: 0,
        currentFile: null,
        message: 'Starting replacement execution.',
        error: null
      });
      setReplacementResult(null);
      setReplacementResultError(null);
      setIsReplacementResultDialogVisible(false);
      setActiveAction('replacementExecute');

      try {
        const response = await window.videoAudit.replacement.executePlan({
          planId: postConversionPlan.id,
          confirmed: true,
          typedConfirmation,
          originalDisposition: 'move-original-to-trash'
        });

        if (response.status !== 'started' || !response.jobId) {
          setActiveAction(null);
          setPostConversionError(response.message ?? 'Could not start replacement execution.');
          setReplacementResultError(response.message ?? 'Could not start replacement execution.');
          return;
        }

        setReplacementJobId(response.jobId);
        setPostConversionMessage(
          response.message ?? `${executableCount.toLocaleString()} replacement item(s) queued.`
        );
        setWorkflowMessage(response.message ?? 'Replacement execution started.');
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not start replacement execution.');
        setActiveAction(null);
        setPostConversionError(message);
        setReplacementResultError(message);
        setWorkflowMessage(message);
      }
    },
    [postConversionPlan, settings]
  );

  const reviewPostConversionPlan = useCallback((): void => {
    setPostConversionError(null);
    setPostConversionMessage(null);
    setPostConversionMode('manual-review');
  }, []);

  const leavePostConversionOutputs = useCallback((): void => {
    setIsPostConversionDialogVisible(false);
    setPostConversionError(null);
    setPostConversionMessage(null);
    setWorkflowMessage('Converted files were left in the output folder.');
  }, []);

  const backToPostConversionChoices = useCallback((): void => {
    setPostConversionMode('choices');
    setPostConversionError(null);
    setPostConversionMessage(null);
  }, []);

  const closePostConversionDialog = useCallback((): void => {
    if (isReplacementActionUpdating || isReplacementExecuting) {
      return;
    }

    setIsPostConversionDialogVisible(false);
    setPostConversionError(null);
    setPostConversionMessage(null);
  }, [isReplacementActionUpdating, isReplacementExecuting]);

  const cancelReplacementExecution = useCallback(async (): Promise<void> => {
    if (!replacementJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.replacement.cancelExecution(replacementJobId);
      setReplacementProgress(progress);
      setWorkflowMessage(progress.message ?? 'Replacement execution canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not cancel replacement execution.');
      setReplacementResultError(message);
      setWorkflowMessage(message);
    }
  }, [replacementJobId]);

  const closeReplacementResultDialog = useCallback((): void => {
    setIsReplacementResultDialogVisible(false);
    setReplacementResultError(null);
    if (settings?.previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, settings?.previewOperationHistoryAfterExecution]);

  useEffect(() => {
    return window.videoAudit.autoFix.onProgress((progress) => {
      setAutoFixProgress(progress);

      if (progress.jobId) {
        setAutoFixJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoFix');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoFixResult(progress.result);
        setAutoFixError(null);

        const succeededPaths = progress.result.items
          .filter((item) => item.status === 'success' && item.sourcePath)
          .map((item) => item.sourcePath as string);

        void hideVideoPathsFromTable(succeededPaths).then((hiddenCount) => {
          const removedText =
            hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} video(s) were removed from the table.` : '';
          setWorkflowMessage(`Auto-Fix complete.${removedText}`);
          void createPostConversionPlan({
            sourceLabel: 'Auto-Fix',
            autoFixResult: progress.result
          }).then((opened) => {
            if (opened) {
              setIsAutoFixDialogVisible(false);
            }
          });
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoFixError(progress.error ?? progress.message ?? 'Auto-Fix failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Fix failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoFixError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      }
    });
  }, [createPostConversionPlan, hideVideoPathsFromTable]);

  useEffect(() => {
    return window.videoAudit.autoCrop.onProgress((progress) => {
      setAutoCropProgress(progress);

      if (progress.jobId) {
        setAutoCropJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoCrop');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoCropResult(progress.result);
        setAutoCropError(null);
        const croppedCount = progress.result.summary.succeeded;
        const croppedLabel = croppedCount === 1 ? 'cropped copy' : 'cropped copies';
        setWorkflowMessage(
          `Auto-Crop complete. ${croppedCount.toLocaleString()} ${croppedLabel} created.`
        );
        void createPostConversionPlan({
          sourceLabel: 'Auto-Crop',
          autoCropResult: progress.result
        }).then((opened) => {
          if (opened) {
            setIsAutoCropDialogVisible(false);
          }
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoCropError(progress.error ?? progress.message ?? 'Auto-Crop failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Crop failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoCropError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      }
    });
  }, [createPostConversionPlan]);

  useEffect(() => {
    return window.videoAudit.replacement.onProgress((progress) => {
      setReplacementProgress(progress);

      if (progress.jobId) {
        setReplacementJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('replacementExecute');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setReplacementResult(progress.result);
        setReplacementResultError(null);
        setIsPostConversionDialogVisible(false);
        setIsReplacementResultDialogVisible(true);

        const replacedPaths = progress.result.items
          .filter((item) => item.status === 'success')
          .map((item) => item.sourcePath);

        void hideVideoPathsFromTable(replacedPaths).then((hiddenCount) => {
          const hiddenText =
            hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} original row(s) were removed from the table.` : '';
          setWorkflowMessage(`${progress.message ?? 'Replacement complete.'}${hiddenText}`);
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setReplacementResultError(progress.error ?? progress.message ?? 'Replacement execution failed.');
        setWorkflowMessage(progress.message ?? 'Replacement execution failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setReplacementResult(progress.result ?? null);
        setReplacementResultError(null);
        setIsPostConversionDialogVisible(false);
        setIsReplacementResultDialogVisible(Boolean(progress.result));
        setWorkflowMessage(progress.message ?? 'Replacement execution canceled.');
      }
    });
  }, [hideVideoPathsFromTable]);

  const applyMediaPreviewResult = useCallback(
    async (result: MediaPreviewResult): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergeMediaPreviewItems(auditResult.videos, result.items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergeMediaPreviewItems(currentSelection, result.items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult]
  );

  const applyPreviewClipResult = useCallback(
    async (result: PreviewClipResult): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergePreviewClipItems(auditResult.videos, result.items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergePreviewClipItems(currentSelection, result.items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult]
  );

  useEffect(() => {
    return window.videoAudit.mediaPreview.onProgress((progress) => {
      setMediaPreviewProgress(progress);

      if (progress.jobId) {
        setMediaPreviewJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('mediaPreview');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setMediaPreviewResult(progress.result);
        setMediaPreviewError(null);
        void applyMediaPreviewResult(progress.result).then(() => {
          setWorkflowMessage(
            `Thumbnail generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setMediaPreviewError(progress.error ?? progress.message ?? 'Thumbnail generation failed.');
        setWorkflowMessage(progress.message ?? 'Thumbnail generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setMediaPreviewError(null);
        setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      }
    });
  }, [applyMediaPreviewResult]);

  useEffect(() => {
    return window.videoAudit.mediaPreview.onClipProgress((progress) => {
      setPreviewClipProgress(progress);

      if (progress.jobId) {
        setPreviewClipJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('previewClip');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setPreviewClipResult(progress.result);
        setPreviewClipError(null);
        void applyPreviewClipResult(progress.result).then(() => {
          setWorkflowMessage(
            `Preview clip generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setPreviewClipError(progress.error ?? progress.message ?? 'Preview clip generation failed.');
        setWorkflowMessage(progress.message ?? 'Preview clip generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setPreviewClipError(null);
        setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      }
    });
  }, [applyPreviewClipResult]);

  useEffect(() => {
    return window.videoAudit.migration.onProgress((progress) => {
      setMigrationProgress(progress);

      if (progress.jobId) {
        setMigrationJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('migrationExecute');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setMigrationResult(progress.result);
        setMigrationResultError(null);
        setIsMigrationScanDialogVisible(false);
        setIsMigrationResultDialogVisible(true);
        setWorkflowMessage(
          `Migration complete. ${progress.result.summary.filesCopiedToDestination.toLocaleString()} copied, ${progress.result.summary.destinationMatchesArchived.toLocaleString()} archived.`
        );
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setMigrationResultError(progress.error ?? progress.message ?? 'Migration failed.');
        setIsMigrationScanDialogVisible(false);
        setIsMigrationResultDialogVisible(true);
        setWorkflowMessage(progress.message ?? 'Migration failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setMigrationResultError(null);
        setWorkflowMessage(progress.message ?? 'Migration canceled.');
      }
    });
  }, []);

  const removeSelectedVideos = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      return;
    }

    await hideVideoPathsFromTable(selectedVideos.map((video) => video.path));
  }, [hideVideoPathsFromTable, selectedVideos]);

  const restoreRemovedVideos = useCallback(async (): Promise<void> => {
    if (!auditResult) {
      return;
    }

    const nextRows = auditResult.videos.map((row) => ({ ...row, visible: true }));
    const nextResult = {
      ...auditResult,
      videos: nextRows
    };

    setAuditResult(nextResult);
    setVideoRows(nextRows);
    await persistCurrentResult(nextResult);
  }, [auditResult, persistCurrentResult]);

  const setShowThumbnails = useCallback(
    async (value: boolean): Promise<void> => {
      setShowThumbnailsState(value);

      if (auditResult) {
        await persistCurrentResult(auditResult, value);
      }
    },
    [auditResult, persistCurrentResult]
  );

  const clearAuditData = useCallback(async (): Promise<void> => {
    setActiveAction('clearCache');
    setStorageMessage('Clearing cache...');
    setWorkflowMessage(null);

    let savedHistoryMetadata = false;
    let historyMetadataError: string | null = null;

    if (auditResult && lastAuditRequest) {
      try {
        await saveStoredAuditHistoryEntry({
          request: lastAuditRequest,
          result: auditResult,
          outputFolder,
          savedAt: storageSavedAt
        });
        savedHistoryMetadata = true;
      } catch (error: unknown) {
        historyMetadataError = getErrorMessage(error, 'Could not save scan history metadata.');
      }
    }

    try {
      const previewCacheResponse = await window.videoAudit.mediaPreview.clearCache();

      if (previewCacheResponse.status !== 'complete') {
        throw new Error(previewCacheResponse.message || 'Could not clear media preview cache.');
      }

      await clearStoredAuditResult();

      const updatedSettings = await window.videoAudit.settings.update({
        defaultOutputDirectory: null,
        latestSelectedFolder: null,
        latestFolderTreeSource: null,
        lastAuditResultSummary: null
      });

      setSettings(updatedSettings);
      setSettingsMessage(null);
      setOutputFolder(updatedSettings.defaultOutputDirectory);
      setAuditOptions(settingsToAuditOptions(updatedSettings));
      setAuditJobId(null);
      setAuditProgress(null);
      setAuditResult(null);
      setAuditSummary(null);
      setAuditErrors([]);
      setVideoRows(null);
      setSelectedVideos([]);
      setGlobalFilter('');
      setResultsViewFilter('all');
      setShowThumbnailsState(true);
      setSelectedFolders([]);
      setSelectedFolderSummary(null);
      setFolderTreeRootPath(null);
      setFolderTreeLastScannedAt(null);
      setSelectedFiles([]);
      setSelectionMessage(null);
      setDiscoveryJobId(null);
      setDiscoveryProgress(null);
      setFfprobeJobId(null);
      setFfprobeProgress(null);
      setAutoFixJobId(null);
      setAutoFixProgress(null);
      setAutoFixResult(null);
      setAutoFixError(null);
      setIsAutoFixDialogVisible(false);
      setAutoCropJobId(null);
      setAutoCropProgress(null);
      setAutoCropResult(null);
      setAutoCropError(null);
      setIsAutoCropDialogVisible(false);
      setMediaPreviewJobId(null);
      setMediaPreviewProgress(null);
      setMediaPreviewResult(null);
      setMediaPreviewError(null);
      setMediaPreviewScope('all');
      setIsThumbnailDialogVisible(false);
      setPreviewClipJobId(null);
      setPreviewClipProgress(null);
      setPreviewClipResult(null);
      setPreviewClipError(null);
      setMigrationNewEditedDirState('');
      setMigrationScan(null);
      setMigrationScanError(null);
      setMigrationJobId(null);
      setMigrationProgress(null);
      setMigrationResult(null);
      setMigrationResultError(null);
      setIsMigrationScanDialogVisible(false);
      setIsMigrationResultDialogVisible(false);
      setTrashPlan(null);
      setTrashPlanError(null);
      setTrashResult(null);
      setTrashResultError(null);
      setIsTrashConfirmDialogVisible(false);
      setIsTrashResultDialogVisible(false);
      setMovePlan(null);
      setMovePlanError(null);
      setMoveResult(null);
      setMoveResultError(null);
      setIsMoveConfirmDialogVisible(false);
      setIsMoveResultDialogVisible(false);
      setArchivePlan(null);
      setArchivePlanError(null);
      setArchiveResult(null);
      setArchiveResultError(null);
      setIsArchiveConfirmDialogVisible(false);
      setIsArchiveResultDialogVisible(false);
      setPostConversionPlan(null);
      setPostConversionSourceLabel(null);
      setPostConversionMode('choices');
      setPostConversionError(null);
      setPostConversionMessage(null);
      setIsPostConversionDialogVisible(false);
      setReplacementJobId(null);
      setReplacementProgress(null);
      setReplacementResult(null);
      setReplacementResultError(null);
      setIsReplacementResultDialogVisible(false);
      setPremiereImportResult(null);
      setPremiereImportError(null);
      setIsPremiereImportSubmitting(false);
      setLastAuditRequest(null);
      pendingAuditRequestRef.current = null;
      setStorageSavedAt(null);
      setStorageMessage(
        historyMetadataError
          ? `Cache cleared. Scan history metadata could not be saved: ${historyMetadataError}`
          : savedHistoryMetadata
            ? 'Cache cleared. Scan metadata saved for future history.'
            : 'Cache cleared.'
      );
    } catch (error: unknown) {
      setStorageMessage(getErrorMessage(error, 'Could not clear cache.'));
    } finally {
      setActiveAction(null);
    }
  }, [auditResult, lastAuditRequest, outputFolder, storageSavedAt]);

  const startDiscovery = useCallback(async (): Promise<void> => {
    const request: FileDiscoveryRequest = {
      folderPaths: dedupeOverlappingFolderPaths(selectedFolders),
      filePaths: selectedFiles,
      includeSubfolders: auditOptions.includeSubfolders
    };

    setWorkflowMessage(null);
    setDiscoveryProgress(null);

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before scanning.');
      return;
    }

    setActiveAction('discovery');

    try {
      const response = await window.videoAudit.discovery.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start file discovery.');
        return;
      }

      setDiscoveryJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'File discovery started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start file discovery.'));
    }
  }, [auditOptions.includeSubfolders, selectedFiles, selectedFolders]);

  const cancelDiscovery = useCallback(async (): Promise<void> => {
    if (!discoveryJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.discovery.cancel(discoveryJobId);
      setDiscoveryProgress(progress);
      setWorkflowMessage(progress.message ?? 'File discovery canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel file discovery.'));
    }
  }, [discoveryJobId]);

  const startFfprobe = useCallback(async (): Promise<void> => {
    const request: FfprobeMetadataRequest = {
      filePaths: discoveredPaths,
      ffprobePathOverride: settings?.ffprobePathOverride ?? null
    };

    setWorkflowMessage(null);
    setFfprobeProgress(null);

    if (request.filePaths.length === 0) {
      setWorkflowMessage('Scan files before running metadata extraction.');
      return;
    }

    setActiveAction('ffprobe');

    try {
      const response = await window.videoAudit.ffprobe.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start metadata extraction.');
        return;
      }

      setFfprobeJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Metadata extraction started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start metadata extraction.'));
    }
  }, [discoveredPaths, settings?.ffprobePathOverride]);

  const cancelFfprobe = useCallback(async (): Promise<void> => {
    if (!ffprobeJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.ffprobe.cancel(ffprobeJobId);
      setFfprobeProgress(progress);
      setWorkflowMessage(progress.message ?? 'Metadata extraction canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel metadata extraction.'));
    }
  }, [ffprobeJobId]);

  const openAutoFixDialog = useCallback((): void => {
    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress(null);
    setIsAutoFixDialogVisible(true);

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
    }
  }, [autoFixOutputDirectory]);

  const closeAutoFixDialog = useCallback((): void => {
    if (isAutoFixActive) {
      return;
    }

    setIsAutoFixDialogVisible(false);
    setAutoFixError(null);
  }, [isAutoFixActive]);

  const startAutoFix = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoFixError('Select at least one video before running Auto-Fix.');
      return;
    }

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
      return;
    }

    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: selectedVideos.length,
      processedVideos: 0,
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message: 'Starting Auto-Fix.',
      succeeded: 0,
      failed: 0,
      outputDirectory: autoFixOutputDirectory,
      error: null
    });
    setActiveAction('autoFix');

    try {
      const response = await window.videoAudit.autoFix.start({
        videos: selectedVideos,
        outputDirectory: autoFixOutputDirectory
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoFixError(response.message ?? 'Could not start Auto-Fix.');
        return;
      }

      setAutoFixJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Fix started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoFixError(getErrorMessage(error, 'Could not start Auto-Fix.'));
    }
  }, [autoFixOutputDirectory, selectedVideos]);

  const cancelAutoFix = useCallback(async (): Promise<void> => {
    if (!autoFixJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.autoFix.cancel(autoFixJobId);
      setAutoFixProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoFixError(getErrorMessage(error, 'Could not cancel Auto-Fix.'));
    }
  }, [autoFixJobId]);

  const openAutoCropDialog = useCallback((): void => {
    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress(null);
    setIsAutoCropDialogVisible(true);

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
    }
  }, [autoCropOutputRootDir]);

  const closeAutoCropDialog = useCallback((): void => {
    if (isAutoCropActive) {
      return;
    }

    setIsAutoCropDialogVisible(false);
    setAutoCropError(null);
  }, [isAutoCropActive]);

  const startAutoCrop = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoCropError('Select at least one video before running Auto-Crop.');
      return;
    }

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
      return;
    }

    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      outputRootDir: autoCropOutputRootDir,
      outputDir: null,
      totalFiles: selectedVideos.length,
      processedFiles: 0,
      succeededCount: 0,
      skippedCount: 0,
      errorCount: 0,
      currentFile: null,
      message: 'Starting Auto-Crop.',
      error: null
    });
    setActiveAction('autoCrop');

    try {
      const response = await window.videoAudit.autoCrop.start({
        videos: selectedVideos,
        outputRootDir: autoCropOutputRootDir
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoCropError(response.message ?? 'Could not start Auto-Crop.');
        return;
      }

      setAutoCropJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Crop started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoCropError(getErrorMessage(error, 'Could not start Auto-Crop.'));
    }
  }, [autoCropOutputRootDir, selectedVideos]);

  const cancelAutoCrop = useCallback(async (): Promise<void> => {
    if (!autoCropJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.autoCrop.cancel(autoCropJobId);
      setAutoCropProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoCropError(getErrorMessage(error, 'Could not cancel Auto-Crop.'));
    }
  }, [autoCropJobId]);

  const openThumbnailDialog = useCallback((): void => {
    if (visibleVideoRows.length === 0) {
      setWorkflowMessage('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewScope(selectedVideos.length > 0 ? 'selected' : 'all');
    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress(null);
    setIsThumbnailDialogVisible(true);
  }, [selectedVideos.length, visibleVideoRows.length]);

  const closeThumbnailDialog = useCallback((): void => {
    if (isMediaPreviewActive) {
      return;
    }

    setIsThumbnailDialogVisible(false);
    setMediaPreviewError(null);
  }, [isMediaPreviewActive]);

  const startThumbnailGeneration = useCallback(async (): Promise<void> => {
    const rows = mediaPreviewScope === 'selected' && selectedVideos.length > 0 ? selectedVideos : visibleVideoRows;

    if (rows.length === 0) {
      setMediaPreviewError('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: rows.length,
      processedVideos: 0,
      generatedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      currentFile: null,
      message: 'Starting thumbnail generation.',
      error: null
    });
    setActiveAction('mediaPreview');

    try {
      const response = await window.videoAudit.mediaPreview.start({
        videos: rows,
        mode: 'thumbnail'
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setMediaPreviewError(response.message ?? 'Could not start thumbnail generation.');
        return;
      }

      setMediaPreviewJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Thumbnail generation started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setMediaPreviewError(getErrorMessage(error, 'Could not start thumbnail generation.'));
    }
  }, [mediaPreviewScope, selectedVideos, visibleVideoRows]);

  const cancelThumbnailGeneration = useCallback(async (): Promise<void> => {
    if (!mediaPreviewJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.mediaPreview.cancel(mediaPreviewJobId);
      setMediaPreviewProgress(progress);
      setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setMediaPreviewError(getErrorMessage(error, 'Could not cancel thumbnail generation.'));
    }
  }, [mediaPreviewJobId]);

  const startPreviewClipGeneration = useCallback(
    async (video: VideoRow, frames: VideoPreviewFrame[]): Promise<void> => {
      if (!video) {
        setPreviewClipError('Choose a video before generating preview clips.');
        return;
      }

      setPreviewClipError(null);
      setPreviewClipResult(null);
      setPreviewClipProgress({
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalClips: frames.length || null,
        processedClips: 0,
        generatedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        currentFile: video.fileName,
        currentTimestampLabel: null,
        message: 'Starting preview clip generation.',
        error: null
      });
      setActiveAction('previewClip');

      try {
        const response = await window.videoAudit.mediaPreview.startClipGeneration({
          video,
          frames,
          clipDurationSeconds: settings?.previewClipDurationSecondsDefault ?? 5,
          width: settings?.previewClipWidthDefault ?? 640
        });

        if (response.status !== 'started' || !response.jobId) {
          setActiveAction(null);
          setPreviewClipError(response.message ?? 'Could not start preview clip generation.');
          return;
        }

        setPreviewClipJobId(response.jobId);
        setWorkflowMessage(response.message ?? 'Preview clip generation started.');
      } catch (error: unknown) {
        setActiveAction(null);
        setPreviewClipError(getErrorMessage(error, 'Could not start preview clip generation.'));
      }
    },
    [settings?.previewClipDurationSecondsDefault, settings?.previewClipWidthDefault]
  );

  const cancelPreviewClipGeneration = useCallback(async (): Promise<void> => {
    if (!previewClipJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.mediaPreview.cancelClipGeneration(previewClipJobId);
      setPreviewClipProgress(progress);
      setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setPreviewClipError(getErrorMessage(error, 'Could not cancel preview clip generation.'));
    }
  }, [previewClipJobId]);

  const setMigrationNewEditedDir = useCallback((value: string): void => {
    setMigrationNewEditedDirState(value);
    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationResult(null);
    setMigrationResultError(null);
  }, []);

  const openMigrationDialog = useCallback((): void => {
    if (!auditedRootDirectory) {
      setWorkflowMessage('Migration needs a single audited root folder. Run or refresh an audit from one folder first.');
      return;
    }

    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationResultError(null);
    setIsMigrationResultDialogVisible(false);
    setIsMigrationScanDialogVisible(true);
  }, [auditedRootDirectory]);

  const closeMigrationDialog = useCallback((): void => {
    if (isMigrationActive) {
      return;
    }

    setIsMigrationScanDialogVisible(false);
    setMigrationScanError(null);
    setMigrationResultError(null);
  }, [isMigrationActive]);

  const selectMigrationFolder = useCallback(async (): Promise<void> => {
    setActiveAction('migrationScan');
    setMigrationScanError(null);

    try {
      const result = await window.videoAudit.dialog.chooseFolders();

      if (result.canceled) {
        return;
      }

      const selectedPath = result.paths[0];

      if (selectedPath) {
        setMigrationNewEditedDir(selectedPath);
      }

      if (result.invalidPaths.length > 0) {
        setMigrationScanError(`${result.invalidPaths.length.toLocaleString()} selected path(s) could not be used.`);
      }
    } catch (error: unknown) {
      setMigrationScanError(getErrorMessage(error, 'Could not choose a new edits folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setMigrationNewEditedDir]);

  const startMigrationScan = useCallback(async (): Promise<void> => {
    const newEditedDir = migrationNewEditedDir.trim();

    if (!auditedRootDirectory) {
      setMigrationScanError('Migration needs a single audited root folder.');
      return;
    }

    if (!newEditedDir) {
      setMigrationScanError('Choose the folder that contains the new edited videos.');
      return;
    }

    setActiveAction('migrationScan');
    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationResultError(null);

    try {
      const response = await window.videoAudit.migration.scan({
        newEditedDir,
        destinationRoot: auditedRootDirectory
      });

      if (response.status !== 'complete' || !response.result) {
        setMigrationScanError(response.message ?? 'Migration scan failed.');
        return;
      }

      setMigrationScan(response.result);
      setWorkflowMessage(
        `Migration scan complete. ${response.result.summary.newFilesFound.toLocaleString()} new file(s) found.`
      );
    } catch (error: unknown) {
      setMigrationScanError(getErrorMessage(error, 'Migration scan failed.'));
    } finally {
      setActiveAction(null);
    }
  }, [auditedRootDirectory, migrationNewEditedDir]);

  const executeMigration = useCallback(async (): Promise<void> => {
    if (!migrationScan) {
      setMigrationResultError('Run a migration scan before executing.');
      return;
    }

    setMigrationResult(null);
    setMigrationResultError(null);
    setMigrationProgress({
      jobId: null,
      migrationId: migrationScan.migrationId,
      status: 'starting',
      phase: 'validating',
      totalFiles: migrationScan.items.length,
      processedFiles: 0,
      copiedCount: 0,
      archivedCount: 0,
      failedCount: 0,
      currentFile: null,
      message: 'Starting migration.',
      error: null
    });
    setActiveAction('migrationExecute');

    try {
      const response = await window.videoAudit.migration.execute({
        migrationId: migrationScan.migrationId
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setMigrationResultError(response.message ?? 'Could not start migration.');
        return;
      }

      setMigrationJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Migration started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setMigrationResultError(getErrorMessage(error, 'Could not start migration.'));
    }
  }, [migrationScan]);

  const closeMigrationResultDialog = useCallback((): void => {
    if (isMigrationActive) {
      return;
    }

    setIsMigrationResultDialogVisible(false);
    setMigrationResultError(null);
  }, [isMigrationActive]);

  const cancelActiveWork = useCallback(async (): Promise<void> => {
    if (isAuditActive) {
      await cancelAudit();
      return;
    }

    if (isAutoFixActive) {
      await cancelAutoFix();
      return;
    }

    if (isAutoCropActive) {
      await cancelAutoCrop();
      return;
    }

    if (isMediaPreviewActive) {
      await cancelThumbnailGeneration();
      return;
    }

    if (isPreviewClipActive) {
      await cancelPreviewClipGeneration();
      return;
    }

    if (isMigrationScanDialogVisible) {
      closeMigrationDialog();
      return;
    }

    if (isMigrationResultDialogVisible) {
      closeMigrationResultDialog();
      return;
    }

    if (isReplacementExecuting) {
      await cancelReplacementExecution();
      return;
    }

    if (isReplacementResultDialogVisible) {
      closeReplacementResultDialog();
      return;
    }

    if (isOperationHistoryVisible) {
      closeOperationHistory();
      return;
    }

    if (isTrashConfirmDialogVisible) {
      closeTrashDialog();
      return;
    }

    if (isTrashResultDialogVisible) {
      closeTrashResultDialog();
      return;
    }

    if (isMoveConfirmDialogVisible) {
      closeMoveDialog();
      return;
    }

    if (isMoveResultDialogVisible) {
      closeMoveResultDialog();
      return;
    }

    if (isArchiveConfirmDialogVisible) {
      closeArchiveDialog();
      return;
    }

    if (isArchiveResultDialogVisible) {
      closeArchiveResultDialog();
      return;
    }

    if (isPostConversionDialogVisible) {
      closePostConversionDialog();
      return;
    }

    if (isThumbnailDialogVisible) {
      closeThumbnailDialog();
      return;
    }

    if (isAutoCropDialogVisible) {
      closeAutoCropDialog();
      return;
    }

    if (isAutoFixDialogVisible) {
      closeAutoFixDialog();
    }
  }, [
    cancelAudit,
    cancelAutoCrop,
    cancelAutoFix,
    cancelReplacementExecution,
    cancelPreviewClipGeneration,
    cancelThumbnailGeneration,
    closeArchiveDialog,
    closeArchiveResultDialog,
    closeAutoCropDialog,
    closeAutoFixDialog,
    closeMigrationDialog,
    closeMigrationResultDialog,
    closeMoveDialog,
    closeMoveResultDialog,
    closeOperationHistory,
    closePostConversionDialog,
    closeReplacementResultDialog,
    closeTrashDialog,
    closeTrashResultDialog,
    closeThumbnailDialog,
    isAuditActive,
    isArchiveConfirmDialogVisible,
    isArchiveResultDialogVisible,
    isAutoCropActive,
    isAutoCropDialogVisible,
    isAutoFixActive,
    isAutoFixDialogVisible,
    isMediaPreviewActive,
    isMigrationResultDialogVisible,
    isMigrationScanDialogVisible,
    isMoveConfirmDialogVisible,
    isMoveResultDialogVisible,
    isOperationHistoryVisible,
    isPostConversionDialogVisible,
    isPreviewClipActive,
    isReplacementExecuting,
    isReplacementResultDialogVisible,
    isTrashConfirmDialogVisible,
    isTrashResultDialogVisible,
    isThumbnailDialogVisible
  ]);

  const handleAppCommand = useCallback(
    async (command: AppCommand): Promise<void> => {
      if (command === 'choose-folder') {
        setFolderTreeOpenRequestCount((count) => count + 1);
        setSelectionMessage(null);
        return;
      }

      if (command === 'choose-files') {
        await chooseFiles();
        return;
      }

      if (command === 'refresh-audit') {
        await refreshAudit();
        return;
      }

      if (command === 'cancel-active') {
        await cancelActiveWork();
        return;
      }

      if (command === 'open-settings') {
        setSettingsOpenRequestCount((count) => count + 1);
        setSettingsMessage(null);
      }
    },
    [cancelActiveWork, chooseFiles, refreshAudit]
  );

  useEffect(() => window.videoAudit.app.onCommand((command) => {
    void handleAppCommand(command);
  }), [handleAppCommand]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      void handleAppCommand('cancel-active');
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAppCommand]);

  const editSelectedInPremiere = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setPremiereImportError('Select at least one video to import into Premiere.');
      return;
    }

    if (premiereStatus?.status !== 'ready') {
      setPremiereImportError('Premiere bridge must be ready before importing videos.');
      await refreshPremiereStatus();
      return;
    }

    setActiveAction('premiereImport');
    setIsPremiereImportSubmitting(true);
    setPremiereImportResult(null);
    setPremiereImportError(null);

    try {
      const response = await window.videoAudit.premiere.createImportRequest({
        videos: selectedVideos.map(toPremiereRequestVideo)
      });

      if (response.premiereStatus) {
        setPremiereStatus(response.premiereStatus);
      }

      if (response.status !== 'queued' || !response.requestId) {
        throw new Error(response.message ?? 'Unable to import selected videos into Premiere.');
      }

      setPremiereImportResult(response);
      const importedCount = selectedVideos.length;
      const hiddenCount = await hideVideoPathsFromTable(selectedVideos.map((video) => video.path));
      const hiddenText =
        hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} video(s) were removed from the table.` : '';

      setWorkflowMessage(
        `Premiere import requested for ${importedCount.toLocaleString()} video(s).${hiddenText}`
      );
      await refreshPremiereStatus();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Unable to import selected videos into Premiere.');
      setPremiereImportError(message);
      setWorkflowMessage(message);
    } finally {
      setIsPremiereImportSubmitting(false);
      setActiveAction(null);
    }
  }, [hideVideoPathsFromTable, premiereStatus?.status, refreshPremiereStatus, selectedVideos]);

  return {
    appInfo,
    appInfoMessage,
    settings,
    settingsMessage,
    settingsOpenRequestCount,
    folderTreeOpenRequestCount,
    toolDiagnostics,
    toolDiagnosticsError,
    isToolDiagnosticsLoading,
    selectionMessage,
    workflowMessage,
    activeAction,
    selectedFolders,
    selectedFolderSummary,
    folderTreeRootPath,
    folderTreeLastScannedAt,
    selectedFiles,
    outputFolder,
    auditOptions,
    auditProgress,
    auditPercent,
    auditSummary,
    auditErrors,
    videoRows,
    visibleVideoRows,
    filteredVideoRows,
    removedVideoCount,
    selectedVideos,
    globalFilter,
    resultsViewFilter,
    resultsViewCounts,
    showThumbnails: showThumbnailsState,
    isAuditActive,
    isDiscoveryActive,
    isFfprobeActive,
    canRunAudit,
    canRefreshAudit,
    isStorageLoading,
    storageMessage,
    storageSavedAt,
    discoveryProgress,
    discoveryPercent,
    discoveredPaths,
    metadataItems,
    ffprobeProgress,
    ffprobePercent,
    autoFixProgress,
    autoFixPercent,
    autoFixResult,
    autoFixError,
    isAutoFixDialogVisible,
    isAutoFixActive,
    canAutoFixSelected,
    autoFixOutputDirectory,
    autoCropProgress,
    autoCropPercent,
    autoCropResult,
    autoCropError,
    isAutoCropDialogVisible,
    isAutoCropActive,
    canOpenCropOptions,
    autoCropOutputRootDir,
    mediaPreviewProgress,
    mediaPreviewPercent,
    mediaPreviewResult,
    mediaPreviewError,
    mediaPreviewScope,
    isThumbnailDialogVisible,
    isMediaPreviewActive,
    previewClipProgress,
    previewClipPercent,
    previewClipResult,
    previewClipError,
    isPreviewClipActive,
    migrationNewEditedDir,
    migrationScan,
    migrationScanError,
    migrationProgress,
    migrationPercent,
    migrationResult,
    migrationResultError,
    auditedRootDirectory,
    isMigrationScanDialogVisible,
    isMigrationResultDialogVisible,
    isMigrationScanning,
    isMigrationExecuting,
    isMigrationActive,
    trashPlan,
    trashPlanError,
    trashResult,
    trashResultError,
    isTrashConfirmDialogVisible,
    isTrashResultDialogVisible,
    isTrashPlanning,
    isTrashExecuting,
    canMoveSelectedToTrash,
    movePlan,
    movePlanError,
    moveResult,
    moveResultError,
    isMoveConfirmDialogVisible,
    isMoveResultDialogVisible,
    isMovePlanning,
    isMoveExecuting,
    canMoveSelectedToFolder,
    archivePlan,
    archivePlanError,
    archiveResult,
    archiveResultError,
    isArchiveConfirmDialogVisible,
    isArchiveResultDialogVisible,
    isArchivePlanning,
    isArchiveExecuting,
    canArchiveSelectedOriginals,
    postConversionPlan,
    postConversionSourceLabel,
    postConversionMode,
    postConversionError,
    postConversionMessage,
    isPostConversionDialogVisible,
    isReplacementPlanning,
    isReplacementActionUpdating,
    replacementProgress,
    replacementPercent,
    replacementResult,
    replacementResultError,
    isReplacementExecuting,
    isReplacementResultDialogVisible,
    operationHistoryRecords,
    selectedOperationHistoryRecord,
    operationHistoryError,
    isOperationHistoryVisible,
    isOperationHistoryLoading,
    canStartMigration,
    premiereStatus,
    premiereStatusError,
    premiereLaunchMessage,
    isPremiereStatusLoading,
    isPremiereImportSubmitting,
    premiereImportResult,
    premiereImportError,
    canEditSelectedInPremiere,
    canGenerateThumbnails,
    applyFolderTreeSelection,
    chooseFolders,
    chooseFiles,
    chooseOutputFolder,
    chooseRecentFolder,
    clearSelectedSources,
    revealPath,
    revealKnownFile,
    revealKnownFolder,
    updateAuditOption,
    updateSettingsField,
    resetSettings,
    runToolDiagnostics,
    runAudit,
    refreshAudit,
    cancelAudit,
    clearAuditData,
    removeSelectedVideos,
    restoreRemovedVideos,
    setSelectedVideos,
    setGlobalFilter,
    setResultsViewFilter,
    setShowThumbnails,
    startDiscovery,
    cancelDiscovery,
    startFfprobe,
    cancelFfprobe,
    openAutoFixDialog,
    closeAutoFixDialog,
    startAutoFix,
    cancelAutoFix,
    openAutoCropDialog,
    closeAutoCropDialog,
    startAutoCrop,
    cancelAutoCrop,
    openThumbnailDialog,
    closeThumbnailDialog,
    setMediaPreviewScope,
    startThumbnailGeneration,
    cancelThumbnailGeneration,
    startPreviewClipGeneration,
    cancelPreviewClipGeneration,
    setMigrationNewEditedDir,
    openMigrationDialog,
    closeMigrationDialog,
    selectMigrationFolder,
    startMigrationScan,
    executeMigration,
    closeMigrationResultDialog,
    openTrashDialog,
    closeTrashDialog,
    executeTrashPlan,
    closeTrashResultDialog,
    openMoveDialog,
    closeMoveDialog,
    executeMovePlan,
    closeMoveResultDialog,
    openArchiveDialog,
    closeArchiveDialog,
    executeArchivePlan,
    closeArchiveResultDialog,
    changePostConversionPlanAction,
    applyPostConversionPlanBulkAction,
    replacePostConversionOriginals,
    reviewPostConversionPlan,
    leavePostConversionOutputs,
    backToPostConversionChoices,
    closePostConversionDialog,
    cancelReplacementExecution,
    closeReplacementResultDialog,
    openOperationHistory,
    closeOperationHistory,
    refreshOperationHistory,
    selectOperationHistoryRecord,
    refreshPremiereStatus,
    openPremiereBridgeApps,
    editSelectedInPremiere
  };
}

const REPLACE_CONFIRMATION_PHRASE = 'REPLACE';
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

function hasSuccessfulConversionOutputs(result: AutoFixResult | AutoCropResult | null): boolean {
  return Boolean(
    result?.items.some((item) => item.status === 'success' && Boolean(item.outputPath))
  );
}

function getReplacementBulkActionUpdates(
  plan: ReplacementPlan,
  action: ReplacementPlanBulkAction
): ReplacementPlanActionUpdate[] {
  if (action === 'ready-replace') {
    return plan.items
      .filter((item) => item.status === 'ready')
      .map((item) => ({
        itemId: item.id,
        selectedAction: 'replace-original'
      }));
  }

  if (action === 'warning-skip') {
    return plan.items
      .filter((item) => item.status === 'warning')
      .map((item) => ({
        itemId: item.id,
        selectedAction: 'skip'
      }));
  }

  if (action === 'keep-output') {
    return plan.items.map((item) => ({
      itemId: item.id,
      selectedAction: 'keep-output'
    }));
  }

  return plan.items.map((item) => ({
    itemId: item.id,
    selectedAction: 'skip'
  }));
}

function getReplacementBulkActionMessage(action: ReplacementPlanBulkAction): string {
  if (action === 'ready-replace') {
    return 'Ready items were set to replace originals.';
  }

  if (action === 'warning-skip') {
    return 'Warning items were set to skip.';
  }

  if (action === 'keep-output') {
    return 'All items were set to keep outputs.';
  }

  return 'Replacement actions were cleared.';
}

function getExecutableReplacementItemCount(plan: ReplacementPlan): number {
  return getExecutableReplacementItems(plan).length;
}

function requiresReplacementConfirmation(plan: ReplacementPlan, settings: AppSettings | null): boolean {
  const executableItems = getExecutableReplacementItems(plan);
  const thresholds = getReplacementConfirmationThresholds(settings);

  return (
    executableItems.length > thresholds.fileCount ||
    executableItems.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0) > thresholds.sizeBytes ||
    executableItems.some((item) => item.warnings.length > 0) ||
    plan.summary.destinationConflicts > 0 ||
    executableItems.some((item) => isExternalVolumePath(item.originalPath) || isExternalVolumePath(item.outputPath)) ||
    executableItems.some((item) => item.warningCodes.includes('extension-changed'))
  );
}

function getReplacementConfirmationThresholds(settings: AppSettings | null): { fileCount: number; sizeBytes: number } {
  if (!settings?.requireTypedConfirmationForLargeOperations) {
    return {
      fileCount: 10,
      sizeBytes: TEN_GB_BYTES
    };
  }

  return {
    fileCount: Math.min(10, Math.max(1, settings.typedConfirmationFileCountThreshold)),
    sizeBytes: Math.min(TEN_GB_BYTES, Math.max(1024 * 1024, settings.typedConfirmationSizeThresholdBytes))
  };
}

function getExecutableReplacementItems(plan: ReplacementPlan): ReplacementPlan['items'] {
  return plan.items.filter(
    (item) =>
      item.selectedAction === 'replace-original' &&
      (item.status === 'ready' || item.status === 'warning')
  );
}

function isExternalVolumePath(path: string): boolean {
  return path.startsWith('/Volumes/');
}

function mergeMediaPreviewItems(rows: VideoRow[], items: MediaPreviewResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, MediaPreviewResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    const nextRow: VideoRow = {
      ...row,
      thumbnail: item.thumbnail
    };

    if (item.previewFrames) {
      nextRow.previewFrames = item.previewFrames.frames;
      nextRow.previewFrameBatchId = item.previewFrames.batchId;
      nextRow.maxPreviewFrameCount = item.previewFrames.maxPreviewFrameCount;
    }

    return nextRow;
  });
}

function mergePreviewClipItems(rows: VideoRow[], items: PreviewClipResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, PreviewClipResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    return {
      ...row,
      previewFrames: mergePreviewFrames(row.previewFrames ?? [], item.previewFrames),
      previewFrameBatchId: row.previewFrameBatchId ?? item.previewFrames[0]?.batchId,
      maxPreviewFrameCount: row.maxPreviewFrameCount ?? item.previewFrames.length
    };
  });
}

function mergePreviewFrames(
  existingFrames: VideoPreviewFrame[],
  incomingFrames: VideoPreviewFrame[]
): VideoPreviewFrame[] {
  if (existingFrames.length === 0) {
    return incomingFrames;
  }

  const incomingByKey = new Map(incomingFrames.map((frame) => [getPreviewFrameKey(frame), frame]));
  const mergedFrames = existingFrames.map((frame) => {
    const incoming = incomingByKey.get(getPreviewFrameKey(frame));

    if (!incoming) {
      return frame;
    }

    incomingByKey.delete(getPreviewFrameKey(frame));
    return {
      ...frame,
      thumbnail: incoming.thumbnail ?? frame.thumbnail,
      previewClip: incoming.previewClip ?? frame.previewClip
    };
  });

  return [...mergedFrames, ...incomingByKey.values()];
}

function getPreviewFrameKey(frame: VideoPreviewFrame): string {
  return `${frame.batchId}:${frame.index}:${frame.timestampSeconds}`;
}

function toKnownFileOperationItem(row: VideoRow): KnownFileOperationItem {
  return {
    id: row.id ?? row.path,
    sourcePath: row.path,
    fileName: row.fileName,
    expectedSizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
    expectedModifiedAtMs: row.modifiedAtMs ?? null,
    identity: {
      path: row.path,
      fileName: row.fileName,
      extension: row.extension || row.fileExtension || '',
      sizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
      modifiedAtMs: row.modifiedAtMs ?? null,
      createdAtMs: row.createdAtMs ?? null,
      isDirectory: false,
      isFile: true
    }
  };
}

function getKnownDirectories({
  auditedRootDirectory,
  selectedFolders,
  selectedVideos
}: {
  auditedRootDirectory: string | null;
  selectedFolders: string[];
  selectedVideos: VideoRow[];
}): string[] {
  return [
    ...new Set([
      auditedRootDirectory,
      ...selectedFolders,
      ...selectedVideos.map((video) => video.directory)
    ].filter((value): value is string => Boolean(value)))
  ];
}

function toPremiereRequestVideo(row: VideoRow): PremiereRequestVideo {
  return {
    id: row.id ?? row.path,
    fileName: row.fileName,
    absolutePath: row.path,
    directory: row.directory,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    displayAspectRatio: row.displayAspectRatio || null,
    frameRate: row.frameRate
  };
}

function getAuditedRootDirectory(
  request: AuditRequest | null,
  summary: AuditSummary | null
): string | null {
  if (request?.folderPaths.length === 1) {
    return request.folderPaths[0];
  }

  if (request?.folderPaths && request.folderPaths.length !== 1) {
    return null;
  }

  const summaryPath = summary?.resolvedDirectory ?? summary?.directoryPath ?? null;

  if (!summaryPath || summaryPath === 'Selected files') {
    return null;
  }

  return summaryPath;
}

function getResultsViewCounts(rows: VideoRow[]): ResultsViewCounts {
  return {
    all: rows.length,
    flagged: rows.filter(isFlaggedRow).length,
    'low-res': rows.filter((row) => row.isLowResolution).length,
    aspect: rows.filter((row) => row.isWrongAspectRatio).length,
    crop: rows.filter(hasCropIssue).length,
    errors: rows.filter(hasRowError).length
  };
}

function matchesResultsViewFilter(row: VideoRow, filter: ResultsViewFilter): boolean {
  switch (filter) {
    case 'flagged':
      return isFlaggedRow(row);
    case 'low-res':
      return row.isLowResolution;
    case 'aspect':
      return row.isWrongAspectRatio;
    case 'crop':
      return hasCropIssue(row);
    case 'errors':
      return hasRowError(row);
    case 'all':
      return true;
  }
}

function isFlaggedRow(row: VideoRow): boolean {
  return row.isLowResolution || row.isWrongAspectRatio || hasCropIssue(row) || hasRowError(row) || Boolean(row.reasons);
}

function hasCropIssue(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return false;
  }

  return (
    blackBorder.detected ||
    blackBorder.classification === 'nested_borders' ||
    blackBorder.classification === 'asymmetric_border' ||
    blackBorder.classification === 'pillarboxed' ||
    blackBorder.classification === 'letterboxed' ||
    blackBorder.classification === 'uncertain' ||
    blackBorder.classification === 'analysis_error' ||
    blackBorder.recommendedFix?.eligible === true ||
    blackBorder.recommendedFix?.type === 'crop-scale' ||
    blackBorder.recommendedFix?.type === 'manual-review'
  );
}

function hasRowError(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  return (
    Boolean(blackBorder?.error) ||
    blackBorder?.classification === 'analysis_error' ||
    row.reasons.toLowerCase().includes('error')
  );
}

function settingsToAuditOptions(settings: AppSettings): AuditOptions {
  return {
    ...DEFAULT_AUDIT_OPTIONS,
    includeSubfolders: settings.includeSubfoldersDefault,
    includeLowResolutionAnalysis: settings.lowResolutionAnalysisEnabledDefault,
    includeBlackBorderAnalysis: settings.blackBorderAnalysisEnabledDefault
  };
}

function getPersistedFolderTreeSourcePaths(source: PersistedFolderTreeSource): string[] {
  return dedupeOverlappingFolderPaths(
    source.dedupedSelectedFolderPaths.length > 0
      ? source.dedupedSelectedFolderPaths
      : source.selectedFolderPaths
  );
}

function createPersistedFolderTreeSource({
  rootPath,
  selectedFolderPaths,
  dedupedSelectedFolderPaths,
  summary,
  includeSubfolders,
  lastScannedAt
}: {
  rootPath: string;
  selectedFolderPaths: string[];
  dedupedSelectedFolderPaths: string[];
  summary: SelectedFolderSummary;
  includeSubfolders: boolean;
  lastScannedAt: string | null;
}): PersistedFolderTreeSource {
  const dedupedFolderPaths = dedupeOverlappingFolderPaths(dedupedSelectedFolderPaths);

  return {
    rootPath,
    selectedFolderPaths,
    dedupedSelectedFolderPaths: dedupedFolderPaths,
    selectedFolderSummary: {
      ...summary,
      dedupedFolderPaths,
      dedupedFolderCount: dedupedFolderPaths.length
    },
    includeSubfolders,
    lastScannedAt
  };
}

function mergeRecentPaths(nextPaths: string[], currentPaths: string[]): string[] {
  return [...new Set([...nextPaths, ...currentPaths])].slice(0, 10);
}

function getProgressPercent(processedFiles?: number, totalFiles?: number | null): number | null {
  if (!totalFiles || totalFiles <= 0 || processedFiles === undefined) {
    return null;
  }

  return Math.min(100, Math.round((processedFiles / totalFiles) * 100));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
