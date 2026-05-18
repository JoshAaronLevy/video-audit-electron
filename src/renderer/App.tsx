import { useEffect, useState, type ReactElement } from 'react';
import { Dialog } from 'primereact/dialog';
import { AppHeader } from './components/AppHeader';
import { AuditProgressPanel } from './components/AuditProgressPanel';
import { AutoCropDialog } from './components/AutoCropDialog';
import { AutoFixDialog } from './components/AutoFixDialog';
import { DiagnosticsDialog } from './components/DiagnosticsDialog';
import { MigrationResultDialog } from './components/MigrationResultDialog';
import { MigrationScanDialog } from './components/MigrationScanDialog';
import { ResultsToolbar } from './components/ResultsToolbar';
import { SelectionActionBar } from './components/SelectionActionBar';
import { SettingsPanel } from './components/SettingsPanel';
import { SourceConfigDialog } from './components/SourceConfigDialog';
import { SourceSummaryBar } from './components/SourceSummaryBar';
import { StatusStrip } from './components/StatusStrip';
import { ThumbnailGenerationDialog } from './components/ThumbnailGenerationDialog';
import { UtilityPanel } from './components/UtilityPanel';
import { VideoResultsTable } from './components/VideoResultsTable';
import { useVideoAuditAppController } from './hooks/useVideoAuditAppController';

export function App(): ReactElement {
  const controller = useVideoAuditAppController();
  const [isSourceSetupVisible, setIsSourceSetupVisible] = useState(false);
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

  return (
    <main className="app-shell">
      <AppHeader
        appInfo={controller.appInfo}
        auditSummary={controller.auditSummary}
        visibleVideoCount={controller.visibleVideoRows.length}
        selectedVideoCount={controller.selectedVideos.length}
        premiereStatus={controller.premiereStatus}
        onOpenUtilities={() => setIsUtilitiesVisible(true)}
        onOpenSettings={() => setIsSettingsVisible(true)}
      />

      <section className="app-workspace">
        <SourceSummaryBar
          selectedFolders={controller.selectedFolders}
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
            showThumbnails={controller.showThumbnails}
            isAuditActive={controller.isAuditActive}
            isStorageLoading={controller.isStorageLoading}
            canRefreshAudit={controller.canRefreshAudit}
            hasAuditData={hasAuditData}
            onGlobalFilterChange={controller.setGlobalFilter}
            onShowThumbnailsChange={controller.setShowThumbnails}
            onRefreshAudit={controller.refreshAudit}
            onClearData={controller.clearAuditData}
          />

          <VideoResultsTable
            rows={controller.visibleVideoRows}
            allRows={controller.videoRows}
            selectedVideos={controller.selectedVideos}
            globalFilter={controller.globalFilter}
            showThumbnails={controller.showThumbnails}
            auditSummary={controller.auditSummary}
            auditErrors={controller.auditErrors}
            removedVideoCount={controller.removedVideoCount}
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
            onStartPreviewClipGeneration={controller.startPreviewClipGeneration}
            onCancelPreviewClipGeneration={controller.cancelPreviewClipGeneration}
            onRevealPath={controller.revealPath}
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
          isPremiereImportSubmitting={controller.isPremiereImportSubmitting}
          canAutoFixSelected={controller.canAutoFixSelected}
          canOpenCropOptions={controller.canOpenCropOptions}
          canGenerateThumbnails={controller.canGenerateThumbnails}
          canStartMigration={controller.canStartMigration}
          canEditSelectedInPremiere={controller.canEditSelectedInPremiere}
          onRemoveSelectedVideos={controller.removeSelectedVideos}
          onRestoreRemovedVideos={controller.restoreRemovedVideos}
          onOpenAutoFixDialog={controller.openAutoFixDialog}
          onOpenAutoCropDialog={controller.openAutoCropDialog}
          onOpenThumbnailDialog={controller.openThumbnailDialog}
          onOpenMigrationDialog={controller.openMigrationDialog}
          onEditSelectedInPremiere={controller.editSelectedInPremiere}
        />
      </section>

      <SourceConfigDialog
        visible={isSourceSetupVisible}
        selectedFolders={controller.selectedFolders}
        selectedFiles={controller.selectedFiles}
        outputFolder={controller.outputFolder}
        recentFolders={controller.settings?.recentFolders ?? []}
        auditOptions={controller.auditOptions}
        isAuditActive={controller.isAuditActive}
        canRunAudit={controller.canRunAudit}
        activeAction={controller.activeAction}
        selectionMessage={controller.selectionMessage}
        workflowMessage={controller.workflowMessage}
        onChooseFolders={controller.chooseFolders}
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

      <Dialog
        header="Utilities"
        visible={isUtilitiesVisible}
        className="app-dialog utility-dialog"
        modal
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

      <Dialog
        header="Settings"
        visible={isSettingsVisible}
        className="app-dialog settings-dialog"
        modal
        onHide={() => setIsSettingsVisible(false)}
      >
        <SettingsPanel
          appInfo={controller.appInfo}
          appInfoMessage={controller.appInfoMessage}
          settings={controller.settings}
          settingsMessage={controller.settingsMessage}
          toolDiagnostics={controller.toolDiagnostics}
          toolDiagnosticsError={controller.toolDiagnosticsError}
          isToolDiagnosticsLoading={controller.isToolDiagnosticsLoading}
          activeAction={controller.activeAction}
          onUpdateSettingsField={controller.updateSettingsField}
          onResetSettings={controller.resetSettings}
          onRunToolDiagnostics={controller.runToolDiagnostics}
        />
      </Dialog>

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
    </main>
  );
}
