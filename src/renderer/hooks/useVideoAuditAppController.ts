import { useCallback, useMemo, useState } from 'react';
import { getAuditedRootDirectory } from '../helpers/resultFilters';
import { getWorkflowCapabilities } from '../helpers/workflowCapabilities';
import { useAppCommands } from '../app/useAppCommands';
import type { ActiveAction, VideoAuditAppController } from '../types/videoAuditAppController';
import { useAuditResults } from './useAuditResults';
import { useAuditSourceController } from './useAuditSourceController';
import { useAuditWorkflow } from './useAuditWorkflow';
import { useAppBootstrap } from './useAppBootstrap';
import { useAutoCropWorkflow } from './useAutoCropWorkflow';
import { useAutoFixWorkflow } from './useAutoFixWorkflow';
import { useClearAuditDataWorkflow } from './useClearAuditDataWorkflow';
import { useDiagnosticsWorkflow } from './useDiagnosticsWorkflow';
import { useDiscoveryWorkflow } from './useDiscoveryWorkflow';
import { useFfprobeWorkflow } from './useFfprobeWorkflow';
import { useFileOperationsWorkflow } from './useFileOperationsWorkflow';
import { useInitialVideoAuditState } from './useInitialVideoAuditState';
import { useMediaPreviewWorkflow } from './useMediaPreviewWorkflow';
import { useMigrationWorkflow } from './useMigrationWorkflow';
import { useOperationHistory } from './useOperationHistory';
import { usePathReveal } from './usePathReveal';
import { usePremiereBridge } from './usePremiereBridge';
import { usePostConversionWorkflow } from './usePostConversionWorkflow';
import { useSelectedVideoActions } from './useSelectedVideoActions';
import { useSelectionState } from './useSelectionState';
import { useSettingsController } from './useSettingsController';
import { useWorkflowBusyState } from './useWorkflowBusyState';

export type { VideoAuditAppController };

