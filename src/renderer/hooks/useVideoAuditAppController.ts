import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppInfo } from '../../shared/types/app';
import type { AppCommand } from '../../shared/types/appCommands';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditResult,
  AuditSummary,
  FileDiscoveryJobSnapshot,
  FfprobeMetadataJobSnapshot
} from '../../shared/types/audit';
import type { AutoCropJobSnapshot, AutoCropResult } from '../../shared/types/autoCrop';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { AutoFixJobSnapshot, AutoFixResult } from '../../shared/types/autoFix';
import type {
  ArchiveOperationPlan,
  DestinationConflictStrategy,
  FileOperationResult,
  KnownPathValidationItem,
  MoveOperationPlan,
  TrashOperationPlan
} from '../../shared/types/fileOperations';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewScope,
  PreviewClipJobSnapshot,
  PreviewClipResult
} from '../../shared/types/mediaPreview';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type {
  PremiereRequestResponse,
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
  ReplacementPlanBulkAction
} from '../../shared/types/replacementWorkflow';
import type { AppSettings } from '../../shared/types/settings';
import type { FfprobeResult, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import * as appClient from '../api/appClient';
import * as dialogClient from '../api/dialogClient';
import * as mediaPreviewClient from '../api/mediaPreviewClient';
import * as migrationClient from '../api/migrationClient';
import * as premiereClient from '../api/premiereClient';
import { DEFAULT_AUDIT_OPTIONS, settingsToAuditOptions } from '../helpers/auditOptions';
import { getErrorMessage } from '../helpers/errors';
import { getPersistedFolderTreeSourcePaths } from '../helpers/folderTreeSource';
import { toPremiereRequestVideo } from '../helpers/premiereRows';
import { getProgressPercent } from '../helpers/progress';
import { getAuditedRootDirectory } from '../helpers/resultFilters';
import { getWorkflowCapabilities } from '../helpers/workflowCapabilities';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';
import { useAuditResults } from './useAuditResults';
import { useAuditWorkflow, type AuditStartOutcome, type AuditWorkflowActiveAction } from './useAuditWorkflow';
import { useAppBootstrap } from './useAppBootstrap';
import { useAutoCropWorkflow, type AutoCropWorkflowActiveAction } from './useAutoCropWorkflow';
import { useAutoFixWorkflow, type AutoFixWorkflowActiveAction } from './useAutoFixWorkflow';
import { useDiagnosticsWorkflow } from './useDiagnosticsWorkflow';
import { useDiscoveryWorkflow, type DiscoveryWorkflowActiveAction } from './useDiscoveryWorkflow';
import { useFfprobeWorkflow, type FfprobeWorkflowActiveAction } from './useFfprobeWorkflow';
import { useFileOperationsWorkflow, type FileOperationsWorkflowActiveAction } from './useFileOperationsWorkflow';
import { useMediaPreviewWorkflow, type MediaPreviewWorkflowActiveAction } from './useMediaPreviewWorkflow';
import { useOperationHistory, type OperationHistoryActiveAction } from './useOperationHistory';
import { usePathReveal, type PathRevealActiveAction } from './usePathReveal';
import {
  usePostConversionWorkflow,
  type PostConversionDialogMode,
  type PostConversionWorkflowActiveAction
} from './usePostConversionWorkflow';
import { useResultFilters } from './useResultFilters';
import { useSelectionState } from './useSelectionState';
import { useSettingsController } from './useSettingsController';
import { useSourceSelection, type SourceSelectionActiveAction } from './useSourceSelection';
import { useWorkflowBusyState } from './useWorkflowBusyState';

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

export function useVideoAuditAppController(): VideoAuditAppController {
  const [settingsOpenRequestCount, setSettingsOpenRequestCount] = useState(0);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [auditOptions, setAuditOptions] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const { appInfo, appInfoMessage } = useAppBootstrap();
  const handleSettingsActiveChange = useCallback((isActive: boolean): void => {
    setActiveAction(isActive ? 'settings' : null);
  }, []);
  const {
    settings,
    settingsMessage,
    setSettingsMessage,
    loadSettings,
    persistSettings,
    saveSettingsSilently,
    updateSettingsField,
    resetSettings: resetStoredSettings
  } = useSettingsController({
    onSettingsActiveChange: handleSettingsActiveChange
  });
  const {
    toolDiagnostics,
    toolDiagnosticsError,
    isToolDiagnosticsLoading,
    runToolDiagnostics
  } = useDiagnosticsWorkflow({ setSettingsMessage });
  const setSourceSelectionActiveAction = useCallback((action: SourceSelectionActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    selectedFolders,
    selectedFolderSummary,
    folderTreeRootPath,
    folderTreeLastScannedAt,
    selectedFiles,
    outputFolder,
    selectionMessage,
    folderTreeOpenRequestCount,
    applySourceSelectionState,
    requestFolderTreeOpen,
    applyFolderTreeSelection,
    chooseFolders,
    chooseFiles,
    chooseOutputFolder,
    chooseRecentFolder,
    clearSelectedSources
  } = useSourceSelection({
    settings,
    includeSubfolders: auditOptions.includeSubfolders,
    persistSettings,
    setWorkflowMessage,
    setActiveAction: setSourceSelectionActiveAction
  });
  const setPathRevealSelectionMessage = useCallback((message: string | null): void => {
    applySourceSelectionState({ selectionMessage: message });
  }, [applySourceSelectionState]);
  const setPathRevealActiveAction = useCallback((action: PathRevealActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    revealPath,
    revealKnownFile,
    revealKnownFolder
  } = usePathReveal({
    setSelectionMessage: setPathRevealSelectionMessage,
    setActiveAction: setPathRevealActiveAction
  });
  const {
    selectedVideos,
    setSelectedVideos,
    clearSelectedVideos,
    selectedVideoCount,
    selectedPaths
  } = useSelectionState();
  const {
    auditResult,
    auditSummary,
    auditErrors,
    videoRows,
    visibleVideoRows,
    removedVideoCount,
    storageMessage,
    storageSavedAt,
    isStorageLoading,
    lastAuditRequest,
    showThumbnails,
    loadStoredAuditResultState,
    applyStoredAuditResult,
    finishStorageLoading,
    applyAuditResult,
    hideVideoPathsFromTable,
    restoreRemovedVideos,
    setShowThumbnails,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    resetResultStateForAuditStart,
    resetAuditResults,
    setStorageMessage,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState
  } = useAuditResults({ setSelectedVideos, clearSelectedVideos });
  const {
    globalFilter,
    resultsViewFilter,
    resultsViewCounts,
    filteredVideoRows,
    setGlobalFilter,
    setResultsViewFilter
  } = useResultFilters(visibleVideoRows);
  const applyRefreshAuditSources = useCallback((selection: {
    selectedFolders: string[];
    selectedFiles: string[];
  }): void => {
    applySourceSelectionState({
      selectedFolders: selection.selectedFolders,
      selectedFolderSummary: null,
      selectedFiles: selection.selectedFiles
    });
  }, [applySourceSelectionState]);
  const setAuditWorkflowActiveAction = useCallback((action: AuditWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    auditProgress,
    auditPercent,
    runAudit,
    refreshAudit,
    cancelAudit,
    resetAuditWorkflow
  } = useAuditWorkflow({
    selectedFolders,
    selectedFiles,
    auditOptions,
    lastAuditRequest,
    applyAuditResult,
    resetResultStateForAuditStart,
    applyRefreshSourceSelection: applyRefreshAuditSources,
    setAuditOptions,
    setWorkflowMessage,
    setActiveAction: setAuditWorkflowActiveAction
  });
  const setDiscoveryWorkflowActiveAction = useCallback((action: DiscoveryWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    discoveryProgress,
    discoveryPercent,
    discoveredPaths,
    startDiscovery,
    cancelDiscovery,
    resetDiscoveryWorkflow
  } = useDiscoveryWorkflow({
    selectedFolders,
    selectedFiles,
    includeSubfolders: auditOptions.includeSubfolders,
    setWorkflowMessage,
    setActiveAction: setDiscoveryWorkflowActiveAction
  });
  const setFfprobeWorkflowActiveAction = useCallback((action: FfprobeWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    ffprobeProgress,
    ffprobePercent,
    metadataItems,
    startFfprobe,
    cancelFfprobe,
    resetFfprobeWorkflow
  } = useFfprobeWorkflow({
    discoveredPaths,
    ffprobePathOverride: settings?.ffprobePathOverride ?? null,
    setWorkflowMessage,
    setActiveAction: setFfprobeWorkflowActiveAction
  });
  const setMediaPreviewActiveAction = useCallback((action: MediaPreviewWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    mediaPreviewProgress,
    mediaPreviewPercent,
    mediaPreviewResult,
    mediaPreviewError,
    mediaPreviewScope,
    isThumbnailDialogVisible,
    previewClipProgress,
    previewClipPercent,
    previewClipResult,
    previewClipError,
    previewFrameFetchPath,
    previewFrameError,
    openThumbnailDialog,
    closeThumbnailDialog,
    setMediaPreviewScope,
    startThumbnailGeneration,
    cancelThumbnailGeneration,
    clearPreviewFrameError,
    getFreshThumbnailsForVideo,
    startPreviewClipGeneration,
    cancelPreviewClipGeneration,
    resetMediaPreviewWorkflow
  } = useMediaPreviewWorkflow({
    visibleVideoRows,
    selectedVideos,
    hasAuditResult: Boolean(auditResult),
    previewClipDurationSecondsDefault: settings?.previewClipDurationSecondsDefault,
    previewClipWidthDefault: settings?.previewClipWidthDefault,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    setWorkflowMessage,
    setActiveAction: setMediaPreviewActiveAction,
    busyState: {
      activeAction
    }
  });
  const [migrationNewEditedDir, setMigrationNewEditedDirState] = useState('');
  const [migrationScan, setMigrationScan] = useState<MigrationScanResult | null>(null);
  const [migrationScanError, setMigrationScanError] = useState<string | null>(null);
  const [migrationJobId, setMigrationJobId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationJobSnapshot | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationResultError, setMigrationResultError] = useState<string | null>(null);
  const [isMigrationScanDialogVisible, setIsMigrationScanDialogVisible] = useState(false);
  const [isMigrationResultDialogVisible, setIsMigrationResultDialogVisible] = useState(false);
  const setOperationHistoryActiveAction = useCallback((action: OperationHistoryActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    operationHistoryRecords,
    selectedOperationHistoryRecord,
    operationHistoryError,
    isOperationHistoryVisible,
    isOperationHistoryLoading,
    openOperationHistory,
    closeOperationHistory,
    refreshOperationHistory,
    selectOperationHistoryRecord
  } = useOperationHistory({
    setActiveAction: setOperationHistoryActiveAction
  });
  const setPostConversionActiveAction = useCallback((action: PostConversionWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    postConversionPlan,
    postConversionSourceLabel,
    postConversionMode,
    postConversionError,
    postConversionMessage,
    isPostConversionDialogVisible,
    replacementProgress,
    replacementPercent,
    replacementResult,
    replacementResultError,
    isReplacementResultDialogVisible,
    createPostConversionPlan,
    changePostConversionPlanAction,
    applyPostConversionPlanBulkAction,
    replacePostConversionOriginals,
    reviewPostConversionPlan,
    leavePostConversionOutputs,
    backToPostConversionChoices,
    closePostConversionDialog,
    cancelReplacementExecution,
    closeReplacementResultDialog,
    resetPostConversionWorkflow
  } = usePostConversionWorkflow({
    settings,
    hideVideoPathsFromTable,
    openOperationHistory,
    setWorkflowMessage,
    setActiveAction: setPostConversionActiveAction,
    busyState: {
      activeAction
    }
  });
  const autoFixOutputDirectory = outputFolder ?? settings?.defaultAutoFixDestinationRoot ?? null;
  const autoCropOutputRootDir = outputFolder ?? settings?.defaultOutputDirectory ?? null;
  const setAutoFixActiveAction = useCallback((action: AutoFixWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    autoFixProgress,
    autoFixPercent,
    autoFixResult,
    autoFixError,
    isAutoFixDialogVisible,
    openAutoFixDialog,
    closeAutoFixDialog,
    startAutoFix,
    cancelAutoFix,
    resetAutoFixWorkflow
  } = useAutoFixWorkflow({
    selectedVideos,
    autoFixOutputDirectory,
    hideVideoPathsFromTable,
    createPostConversionPlan,
    setWorkflowMessage,
    setActiveAction: setAutoFixActiveAction,
    busyState: {
      activeAction
    }
  });
  const setAutoCropActiveAction = useCallback((action: AutoCropWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    autoCropProgress,
    autoCropPercent,
    autoCropResult,
    autoCropError,
    isAutoCropDialogVisible,
    openAutoCropDialog,
    closeAutoCropDialog,
    startAutoCrop,
    cancelAutoCrop,
    resetAutoCropWorkflow
  } = useAutoCropWorkflow({
    selectedVideos,
    autoCropOutputRootDir,
    createPostConversionPlan,
    setWorkflowMessage,
    setActiveAction: setAutoCropActiveAction,
    busyState: {
      activeAction
    }
  });
  const [premiereStatus, setPremiereStatus] = useState<PremiereStatusResponse | null>(null);
  const [premiereStatusError, setPremiereStatusError] = useState<string | null>(null);
  const [premiereLaunchMessage, setPremiereLaunchMessage] = useState<string | null>(null);
  const [isPremiereStatusLoading, setIsPremiereStatusLoading] = useState(false);
  const [isPremiereImportSubmitting, setIsPremiereImportSubmitting] = useState(false);
  const [premiereImportResult, setPremiereImportResult] = useState<PremiereRequestResponse | null>(null);
  const [premiereImportError, setPremiereImportError] = useState<string | null>(null);

  const refreshPremiereStatus = useCallback(async (): Promise<void> => {
    setIsPremiereStatusLoading(true);
    setPremiereStatusError(null);

    try {
      const status = await premiereClient.getPremiereStatus();
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
      const response = await premiereClient.openPremiereBridgeApps();
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
        const storedAudit = await loadStoredAuditResultState();
        const loadedSettings = await loadSettings();

        if (!isMounted) {
          return;
        }

        const restoredFolderTreeSource = loadedSettings.latestFolderTreeSource;
        const restoredFolderTreePaths = restoredFolderTreeSource
          ? getPersistedFolderTreeSourcePaths(restoredFolderTreeSource)
          : [];

        if (storedAudit) {
          const restoredSelectedFolders =
            restoredFolderTreePaths.length > 0
              ? restoredFolderTreePaths
              : dedupeOverlappingFolderPaths(storedAudit.request.folderPaths);
          applySourceSelectionState({
            outputFolder: loadedSettings.defaultOutputDirectory,
            folderTreeRootPath: restoredFolderTreeSource?.rootPath ?? null,
            folderTreeLastScannedAt: restoredFolderTreeSource?.lastScannedAt ?? null,
            selectedFolders: restoredSelectedFolders,
            selectedFolderSummary: restoredFolderTreeSource?.selectedFolderSummary ?? null,
            selectedFiles: storedAudit.request.filePaths
          });
          setAuditOptions({
            ...storedAudit.request.options,
            includeSubfolders:
              restoredFolderTreeSource?.includeSubfolders ?? storedAudit.request.options.includeSubfolders
          });
          await applyStoredAuditResult(storedAudit);
        } else {
          const restoredAuditOptions = settingsToAuditOptions(loadedSettings);
          applySourceSelectionState({
            outputFolder: loadedSettings.defaultOutputDirectory,
            folderTreeRootPath: restoredFolderTreeSource?.rootPath ?? null,
            folderTreeLastScannedAt: restoredFolderTreeSource?.lastScannedAt ?? null,
            selectedFolders: restoredFolderTreePaths,
            selectedFolderSummary: restoredFolderTreeSource?.selectedFolderSummary ?? null
          });
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
          finishStorageLoading();
        }
      }
    }

    void loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [
    applySourceSelectionState,
    applyStoredAuditResult,
    finishStorageLoading,
    loadSettings,
    loadStoredAuditResultState
  ]);

  const auditedRootDirectory = useMemo(
    () => getAuditedRootDirectory(lastAuditRequest, auditSummary),
    [auditSummary, lastAuditRequest]
  );
  const {
    isAuditActive,
    isDiscoveryActive,
    isFfprobeActive,
    isAutoFixActive,
    isAutoCropActive,
    isMediaPreviewActive,
    isPreviewClipActive,
    isMigrationScanning,
    isMigrationExecuting,
    isMigrationActive,
    isTrashPlanning,
    isTrashExecuting,
    isMovePlanning,
    isMoveExecuting,
    isArchivePlanning,
    isArchiveExecuting,
    isReplacementPlanning,
    isReplacementActionUpdating,
    isReplacementExecuting,
    isPremiereImportActive,
    isAnyBlockingWorkflowActive
  } = useWorkflowBusyState({
    activeAction,
    auditProgress,
    discoveryProgress,
    ffprobeProgress,
    autoFixProgress,
    autoCropProgress,
    mediaPreviewProgress,
    previewClipProgress,
    migrationProgress,
    replacementProgress,
    isPremiereImportSubmitting
  });
  const setFileOperationsActiveAction = useCallback((action: FileOperationsWorkflowActiveAction): void => {
    setActiveAction(action);
  }, []);
  const {
    trashPlan,
    trashPlanError,
    trashResult,
    trashResultError,
    isTrashConfirmDialogVisible,
    isTrashResultDialogVisible,
    openTrashDialog,
    closeTrashDialog,
    executeTrashPlan,
    closeTrashResultDialog,
    movePlan,
    movePlanError,
    moveResult,
    moveResultError,
    isMoveConfirmDialogVisible,
    isMoveResultDialogVisible,
    openMoveDialog,
    closeMoveDialog,
    executeMovePlan,
    closeMoveResultDialog,
    archivePlan,
    archivePlanError,
    archiveResult,
    archiveResultError,
    isArchiveConfirmDialogVisible,
    isArchiveResultDialogVisible,
    openArchiveDialog,
    closeArchiveDialog,
    executeArchivePlan,
    closeArchiveResultDialog,
    resetFileOperationsWorkflow
  } = useFileOperationsWorkflow({
    selectedVideos,
    selectedFolders,
    auditedRootDirectory,
    outputFolder,
    fileManagementConflictStrategy: settings?.fileManagementConflictStrategy,
    previewOperationHistoryAfterExecution: settings?.previewOperationHistoryAfterExecution,
    hideVideoPathsFromTable,
    openOperationHistory,
    setWorkflowMessage,
    setActiveAction: setFileOperationsActiveAction,
    busyState: {
      isTrashExecuting,
      isMoveExecuting,
      isArchiveExecuting
    }
  });
  const migrationPercent = getProgressPercent(migrationProgress?.processedFiles, migrationProgress?.totalFiles);
  const {
    canRunAudit,
    canRefreshAudit,
    canAutoFixSelected,
    canOpenCropOptions,
    canGenerateThumbnails,
    canMoveSelectedToTrash,
    canMoveSelectedToFolder,
    canArchiveSelectedOriginals,
    canStartMigration,
    canEditSelectedInPremiere
  } = getWorkflowCapabilities({
    isAnyBlockingWorkflowActive,
    selectedFolderCount: selectedFolders.length,
    selectedFileCount: selectedFiles.length,
    includeLowResolutionAnalysis: auditOptions.includeLowResolutionAnalysis,
    includeBlackBorderAnalysis: auditOptions.includeBlackBorderAnalysis,
    hasLastAuditRequest: Boolean(lastAuditRequest),
    selectedVideoCount,
    visibleVideoRowCount: visibleVideoRows.length,
    hasAuditedRootDirectory: Boolean(auditedRootDirectory),
    hasVideoRows: Boolean(videoRows),
    premiereStatus: premiereStatus?.status ?? null
  });

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
    const reset = await resetStoredSettings();

    if (!reset) {
      return;
    }

    applySourceSelectionState({
      outputFolder: reset.defaultOutputDirectory,
      selectedFolders: [],
      selectedFolderSummary: null,
      folderTreeRootPath: null,
      folderTreeLastScannedAt: null
    });
    setAuditOptions(settingsToAuditOptions(reset));
  }, [applySourceSelectionState, resetStoredSettings]);

  useEffect(() => {
    return migrationClient.subscribeToMigrationProgress((progress) => {
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
    if (selectedVideoCount === 0) {
      return;
    }

    await hideVideoPathsFromTable(selectedPaths);
  }, [hideVideoPathsFromTable, selectedPaths, selectedVideoCount]);

  const clearAuditData = useCallback(async (): Promise<void> => {
    setActiveAction('clearCache');
    setStorageMessage('Clearing cache...');
    setWorkflowMessage(null);

    const { savedHistoryMetadata, historyMetadataError } = await archiveCurrentResultToHistory({
      outputFolder
    });

    try {
      const previewCacheResponse = await mediaPreviewClient.clearCache();

      if (previewCacheResponse.status !== 'complete') {
        throw new Error(previewCacheResponse.message || 'Could not clear media preview cache.');
      }

      await clearStoredAuditResultState();

      const updatedSettings = await saveSettingsSilently(
        {
          defaultOutputDirectory: null,
          latestSelectedFolder: null,
          latestFolderTreeSource: null,
          lastAuditResultSummary: null
        },
        {
          errorMessage: null,
          throwOnError: true
        }
      );

      if (!updatedSettings) {
        return;
      }

      applySourceSelectionState({
        outputFolder: updatedSettings.defaultOutputDirectory,
        selectedFolders: [],
        selectedFolderSummary: null,
        folderTreeRootPath: null,
        folderTreeLastScannedAt: null,
        selectedFiles: [],
        selectionMessage: null
      });
      setAuditOptions(settingsToAuditOptions(updatedSettings));
      resetAuditWorkflow();
      setGlobalFilter('');
      setResultsViewFilter('all');
      resetDiscoveryWorkflow();
      resetFfprobeWorkflow();
      resetAutoFixWorkflow();
      resetAutoCropWorkflow();
      resetMediaPreviewWorkflow();
      setMigrationNewEditedDirState('');
      setMigrationScan(null);
      setMigrationScanError(null);
      setMigrationJobId(null);
      setMigrationProgress(null);
      setMigrationResult(null);
      setMigrationResultError(null);
      setIsMigrationScanDialogVisible(false);
      setIsMigrationResultDialogVisible(false);
      resetFileOperationsWorkflow();
      resetPostConversionWorkflow();
      setPremiereImportResult(null);
      setPremiereImportError(null);
      setIsPremiereImportSubmitting(false);
      resetAuditResults({
        storageMessage: historyMetadataError
          ? `Cache cleared. Scan history metadata could not be saved: ${historyMetadataError}`
          : savedHistoryMetadata
            ? 'Cache cleared. Scan metadata saved for future history.'
            : 'Cache cleared.'
      });
    } catch (error: unknown) {
      setStorageMessage(getErrorMessage(error, 'Could not clear cache.'));
    } finally {
      setActiveAction(null);
    }
  }, [
    applySourceSelectionState,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState,
    outputFolder,
    resetAuditResults,
    resetAuditWorkflow,
    resetAutoCropWorkflow,
    resetAutoFixWorkflow,
    resetDiscoveryWorkflow,
    resetFileOperationsWorkflow,
    resetFfprobeWorkflow,
    resetMediaPreviewWorkflow,
    resetPostConversionWorkflow,
    saveSettingsSilently,
    setStorageMessage
  ]);

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
      const result = await dialogClient.chooseFolders();

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
      const response = await migrationClient.scanMigration({
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
      const response = await migrationClient.executeMigration({
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
        requestFolderTreeOpen();
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
    [cancelActiveWork, chooseFiles, refreshAudit, requestFolderTreeOpen]
  );

  useEffect(() => appClient.subscribeToAppCommands((command) => {
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
    if (selectedVideoCount === 0) {
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
      const response = await premiereClient.createPremiereImportRequest({
        videos: selectedVideos.map(toPremiereRequestVideo)
      });

      if (response.premiereStatus) {
        setPremiereStatus(response.premiereStatus);
      }

      if (response.status !== 'queued' || !response.requestId) {
        throw new Error(response.message ?? 'Unable to import selected videos into Premiere.');
      }

      setPremiereImportResult(response);
      const importedCount = selectedVideoCount;
      const hiddenCount = await hideVideoPathsFromTable(selectedPaths);
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
  }, [
    hideVideoPathsFromTable,
    premiereStatus?.status,
    refreshPremiereStatus,
    selectedPaths,
    selectedVideoCount,
    selectedVideos
  ]);

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
    showThumbnails,
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
    isPreviewFrameFetching: Boolean(previewFrameFetchPath),
    previewFrameError,
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
    clearPreviewFrameError,
    getFreshThumbnailsForVideo,
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
