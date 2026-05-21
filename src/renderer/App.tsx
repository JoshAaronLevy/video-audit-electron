import { useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import type { ProjectIndexItem, VideoProject } from '../shared/types/project';
import type { DuplicateReviewScanResult } from '../shared/types/duplicateScan';
import { isImprovedDuplicateScanResult } from '../shared/types/duplicateScan';
import { AppHeader } from './components/AppHeader';
import { AuditProgressPanel } from './components/AuditProgressPanel';
import { AutoCropDialog } from './components/AutoCropDialog';
import { AutoFixDialog } from './components/AutoFixDialog';
import { DiagnosticsDialog } from './components/DiagnosticsDialog';
import { DialogHeader } from './components/DialogChrome';
import { DuplicateScanDialog } from './components/DuplicateScanDialog';
import { DuplicateReviewWorkspace } from './components/DuplicateReviewWorkspace';
import { DuplicateTrashConfirmDialog } from './components/DuplicateTrashConfirmDialog';
import { DuplicateTrashResultDialog } from './components/DuplicateTrashResultDialog';
import { FileOperationConfirmDialog } from './components/FileOperationConfirmDialog';
import { FileOperationResultDialog } from './components/FileOperationResultDialog';
import { MigrationResultDialog } from './components/MigrationResultDialog';
import { MigrationScanDialog } from './components/MigrationScanDialog';
import { OperationHistoryDialog } from './components/OperationHistoryDialog';
import { PostConversionDialog } from './components/PostConversionDialog';
import { ProjectDeleteDialog } from './components/ProjectDeleteDialog';
import { ProjectNameDialog } from './components/ProjectNameDialog';
import { ProjectOpenDialog } from './components/ProjectOpenDialog';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ResultsToolbar } from './components/ResultsToolbar';
import { SelectionActionBar } from './components/SelectionActionBar';
import { SettingsDialog } from './components/SettingsDialog';
import { SourceConfigDialog } from './components/SourceConfigDialog';
import { SourceSummaryBar } from './components/SourceSummaryBar';
import { StatusStrip } from './components/StatusStrip';
import { ThumbnailGenerationDialog } from './components/ThumbnailGenerationDialog';
import { UtilityPanel } from './components/UtilityPanel';
import { VideoResultsTable } from './components/VideoResultsTable';
import { FolderTreeSelectorDialog } from './components/source/FolderTreeSelectorDialog';
import { useResultFilters } from './hooks/useResultFilters';
import { useVideoAuditAppController } from './hooks/useVideoAuditAppController';

type WorkspaceMode = 'results' | 'duplicate-review';

