import { useCallback, useMemo, useRef, useState } from 'react';
import type { AuditRequest } from '../../shared/types/audit';
import type { VideoProject } from '../../shared/types/project';
import * as fileOperationsClient from '../api/fileOperationsClient';
import {
  buildProjectAvailabilityMergeResult,
  buildProjectAvailabilityValidationItems,
  formatProjectAvailabilityMessage
} from '../helpers/projectAvailability';
import {
  buildVideoProjectDirtySignature,
  buildVideoProjectSnapshot
} from '../helpers/projectSnapshot';
import { getAuditedRootDirectory } from '../helpers/resultFilters';
import { getWorkflowCapabilities } from '../helpers/workflowCapabilities';
import { useAppCommands } from '../app/useAppCommands';
import { useVideoResultsStore } from '../stores/useVideoResultsStore';
import type { ResultsViewFilter } from '../types/resultsView';
import type { ActiveAction, VideoAuditAppController } from '../types/videoAuditAppController';
import { useAuditResults } from './useAuditResults';
import { useAuditSourceController } from './useAuditSourceController';
import { useAuditWorkflow, type AuditStartOutcome } from './useAuditWorkflow';
import { useAppBootstrap } from './useAppBootstrap';
import { useAutoCropWorkflow } from './useAutoCropWorkflow';
import { useAutoFixWorkflow } from './useAutoFixWorkflow';
import { useClearAuditDataWorkflow } from './useClearAuditDataWorkflow';
import { useDiagnosticsWorkflow } from './useDiagnosticsWorkflow';
import { useDiscoveryWorkflow } from './useDiscoveryWorkflow';
import { useDuplicateScanWorkflow } from './useDuplicateScanWorkflow';
import { useFfprobeWorkflow } from './useFfprobeWorkflow';
import { useFileOperationsWorkflow } from './useFileOperationsWorkflow';
import { useInitialVideoAuditState } from './useInitialVideoAuditState';
import { useMediaPreviewWorkflow } from './useMediaPreviewWorkflow';
import { useMigrationWorkflow } from './useMigrationWorkflow';
import { useOperationHistory } from './useOperationHistory';
import { usePathReveal } from './usePathReveal';
import { usePremiereBridge } from './usePremiereBridge';
import { usePostConversionWorkflow } from './usePostConversionWorkflow';
import { useProjectWorkspace } from './useProjectWorkspace';
import { useSelectedVideoActions } from './useSelectedVideoActions';
import { useSelectionState } from './useSelectionState';
import { useSettingsController } from './useSettingsController';
import { useWorkflowBusyState } from './useWorkflowBusyState';

export type { VideoAuditAppController };