export function useVideoAuditAppController(): VideoAuditAppController {
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const setWorkflowActiveAction = useCallback((action: ActiveAction): void => {
    setActiveAction(action);
  }, []);
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
  const {
    auditOptions,
    setAuditOptions,
    updateAuditOption,
    resetSettings,
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
  } = useAuditSourceController({
    settings,
    persistSettings,
    resetStoredSettings,
    setWorkflowMessage,
    setActiveAction: setWorkflowActiveAction
  });
  const setPathRevealSelectionMessage = useCallback((message: string | null): void => {
    applySourceSelectionState({ selectionMessage: message });
  }, [applySourceSelectionState]);
  const {
    revealPath,
    revealKnownFile,
    revealKnownFolder
  } = usePathReveal({
    setSelectionMessage: setPathRevealSelectionMessage,
    setActiveAction: setWorkflowActiveAction
  });
  const {
    selectedVideos,
    setSelectedVideos,
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
    loadStoredAuditResultState,
    applyStoredAuditResult,
    finishStorageLoading,
    applyAuditResult,
    hideVideoPathsFromTable,
    restoreRemovedVideos,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    resetResultStateForAuditStart,
    resetAuditResults,
    setStorageMessage,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState
  } = useAuditResults();
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
    setActiveAction: setWorkflowActiveAction
  });
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
    setActiveAction: setWorkflowActiveAction
  });
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
    setActiveAction: setWorkflowActiveAction
  });
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
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });
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
    setActiveAction: setWorkflowActiveAction
  });
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
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });
  const autoFixOutputDirectory = outputFolder ?? settings?.defaultAutoFixDestinationRoot ?? null;
  const autoCropOutputRootDir = outputFolder ?? settings?.defaultOutputDirectory ?? null;
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
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });
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
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });
  const {
    premiereStatus,
    premiereStatusError,
    premiereLaunchMessage,
    isPremiereStatusLoading,
    isPremiereImportSubmitting,
    premiereImportResult,
    premiereImportError,
    refreshPremiereStatus,
    openPremiereBridgeApps,
    editSelectedInPremiere,
    resetPremiereBridgeWorkflow
  } = usePremiereBridge({
    selectedVideos,
    selectedPaths,
    hideVideoPathsFromTable,
    setWorkflowMessage,
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });

  useInitialVideoAuditState({
    loadStoredAuditResultState,
    loadSettings,
    applySourceSelectionState,
    setAuditOptions,
    applyStoredAuditResult,
    finishStorageLoading,
    setSettingsMessage
  });

  const auditedRootDirectory = useMemo(
    () => getAuditedRootDirectory(lastAuditRequest, auditSummary),
    [auditSummary, lastAuditRequest]
  );
  const {
    migrationNewEditedDir,
    migrationScan,
    migrationScanError,
    migrationProgress,
    migrationPercent,
    migrationResult,
    migrationResultError,
    isMigrationScanDialogVisible,
    isMigrationResultDialogVisible,
    setMigrationNewEditedDir,
    openMigrationDialog,
    closeMigrationDialog,
    selectMigrationFolder,
    startMigrationScan,
    executeMigration,
    closeMigrationResultDialog,
    resetMigrationWorkflow
  } = useMigrationWorkflow({
    auditedRootDirectory,
    setWorkflowMessage,
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      activeAction
    }
  });
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
    setActiveAction: setWorkflowActiveAction,
    busyState: {
      isTrashExecuting,
      isMoveExecuting,
      isArchiveExecuting
    }
  });
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

  const { removeSelectedVideos } = useSelectedVideoActions({
    selectedVideoCount,
    selectedPaths,
    hideVideoPathsFromTable
  });

  const { clearAuditData } = useClearAuditDataWorkflow({
    outputFolder,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState,
    saveSettingsSilently,
    applySourceSelectionState,
    setAuditOptions,
    resetAuditWorkflow,
    resetDiscoveryWorkflow,
    resetFfprobeWorkflow,
    resetAutoFixWorkflow,
    resetAutoCropWorkflow,
    resetMediaPreviewWorkflow,
    resetMigrationWorkflow,
    resetFileOperationsWorkflow,
    resetPostConversionWorkflow,
    resetPremiereBridgeWorkflow,
    resetAuditResults,
    setStorageMessage,
    setWorkflowMessage,
    setActiveAction: setWorkflowActiveAction
  });

  const { settingsOpenRequestCount } = useAppCommands({
    requestFolderTreeOpen,
    chooseFiles,
    refreshAudit,
    setSettingsMessage,
    cancelAudit,
    cancelAutoFix,
    cancelAutoCrop,
    cancelThumbnailGeneration,
    cancelPreviewClipGeneration,
    cancelReplacementExecution,
    closeMigrationDialog,
    closeMigrationResultDialog,
    closeReplacementResultDialog,
    closeOperationHistory,
    closeTrashDialog,
    closeTrashResultDialog,
    closeMoveDialog,
    closeMoveResultDialog,
    closeArchiveDialog,
    closeArchiveResultDialog,
    closePostConversionDialog,
    closeThumbnailDialog,
    closeAutoCropDialog,
    closeAutoFixDialog,
    activeState: {
      isAuditActive,
      isAutoFixActive,
      isAutoCropActive,
      isMediaPreviewActive,
      isPreviewClipActive,
      isMigrationScanDialogVisible,
      isMigrationResultDialogVisible,
      isReplacementExecuting,
      isReplacementResultDialogVisible,
      isOperationHistoryVisible,
      isTrashConfirmDialogVisible,
      isTrashResultDialogVisible,
      isMoveConfirmDialogVisible,
      isMoveResultDialogVisible,
      isArchiveConfirmDialogVisible,
      isArchiveResultDialogVisible,
      isPostConversionDialogVisible,
      isThumbnailDialogVisible,
      isAutoCropDialogVisible,
      isAutoFixDialogVisible
    }
  });

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
    removedVideoCount,
    selectedVideos,
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
