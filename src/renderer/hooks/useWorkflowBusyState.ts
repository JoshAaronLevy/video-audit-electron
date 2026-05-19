type WorkflowProgress = {
  status?: string;
} | null | undefined;

export interface UseWorkflowBusyStateInput {
  activeAction: string | null;
  auditProgress?: WorkflowProgress;
  discoveryProgress?: WorkflowProgress;
  ffprobeProgress?: WorkflowProgress;
  autoFixProgress?: WorkflowProgress;
  autoCropProgress?: WorkflowProgress;
  mediaPreviewProgress?: WorkflowProgress;
  previewClipProgress?: WorkflowProgress;
  migrationProgress?: WorkflowProgress;
  replacementProgress?: WorkflowProgress;
  isPremiereImportSubmitting: boolean;
}

export interface UseWorkflowBusyStateValue {
  isAuditActive: boolean;
  isDiscoveryActive: boolean;
  isFfprobeActive: boolean;
  isAutoFixActive: boolean;
  isAutoCropActive: boolean;
  isMediaPreviewActive: boolean;
  isPreviewClipActive: boolean;
  isMigrationScanning: boolean;
  isMigrationExecuting: boolean;
  isMigrationActive: boolean;
  isTrashPlanning: boolean;
  isTrashExecuting: boolean;
  isMovePlanning: boolean;
  isMoveExecuting: boolean;
  isArchivePlanning: boolean;
  isArchiveExecuting: boolean;
  isReplacementPlanning: boolean;
  isReplacementActionUpdating: boolean;
  isReplacementExecuting: boolean;
  isPremiereImportActive: boolean;
  isAnyBlockingWorkflowActive: boolean;
}

export function useWorkflowBusyState({
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
}: UseWorkflowBusyStateInput): UseWorkflowBusyStateValue {
  const isAuditActive = isRunningProgress(auditProgress);
  const isDiscoveryActive = activeAction === 'discovery' || isRunningProgress(discoveryProgress);
  const isFfprobeActive = activeAction === 'ffprobe' || isRunningProgress(ffprobeProgress);
  const isAutoFixActive = activeAction === 'autoFix' || isRunningProgress(autoFixProgress);
  const isAutoCropActive = activeAction === 'autoCrop' || isRunningProgress(autoCropProgress);
  const isMediaPreviewActive = activeAction === 'mediaPreview' || isRunningProgress(mediaPreviewProgress);
  const isPreviewClipActive = activeAction === 'previewClip' || isRunningProgress(previewClipProgress);
  const isMigrationScanning = activeAction === 'migrationScan';
  const isMigrationExecuting = activeAction === 'migrationExecute' || isRunningProgress(migrationProgress);
  const isMigrationActive = isMigrationScanning || isMigrationExecuting;
  const isTrashPlanning = activeAction === 'trashPlan';
  const isTrashExecuting = activeAction === 'trashExecute';
  const isMovePlanning = activeAction === 'movePlan';
  const isMoveExecuting = activeAction === 'moveExecute';
  const isArchivePlanning = activeAction === 'archivePlan';
  const isArchiveExecuting = activeAction === 'archiveExecute';
  const isReplacementPlanning = activeAction === 'replacementPlan';
  const isReplacementActionUpdating = activeAction === 'replacementUpdate';
  const isReplacementExecuting = activeAction === 'replacementExecute' || isRunningProgress(replacementProgress);
  const isPremiereImportActive = activeAction === 'premiereImport' || isPremiereImportSubmitting;
  const isAnyBlockingWorkflowActive =
    isAuditActive ||
    isDiscoveryActive ||
    isFfprobeActive ||
    isAutoFixActive ||
    isAutoCropActive ||
    isMediaPreviewActive ||
    isPreviewClipActive ||
    isMigrationActive ||
    isTrashPlanning ||
    isTrashExecuting ||
    isMovePlanning ||
    isMoveExecuting ||
    isArchivePlanning ||
    isArchiveExecuting ||
    isReplacementPlanning ||
    isReplacementActionUpdating ||
    isReplacementExecuting ||
    isPremiereImportActive;

  return {
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
  };
}

function isRunningProgress(progress: WorkflowProgress): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}