export function useVideoAuditAppController(): VideoAuditAppController {
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [fileAvailabilityMessage, setFileAvailabilityMessage] = useState<string | null>(null);
  const availabilityValidationIdRef = useRef(0);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const clearFileAvailabilityState = useCallback((): void => {
    availabilityValidationIdRef.current += 1;
    setFileAvailabilityMessage(null);
  }, []);
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
    applyProjectAuditState,
    hideVideoPathsFromTable,
    restoreRemovedVideos,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    mergeFileAvailabilityIntoRows,
    resetResultStateForAuditStart,
    resetAuditResults,
    setStorageMessage,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState
  } = useAuditResults();
  const projectSearchQuery = useVideoResultsStore((state) => state.searchQuery);
  const projectActiveViewFilter = useVideoResultsStore((state) => state.activeViewFilter);
  const projectShowThumbnails = useVideoResultsStore((state) => state.showThumbnails);
  const buildProjectSnapshot = useCallback(() => {
    const resultsState = useVideoResultsStore.getState();

    return buildVideoProjectSnapshot({
      selectedFolders,
      selectedFolderSummary,
      folderTreeRootPath,
      folderTreeLastScannedAt,
      selectedFiles,
      outputFolder,
      auditOptions,
      auditRequest: resultsState.lastAuditRequest,
      auditResult: resultsState.auditResult,
      auditRows: resultsState.rows,
      auditSavedAt: resultsState.storageSavedAt,
      searchQuery: resultsState.searchQuery,
      activeViewFilter: resultsState.activeViewFilter,
      showThumbnails: resultsState.showThumbnails,
      settings,
      appVersion: appInfo?.version ?? null
    });
  }, [
    appInfo?.version,
    auditOptions,
    folderTreeLastScannedAt,
    folderTreeRootPath,
    outputFolder,
    selectedFiles,
    selectedFolderSummary,
    selectedFolders,
    settings
  ]);
  const projectWorkspaceSignature = useMemo(
    () =>
      buildVideoProjectDirtySignature({
        selectedFolders,
        selectedFolderSummary,
        folderTreeRootPath,
        folderTreeLastScannedAt,
        selectedFiles,
        outputFolder,
        auditOptions,
        auditRequest: lastAuditRequest,
        auditResult,
        auditRows: videoRows ?? [],
        auditSavedAt: storageSavedAt,
        searchQuery: projectSearchQuery,
        activeViewFilter: projectActiveViewFilter,
        showThumbnails: projectShowThumbnails
      }),
    [
      auditOptions,
      auditResult,
      folderTreeLastScannedAt,
      folderTreeRootPath,
      lastAuditRequest,
      outputFolder,
      projectActiveViewFilter,
      projectSearchQuery,
      projectShowThumbnails,
      selectedFiles,
      selectedFolderSummary,
      selectedFolders,
      storageSavedAt,
      videoRows
    ]
  );
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
    runAuditRequest,
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
    duplicateScanFolder,
    duplicateScanProgress,
    duplicateScanPercent,
    duplicateScanResult,
    duplicateScanError,
    duplicateMarkedCandidateIds,
    duplicateMarkedCandidateCount,
    duplicateMarkedCandidateSizeBytes,
    duplicateTrashPlan,
    duplicateTrashPlanError,
    duplicateTrashResult,
    duplicateTrashResultError,
    isDuplicateScanDialogVisible,
    isDuplicateTrashConfirmDialogVisible,
    isDuplicateTrashResultDialogVisible,
    canStartDuplicateScan,
    hasDuplicateScanResults,
    hasDuplicateScanNoResults,
    setDuplicateScanFolder,
    openDuplicateScanDialog,
    closeDuplicateScanDialog,
    selectDuplicateScanFolder,
    startDuplicateScan,
    cancelDuplicateScan,
    clearDuplicateScanResult,
    markDuplicateCandidate,
    toggleDuplicateCandidateMark,
    clearDuplicateCandidateMarks,
    createDuplicateTrashPlan,
    closeDuplicateTrashDialog,
    executeDuplicateTrashPlan,
    closeDuplicateTrashResultDialog,
    resetDuplicateScanWorkflow
  } = useDuplicateScanWorkflow({
    selectedVideos,
    previewOperationHistoryAfterExecution: settings?.previewOperationHistoryAfterExecution,
    openOperationHistory,
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
    isDuplicateScanActive,
    isDuplicateTrashPlanning,
    isDuplicateTrashExecuting,
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
    duplicateScanProgress,
    replacementProgress,
    isPremiereImportSubmitting
  });
  const {
    projectIndexItems,
    activeProjectId,
    activeProjectName,
    projectSavedAt,
    projectMessage,
    projectError,
    isProjectIndexLoading,
    isProjectSaving,
    isProjectDirty,
    loadProjectIndex,
    createProject,
    saveProject,
    loadProject,
    activateProject,
    deleteProject,
    clearProjectStatus
  } = useProjectWorkspace({
    buildSnapshot: buildProjectSnapshot,
    workspaceSignature: projectWorkspaceSignature,
    isAutosavePaused: isAnyBlockingWorkflowActive
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
    resetDuplicateScanWorkflow,
    resetFileOperationsWorkflow,
    resetPostConversionWorkflow,
    resetPremiereBridgeWorkflow,
    resetAuditResults,
    setStorageMessage,
    setWorkflowMessage,
    setActiveAction: setWorkflowActiveAction
  });

  const resetTransientWorkflowState = useCallback((): void => {
    setWorkflowMessage(null);
    setActiveAction(null);
    resetAuditWorkflow();
    resetDiscoveryWorkflow();
    resetFfprobeWorkflow();
    resetAutoFixWorkflow();
    resetAutoCropWorkflow();
    resetMediaPreviewWorkflow();
    resetMigrationWorkflow();
    resetDuplicateScanWorkflow();
    resetFileOperationsWorkflow();
    resetPostConversionWorkflow();
    resetPremiereBridgeWorkflow();
    closeOperationHistory();
  }, [
    closeOperationHistory,
    resetAuditWorkflow,
    resetAutoCropWorkflow,
    resetAutoFixWorkflow,
    resetDiscoveryWorkflow,
    resetDuplicateScanWorkflow,
    resetFfprobeWorkflow,
    resetFileOperationsWorkflow,
    resetMediaPreviewWorkflow,
    resetMigrationWorkflow,
    resetPostConversionWorkflow,
    resetPremiereBridgeWorkflow
  ]);

  const applyProjectWorkspaceState = useCallback(
    async (project: VideoProject): Promise<void> => {
      const request = cloneAuditRequest(project.audit.request);

      applySourceSelectionState({
        selectedFolders: [...project.sources.selectedFolders],
        selectedFolderSummary: project.sources.selectedFolderSummary
          ? {
              ...project.sources.selectedFolderSummary,
              selectedFolderPaths: [...project.sources.selectedFolderSummary.selectedFolderPaths],
              dedupedFolderPaths: [...project.sources.selectedFolderSummary.dedupedFolderPaths]
            }
          : null,
        folderTreeRootPath: project.sources.folderTreeRootPath,
        folderTreeLastScannedAt: project.sources.folderTreeLastScannedAt,
        selectedFiles: [...project.sources.selectedFiles],
        outputFolder: project.sources.outputFolder,
        selectionMessage: null
      });

      if (request) {
        setAuditOptions({ ...request.options });
      }

      await applyProjectAuditState(
        {
          request,
          result: project.audit.result,
          savedAt: project.audit.savedAt
        },
        {
          showThumbnails: project.workspace.showThumbnails
        }
      );

      const resultsStore = useVideoResultsStore.getState();
      resultsStore.setSearchQuery(project.workspace.searchQuery);
      resultsStore.setActiveViewFilter(getRestoredResultsViewFilter(project.workspace.activeViewFilter));
      resultsStore.setShowThumbnails(project.workspace.showThumbnails);
      resultsStore.clearSelection();
    },
    [applyProjectAuditState, applySourceSelectionState, setAuditOptions]
  );

  const validateProjectFileAvailability = useCallback(async (project: VideoProject): Promise<void> => {
    const validationId = availabilityValidationIdRef.current + 1;
    availabilityValidationIdRef.current = validationId;
    setFileAvailabilityMessage('Checking saved file availability...');

    const rows = useVideoResultsStore.getState().rows;
    const { rowItems, sourceItems } = buildProjectAvailabilityValidationItems({
      rows,
      selectedFolders: project.sources.selectedFolders,
      selectedFiles: project.sources.selectedFiles
    });
    const items = [...rowItems, ...sourceItems];

    if (items.length === 0) {
      setFileAvailabilityMessage(null);
      return;
    }

    try {
      const response = await fileOperationsClient.validateKnownPaths({ items });

      if (availabilityValidationIdRef.current !== validationId) {
        return;
      }

      if (response.status !== 'success') {
        setFileAvailabilityMessage(response.message ?? 'Could not check saved file availability.');
        return;
      }

      const checkedAt = new Date().toISOString();
      const mergeResult = buildProjectAvailabilityMergeResult(rows, response.items, checkedAt);

      mergeFileAvailabilityIntoRows(mergeResult.rowAvailability);
      setFileAvailabilityMessage(formatProjectAvailabilityMessage(mergeResult.summary));
    } catch {
      if (availabilityValidationIdRef.current === validationId) {
        setFileAvailabilityMessage('Could not check saved file availability.');
      }
    }
  }, [mergeFileAvailabilityIntoRows]);

  const restoreProject = useCallback(
    async (project: VideoProject): Promise<boolean> => {
      if (isAnyBlockingWorkflowActive) {
        setWorkflowMessage('Finish or cancel the active workflow before opening a project.');
        return false;
      }

      resetTransientWorkflowState();
      clearFileAvailabilityState();
      await applyProjectWorkspaceState(project);
      await activateProject(project);
      void validateProjectFileAvailability(project);
      setWorkflowMessage(`Restored "${project.name}".`);
      return true;
    },
    [
      activateProject,
      applyProjectWorkspaceState,
      clearFileAvailabilityState,
      isAnyBlockingWorkflowActive,
      resetTransientWorkflowState,
      setWorkflowMessage,
      validateProjectFileAvailability
    ]
  );

  const scanProjectAgain = useCallback(
    async (project: VideoProject): Promise<AuditStartOutcome> => {
      const request = cloneAuditRequest(project.audit.request);

      if (!request) {
        setWorkflowMessage('This project does not have a saved audit request to scan again.');
        return 'not_started';
      }

      if (isAnyBlockingWorkflowActive) {
        setWorkflowMessage('Finish or cancel the active workflow before scanning a saved project.');
        return 'not_started';
      }

      resetTransientWorkflowState();
      clearFileAvailabilityState();
      await applyProjectWorkspaceState(project);
      await activateProject(project);

      return runAuditRequest(request);
    },
    [
      activateProject,
      applyProjectWorkspaceState,
      clearFileAvailabilityState,
      isAnyBlockingWorkflowActive,
      resetTransientWorkflowState,
      runAuditRequest,
      setWorkflowMessage
    ]
  );

  const runAuditWithAvailabilityReset = useCallback(async (): Promise<AuditStartOutcome> => {
    clearFileAvailabilityState();
    resetDuplicateScanWorkflow();
    return runAudit();
  }, [clearFileAvailabilityState, resetDuplicateScanWorkflow, runAudit]);

  const refreshAuditWithAvailabilityReset = useCallback(async (): Promise<void> => {
    clearFileAvailabilityState();
    resetDuplicateScanWorkflow();
    await refreshAudit();
  }, [clearFileAvailabilityState, refreshAudit, resetDuplicateScanWorkflow]);

  const clearAuditDataWithAvailabilityReset = useCallback(async (): Promise<void> => {
    clearFileAvailabilityState();
    await clearAuditData();
  }, [clearAuditData, clearFileAvailabilityState]);

  const { settingsOpenRequestCount } = useAppCommands({
    requestFolderTreeOpen,
    chooseFiles,
    refreshAudit: refreshAuditWithAvailabilityReset,
    setSettingsMessage,
    cancelAudit,
    cancelAutoFix,
    cancelAutoCrop,
    cancelThumbnailGeneration,
    cancelPreviewClipGeneration,
    cancelDuplicateScan,
    cancelReplacementExecution,
    closeMigrationDialog,
    closeMigrationResultDialog,
    closeDuplicateScanDialog,
    closeDuplicateTrashDialog,
    closeDuplicateTrashResultDialog,
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
      isDuplicateScanActive,
      isDuplicateScanDialogVisible,
      isDuplicateTrashConfirmDialogVisible,
      isDuplicateTrashResultDialogVisible,
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
    fileAvailabilityMessage,
    activeAction,
    projectIndexItems,
    activeProjectId,
    activeProjectName,
    projectSavedAt,
    projectMessage,
    projectError,
    isProjectIndexLoading,
    isProjectSaving,
    isProjectDirty,
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
    duplicateScanFolder,
    duplicateScanProgress,
    duplicateScanPercent,
    duplicateScanResult,
    duplicateScanError,
    duplicateMarkedCandidateIds,
    duplicateMarkedCandidateCount,
    duplicateMarkedCandidateSizeBytes,
    duplicateTrashPlan,
    duplicateTrashPlanError,
    duplicateTrashResult,
    duplicateTrashResultError,
    isDuplicateScanDialogVisible,
    isDuplicateTrashConfirmDialogVisible,
    isDuplicateTrashResultDialogVisible,
    isDuplicateScanActive,
    isDuplicateTrashPlanning,
    isDuplicateTrashExecuting,
    canStartDuplicateScan,
    hasDuplicateScanResults,
    hasDuplicateScanNoResults,
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
    canOpenProject: !isAnyBlockingWorkflowActive,
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
    loadProjectIndex,
    createProject,
    saveProject,
    loadProject,
    restoreProject,
    scanProjectAgain,
    activateProject,
    deleteProject,
    clearProjectStatus,
    runAudit: runAuditWithAvailabilityReset,
    refreshAudit: refreshAuditWithAvailabilityReset,
    cancelAudit,
    clearAuditData: clearAuditDataWithAvailabilityReset,
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
    setDuplicateScanFolder,
    openDuplicateScanDialog,
    closeDuplicateScanDialog,
    selectDuplicateScanFolder,
    startDuplicateScan,
    cancelDuplicateScan,
    clearDuplicateScanResult,
    markDuplicateCandidate,
    toggleDuplicateCandidateMark,
    clearDuplicateCandidateMarks,
    createDuplicateTrashPlan,
    closeDuplicateTrashDialog,
    executeDuplicateTrashPlan,
    closeDuplicateTrashResultDialog,
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

function getRestoredResultsViewFilter(value: string): ResultsViewFilter {
  if (
    value === 'all' ||
    value === 'flagged' ||
    value === 'low-res' ||
    value === 'aspect' ||
    value === 'crop' ||
    value === 'errors'
  ) {
    return value;
  }

  return 'all';
}
