import { useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import { Dialog } from 'primereact/dialog';
import { AppHeader } from './components/AppHeader';
import { AuditProgressPanel } from './components/AuditProgressPanel';
import { AutoCropDialog } from './components/AutoCropDialog';
import { AutoFixDialog } from './components/AutoFixDialog';
import { DiagnosticsDialog } from './components/DiagnosticsDialog';
import { DialogHeader } from './components/DialogChrome';
import { FileOperationConfirmDialog } from './components/FileOperationConfirmDialog';
import { FileOperationResultDialog } from './components/FileOperationResultDialog';
import { MigrationResultDialog } from './components/MigrationResultDialog';
import { MigrationScanDialog } from './components/MigrationScanDialog';
import { OperationHistoryDialog } from './components/OperationHistoryDialog';
import { PostConversionDialog } from './components/PostConversionDialog';
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

export function App(): ReactElement {
  const controller = useVideoAuditAppController();
  const resultFilters = useResultFilters();
  const [isSourceSetupVisible, setIsSourceSetupVisible] = useState(false);
  const [isFolderTreeSelectorVisible, setIsFolderTreeSelectorVisible] = useState(false);
  const [isUtilitiesVisible, setIsUtilitiesVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);
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

  const runAuditFromSourceDialog = async (): Promise<void> => {
    const outcome = await controller.runAudit();

    if (outcome === 'started') {
      setIsSourceSetupVisible(false);
    }
  };

  const appHeaderProps = {
    appInfo: controller.appInfo,
    auditSummary: controller.auditSummary,
    visibleVideoCount: controller.visibleVideoRows.length,
    selectedVideoCount: controller.selectedVideos.length,
    premiereStatus: controller.premiereStatus,
    onOpenOperationHistory: controller.openOperationHistory,
    onOpenUtilities: () => setIsUtilitiesVisible(true),
    onOpenSettings: () => setIsSettingsVisible(true)
  } satisfies ComponentProps<typeof AppHeader>;

  const sourceSummaryProps = {
    selectedFolders: controller.selectedFolders,
    selectedFolderSummary: controller.selectedFolderSummary,
    selectedFiles: controller.selectedFiles,
    outputFolder: controller.outputFolder,
    auditOptions: controller.auditOptions,
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
    canEditSelectedInPremiere: controller.canEditSelectedInPremiere,
    onRemoveSelectedVideos: controller.removeSelectedVideos,
    onRestoreRemovedVideos: controller.restoreRemovedVideos,
    onOpenAutoFixDialog: controller.openAutoFixDialog,
    onOpenAutoCropDialog: controller.openAutoCropDialog,
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
    onPlanActionChange: controller.changePostConversionPlanAction,
    onPlanBulkAction: controller.applyPostConversionPlanBulkAction,
    onReplaceOriginals: controller.replacePostConversionOriginals,
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
    title: 'Replacement Result',
    description: 'Review replaced originals, moved converted outputs, and any items that need attention.',
    error: controller.replacementResultError,
    onRevealPath: controller.revealPath,
    onHide: controller.closeReplacementResultDialog
  } satisfies ComponentProps<typeof FileOperationResultDialog>;

  return (
    <main className="app-shell">
      <AppHeader {...appHeaderProps} />

      <section className="app-workspace">
        <SourceSummaryBar {...sourceSummaryProps} />

        <StatusStrip {...statusStripProps} />

        <AuditProgressPanel {...auditProgressProps} />

        <section className="results-workspace" aria-label="Results workspace">
          <ResultsToolbar {...resultsToolbarProps} />

          <VideoResultsTable {...videoResultsTableProps} />
        </section>

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

      <AutoFixDialog {...autoFixDialogProps} />

      <AutoCropDialog {...autoCropDialogProps} />

      <PostConversionDialog {...postConversionDialogProps} />

      <ThumbnailGenerationDialog {...thumbnailGenerationDialogProps} />

      <MigrationScanDialog {...migrationScanDialogProps} />

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
