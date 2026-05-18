import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/ipcChannels';
import type { AppInfo } from '../shared/types/app';
import type { AppCommand } from '../shared/types/appCommands';
import type {
  AuditJobSnapshot,
  AuditRequest,
  AuditResultResponse,
  AuditStartResponse,
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest,
  FileDiscoveryStartResponse,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest,
  FfprobeMetadataStartResponse
} from '../shared/types/audit';
import type {
  AutoCropJobSnapshot,
  AutoCropRequest,
  AutoCropResultResponse,
  AutoCropStartResponse
} from '../shared/types/autoCrop';
import type {
  AutoFixJobSnapshot,
  AutoFixRequest,
  AutoFixResultResponse,
  AutoFixStartResponse
} from '../shared/types/autoFix';
import type { PathSelectionResult } from '../shared/types/dialog';
import type { ToolDiagnosticsResult } from '../shared/types/diagnostics';
import type {
  CreateArchiveOperationPlanRequest,
  CreateArchiveOperationPlanResponse,
  CreateMoveOperationPlanRequest,
  CreateMoveOperationPlanResponse,
  CreateTrashOperationPlanRequest,
  CreateTrashOperationPlanResponse,
  ExecuteArchiveOperationPlanRequest,
  ExecuteArchiveOperationPlanResponse,
  ExecuteMoveOperationPlanRequest,
  ExecuteMoveOperationPlanResponse,
  ExecuteTrashOperationPlanRequest,
  ExecuteTrashOperationPlanResponse,
  KnownPathValidationRequest,
  KnownPathValidationResponse,
  RevealKnownPathRequest,
  RevealKnownPathResponse
} from '../shared/types/fileOperations';
import type {
  CancelFolderTreeScanResponse,
  ChooseFolderTreeRootResult,
  FolderTreeScanJobSnapshot,
  ScanFolderTreeResultResponse,
  ScanFolderTreeStartResponse
} from '../shared/types/folderTree';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewRequest,
  MediaPreviewResultResponse,
  MediaPreviewStartResponse,
  PreviewClipJobSnapshot,
  PreviewClipRequest,
  PreviewClipResultResponse,
  PreviewClipStartResponse,
  PreviewFrameRequest,
  PreviewFrameResultResponse
} from '../shared/types/mediaPreview';
import type {
  PremiereBridgeAppsLaunchResponse,
  PremiereImportRequest,
  PremiereRequestResponse,
  PremiereStatusResponse
} from '../shared/types/premiere';
import type {
  OperationHistoryDetailsResponse,
  OperationHistoryListRequest,
  OperationHistoryListResponse
} from '../shared/types/operationHistory';
import type {
  CreateReplacementPlanRequest,
  CreateReplacementPlanResponse,
  ExecuteReplacementPlanRequest,
  ReplacementExecutionJobSnapshot,
  ReplacementExecutionResultResponse,
  ReplacementExecutionStartResponse,
  UpdateReplacementPlanActionsRequest,
  UpdateReplacementPlanActionsResponse
} from '../shared/types/replacementWorkflow';
import type {
  MigrationExecuteRequest,
  MigrationJobSnapshot,
  MigrationResultResponse,
  MigrationScanRequest,
  MigrationScanResponse,
  MigrationStartResponse
} from '../shared/types/migration';
import type { AppSettings, AppSettingsUpdate } from '../shared/types/settings';