export function App(): ReactElement {
  const controller = useVideoAuditAppController();
  const resultFilters = useResultFilters();
  const [isSourceSetupVisible, setIsSourceSetupVisible] = useState(false);
  const [isFolderTreeSelectorVisible, setIsFolderTreeSelectorVisible] = useState(false);
  const [isUtilitiesVisible, setIsUtilitiesVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);
  const [isProjectSidebarVisible, setIsProjectSidebarVisible] = useState(false);
  const [isProjectNameDialogVisible, setIsProjectNameDialogVisible] = useState(false);
  const [projectOpenDialogProject, setProjectOpenDialogProject] = useState<VideoProject | null>(null);
  const [isProjectOpenSubmitting, setIsProjectOpenSubmitting] = useState(false);
  const [projectDeleteDialogProject, setProjectDeleteDialogProject] = useState<ProjectIndexItem | null>(null);
  const [isProjectDeleteSubmitting, setIsProjectDeleteSubmitting] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('results');
  const hasSources = controller.selectedFolders.length > 0 || controller.selectedFiles.length > 0;
  const hasAuditData = Boolean(controller.videoRows) || Boolean(controller.storageSavedAt);
  const tableDisplayRootPath = controller.folderTreeRootPath ?? controller.auditedRootDirectory;

  useEffect(() => {
    if (controller.settingsOpenRequestCount > 0) {
      setIsSettingsVisible(true);
    }
  }, [controller.settingsOpenRequestCount]);

  useEffect(() => {
    if (controller.folderTreeOpenRequestCount > 0) {
      setIsSourceSetupVisible(true);
      setIsFolderTreeSelectorVisible(true);
    }
  }, [controller.folderTreeOpenRequestCount]);

  useEffect(() => {
    if (controller.hasDuplicateScanResults) {
      setWorkspaceMode('duplicate-review');
    }
  }, [controller.hasDuplicateScanResults, controller.duplicateScanResult?.scanId]);

  useEffect(() => {
    if (!controller.duplicateScanResult && workspaceMode === 'duplicate-review') {
      setWorkspaceMode('results');
    }
  }, [controller.duplicateScanResult, workspaceMode]);

  const runAuditFromSourceDialog = async (): Promise<void> => {
    const outcome = await controller.runAudit();

    if (outcome === 'started') {
      setIsSourceSetupVisible(false);
    }
  };

  const requestProjectSave = (): void => {
    if (controller.activeProjectId) {
      void controller.saveProject();
      return;
    }

    controller.clearProjectStatus();
    setIsProjectNameDialogVisible(true);
  };

  const saveNamedProject = async (name: string): Promise<boolean> => {
    const project = await controller.createProject(name);

    if (project) {
      setIsProjectNameDialogVisible(false);
      return true;
    }

    return false;
  };

  const openProjectSidebar = (): void => {
    setIsProjectSidebarVisible(true);
  };

  const closeProjectOpenSurfaces = (): void => {
    setProjectOpenDialogProject(null);
    setProjectDeleteDialogProject(null);
    setIsProjectSidebarVisible(false);
    setIsProjectNameDialogVisible(false);
    setIsSourceSetupVisible(false);
    setIsFolderTreeSelectorVisible(false);
    setIsUtilitiesVisible(false);
    setIsSettingsVisible(false);
    setIsDiagnosticsVisible(false);
  };

  const openSavedProject = async (projectId: string): Promise<void> => {
    setIsProjectOpenSubmitting(true);

    try {
      const project = await controller.loadProject(projectId);

      if (project) {
        setProjectOpenDialogProject(project);
      }
    } finally {
      setIsProjectOpenSubmitting(false);
    }
  };

  const restoreOpenProject = async (): Promise<void> => {
    if (!projectOpenDialogProject) {
      return;
    }

    setIsProjectOpenSubmitting(true);

    try {
      const restored = await controller.restoreProject(projectOpenDialogProject);

      if (restored) {
        closeProjectOpenSurfaces();
      }
    } finally {
      setIsProjectOpenSubmitting(false);
    }
  };

  const scanOpenProjectAgain = async (): Promise<void> => {
    if (!projectOpenDialogProject) {
      return;
    }

    setIsProjectOpenSubmitting(true);

    try {
      const outcome = await controller.scanProjectAgain(projectOpenDialogProject);

      if (outcome === 'started') {
        closeProjectOpenSurfaces();
      }
    } finally {
      setIsProjectOpenSubmitting(false);
    }
  };

  const requestProjectDelete = (projectId: string): void => {
    const project = controller.projectIndexItems.find((item) => item.id === projectId);

    if (project) {
      controller.clearProjectStatus();
      setProjectDeleteDialogProject(project);
      return;
    }

    void controller.loadProjectIndex();
  };

  const confirmProjectDelete = async (): Promise<void> => {
    if (!projectDeleteDialogProject) {
      return;
    }

    setIsProjectDeleteSubmitting(true);

    try {
      const deleted = await controller.deleteProject(projectDeleteDialogProject.id);
      const refreshedIndex = await controller.loadProjectIndex();
      const stillExists =
        refreshedIndex?.projects.some((project) => project.id === projectDeleteDialogProject.id) ?? true;

      if (deleted || !stillExists) {
        setProjectDeleteDialogProject(null);
      }
    } finally {
      setIsProjectDeleteSubmitting(false);
    }
  };

  const appHeaderProps = {
    appInfo: controller.appInfo,
    auditSummary: controller.auditSummary,
    visibleVideoCount: controller.visibleVideoRows.length,
    selectedVideoCount: controller.selectedVideos.length,
    premiereStatus: controller.premiereStatus,
    activeProjectName: controller.activeProjectName,
    projectSavedAt: controller.projectSavedAt,
    projectMessage: controller.projectMessage,
    projectError: controller.projectError,
    isProjectSaving: controller.isProjectSaving,
    isProjectDirty: controller.isProjectDirty,
    onOpenProjects: openProjectSidebar,
    onSaveProject: requestProjectSave,
    onOpenOperationHistory: controller.openOperationHistory,
    onOpenUtilities: () => setIsUtilitiesVisible(true),
    onOpenSettings: () => setIsSettingsVisible(true)
  } satisfies ComponentProps<typeof AppHeader>;

  const projectSidebarProps = {
    visible: isProjectSidebarVisible,
    projects: controller.projectIndexItems,
    activeProjectId: controller.activeProjectId,
    isLoading: controller.isProjectIndexLoading,
    isSaving: controller.isProjectSaving,
    error: controller.projectError,
    onHide: () => setIsProjectSidebarVisible(false),
    onRefresh: () => {
      void controller.loadProjectIndex();
    },
    onSaveCurrentProject: requestProjectSave,
    onOpenProject: (projectId: string) => {
      void openSavedProject(projectId);
    },
    onRequestDeleteProject: requestProjectDelete
  } satisfies ComponentProps<typeof ProjectSidebar>;

  const sourceSummaryProps = {
    selectedFolders: controller.selectedFolders,
    selectedFolderSummary: controller.selectedFolderSummary,
    selectedFiles: controller.selectedFiles,
    outputFolder: controller.outputFolder,
    auditOptions: controller.auditOptions,
    fileAvailabilityMessage: controller.fileAvailabilityMessage,
    isAuditActive: controller.isAuditActive,
    canRunAudit: controller.canRunAudit,
    onRunAudit: controller.runAudit,
    onCancelAudit: controller.cancelAudit,
    onOpenSourceSetup: () => setIsSourceSetupVisible(true)
  } satisfies ComponentProps<typeof SourceSummaryBar>;

  const statusStripProps = {
    auditProgress: controller.auditProgress,
    activeAction: controller.activeAction,
    premiereStatus: controller.premiereStatus,
    premiereStatusError: controller.premiereStatusError,
    isPremiereStatusLoading: controller.isPremiereStatusLoading,
    isPremiereBridgeAppsLaunching: controller.activeAction === 'premiereLaunch',
    toolDiagnostics: controller.toolDiagnostics,
    storageSavedAt: controller.storageSavedAt,
    outputFolder: controller.outputFolder,
    onOpenDiagnostics: () => setIsDiagnosticsVisible(true),
    onRefreshPremiereStatus: controller.refreshPremiereStatus,
    onOpenPremiereBridgeApps: controller.openPremiereBridgeApps
  } satisfies ComponentProps<typeof StatusStrip>;

  const auditProgressProps = {
    progress: controller.auditProgress,
    percent: controller.auditPercent,
    isActive: controller.isAuditActive,
    onCancelAudit: controller.cancelAudit
  } satisfies ComponentProps<typeof AuditProgressPanel>;

  const resultsToolbarProps = {
    globalFilter: resultFilters.globalFilter,
    resultsViewFilter: resultFilters.resultsViewFilter,
    resultsViewCounts: resultFilters.resultsViewCounts,
    visibleRowCount: resultFilters.visibleRowCount,
    isAuditActive: controller.isAuditActive,
    isStorageLoading: controller.isStorageLoading,
    isCacheClearing: controller.activeAction === 'clearCache',
    canRefreshAudit: controller.canRefreshAudit,
    hasAuditData,
    onGlobalFilterChange: resultFilters.setGlobalFilter,
    onResultsViewFilterChange: resultFilters.setResultsViewFilter,
    onRefreshAudit: controller.refreshAudit,
    onClearData: controller.clearAuditData
  } satisfies ComponentProps<typeof ResultsToolbar>;

  const videoResultsTableProps = {
    rows: resultFilters.filteredVideoRows,
    allRows: controller.videoRows,
    selectedVideos: controller.selectedVideos,
    globalFilter: resultFilters.globalFilter,
    resultsViewFilter: resultFilters.resultsViewFilter,
    hasSources,
    selectedFolderCount: controller.selectedFolders.length,
    selectedFileCount: controller.selectedFiles.length,
    displayRootPath: tableDisplayRootPath,
    auditOptions: controller.auditOptions,
    auditSummary: controller.auditSummary,
    auditErrors: controller.auditErrors,
    removedVideoCount: controller.removedVideoCount,
    isAuditActive: controller.isAuditActive,
    canRunAudit: controller.canRunAudit,
    auditPercent: controller.auditPercent,
    auditProgressMessage: controller.auditProgress?.message ?? null,
    isPreviewClipActive: controller.isPreviewClipActive,
    isStorageLoading: controller.isStorageLoading,
    storageMessage: controller.storageMessage,
    storageSavedAt: controller.storageSavedAt,
    fileAvailabilityMessage: controller.fileAvailabilityMessage,
    previewClipProgress: controller.previewClipProgress,
    previewClipPercent: controller.previewClipPercent,
    previewClipError: controller.previewClipError,
    isPreviewFrameFetching: controller.isPreviewFrameFetching,
    previewFrameError: controller.previewFrameError,
    premiereImportResult: controller.premiereImportResult,
    premiereImportError: controller.premiereImportError,
    onSelectedVideosChange: controller.setSelectedVideos,
    onOpenSourceSetup: () => setIsSourceSetupVisible(true),
    onRunAudit: controller.runAudit,
    onClearPreviewFrameError: controller.clearPreviewFrameError,
    onGetFreshThumbnails: controller.getFreshThumbnailsForVideo,
    onStartPreviewClipGeneration: controller.startPreviewClipGeneration,
    onCancelPreviewClipGeneration: controller.cancelPreviewClipGeneration,
    onRevealKnownFile: controller.revealKnownFile
  } satisfies ComponentProps<typeof VideoResultsTable>;

  const selectionActionBarProps = {
    rowsExist: controller.visibleVideoRows.length > 0,
    selectedVideos: controller.selectedVideos,
    removedVideoCount: controller.removedVideoCount,
    isAuditActive: controller.isAuditActive,
    isAutoFixActive: controller.isAutoFixActive,
    isAutoCropActive: controller.isAutoCropActive,
    isMigrationActive: controller.isMigrationActive,
    isDuplicateScanActive: controller.isDuplicateScanActive,
    isTrashPlanning: controller.isTrashPlanning,
    isTrashExecuting: controller.isTrashExecuting,
    isMovePlanning: controller.isMovePlanning,
    isMoveExecuting: controller.isMoveExecuting,
    isArchivePlanning: controller.isArchivePlanning,
    isArchiveExecuting: controller.isArchiveExecuting,
    isPremiereImportSubmitting: controller.isPremiereImportSubmitting,
    canAutoFixSelected: controller.canAutoFixSelected,
    canOpenCropOptions: controller.canOpenCropOptions,
    canMoveSelectedToTrash: controller.canMoveSelectedToTrash,
    canMoveSelectedToFolder: controller.canMoveSelectedToFolder,
    canArchiveSelectedOriginals: controller.canArchiveSelectedOriginals,
    canStartMigration: controller.canStartMigration,
    canStartDuplicateScan: controller.canStartDuplicateScan,
    canEditSelectedInPremiere: controller.canEditSelectedInPremiere,
    onRemoveSelectedVideos: controller.removeSelectedVideos,
    onRestoreRemovedVideos: controller.restoreRemovedVideos,
    onOpenAutoFixDialog: controller.openAutoFixDialog,
    onOpenAutoCropDialog: controller.openAutoCropDialog,
    onOpenDuplicateScanDialog: controller.openDuplicateScanDialog,
    onOpenMigrationDialog: controller.openMigrationDialog,
    onOpenTrashDialog: controller.openTrashDialog,
    onOpenMoveDialog: controller.openMoveDialog,
    onOpenArchiveDialog: controller.openArchiveDialog,
    onEditSelectedInPremiere: controller.editSelectedInPremiere
  } satisfies ComponentProps<typeof SelectionActionBar>;

  const sourceConfigDialogProps = {
    visible: isSourceSetupVisible,
    selectedFolders: controller.selectedFolders,
    selectedFolderSummary: controller.selectedFolderSummary,
    selectedFiles: controller.selectedFiles,
    outputFolder: controller.outputFolder,
    recentFolders: controller.settings?.recentFolders ?? [],
    auditOptions: controller.auditOptions,
    isAuditActive: controller.isAuditActive,
    canRunAudit: controller.canRunAudit,
    activeAction: controller.activeAction,
    selectionMessage: controller.selectionMessage,
    workflowMessage: controller.workflowMessage,
    onChooseFolders: () => setIsFolderTreeSelectorVisible(true),
    onChooseFiles: controller.chooseFiles,
    onChooseOutputFolder: controller.chooseOutputFolder,
    onChooseRecentFolder: controller.chooseRecentFolder,
    onClearSelectedSources: controller.clearSelectedSources,
    onRunAudit: runAuditFromSourceDialog,
    onCancelAudit: controller.cancelAudit,
    onRevealPath: controller.revealPath,
    onAuditOptionChange: controller.updateAuditOption,
    onHide: () => setIsSourceSetupVisible(false)
  } satisfies ComponentProps<typeof SourceConfigDialog>;

  const folderTreeSelectorDialogProps = {
    visible: isFolderTreeSelectorVisible,
    selectedFolderPaths: controller.selectedFolders,
    initialRootPath: controller.folderTreeRootPath,
    lastScannedAt: controller.folderTreeLastScannedAt,
    includeSubfolders: controller.auditOptions.includeSubfolders,
    isAuditActive: controller.isAuditActive,
    onConfirm: async (selection) => {
      await controller.applyFolderTreeSelection(
        selection.selectedFolderPaths,
        selection.rootPath,
        selection.summary,
        selection.lastScannedAt
      );
      setIsFolderTreeSelectorVisible(false);
    },
    onHide: () => setIsFolderTreeSelectorVisible(false)
  } satisfies ComponentProps<typeof FolderTreeSelectorDialog>;

  const utilityPanelProps = {
    discoveryProgress: controller.discoveryProgress,
    discoveryPercent: controller.discoveryPercent,
    discoveredPaths: controller.discoveredPaths,
    ffprobeProgress: controller.ffprobeProgress,
    ffprobePercent: controller.ffprobePercent,
    metadataItems: controller.metadataItems,
    isDiscoveryActive: controller.isDiscoveryActive,
    isFfprobeActive: controller.isFfprobeActive,
    hasSources,
    activeAction: controller.activeAction,
    onStartDiscovery: controller.startDiscovery,
    onCancelDiscovery: controller.cancelDiscovery,
    onStartFfprobe: controller.startFfprobe,
    onCancelFfprobe: controller.cancelFfprobe,
    onRevealPath: controller.revealPath
  } satisfies ComponentProps<typeof UtilityPanel>;

  const diagnosticsDialogProps = {
    visible: isDiagnosticsVisible,
    appInfo: controller.appInfo,
    settings: controller.settings,
    settingsMessage: controller.settingsMessage,
    auditProgress: controller.auditProgress,
    activeAction: controller.activeAction,
    premiereStatus: controller.premiereStatus,
    premiereStatusError: controller.premiereStatusError,
    premiereLaunchMessage: controller.premiereLaunchMessage,
    isPremiereStatusLoading: controller.isPremiereStatusLoading,
    isPremiereBridgeAppsLaunching: controller.activeAction === 'premiereLaunch',
    toolDiagnostics: controller.toolDiagnostics,
    toolDiagnosticsError: controller.toolDiagnosticsError,
    isToolDiagnosticsLoading: controller.isToolDiagnosticsLoading,
    outputFolder: controller.outputFolder,
    storageSavedAt: controller.storageSavedAt,
    onHide: () => setIsDiagnosticsVisible(false),
    onRefreshPremiereStatus: controller.refreshPremiereStatus,
    onOpenPremiereBridgeApps: controller.openPremiereBridgeApps,
    onRunToolDiagnostics: controller.runToolDiagnostics
  } satisfies ComponentProps<typeof DiagnosticsDialog>;

  const operationHistoryDialogProps = {
    visible: controller.isOperationHistoryVisible,
    records: controller.operationHistoryRecords,
    selectedRecord: controller.selectedOperationHistoryRecord,
    isLoading: controller.isOperationHistoryLoading,
    error: controller.operationHistoryError,
    onRefresh: controller.refreshOperationHistory,
    onSelectRecord: controller.selectOperationHistoryRecord,
    onRevealPath: controller.revealPath,
    onHide: controller.closeOperationHistory
  } satisfies ComponentProps<typeof OperationHistoryDialog>;

  const settingsDialogProps = {
    visible: isSettingsVisible,
    appInfo: controller.appInfo,
    appInfoMessage: controller.appInfoMessage,
    settings: controller.settings,
    settingsMessage: controller.settingsMessage,
    premiereStatus: controller.premiereStatus,
    toolDiagnostics: controller.toolDiagnostics,
    toolDiagnosticsError: controller.toolDiagnosticsError,
    isToolDiagnosticsLoading: controller.isToolDiagnosticsLoading,
    activeAction: controller.activeAction,
    onHide: () => setIsSettingsVisible(false),
    onUpdateSettingsField: controller.updateSettingsField,
    onResetSettings: controller.resetSettings,
    onRunToolDiagnostics: controller.runToolDiagnostics
  } satisfies ComponentProps<typeof SettingsDialog>;

  const autoFixDialogProps = {
    visible: controller.isAutoFixDialogVisible,
    selectedCount: controller.selectedVideos.length,
    outputDirectory: controller.autoFixOutputDirectory,
    progress: controller.autoFixProgress,
    percent: controller.autoFixPercent,
    result: controller.autoFixResult,
    error: controller.autoFixError,
    isSubmitting: controller.isAutoFixActive,
    onSubmit: controller.startAutoFix,
    onCancel: controller.cancelAutoFix,
    onHide: controller.closeAutoFixDialog,
    onRevealOutputDirectory: controller.revealPath
  } satisfies ComponentProps<typeof AutoFixDialog>;

  const autoCropDialogProps = {
    visible: controller.isAutoCropDialogVisible,
    selectedVideos: controller.selectedVideos,
    outputRootDir: controller.autoCropOutputRootDir,
    progress: controller.autoCropProgress,
    percent: controller.autoCropPercent,
    result: controller.autoCropResult,
    error: controller.autoCropError,
    isSubmitting: controller.isAutoCropActive,
    onSubmit: controller.startAutoCrop,
    onCancel: controller.cancelAutoCrop,
    onHide: controller.closeAutoCropDialog,
    onRevealOutputDir: controller.revealPath
  } satisfies ComponentProps<typeof AutoCropDialog>;

  const postConversionDialogProps = {
    visible: controller.isPostConversionDialogVisible,
    sourceLabel: controller.postConversionSourceLabel,
    plan: controller.postConversionPlan,
    settings: controller.settings,
    mode: controller.postConversionMode,
    error: controller.postConversionError,
    message: controller.postConversionMessage,
    isPlanning: controller.isReplacementPlanning,
    isUpdatingActions: controller.isReplacementActionUpdating,
    isExecuting: controller.isReplacementExecuting,
    progress: controller.replacementProgress,
    percent: controller.replacementPercent,
    executionAction: controller.postConversionExecutionAction,
    onPlanActionChange: controller.changePostConversionPlanAction,
    onPlanBulkAction: controller.applyPostConversionPlanBulkAction,
    onExecutePlan: controller.executePostConversionPlan,
    onCancelExecution: controller.cancelReplacementExecution,
    onReviewManually: controller.reviewPostConversionPlan,
    onLeaveOutputs: controller.leavePostConversionOutputs,
    onBackToChoices: controller.backToPostConversionChoices,
    onHide: controller.closePostConversionDialog
  } satisfies ComponentProps<typeof PostConversionDialog>;

  const thumbnailGenerationDialogProps = {
    visible: controller.isThumbnailDialogVisible,
    allCount: controller.visibleVideoRows.length,
    selectedCount: controller.selectedVideos.length,
    scope: controller.mediaPreviewScope,
    progress: controller.mediaPreviewProgress,
    percent: controller.mediaPreviewPercent,
    result: controller.mediaPreviewResult,
    error: controller.mediaPreviewError,
    isSubmitting: controller.isMediaPreviewActive,
    onScopeChange: controller.setMediaPreviewScope,
    onSubmit: controller.startThumbnailGeneration,
    onCancel: controller.cancelThumbnailGeneration,
    onHide: controller.closeThumbnailDialog
  } satisfies ComponentProps<typeof ThumbnailGenerationDialog>;

  const migrationScanDialogProps = {
    visible: controller.isMigrationScanDialogVisible,
    auditedRootDirectory: controller.auditedRootDirectory,
    newEditedDir: controller.migrationNewEditedDir,
    scan: controller.migrationScan,
    error: controller.migrationScanError,
    resultError: controller.migrationResultError,
    progress: controller.migrationProgress,
    percent: controller.migrationPercent,
    isScanning: controller.isMigrationScanning,
    isExecuting: controller.isMigrationExecuting,
    onNewEditedDirChange: controller.setMigrationNewEditedDir,
    onSelectFolder: controller.selectMigrationFolder,
    onStartScan: controller.startMigrationScan,
    onExecute: controller.executeMigration,
    onHide: controller.closeMigrationDialog
  } satisfies ComponentProps<typeof MigrationScanDialog>;

  const duplicateScanDialogProps = {
    visible: controller.isDuplicateScanDialogVisible,
    selectedCount: controller.selectedVideos.length,
    scanFolder: controller.duplicateScanFolder,
    modes: controller.duplicateScanModes,
    profile: controller.duplicateScanProfile,
    progress: controller.duplicateScanProgress,
    percent: controller.duplicateScanPercent,
    result: controller.hasDuplicateScanNoResults ? controller.duplicateScanResult : null,
    error: controller.duplicateScanError,
    isScanning: controller.isDuplicateScanActive,
    onScanFolderChange: controller.setDuplicateScanFolder,
    onModesChange: controller.setDuplicateScanModes,
    onProfileChange: controller.setDuplicateScanProfile,
    onSelectFolder: controller.selectDuplicateScanFolder,
    onStartScan: controller.startDuplicateScan,
    onCancelScan: controller.cancelDuplicateScan,
    onHide: controller.closeDuplicateScanDialog
  } satisfies ComponentProps<typeof DuplicateScanDialog>;

  const duplicateTrashConfirmDialogProps = {
    visible: controller.isDuplicateTrashConfirmDialogVisible,
    result: controller.duplicateScanResult,
    markedCandidateIds: controller.duplicateMarkedCandidateIds,
    plan: controller.duplicateTrashPlan,
    error: controller.duplicateTrashPlanError,
    isSubmitting: controller.isDuplicateTrashExecuting,
    onConfirm: controller.executeDuplicateTrashPlan,
    onHide: controller.closeDuplicateTrashDialog
  } satisfies ComponentProps<typeof DuplicateTrashConfirmDialog>;

  const duplicateTrashResultDialogProps = {
    visible: controller.isDuplicateTrashResultDialogVisible,
    result: controller.duplicateTrashResult,
    error: controller.duplicateTrashResultError,
    onHide: controller.closeDuplicateTrashResultDialog
  } satisfies ComponentProps<typeof DuplicateTrashResultDialog>;

  const migrationResultDialogProps = {
    visible: controller.isMigrationResultDialogVisible,
    result: controller.migrationResult,
    scan: controller.migrationScan,
    error: controller.migrationResultError,
    onHide: controller.closeMigrationResultDialog,
    onRevealPath: controller.revealPath
  } satisfies ComponentProps<typeof MigrationResultDialog>;

  const trashConfirmDialogProps = {
    visible: controller.isTrashConfirmDialogVisible,
    plan: controller.trashPlan,
    title: 'Move to Trash',
    description: 'Review the selected files before moving recoverable items to macOS Trash.',
    confirmLabel: 'Move to Trash',
    confirmIcon: 'pi pi-trash',
    confirmSeverity: 'danger',
    error: controller.trashPlanError,
    isSubmitting: controller.isTrashExecuting,
    onConfirm: controller.executeTrashPlan,
    onHide: controller.closeTrashDialog
  } satisfies ComponentProps<typeof FileOperationConfirmDialog>;

  const trashResultDialogProps = {
    visible: controller.isTrashResultDialogVisible,
    result: controller.trashResult,
    title: 'Move to Trash Result',
    description: 'Review what was moved to macOS Trash and what needs attention.',
    error: controller.trashResultError,
    onHide: controller.closeTrashResultDialog
  } satisfies ComponentProps<typeof FileOperationResultDialog>;

  const moveConfirmDialogProps = {
    visible: controller.isMoveConfirmDialogVisible,
    plan: controller.movePlan,
    title: 'Move Files',
    description: 'Review the selected files before moving eligible items to the destination folder.',
    confirmLabel: 'Move Files',
    confirmIcon: 'pi pi-folder-open',
    confirmSeverity: 'success',
    error: controller.movePlanError,
    isSubmitting: controller.isMoveExecuting,
    onConfirm: controller.executeMovePlan,
    onHide: controller.closeMoveDialog
  } satisfies ComponentProps<typeof FileOperationConfirmDialog>;

  const moveResultDialogProps = {
    visible: controller.isMoveResultDialogVisible,
    result: controller.moveResult,
    title: 'Move Files Result',
    description: 'Review what was moved and what needs attention.',
    error: controller.moveResultError,
    onHide: controller.closeMoveResultDialog
  } satisfies ComponentProps<typeof FileOperationResultDialog>;

  const archiveConfirmDialogProps = {
    visible: controller.isArchiveConfirmDialogVisible,
    plan: controller.archivePlan,
    title: 'Archive Originals',
    description: 'Review selected source videos before moving eligible originals into local archive folders.',
    confirmLabel: 'Archive Originals',
    confirmIcon: 'pi pi-box',
    confirmSeverity: 'warning',
    error: controller.archivePlanError,
    isSubmitting: controller.isArchiveExecuting,
    onConfirm: controller.executeArchivePlan,
    onHide: controller.closeArchiveDialog
  } satisfies ComponentProps<typeof FileOperationConfirmDialog>;

  const archiveResultDialogProps = {
    visible: controller.isArchiveResultDialogVisible,
    result: controller.archiveResult,
    title: 'Archive Originals Result',
    description: 'Review what was archived and what needs attention.',
    error: controller.archiveResultError,
    onRevealPath: controller.revealPath,
    onHide: controller.closeArchiveResultDialog
  } satisfies ComponentProps<typeof FileOperationResultDialog>;

  const replacementResultDialogProps = {
    visible: controller.isReplacementResultDialogVisible,
    result: controller.replacementResult,
    title:
      controller.replacementResult?.type === 'trash'
        ? 'Move Originals to Trash Result'
        : 'Replacement Result',
    description:
      controller.replacementResult?.type === 'trash'
        ? 'Review originals moved to macOS Trash and any items that need attention.'
        : 'Review replaced originals, moved converted outputs, and any items that need attention.',
    error: controller.replacementResultError,
    onRevealPath: controller.revealPath,
    onHide: controller.closeReplacementResultDialog
  } satisfies ComponentProps<typeof FileOperationResultDialog>;

  return (
    <main className="app-shell">
      <AppHeader {...appHeaderProps} />

      <ProjectSidebar {...projectSidebarProps} />

      <ProjectOpenDialog
        visible={Boolean(projectOpenDialogProject)}
        project={projectOpenDialogProject}
        isSubmitting={isProjectOpenSubmitting}
        canOpenProject={controller.canOpenProject}
        onRestore={restoreOpenProject}
        onScanAgain={scanOpenProjectAgain}
        onHide={() => setProjectOpenDialogProject(null)}
      />

      <ProjectDeleteDialog
        visible={Boolean(projectDeleteDialogProject)}
        project={projectDeleteDialogProject}
        error={controller.projectError}
        isSubmitting={isProjectDeleteSubmitting}
        onConfirm={confirmProjectDelete}
        onHide={() => setProjectDeleteDialogProject(null)}
      />

      <section className="app-workspace">
        <SourceSummaryBar {...sourceSummaryProps} />

        <StatusStrip {...statusStripProps} />

        <AuditProgressPanel {...auditProgressProps} />

        {controller.duplicateScanResult && controller.duplicateScanResult.groups.length > 0 ? (
          <WorkspaceSwitcher
            mode={workspaceMode}
            result={controller.duplicateScanResult}
            onModeChange={setWorkspaceMode}
            onClearDuplicateScanResult={controller.clearDuplicateScanResult}
          />
        ) : null}

        {workspaceMode === 'duplicate-review' && controller.duplicateScanResult ? (
          <DuplicateReviewWorkspace
            result={controller.duplicateScanResult}
            markedCandidateIds={controller.duplicateMarkedCandidateIds}
            markedCount={controller.duplicateMarkedCandidateCount}
            markedSizeBytes={controller.duplicateMarkedCandidateSizeBytes}
            trashPlanError={controller.duplicateTrashPlanError}
            isPreparingTrashPlan={controller.isDuplicateTrashPlanning}
            canReviewMarkedCandidates={controller.canReviewMarkedDuplicateCandidates}
            onMarkCandidate={controller.markDuplicateCandidate}
            onClearMarks={controller.clearDuplicateCandidateMarks}
            onBackToResults={() => setWorkspaceMode('results')}
            onReviewMarkedCandidates={controller.createDuplicateTrashPlan}
          />
        ) : (
          <section className="results-workspace" aria-label="Results workspace">
            <ResultsToolbar {...resultsToolbarProps} />

            <VideoResultsTable {...videoResultsTableProps} />
          </section>
        )}

        <SelectionActionBar {...selectionActionBarProps} />
      </section>

      <SourceConfigDialog {...sourceConfigDialogProps} />

      <FolderTreeSelectorDialog {...folderTreeSelectorDialogProps} />

      <Dialog
        header={
          <DialogHeader
            eyebrow="Utilities"
            title="Discovery"
            description="Run supporting discovery and metadata reads without leaving the results workspace."
          />
        }
        visible={isUtilitiesVisible}
        className="app-dialog utility-dialog"
        modal
        draggable={false}
        onHide={() => setIsUtilitiesVisible(false)}
      >
        <UtilityPanel {...utilityPanelProps} />
      </Dialog>

      <DiagnosticsDialog {...diagnosticsDialogProps} />

      <OperationHistoryDialog {...operationHistoryDialogProps} />

      <SettingsDialog {...settingsDialogProps} />

      <ProjectNameDialog
        visible={isProjectNameDialogVisible}
        error={controller.projectError}
        isSaving={controller.isProjectSaving}
        onSave={saveNamedProject}
        onHide={() => setIsProjectNameDialogVisible(false)}
      />

      <AutoFixDialog {...autoFixDialogProps} />

      <AutoCropDialog {...autoCropDialogProps} />

      <PostConversionDialog {...postConversionDialogProps} />

      <ThumbnailGenerationDialog {...thumbnailGenerationDialogProps} />

      <MigrationScanDialog {...migrationScanDialogProps} />

      <DuplicateScanDialog {...duplicateScanDialogProps} />

      <DuplicateTrashConfirmDialog {...duplicateTrashConfirmDialogProps} />

      <DuplicateTrashResultDialog {...duplicateTrashResultDialogProps} />

      <MigrationResultDialog {...migrationResultDialogProps} />

      <FileOperationConfirmDialog {...trashConfirmDialogProps} />

      <FileOperationResultDialog {...trashResultDialogProps} />

      <FileOperationConfirmDialog {...moveConfirmDialogProps} />

      <FileOperationResultDialog {...moveResultDialogProps} />

      <FileOperationConfirmDialog {...archiveConfirmDialogProps} />

      <FileOperationResultDialog {...archiveResultDialogProps} />

      <FileOperationResultDialog {...replacementResultDialogProps} />
    </main>
  );
}

