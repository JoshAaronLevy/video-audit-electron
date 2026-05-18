import { useEffect, useState, type ReactElement } from 'react';
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
import { useVideoAuditAppController } from './hooks/useVideoAuditAppController';

export function App(): ReactElement {
  const controller = useVideoAuditAppController();
  const [isSourceSetupVisible, setIsSourceSetupVisible] = useState(false);
  const [isFolderTreeSelectorVisible, setIsFolderTreeSelectorVisible] = useState(false);
  const [isUtilitiesVisible, setIsUtilitiesVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);
  const hasSources = controller.selectedFolders.length > 0 || controller.selectedFiles.length > 0;
  const hasAuditData = Boolean(controller.videoRows) || Boolean(controller.storageSavedAt);

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

  return (
    <main className="app-shell">
      <AppHeader
        appInfo={controller.appInfo}
        auditSummary={controller.auditSummary}
        visibleVideoCount={controller.visibleVideoRows.length}
        selectedVideoCount={controller.selectedVideos.length}
        premiereStatus={controller.premiereStatus}
        onOpenOperationHistory={controller.openOperationHistory}
        onOpenUtilities={() => setIsUtilitiesVisible(true)}
        onOpenSettings={() => setIsSettingsVisible(true)}
      />

      <section className="app-workspace">
        <SourceSummaryBar
          selectedFolders={controller.selectedFolders}
          selectedFolderSummary={controller.selectedFolderSummary}
          selectedFiles={controller.selectedFiles}
          outputFolder={controller.outputFolder}
          auditOptions={controller.auditOptions}
          isAuditActive={controller.isAuditActive}
          canRunAudit={controller.canRunAudit}
          onRunAudit={controller.runAudit}
          onCancelAudit={controller.cancelAudit}
          onOpenSourceSetup={() => setIsSourceSetupVisible(true)}
        />

        <StatusStrip
          auditProgress={controller.auditProgress}
          activeAction={controller.activeAction}
          premiereStatus={controller.premiereStatus}
          premiereStatusError={controller.premiereStatusError}
          isPremiereStatusLoading={controller.isPremiereStatusLoading}
          toolDiagnostics={controller.toolDiagnostics}
          storageSavedAt={controller.storageSavedAt}
          outputFolder={controller.outputFolder}
          onOpenDiagnostics={() => setIsDiagnosticsVisible(true)}
          onRefreshPremiereStatus={controller.refreshPremiereStatus}
        />

        <AuditProgressPanel
          progress={controller.auditProgress}
          percent={controller.auditPercent}
          isActive={controller.isAuditActive}
          onCancelAudit={controller.cancelAudit}
        />

        <section className="results-workspace" aria-label="Results workspace">
          <ResultsToolbar
            globalFilter={controller.globalFilter}
            resultsViewFilter={controller.resultsViewFilter}
            resultsViewCounts={controller.resultsViewCounts}
            showThumbnails={controller.showThumbnails}
            isAuditActive={controller.isAuditActive}
            isStorageLoading={controller.isStorageLoading}
            canRefreshAudit={controller.canRefreshAudit}
            hasAuditData={hasAuditData}
            onGlobalFilterChange={controller.setGlobalFilter}
            onResultsViewFilterChange={controller.setResultsViewFilter}
            onShowThumbnailsChange={controller.setShowThumbnails}
            onRefreshAudit={controller.refreshAudit}
            onClearData={controller.clearAuditData}
          />

          <VideoResultsTable
            rows={controller.filteredVideoRows}
            allRows={controller.videoRows}
            selectedVideos={controller.selectedVideos}
            globalFilter={controller.globalFilter}
            resultsViewFilter={controller.resultsViewFilter}
            hasSources={hasSources}
            selectedFolderCount={controller.selectedFolders.length}
            selectedFileCount={controller.selectedFiles.length}
            showThumbnails={controller.showThumbnails}
            auditOptions={controller.auditOptions}
            auditSummary={controller.auditSummary}
            auditErrors={controller.auditErrors}
            removedVideoCount={controller.removedVideoCount}
            isAuditActive={controller.isAuditActive}
            canRunAudit={controller.canRunAudit}
            auditPercent={controller.auditPercent}
            auditProgressMessage={controller.auditProgress?.message ?? null}
            isPreviewClipActive={controller.isPreviewClipActive}
            isStorageLoading={controller.isStorageLoading}
            storageMessage={controller.storageMessage}
            storageSavedAt={controller.storageSavedAt}
            previewClipProgress={controller.previewClipProgress}
            previewClipPercent={controller.previewClipPercent}
            previewClipError={controller.previewClipError}
            premiereImportResult={controller.premiereImportResult}
            premiereImportError={controller.premiereImportError}
            onSelectedVideosChange={controller.setSelectedVideos}
            onOpenSourceSetup={() => setIsSourceSetupVisible(true)}
            onRunAudit={controller.runAudit}
            onStartPreviewClipGeneration={controller.startPreviewClipGeneration}
            onCancelPreviewClipGeneration={controller.cancelPreviewClipGeneration}
            onRevealKnownFile={controller.revealKnownFile}
          />
        </section>

        <SelectionActionBar
          rowsExist={controller.visibleVideoRows.length > 0}
          selectedVideos={controller.selectedVideos}
          removedVideoCount={controller.removedVideoCount}
          isAuditActive={controller.isAuditActive}
          isAutoFixActive={controller.isAutoFixActive}
          isAutoCropActive={controller.isAutoCropActive}
          isMediaPreviewActive={controller.isMediaPreviewActive}
          isMigrationActive={controller.isMigrationActive}
          isTrashPlanning={controller.isTrashPlanning}
          isTrashExecuting={controller.isTrashExecuting}
          isMovePlanning={controller.isMovePlanning}
          isMoveExecuting={controller.isMoveExecuting}
          isArchivePlanning={controller.isArchivePlanning}
          isArchiveExecuting={controller.isArchiveExecuting}
          isPremiereImportSubmitting={controller.isPremiereImportSubmitting}
          canAutoFixSelected={controller.canAutoFixSelected}
          canOpenCropOptions={controller.canOpenCropOptions}
          canGenerateThumbnails={controller.canGenerateThumbnails}
          canMoveSelectedToTrash={controller.canMoveSelectedToTrash}
          canMoveSelectedToFolder={controller.canMoveSelectedToFolder}
          canArchiveSelectedOriginals={controller.canArchiveSelectedOriginals}
          canStartMigration={controller.canStartMigration}
          canEditSelectedInPremiere={controller.canEditSelectedInPremiere}
          onRemoveSelectedVideos={controller.removeSelectedVideos}
          onRestoreRemovedVideos={controller.restoreRemovedVideos}
          onOpenAutoFixDialog={controller.openAutoFixDialog}
          onOpenAutoCropDialog={controller.openAutoCropDialog}
          onOpenThumbnailDialog={controller.openThumbnailDialog}
          onOpenMigrationDialog={controller.openMigrationDialog}
          onOpenTrashDialog={controller.openTrashDialog}
          onOpenMoveDialog={controller.openMoveDialog}
          onOpenArchiveDialog={controller.openArchiveDialog}
          onEditSelectedInPremiere={controller.editSelectedInPremiere}
        />
      </section>

      <SourceConfigDialog
        visible={isSourceSetupVisible}
        selectedFolders={controller.selectedFolders}
        selectedFolderSummary={controller.selectedFolderSummary}
        selectedFiles={controller.selectedFiles}
        outputFolder={controller.outputFolder}
        recentFolders={controller.settings?.recentFolders ?? []}
        auditOptions={controller.auditOptions}
        isAuditActive={controller.isAuditActive}
        canRunAudit={controller.canRunAudit}
        activeAction={controller.activeAction}
        selectionMessage={controller.selectionMessage}
        workflowMessage={controller.workflowMessage}
        onChooseFolders={() => setIsFolderTreeSelectorVisible(true)}
        onChooseFiles={controller.chooseFiles}
        onChooseOutputFolder={controller.chooseOutputFolder}
        onChooseRecentFolder={controller.chooseRecentFolder}
        onClearSelectedSources={controller.clearSelectedSources}
        onRunAudit={controller.runAudit}
        onCancelAudit={controller.cancelAudit}
        onRevealPath={controller.revealPath}
        onAuditOptionChange={controller.updateAuditOption}
        onHide={() => setIsSourceSetupVisible(false)}
      />

      <FolderTreeSelectorDialog
        visible={isFolderTreeSelectorVisible}
        selectedFolderPaths={controller.selectedFolders}
        initialRootPath={controller.folderTreeRootPath}
        lastScannedAt={controller.folderTreeLastScannedAt}
        includeSubfolders={controller.auditOptions.includeSubfolders}
        isAuditActive={controller.isAuditActive}
        onConfirm={async (selection) => {
          await controller.applyFolderTreeSelection(
            selection.selectedFolderPaths,
            selection.rootPath,
            selection.summary,
            selection.lastScannedAt
          );
          setIsFolderTreeSelectorVisible(false);
        }}
        onHide={() => setIsFolderTreeSelectorVisible(false)}
      />

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
        <UtilityPanel
          discoveryProgress={controller.discoveryProgress}
          discoveryPercent={controller.discoveryPercent}
          discoveredPaths={controller.discoveredPaths}
          ffprobeProgress={controller.ffprobeProgress}
          ffprobePercent={controller.ffprobePercent}
          metadataItems={controller.metadataItems}
          isDiscoveryActive={controller.isDiscoveryActive}
          isFfprobeActive={controller.isFfprobeActive}
          hasSources={hasSources}
          activeAction={controller.activeAction}
          onStartDiscovery={controller.startDiscovery}
          onCancelDiscovery={controller.cancelDiscovery}
          onStartFfprobe={controller.startFfprobe}
          onCancelFfprobe={controller.cancelFfprobe}
          onRevealPath={controller.revealPath}
        />
      </Dialog>

      <DiagnosticsDialog
        visible={isDiagnosticsVisible}
        appInfo={controller.appInfo}
        settings={controller.settings}
        settingsMessage={controller.settingsMessage}
        auditProgress={controller.auditProgress}
        activeAction={controller.activeAction}
        premiereStatus={controller.premiereStatus}
        premiereStatusError={controller.premiereStatusError}
        isPremiereStatusLoading={controller.isPremiereStatusLoading}
        toolDiagnostics={controller.toolDiagnostics}
        toolDiagnosticsError={controller.toolDiagnosticsError}
        isToolDiagnosticsLoading={controller.isToolDiagnosticsLoading}
        outputFolder={controller.outputFolder}
        storageSavedAt={controller.storageSavedAt}
        onHide={() => setIsDiagnosticsVisible(false)}
        onRefreshPremiereStatus={controller.refreshPremiereStatus}
        onRunToolDiagnostics={controller.runToolDiagnostics}
      />

      <OperationHistoryDialog
        visible={controller.isOperationHistoryVisible}
        records={controller.operationHistoryRecords}
        selectedRecord={controller.selectedOperationHistoryRecord}
        isLoading={controller.isOperationHistoryLoading}
        error={controller.operationHistoryError}
        onRefresh={controller.refreshOperationHistory}
        onSelectRecord={controller.selectOperationHistoryRecord}
        onRevealPath={controller.revealPath}
        onHide={controller.closeOperationHistory}
      />

      <SettingsDialog
        visible={isSettingsVisible}
        appInfo={controller.appInfo}
        appInfoMessage={controller.appInfoMessage}
        settings={controller.settings}
        settingsMessage={controller.settingsMessage}
        premiereStatus={controller.premiereStatus}
        toolDiagnostics={controller.toolDiagnostics}
        toolDiagnosticsError={controller.toolDiagnosticsError}
        isToolDiagnosticsLoading={controller.isToolDiagnosticsLoading}
        activeAction={controller.activeAction}
        onHide={() => setIsSettingsVisible(false)}
        onUpdateSettingsField={controller.updateSettingsField}
        onResetSettings={controller.resetSettings}
        onRunToolDiagnostics={controller.runToolDiagnostics}
      />

      <AutoFixDialog
        visible={controller.isAutoFixDialogVisible}
        selectedCount={controller.selectedVideos.length}
        outputDirectory={controller.autoFixOutputDirectory}
        progress={controller.autoFixProgress}
        percent={controller.autoFixPercent}
        result={controller.autoFixResult}
        error={controller.autoFixError}
        isSubmitting={controller.isAutoFixActive}
        onSubmit={controller.startAutoFix}
        onCancel={controller.cancelAutoFix}
        onHide={controller.closeAutoFixDialog}
        onRevealOutputDirectory={controller.revealPath}
      />

      <AutoCropDialog
        visible={controller.isAutoCropDialogVisible}
        selectedVideos={controller.selectedVideos}
        outputRootDir={controller.autoCropOutputRootDir}
        progress={controller.autoCropProgress}
        percent={controller.autoCropPercent}
        result={controller.autoCropResult}
        error={controller.autoCropError}
        isSubmitting={controller.isAutoCropActive}
        onSubmit={controller.startAutoCrop}
        onCancel={controller.cancelAutoCrop}
        onHide={controller.closeAutoCropDialog}
        onRevealOutputDir={controller.revealPath}
      />

      <PostConversionDialog
        visible={controller.isPostConversionDialogVisible}
        sourceLabel={controller.postConversionSourceLabel}
        plan={controller.postConversionPlan}
        settings={controller.settings}
        mode={controller.postConversionMode}
        error={controller.postConversionError}
        message={controller.postConversionMessage}
        isPlanning={controller.isReplacementPlanning}
        isUpdatingActions={controller.isReplacementActionUpdating}
        isExecuting={controller.isReplacementExecuting}
        progress={controller.replacementProgress}
        percent={controller.replacementPercent}
        onPlanActionChange={controller.changePostConversionPlanAction}
        onPlanBulkAction={controller.applyPostConversionPlanBulkAction}
        onReplaceOriginals={controller.replacePostConversionOriginals}
        onCancelExecution={controller.cancelReplacementExecution}
        onReviewManually={controller.reviewPostConversionPlan}
        onLeaveOutputs={controller.leavePostConversionOutputs}
        onBackToChoices={controller.backToPostConversionChoices}
        onHide={controller.closePostConversionDialog}
      />

      <ThumbnailGenerationDialog
        visible={controller.isThumbnailDialogVisible}
        allCount={controller.visibleVideoRows.length}
        selectedCount={controller.selectedVideos.length}
        scope={controller.mediaPreviewScope}
        progress={controller.mediaPreviewProgress}
        percent={controller.mediaPreviewPercent}
        result={controller.mediaPreviewResult}
        error={controller.mediaPreviewError}
        isSubmitting={controller.isMediaPreviewActive}
        onScopeChange={controller.setMediaPreviewScope}
        onSubmit={controller.startThumbnailGeneration}
        onCancel={controller.cancelThumbnailGeneration}
        onHide={controller.closeThumbnailDialog}
      />

      <MigrationScanDialog
        visible={controller.isMigrationScanDialogVisible}
        auditedRootDirectory={controller.auditedRootDirectory}
        newEditedDir={controller.migrationNewEditedDir}
        scan={controller.migrationScan}
        error={controller.migrationScanError}
        resultError={controller.migrationResultError}
        progress={controller.migrationProgress}
        percent={controller.migrationPercent}
        isScanning={controller.isMigrationScanning}
        isExecuting={controller.isMigrationExecuting}
        onNewEditedDirChange={controller.setMigrationNewEditedDir}
        onSelectFolder={controller.selectMigrationFolder}
        onStartScan={controller.startMigrationScan}
        onExecute={controller.executeMigration}
        onHide={controller.closeMigrationDialog}
      />

      <MigrationResultDialog
        visible={controller.isMigrationResultDialogVisible}
        result={controller.migrationResult}
        scan={controller.migrationScan}
        error={controller.migrationResultError}
        onHide={controller.closeMigrationResultDialog}
        onRevealPath={controller.revealPath}
      />

      <FileOperationConfirmDialog
        visible={controller.isTrashConfirmDialogVisible}
        plan={controller.trashPlan}
        title="Move to Trash"
        description="Review the selected files before moving recoverable items to macOS Trash."
        confirmLabel="Move to Trash"
        confirmIcon="pi pi-trash"
        confirmSeverity="danger"
        error={controller.trashPlanError}
        isSubmitting={controller.isTrashExecuting}
        onConfirm={controller.executeTrashPlan}
        onHide={controller.closeTrashDialog}
      />

      <FileOperationResultDialog
        visible={controller.isTrashResultDialogVisible}
        result={controller.trashResult}
        title="Move to Trash Result"
        description="Review what was moved to macOS Trash and what needs attention."
        error={controller.trashResultError}
        onHide={controller.closeTrashResultDialog}
      />

      <FileOperationConfirmDialog
        visible={controller.isMoveConfirmDialogVisible}
        plan={controller.movePlan}
        title="Move Files"
        description="Review the selected files before moving eligible items to the destination folder."
        confirmLabel="Move Files"
        confirmIcon="pi pi-folder-open"
        confirmSeverity="success"
        error={controller.movePlanError}
        isSubmitting={controller.isMoveExecuting}
        onConfirm={controller.executeMovePlan}
        onHide={controller.closeMoveDialog}
      />

      <FileOperationResultDialog
        visible={controller.isMoveResultDialogVisible}
        result={controller.moveResult}
        title="Move Files Result"
        description="Review what was moved and what needs attention."
        error={controller.moveResultError}
        onHide={controller.closeMoveResultDialog}
      />

      <FileOperationConfirmDialog
        visible={controller.isArchiveConfirmDialogVisible}
        plan={controller.archivePlan}
        title="Archive Originals"
        description="Review selected source videos before moving eligible originals into local archive folders."
        confirmLabel="Archive Originals"
        confirmIcon="pi pi-box"
        confirmSeverity="warning"
        error={controller.archivePlanError}
        isSubmitting={controller.isArchiveExecuting}
        onConfirm={controller.executeArchivePlan}
        onHide={controller.closeArchiveDialog}
      />

      <FileOperationResultDialog
        visible={controller.isArchiveResultDialogVisible}
        result={controller.archiveResult}
        title="Archive Originals Result"
        description="Review what was archived and what needs attention."
        error={controller.archiveResultError}
        onRevealPath={controller.revealPath}
        onHide={controller.closeArchiveResultDialog}
      />

      <FileOperationResultDialog
        visible={controller.isReplacementResultDialogVisible}
        result={controller.replacementResult}
        title="Replacement Result"
        description="Review replaced originals, moved converted outputs, and any items that need attention."
        error={controller.replacementResultError}
        onRevealPath={controller.revealPath}
        onHide={controller.closeReplacementResultDialog}
      />
    </main>
  );
}