export interface VideoAuditApi {
  app: {
    getInfo: () => Promise<AppInfo>;
    onCommand: (callback: (command: AppCommand) => void) => () => void;
  };
  diagnostics: {
    checkTools: () => Promise<ToolDiagnosticsResult>;
  };
  dialog: {
    chooseFolders: () => Promise<PathSelectionResult>;
    chooseVideoFiles: () => Promise<PathSelectionResult>;
    chooseOutputFolder: () => Promise<PathSelectionResult>;
    chooseMoveDestinationFolder: () => Promise<PathSelectionResult>;
  };
  fileOperations: {
    revealFile: (request: RevealKnownPathRequest) => Promise<RevealKnownPathResponse>;
    revealFolder: (request: RevealKnownPathRequest) => Promise<RevealKnownPathResponse>;
    validateKnownPaths: (request: KnownPathValidationRequest) => Promise<KnownPathValidationResponse>;
    createTrashPlan: (request: CreateTrashOperationPlanRequest) => Promise<CreateTrashOperationPlanResponse>;
    executeTrashPlan: (request: ExecuteTrashOperationPlanRequest) => Promise<ExecuteTrashOperationPlanResponse>;
    createMovePlan: (request: CreateMoveOperationPlanRequest) => Promise<CreateMoveOperationPlanResponse>;
    executeMovePlan: (request: ExecuteMoveOperationPlanRequest) => Promise<ExecuteMoveOperationPlanResponse>;
    createArchivePlan: (request: CreateArchiveOperationPlanRequest) => Promise<CreateArchiveOperationPlanResponse>;
    executeArchivePlan: (request: ExecuteArchiveOperationPlanRequest) => Promise<ExecuteArchiveOperationPlanResponse>;
  };
  folderTree: {
    chooseRootFolder: () => Promise<ChooseFolderTreeRootResult>;
    scanRoot: (rootPath: string) => Promise<ScanFolderTreeStartResponse>;
    cancelScan: (scanId: string) => Promise<CancelFolderTreeScanResponse>;
    getResult: (scanId: string) => Promise<ScanFolderTreeResultResponse>;
    onScanProgress: (callback: (progress: FolderTreeScanJobSnapshot) => void) => () => void;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (partialSettings: AppSettingsUpdate) => Promise<AppSettings>;
    reset: () => Promise<AppSettings>;
  };
  discovery: {
    start: (request: FileDiscoveryRequest) => Promise<FileDiscoveryStartResponse>;
    cancel: (jobId: string) => Promise<FileDiscoveryJobSnapshot>;
    onProgress: (callback: (progress: FileDiscoveryJobSnapshot) => void) => () => void;
  };
  audit: {
    start: (request: AuditRequest) => Promise<AuditStartResponse>;
    cancel: (jobId: string) => Promise<AuditJobSnapshot>;
    getResult: (jobId: string) => Promise<AuditResultResponse>;
    onProgress: (callback: (progress: AuditJobSnapshot) => void) => () => void;
  };
  ffprobe: {
    start: (request: FfprobeMetadataRequest) => Promise<FfprobeMetadataStartResponse>;
    cancel: (jobId: string) => Promise<FfprobeMetadataJobSnapshot>;
    onProgress: (callback: (progress: FfprobeMetadataJobSnapshot) => void) => () => void;
  };
  autoFix: {
    start: (request: AutoFixRequest) => Promise<AutoFixStartResponse>;
    cancel: (jobId: string) => Promise<AutoFixJobSnapshot>;
    getResult: (jobId: string) => Promise<AutoFixResultResponse>;
    onProgress: (callback: (progress: AutoFixJobSnapshot) => void) => () => void;
  };
  autoCrop: {
    start: (request: AutoCropRequest) => Promise<AutoCropStartResponse>;
    cancel: (jobId: string) => Promise<AutoCropJobSnapshot>;
    getResult: (jobId: string) => Promise<AutoCropResultResponse>;
    onProgress: (callback: (progress: AutoCropJobSnapshot) => void) => () => void;
  };
  mediaPreview: {
    start: (request: MediaPreviewRequest) => Promise<MediaPreviewStartResponse>;
    cancel: (jobId: string) => Promise<MediaPreviewJobSnapshot>;
    getResult: (jobId: string) => Promise<MediaPreviewResultResponse>;
    generateFrames: (request: PreviewFrameRequest) => Promise<PreviewFrameResultResponse>;
    startClipGeneration: (request: PreviewClipRequest) => Promise<PreviewClipStartResponse>;
    cancelClipGeneration: (jobId: string) => Promise<PreviewClipJobSnapshot>;
    getClipResult: (jobId: string) => Promise<PreviewClipResultResponse>;
    clearCache: () => Promise<{ status: string; message: string }>;
    onProgress: (callback: (progress: MediaPreviewJobSnapshot) => void) => () => void;
    onClipProgress: (callback: (progress: PreviewClipJobSnapshot) => void) => () => void;
  };
  migration: {
    scan: (request: MigrationScanRequest) => Promise<MigrationScanResponse>;
    execute: (request: MigrationExecuteRequest) => Promise<MigrationStartResponse>;
    getResult: (jobId: string) => Promise<MigrationResultResponse>;
    onProgress: (callback: (progress: MigrationJobSnapshot) => void) => () => void;
  };
  operationHistory: {
    listRecent: (request?: OperationHistoryListRequest) => Promise<OperationHistoryListResponse>;
    getDetails: (operationId: string) => Promise<OperationHistoryDetailsResponse>;
  };
  replacement: {
    createPlan: (request: CreateReplacementPlanRequest) => Promise<CreateReplacementPlanResponse>;
    updatePlanActions: (request: UpdateReplacementPlanActionsRequest) => Promise<UpdateReplacementPlanActionsResponse>;
    executePlan: (request: ExecuteReplacementPlanRequest) => Promise<ReplacementExecutionStartResponse>;
    cancelExecution: (jobId: string) => Promise<ReplacementExecutionJobSnapshot>;
    getExecutionResult: (jobId: string) => Promise<ReplacementExecutionResultResponse>;
    onProgress: (callback: (progress: ReplacementExecutionJobSnapshot) => void) => () => void;
  };
  premiere: {
    getStatus: () => Promise<PremiereStatusResponse>;
    openBridgeApps: () => Promise<PremiereBridgeAppsLaunchResponse>;
    createImportRequest: (request: PremiereImportRequest) => Promise<PremiereRequestResponse>;
  };
}