function WorkspaceSwitcher({
  mode,
  result,
  onModeChange,
  onClearDuplicateScanResult
}: {
  mode: WorkspaceMode;
  result: DuplicateReviewScanResult;
  onModeChange: (mode: WorkspaceMode) => void;
  onClearDuplicateScanResult: () => void;
}): ReactElement {
  return (
    <section className="workspace-switcher" aria-label="Workspace selector">
      <div>
        <strong>Duplicate candidate results available</strong>
        <span>{getDuplicateWorkspaceSummary(result)}</span>
      </div>
      <div>
        <Button
          label="Results"
          icon="pi pi-table"
          severity="secondary"
          outlined={mode !== 'results'}
          onClick={() => onModeChange('results')}
        />
        <Button
          label="Duplicate Review"
          icon="pi pi-search"
          severity="info"
          outlined={mode !== 'duplicate-review'}
          onClick={() => onModeChange('duplicate-review')}
        />
        <Button
          label="Clear Scan"
          icon="pi pi-times"
          severity="secondary"
          text
          title="Clear Duplicate Scan results"
          onClick={onClearDuplicateScanResult}
        />
      </div>
    </section>
  );
}

function getDuplicateWorkspaceSummary(result: DuplicateReviewScanResult): string {
  if (isImprovedDuplicateScanResult(result)) {
    return `${result.summary.candidateFileCount.toLocaleString()} candidate file(s) across ${result.groups.length.toLocaleString()} group(s).`;
  }

  return `${result.matchCount.toLocaleString()} filename match(es) found across ${result.groups.length.toLocaleString()} source video(s).`;
}
