import type { ReactElement } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuditProgressPanel } from './components/AuditProgressPanel';
import { AutoCropDialog } from './components/AutoCropDialog';
import { AutoFixDialog } from './components/AutoFixDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { SourceSelectionPanel } from './components/SourceSelectionPanel';
import { ThumbnailGenerationDialog } from './components/ThumbnailGenerationDialog';
import { UtilityPanel } from './components/UtilityPanel';
import { VideoResultsTable } from './components/VideoResultsTable';
import { useVideoAuditAppController } from './hooks/useVideoAuditAppController';

export function App(): ReactElement {
  const controller = useVideoAuditAppController();

  return (
    <main className="app-shell">
      <AppHeader appInfo={controller.appInfo} />

      <section className="workspace-layout">
        <div className="workspace-main">
          <SourceSelectionPanel
            selectedFolders={controller.selectedFolders}
            selectedFiles={controller.selectedFiles}
            outputFolder={controller.outputFolder}
            auditOptions={controller.auditOptions}
            isAuditActive={controller.isAuditActive}
            canRunAudit={controller.canRunAudit}
            activeAction={controller.activeAction}
            selectionMessage={controller.selectionMessage}
            workflowMessage={controller.workflowMessage}
            onChooseFolders={controller.chooseFolders}
            onChooseFiles={controller.chooseFiles}
            onChooseOutputFolder={controller.chooseOutputFolder}
            onRunAudit={controller.runAudit}
            onCancelAudit={controller.cancelAudit}
            onRevealPath={controller.revealPath}
            onAuditOptionChange={controller.updateAuditOption}
          />

          <AuditProgressPanel
            progress={controller.auditProgress}
            percent={controller.auditPercent}
            isActive={controller.isAuditActive}
            onCancelAudit={controller.cancelAudit}
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
            isAuditActive={controller.isAuditActive}
            isAutoFixActive={controller.isAutoFixActive}
            isAutoCropActive={controller.isAutoCropActive}
            isMediaPreviewActive={controller.isMediaPreviewActive}
            isPreviewClipActive={controller.isPreviewClipActive}
            isStorageLoading={controller.isStorageLoading}
            storageMessage={controller.storageMessage}
            storageSavedAt={controller.storageSavedAt}
            previewClipProgress={controller.previewClipProgress}
            previewClipPercent={controller.previewClipPercent}
            previewClipError={controller.previewClipError}
            canRefreshAudit={controller.canRefreshAudit}
            canAutoFixSelected={controller.canAutoFixSelected}
            canOpenCropOptions={controller.canOpenCropOptions}
            canGenerateThumbnails={controller.canGenerateThumbnails}
            onSelectedVideosChange={controller.setSelectedVideos}
            onGlobalFilterChange={controller.setGlobalFilter}
            onShowThumbnailsChange={controller.setShowThumbnails}
            onRefreshAudit={controller.refreshAudit}
            onClearData={controller.clearAuditData}
            onRemoveSelectedVideos={controller.removeSelectedVideos}
            onRestoreRemovedVideos={controller.restoreRemovedVideos}
            onOpenAutoFixDialog={controller.openAutoFixDialog}
            onOpenAutoCropDialog={controller.openAutoCropDialog}
            onOpenThumbnailDialog={controller.openThumbnailDialog}
            onStartPreviewClipGeneration={controller.startPreviewClipGeneration}
            onCancelPreviewClipGeneration={controller.cancelPreviewClipGeneration}
            onRevealPath={controller.revealPath}
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
        </div>

        <aside className="workspace-side">
          <UtilityPanel
            discoveryProgress={controller.discoveryProgress}
            discoveryPercent={controller.discoveryPercent}
            discoveredPaths={controller.discoveredPaths}
            ffprobeProgress={controller.ffprobeProgress}
            ffprobePercent={controller.ffprobePercent}
            metadataItems={controller.metadataItems}
            isDiscoveryActive={controller.isDiscoveryActive}
            isFfprobeActive={controller.isFfprobeActive}
            hasSources={controller.selectedFolders.length > 0 || controller.selectedFiles.length > 0}
            activeAction={controller.activeAction}
            onStartDiscovery={controller.startDiscovery}
            onCancelDiscovery={controller.cancelDiscovery}
            onStartFfprobe={controller.startFfprobe}
            onCancelFfprobe={controller.cancelFfprobe}
            onRevealPath={controller.revealPath}
          />

          <SettingsPanel
            appInfo={controller.appInfo}
            appInfoMessage={controller.appInfoMessage}
            settings={controller.settings}
            settingsMessage={controller.settingsMessage}
            activeAction={controller.activeAction}
            onUpdateSettingsField={controller.updateSettingsField}
            onResetSettings={controller.resetSettings}
          />
        </aside>
      </section>
    </main>
  );
}