export const videoAuditApi: VideoAuditApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo),
    onCommand: (callback: (command: AppCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: AppCommand): void => {
        callback(command);
      };

      ipcRenderer.on(IPC_CHANNELS.appCommand, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.appCommand, listener);
      };
    }
  },
  diagnostics: {
    checkTools: () => ipcRenderer.invoke(IPC_CHANNELS.diagnosticsCheckTools)
  },
  dialog: {
    chooseFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseFolders),
    chooseVideoFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseVideoFiles),
    chooseOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseOutputFolder),
    chooseMoveDestinationFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseMoveDestinationFolder)
  },
  fileOperations: {
    revealFile: (request: RevealKnownPathRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationRevealFile, request),
    revealFolder: (request: RevealKnownPathRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationRevealFolder, request),
    validateKnownPaths: (request: KnownPathValidationRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationValidateKnownPaths, request),
    createTrashPlan: (request: CreateTrashOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationCreateTrashPlan, request),
    executeTrashPlan: (request: ExecuteTrashOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationExecuteTrashPlan, request),
    createMovePlan: (request: CreateMoveOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationCreateMovePlan, request),
    executeMovePlan: (request: ExecuteMoveOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationExecuteMovePlan, request),
    createArchivePlan: (request: CreateArchiveOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationCreateArchivePlan, request),
    executeArchivePlan: (request: ExecuteArchiveOperationPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.fileOperationExecuteArchivePlan, request)
  },
  folderTree: {
    chooseRootFolder: () => ipcRenderer.invoke(IPC_CHANNELS.folderTreeChooseRootFolder),
    scanRoot: (rootPath: string) => ipcRenderer.invoke(IPC_CHANNELS.folderTreeScanRoot, rootPath),
    cancelScan: (scanId: string) => ipcRenderer.invoke(IPC_CHANNELS.folderTreeCancelScan, scanId),
    getResult: (scanId: string) => ipcRenderer.invoke(IPC_CHANNELS.folderTreeGetResult, scanId),
    onScanProgress: (callback: (progress: FolderTreeScanJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: FolderTreeScanJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.folderTreeProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.folderTreeProgress, listener);
      };
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (partialSettings: AppSettingsUpdate) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, partialSettings),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.settingsReset)
  },
  discovery: {
    start: (request: FileDiscoveryRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.auditDiscoveryStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.auditDiscoveryCancel, jobId),
    onProgress: (callback: (progress: FileDiscoveryJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: FileDiscoveryJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.auditDiscoveryProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.auditDiscoveryProgress, listener);
      };
    }
  },
  audit: {
    start: (request: AuditRequest) => ipcRenderer.invoke(IPC_CHANNELS.auditStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.auditCancel, jobId),
    getResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.auditGetResult, jobId),
    onProgress: (callback: (progress: AuditJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: AuditJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.auditProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.auditProgress, listener);
      };
    }
  },
  ffprobe: {
    start: (request: FfprobeMetadataRequest) => ipcRenderer.invoke(IPC_CHANNELS.ffprobeStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.ffprobeCancel, jobId),
    onProgress: (callback: (progress: FfprobeMetadataJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: FfprobeMetadataJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.ffprobeProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.ffprobeProgress, listener);
      };
    }
  },
  autoFix: {
    start: (request: AutoFixRequest) => ipcRenderer.invoke(IPC_CHANNELS.autoFixStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.autoFixCancel, jobId),
    getResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.autoFixGetResult, jobId),
    onProgress: (callback: (progress: AutoFixJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: AutoFixJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.autoFixProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.autoFixProgress, listener);
      };
    }
  },
  autoCrop: {
    start: (request: AutoCropRequest) => ipcRenderer.invoke(IPC_CHANNELS.autoCropStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.autoCropCancel, jobId),
    getResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.autoCropGetResult, jobId),
    onProgress: (callback: (progress: AutoCropJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: AutoCropJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.autoCropProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.autoCropProgress, listener);
      };
    }
  },
  mediaPreview: {
    start: (request: MediaPreviewRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewStart, request),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewCancel, jobId),
    getResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewGetResult, jobId),
    generateFrames: (request: PreviewFrameRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewGenerateFrames, request),
    startClipGeneration: (request: PreviewClipRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewClipStart, request),
    cancelClipGeneration: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewClipCancel, jobId),
    getClipResult: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewClipGetResult, jobId),
    clearCache: () => ipcRenderer.invoke(IPC_CHANNELS.mediaPreviewClearCache),
    onProgress: (callback: (progress: MediaPreviewJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: MediaPreviewJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.mediaPreviewProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.mediaPreviewProgress, listener);
      };
    },
    onClipProgress: (callback: (progress: PreviewClipJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: PreviewClipJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.mediaPreviewClipProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.mediaPreviewClipProgress, listener);
      };
    }
  },
  migration: {
    scan: (request: MigrationScanRequest) => ipcRenderer.invoke(IPC_CHANNELS.migrationScan, request),
    execute: (request: MigrationExecuteRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.migrationExecuteStart, request),
    getResult: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.migrationExecuteGetResult, jobId),
    onProgress: (callback: (progress: MigrationJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: MigrationJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.migrationExecuteProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.migrationExecuteProgress, listener);
      };
    }
  },
  operationHistory: {
    listRecent: (request?: OperationHistoryListRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.operationHistoryList, request),
    getDetails: (operationId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.operationHistoryGetDetails, operationId)
  },
  replacement: {
    createPlan: (request: CreateReplacementPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.replacementCreatePlan, request),
    updatePlanActions: (request: UpdateReplacementPlanActionsRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.replacementUpdatePlanActions, request),
    executePlan: (request: ExecuteReplacementPlanRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.replacementExecuteStart, request),
    cancelExecution: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.replacementExecuteCancel, jobId),
    getExecutionResult: (jobId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.replacementExecuteGetResult, jobId),
    onProgress: (callback: (progress: ReplacementExecutionJobSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ReplacementExecutionJobSnapshot): void => {
        callback(progress);
      };

      ipcRenderer.on(IPC_CHANNELS.replacementExecuteProgress, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.replacementExecuteProgress, listener);
      };
    }
  },
  premiere: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.premiereGetStatus),
    openBridgeApps: () => ipcRenderer.invoke(IPC_CHANNELS.premiereOpenBridgeApps),
    createImportRequest: (request: PremiereImportRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.premiereCreateImportRequest, request)
  }
};
