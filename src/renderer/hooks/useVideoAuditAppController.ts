import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppInfo } from '../../shared/types/app';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditRequest,
  AuditResult,
  AuditSummary,
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest
} from '../../shared/types/audit';
import type { AutoCropJobSnapshot, AutoCropResult } from '../../shared/types/autoCrop';
import type { PathSelectionResult } from '../../shared/types/dialog';
import type { AutoFixJobSnapshot, AutoFixResult } from '../../shared/types/autoFix';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewResultItem,
  MediaPreviewScope,
  PreviewClipJobSnapshot,
  PreviewClipResult,
  PreviewClipResultItem
} from '../../shared/types/mediaPreview';
import type {
  PremiereRequestResponse,
  PremiereRequestVideo,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import type { FfprobeResult, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import {
  clearStoredAuditResult,
  loadStoredAuditResult,
  saveStoredAuditResult
} from '../storage/auditResultStorage';

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
  | 'premiereStatus'
  | 'premiereImport'
  | null;

const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  includeSubfolders: true,
  includeLowResolutionAnalysis: true,
  includeBlackBorderAnalysis: true,
  minHeight: 720,
  targetAspectRatio: 16 / 9,
  aspectRatioTolerance: 0.01
};

export interface VideoAuditAppController {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  selectionMessage: string | null;
  workflowMessage: string | null;
  activeAction: ActiveAction;
  selectedFolders: string[];
  selectedFiles: string[];
  outputFolder: string | null;
  auditOptions: AuditOptions;
  auditProgress: AuditJobSnapshot | null;
  auditPercent: number | null;
  auditSummary: AuditSummary | null;
  auditErrors: AuditResult['errors'];
  videoRows: VideoRow[] | null;
  visibleVideoRows: VideoRow[];
  removedVideoCount: number;
  selectedVideos: VideoRow[];
  globalFilter: string;
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
  premiereStatus: PremiereStatusResponse | null;
  premiereStatusError: string | null;
  isPremiereStatusLoading: boolean;
  isPremiereImportSubmitting: boolean;
  premiereImportResult: PremiereRequestResponse | null;
  premiereImportError: string | null;
  canEditSelectedInPremiere: boolean;
  canGenerateThumbnails: boolean;
  chooseFolders: () => Promise<void>;
  chooseFiles: () => Promise<void>;
  chooseOutputFolder: () => Promise<void>;
  revealPath: (path: string) => Promise<void>;
  updateAuditOption: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => Promise<void>;
  updateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>;
  resetSettings: () => Promise<void>;
  runAudit: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  cancelAudit: () => Promise<void>;
  clearAuditData: () => Promise<void>;
  removeSelectedVideos: () => Promise<void>;
  restoreRemovedVideos: () => Promise<void>;
  setSelectedVideos: (videos: VideoRow[]) => void;
  setGlobalFilter: (value: string) => void;
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
  startPreviewClipGeneration: (video: VideoRow, frames: VideoPreviewFrame[]) => Promise<void>;
  cancelPreviewClipGeneration: () => Promise<void>;
  refreshPremiereStatus: () => Promise<void>;
  editSelectedInPremiere: () => Promise<void>;
}

export function useVideoAuditAppController(): VideoAuditAppController {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoMessage, setAppInfoMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [auditOptions, setAuditOptions] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditJobSnapshot | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [auditErrors, setAuditErrors] = useState<AuditResult['errors']>([]);
  const [videoRows, setVideoRows] = useState<VideoRow[] | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<VideoRow[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [showThumbnailsState, setShowThumbnailsState] = useState(true);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [storageSavedAt, setStorageSavedAt] = useState<string | null>(null);
  const [lastAuditRequest, setLastAuditRequest] = useState<AuditRequest | null>(null);
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<FileDiscoveryJobSnapshot | null>(null);
  const [ffprobeJobId, setFfprobeJobId] = useState<string | null>(null);
  const [ffprobeProgress, setFfprobeProgress] = useState<FfprobeMetadataJobSnapshot | null>(null);
  const [autoFixJobId, setAutoFixJobId] = useState<string | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<AutoFixJobSnapshot | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [autoFixError, setAutoFixError] = useState<string | null>(null);
  const [isAutoFixDialogVisible, setIsAutoFixDialogVisible] = useState(false);
  const [autoCropJobId, setAutoCropJobId] = useState<string | null>(null);
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropJobSnapshot | null>(null);
  const [autoCropResult, setAutoCropResult] = useState<AutoCropResult | null>(null);
  const [autoCropError, setAutoCropError] = useState<string | null>(null);
  const [isAutoCropDialogVisible, setIsAutoCropDialogVisible] = useState(false);
  const [mediaPreviewJobId, setMediaPreviewJobId] = useState<string | null>(null);
  const [mediaPreviewProgress, setMediaPreviewProgress] = useState<MediaPreviewJobSnapshot | null>(null);
  const [mediaPreviewResult, setMediaPreviewResult] = useState<MediaPreviewResult | null>(null);
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null);
  const [mediaPreviewScope, setMediaPreviewScope] = useState<MediaPreviewScope>('all');
  const [isThumbnailDialogVisible, setIsThumbnailDialogVisible] = useState(false);
  const [previewClipJobId, setPreviewClipJobId] = useState<string | null>(null);
  const [previewClipProgress, setPreviewClipProgress] = useState<PreviewClipJobSnapshot | null>(null);
  const [previewClipResult, setPreviewClipResult] = useState<PreviewClipResult | null>(null);
  const [previewClipError, setPreviewClipError] = useState<string | null>(null);
  const [premiereStatus, setPremiereStatus] = useState<PremiereStatusResponse | null>(null);
  const [premiereStatusError, setPremiereStatusError] = useState<string | null>(null);
  const [isPremiereStatusLoading, setIsPremiereStatusLoading] = useState(false);
  const [isPremiereImportSubmitting, setIsPremiereImportSubmitting] = useState(false);
  const [premiereImportResult, setPremiereImportResult] = useState<PremiereRequestResponse | null>(null);
  const [premiereImportError, setPremiereImportError] = useState<string | null>(null);
  const pendingAuditRequestRef = useRef<AuditRequest | null>(null);

  const applyAuditResult = useCallback(
    async (
      result: AuditResult,
      request: AuditRequest | null,
      options: { persist: boolean; savedAt?: string; showThumbnails?: boolean }
    ): Promise<void> => {
      const normalizedRows = result.videos.map((row) => ({
        ...row,
        visible: row.visible !== false
      }));
      const normalizedResult = {
        ...result,
        videos: normalizedRows
      };

      setAuditResult(normalizedResult);
      setVideoRows(normalizedRows);
      setAuditSummary(normalizedResult.summary);
      setAuditErrors(normalizedResult.errors);
      setSelectedVideos([]);

      if (request) {
        setLastAuditRequest(request);
      }

      if (options.persist && request) {
        const storedState = await saveStoredAuditResult({
          request,
          result: normalizedResult,
          showThumbnails: options.showThumbnails ?? showThumbnailsState,
          savedAt: options.savedAt
        });

        setStorageSavedAt(storedState.savedAt);
        setStorageMessage(`Saved ${normalizedRows.length.toLocaleString()} flagged row(s).`);
      }
    },
    [showThumbnailsState]
  );

  useEffect(() => {
    let isMounted = true;

    window.videoAudit.app
      .getInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfo(info);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAppInfoMessage(getErrorMessage(error, 'Could not read app info.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshPremiereStatus = useCallback(async (): Promise<void> => {
    setIsPremiereStatusLoading(true);
    setPremiereStatusError(null);

    try {
      const status = await window.videoAudit.premiere.getStatus();
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

  useEffect(() => {
    void refreshPremiereStatus();
  }, [refreshPremiereStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState(): Promise<void> {
      try {
        const [loadedSettings, storedAudit] = await Promise.all([
          window.videoAudit.settings.get(),
          loadStoredAuditResult()
        ]);

        if (!isMounted) {
          return;
        }

        setSettings(loadedSettings);
        setOutputFolder(loadedSettings.defaultOutputDirectory);

        if (storedAudit) {
          setSelectedFolders(storedAudit.request.folderPaths);
          setSelectedFiles(storedAudit.request.filePaths);
          setAuditOptions(storedAudit.request.options);
          setShowThumbnailsState(storedAudit.showThumbnails);
          setStorageSavedAt(storedAudit.savedAt);
          setStorageMessage(`Restored saved audit from ${formatDateTime(storedAudit.savedAt)}.`);
          await applyAuditResult(storedAudit.result, storedAudit.request, {
            persist: false,
            savedAt: storedAudit.savedAt,
            showThumbnails: storedAudit.showThumbnails
          });
        } else {
          setAuditOptions(settingsToAuditOptions(loadedSettings));
        }
      } catch (error: unknown) {
        if (isMounted) {
          setSettingsMessage(getErrorMessage(error, 'Could not load settings.'));
        }
      } finally {
        if (isMounted) {
          setIsStorageLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.audit.onProgress((progress) => {
      setAuditProgress(progress);

      if (progress.jobId) {
        setAuditJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit stopped.');
      }

      if (progress.result) {
        void applyAuditResult(progress.result, pendingAuditRequestRef.current, { persist: true });
      }
    });
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.discovery.onProgress((progress) => {
      setDiscoveryProgress(progress);

      if (progress.jobId) {
        setDiscoveryJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery stopped.');
      }
    });
  }, []);

  useEffect(() => {
    return window.videoAudit.ffprobe.onProgress((progress) => {
      setFfprobeProgress(progress);

      if (progress.jobId) {
        setFfprobeJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction stopped.');
      }
    });
  }, []);

  const visibleVideoRows = useMemo(
    () => (videoRows ?? []).filter((row) => row.visible !== false),
    [videoRows]
  );
  const removedVideoCount = (videoRows?.length ?? 0) - visibleVideoRows.length;
  const isAuditActive = auditProgress?.status === 'starting' || auditProgress?.status === 'running';
  const isDiscoveryActive =
    activeAction === 'discovery' ||
    discoveryProgress?.status === 'starting' ||
    discoveryProgress?.status === 'running';
  const isFfprobeActive =
    activeAction === 'ffprobe' ||
    ffprobeProgress?.status === 'starting' ||
    ffprobeProgress?.status === 'running';
  const isAutoFixActive =
    activeAction === 'autoFix' ||
    autoFixProgress?.status === 'starting' ||
    autoFixProgress?.status === 'running';
  const isAutoCropActive =
    activeAction === 'autoCrop' ||
    autoCropProgress?.status === 'starting' ||
    autoCropProgress?.status === 'running';
  const isMediaPreviewActive =
    activeAction === 'mediaPreview' ||
    mediaPreviewProgress?.status === 'starting' ||
    mediaPreviewProgress?.status === 'running';
  const isPreviewClipActive =
    activeAction === 'previewClip' ||
    previewClipProgress?.status === 'starting' ||
    previewClipProgress?.status === 'running';
  const isPremiereImportActive = activeAction === 'premiereImport' || isPremiereImportSubmitting;
  const auditPercent = getProgressPercent(auditProgress?.processedFiles, auditProgress?.totalFiles);
  const discoveryPercent = getProgressPercent(
    discoveryProgress?.processedFiles,
    discoveryProgress?.totalFiles
  );
  const ffprobePercent = getProgressPercent(ffprobeProgress?.processedFiles, ffprobeProgress?.totalFiles);
  const autoFixPercent = getProgressPercent(autoFixProgress?.processedVideos, autoFixProgress?.totalVideos);
  const autoCropPercent = getProgressPercent(autoCropProgress?.processedFiles, autoCropProgress?.totalFiles);
  const mediaPreviewPercent = getProgressPercent(
    mediaPreviewProgress?.processedVideos,
    mediaPreviewProgress?.totalVideos
  );
  const previewClipPercent = getProgressPercent(
    previewClipProgress?.processedClips,
    previewClipProgress?.totalClips
  );
  const discoveredPaths = discoveryProgress?.result?.files.map((file) => file.path) ?? [];
  const metadataItems = ffprobeProgress?.result?.items ?? [];
  const autoFixOutputDirectory = outputFolder ?? settings?.defaultAutoFixDestinationRoot ?? null;
  const autoCropOutputRootDir = outputFolder ?? settings?.defaultOutputDirectory ?? null;
  const canRunAudit =
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive &&
    (selectedFolders.length > 0 || selectedFiles.length > 0) &&
    (auditOptions.includeLowResolutionAnalysis || auditOptions.includeBlackBorderAnalysis);
  const canRefreshAudit =
    Boolean(lastAuditRequest) &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive;
  const canAutoFixSelected =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive;
  const canOpenCropOptions =
    selectedVideos.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive;
  const canGenerateThumbnails =
    visibleVideoRows.length > 0 &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive;
  const canEditSelectedInPremiere =
    selectedVideos.length > 0 &&
    premiereStatus?.status === 'ready' &&
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    !isAutoFixActive &&
    !isAutoCropActive &&
    !isMediaPreviewActive &&
    !isPreviewClipActive &&
    !isPremiereImportActive;

  const persistSettings = useCallback(async (partialSettings: AppSettingsUpdate): Promise<AppSettings | null> => {
    setActiveAction('settings');

    try {
      const updatedSettings = await window.videoAudit.settings.update(partialSettings);
      setSettings(updatedSettings);
      setSettingsMessage('Settings saved.');
      return updatedSettings;
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not save settings.'));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, []);

  const handleSelectionResult = useCallback(
    async (result: PathSelectionResult, onValidPaths: (paths: string[]) => void): Promise<void> => {
      if (result.canceled) {
        setSelectionMessage(null);
        return;
      }

      onValidPaths(result.paths);
      setSelectionMessage(
        result.invalidPaths.length > 0
          ? `${result.invalidPaths.length} selected path(s) could not be used.`
          : null
      );
    },
    []
  );

  const chooseFolders = useCallback(async (): Promise<void> => {
    setActiveAction('folders');

    try {
      const result = await window.videoAudit.dialog.chooseFolders();
      await handleSelectionResult(result, setSelectedFolders);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths(result.paths, settings?.recentFolders ?? []),
          latestSelectedFolder: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose folders.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFolders]);

  const chooseFiles = useCallback(async (): Promise<void> => {
    setActiveAction('files');

    try {
      const result = await window.videoAudit.dialog.chooseVideoFiles();
      await handleSelectionResult(result, setSelectedFiles);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFiles: mergeRecentPaths(result.paths, settings?.recentFiles ?? [])
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose files.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFiles]);

  const chooseOutputFolder = useCallback(async (): Promise<void> => {
    setActiveAction('output');

    try {
      const result = await window.videoAudit.dialog.chooseOutputFolder();
      await handleSelectionResult(result, (paths) => setOutputFolder(paths[0] ?? null));

      if (!result.canceled && result.paths[0]) {
        await persistSettings({
          defaultOutputDirectory: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose an output folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings]);

  const revealPath = useCallback(async (path: string): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await window.videoAudit.shell.revealPath(path);
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that path in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that path in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const updateSettingsField = useCallback(
    async <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): Promise<void> => {
      await persistSettings({ [key]: value } as AppSettingsUpdate);
    },
    [persistSettings]
  );

  const updateAuditOption = useCallback(
    async <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]): Promise<void> => {
      const nextOptions = {
        ...auditOptions,
        [key]: value
      };

      setAuditOptions(nextOptions);

      if (key === 'includeSubfolders') {
        await persistSettings({ includeSubfoldersDefault: Boolean(value) });
      }

      if (key === 'includeLowResolutionAnalysis') {
        await persistSettings({ lowResolutionAnalysisEnabledDefault: Boolean(value) });
      }

      if (key === 'includeBlackBorderAnalysis') {
        await persistSettings({ blackBorderAnalysisEnabledDefault: Boolean(value) });
      }
    },
    [auditOptions, persistSettings]
  );

  const resetSettings = useCallback(async (): Promise<void> => {
    setActiveAction('settings');

    try {
      const reset = await window.videoAudit.settings.reset();
      setSettings(reset);
      setOutputFolder(reset.defaultOutputDirectory);
      setAuditOptions(settingsToAuditOptions(reset));
      setSettingsMessage('Settings reset.');
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not reset settings.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const startAuditRequest = useCallback(async (request: AuditRequest): Promise<void> => {
    setWorkflowMessage(null);
    setAuditProgress(null);
    setAuditResult(null);
    setAuditSummary(null);
    setAuditErrors([]);
    setVideoRows(null);
    setSelectedVideos([]);
    setActiveAction(null);
    pendingAuditRequestRef.current = request;
    setLastAuditRequest(request);

    const response = await window.videoAudit.audit.start(request);

    if (response.status !== 'started' || !response.jobId) {
      setWorkflowMessage(response.message ?? 'Could not start audit.');
      return;
    }

    setAuditJobId(response.jobId);
    setWorkflowMessage(response.message ?? 'Audit started.');
  }, []);

  const runAudit = useCallback(async (): Promise<void> => {
    const request = {
      folderPaths: selectedFolders,
      filePaths: selectedFiles,
      options: auditOptions
    };

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before running an audit.');
      return;
    }

    if (!request.options.includeLowResolutionAnalysis && !request.options.includeBlackBorderAnalysis) {
      setWorkflowMessage('At least one audit option must be selected.');
      return;
    }

    try {
      await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not start audit.'));
    }
  }, [auditOptions, selectedFiles, selectedFolders, startAuditRequest]);

  const refreshAudit = useCallback(async (): Promise<void> => {
    if (!lastAuditRequest) {
      setWorkflowMessage('No saved audit request is available.');
      return;
    }

    setSelectedFolders(lastAuditRequest.folderPaths);
    setSelectedFiles(lastAuditRequest.filePaths);
    setAuditOptions(lastAuditRequest.options);

    try {
      await startAuditRequest(lastAuditRequest);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not refresh audit.'));
    }
  }, [lastAuditRequest, startAuditRequest]);

  const cancelAudit = useCallback(async (): Promise<void> => {
    if (!auditJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.audit.cancel(auditJobId);
      setAuditProgress(progress);
      setWorkflowMessage(progress.message ?? 'Audit canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel audit.'));
    }
  }, [auditJobId]);

  const persistCurrentResult = useCallback(
    async (nextResult: AuditResult, thumbnailValue = showThumbnailsState): Promise<void> => {
      if (!lastAuditRequest) {
        return;
      }

      const storedState = await saveStoredAuditResult({
        request: lastAuditRequest,
        result: nextResult,
        showThumbnails: thumbnailValue
      });

      setStorageSavedAt(storedState.savedAt);
      setStorageMessage(`Saved ${nextResult.videos.length.toLocaleString()} flagged row(s).`);
    },
    [lastAuditRequest, showThumbnailsState]
  );

  const hideVideoPathsFromTable = useCallback(
    async (paths: string[]): Promise<number> => {
      if (!auditResult || paths.length === 0) {
        return 0;
      }

      const pathSet = new Set(paths);
      let hiddenCount = 0;
      const nextRows = auditResult.videos.map((row) => {
        if (!pathSet.has(row.path) || row.visible === false) {
          return row;
        }

        hiddenCount += 1;
        return {
          ...row,
          visible: false
        };
      });

      if (hiddenCount === 0) {
        return 0;
      }

      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) =>
        currentSelection.filter((video) => !pathSet.has(video.path))
      );
      await persistCurrentResult(nextResult);

      return hiddenCount;
    },
    [auditResult, persistCurrentResult]
  );

  useEffect(() => {
    return window.videoAudit.autoFix.onProgress((progress) => {
      setAutoFixProgress(progress);

      if (progress.jobId) {
        setAutoFixJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoFix');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoFixResult(progress.result);
        setAutoFixError(null);

        const succeededPaths = progress.result.items
          .filter((item) => item.status === 'success' && item.sourcePath)
          .map((item) => item.sourcePath as string);

        void hideVideoPathsFromTable(succeededPaths).then((hiddenCount) => {
          const removedText =
            hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} video(s) were removed from the table.` : '';
          setWorkflowMessage(`Auto-Fix complete.${removedText}`);
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoFixError(progress.error ?? progress.message ?? 'Auto-Fix failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Fix failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoFixError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      }
    });
  }, [hideVideoPathsFromTable]);

  useEffect(() => {
    return window.videoAudit.autoCrop.onProgress((progress) => {
      setAutoCropProgress(progress);

      if (progress.jobId) {
        setAutoCropJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('autoCrop');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setAutoCropResult(progress.result);
        setAutoCropError(null);
        const croppedCount = progress.result.summary.succeeded;
        const croppedLabel = croppedCount === 1 ? 'cropped copy' : 'cropped copies';
        setWorkflowMessage(
          `Auto-Crop complete. ${croppedCount.toLocaleString()} ${croppedLabel} created.`
        );
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setAutoCropError(progress.error ?? progress.message ?? 'Auto-Crop failed.');
        setWorkflowMessage(progress.message ?? 'Auto-Crop failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setAutoCropError(null);
        setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      }
    });
  }, []);

  const applyMediaPreviewResult = useCallback(
    async (result: MediaPreviewResult): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergeMediaPreviewItems(auditResult.videos, result.items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergeMediaPreviewItems(currentSelection, result.items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult]
  );

  const applyPreviewClipResult = useCallback(
    async (result: PreviewClipResult): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergePreviewClipItems(auditResult.videos, result.items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergePreviewClipItems(currentSelection, result.items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult]
  );

  useEffect(() => {
    return window.videoAudit.mediaPreview.onProgress((progress) => {
      setMediaPreviewProgress(progress);

      if (progress.jobId) {
        setMediaPreviewJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('mediaPreview');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setMediaPreviewResult(progress.result);
        setMediaPreviewError(null);
        void applyMediaPreviewResult(progress.result).then(() => {
          setWorkflowMessage(
            `Thumbnail generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setMediaPreviewError(progress.error ?? progress.message ?? 'Thumbnail generation failed.');
        setWorkflowMessage(progress.message ?? 'Thumbnail generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setMediaPreviewError(null);
        setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      }
    });
  }, [applyMediaPreviewResult]);

  useEffect(() => {
    return window.videoAudit.mediaPreview.onClipProgress((progress) => {
      setPreviewClipProgress(progress);

      if (progress.jobId) {
        setPreviewClipJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('previewClip');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setPreviewClipResult(progress.result);
        setPreviewClipError(null);
        void applyPreviewClipResult(progress.result).then(() => {
          setWorkflowMessage(
            `Preview clip generation complete. ${progress.result?.summary.generated.toLocaleString() ?? '0'} generated, ${progress.result?.summary.cached.toLocaleString() ?? '0'} cached.`
          );
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setPreviewClipError(progress.error ?? progress.message ?? 'Preview clip generation failed.');
        setWorkflowMessage(progress.message ?? 'Preview clip generation failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setPreviewClipError(null);
        setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      }
    });
  }, [applyPreviewClipResult]);

  const removeSelectedVideos = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      return;
    }

    await hideVideoPathsFromTable(selectedVideos.map((video) => video.path));
  }, [hideVideoPathsFromTable, selectedVideos]);

  const restoreRemovedVideos = useCallback(async (): Promise<void> => {
    if (!auditResult) {
      return;
    }

    const nextRows = auditResult.videos.map((row) => ({ ...row, visible: true }));
    const nextResult = {
      ...auditResult,
      videos: nextRows
    };

    setAuditResult(nextResult);
    setVideoRows(nextRows);
    await persistCurrentResult(nextResult);
  }, [auditResult, persistCurrentResult]);

  const setShowThumbnails = useCallback(
    async (value: boolean): Promise<void> => {
      setShowThumbnailsState(value);

      if (auditResult) {
        await persistCurrentResult(auditResult, value);
      }
    },
    [auditResult, persistCurrentResult]
  );

  const clearAuditData = useCallback(async (): Promise<void> => {
    await clearStoredAuditResult();
    setAuditJobId(null);
    setAuditProgress(null);
    setAuditResult(null);
    setAuditSummary(null);
    setAuditErrors([]);
    setVideoRows(null);
    setSelectedVideos([]);
    setGlobalFilter('');
    setSelectedFolders([]);
    setSelectedFiles([]);
    setDiscoveryProgress(null);
    setFfprobeProgress(null);
    setAutoFixJobId(null);
    setAutoFixProgress(null);
    setAutoFixResult(null);
    setAutoFixError(null);
    setIsAutoFixDialogVisible(false);
    setAutoCropJobId(null);
    setAutoCropProgress(null);
    setAutoCropResult(null);
    setAutoCropError(null);
    setIsAutoCropDialogVisible(false);
    setMediaPreviewJobId(null);
    setMediaPreviewProgress(null);
    setMediaPreviewResult(null);
    setMediaPreviewError(null);
    setIsThumbnailDialogVisible(false);
    setPreviewClipJobId(null);
    setPreviewClipProgress(null);
    setPreviewClipResult(null);
    setPreviewClipError(null);
    setPremiereImportResult(null);
    setPremiereImportError(null);
    setIsPremiereImportSubmitting(false);
    setLastAuditRequest(null);
    pendingAuditRequestRef.current = null;
    setStorageSavedAt(null);
    setStorageMessage('Audit data cleared.');
    setWorkflowMessage(null);
  }, []);

  const startDiscovery = useCallback(async (): Promise<void> => {
    const request: FileDiscoveryRequest = {
      folderPaths: selectedFolders,
      filePaths: selectedFiles,
      includeSubfolders: auditOptions.includeSubfolders
    };

    setWorkflowMessage(null);
    setDiscoveryProgress(null);

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before scanning.');
      return;
    }

    setActiveAction('discovery');

    try {
      const response = await window.videoAudit.discovery.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start file discovery.');
        return;
      }

      setDiscoveryJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'File discovery started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start file discovery.'));
    }
  }, [auditOptions.includeSubfolders, selectedFiles, selectedFolders]);

  const cancelDiscovery = useCallback(async (): Promise<void> => {
    if (!discoveryJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.discovery.cancel(discoveryJobId);
      setDiscoveryProgress(progress);
      setWorkflowMessage(progress.message ?? 'File discovery canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel file discovery.'));
    }
  }, [discoveryJobId]);

  const startFfprobe = useCallback(async (): Promise<void> => {
    const request: FfprobeMetadataRequest = {
      filePaths: discoveredPaths,
      ffprobePathOverride: settings?.ffprobePathOverride ?? null
    };

    setWorkflowMessage(null);
    setFfprobeProgress(null);

    if (request.filePaths.length === 0) {
      setWorkflowMessage('Scan files before running metadata extraction.');
      return;
    }

    setActiveAction('ffprobe');

    try {
      const response = await window.videoAudit.ffprobe.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start metadata extraction.');
        return;
      }

      setFfprobeJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Metadata extraction started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start metadata extraction.'));
    }
  }, [discoveredPaths, settings?.ffprobePathOverride]);

  const cancelFfprobe = useCallback(async (): Promise<void> => {
    if (!ffprobeJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.ffprobe.cancel(ffprobeJobId);
      setFfprobeProgress(progress);
      setWorkflowMessage(progress.message ?? 'Metadata extraction canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel metadata extraction.'));
    }
  }, [ffprobeJobId]);

  const openAutoFixDialog = useCallback((): void => {
    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress(null);
    setIsAutoFixDialogVisible(true);

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
    }
  }, [autoFixOutputDirectory]);

  const closeAutoFixDialog = useCallback((): void => {
    if (isAutoFixActive) {
      return;
    }

    setIsAutoFixDialogVisible(false);
    setAutoFixError(null);
  }, [isAutoFixActive]);

  const startAutoFix = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoFixError('Select at least one video before running Auto-Fix.');
      return;
    }

    if (!autoFixOutputDirectory) {
      setAutoFixError('Choose an output folder before running Auto-Fix.');
      return;
    }

    setAutoFixError(null);
    setAutoFixResult(null);
    setAutoFixProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: selectedVideos.length,
      processedVideos: 0,
      currentFile: null,
      currentProfile: null,
      currentAction: null,
      message: 'Starting Auto-Fix.',
      succeeded: 0,
      failed: 0,
      outputDirectory: autoFixOutputDirectory,
      error: null
    });
    setActiveAction('autoFix');

    try {
      const response = await window.videoAudit.autoFix.start({
        videos: selectedVideos,
        outputDirectory: autoFixOutputDirectory
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoFixError(response.message ?? 'Could not start Auto-Fix.');
        return;
      }

      setAutoFixJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Fix started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoFixError(getErrorMessage(error, 'Could not start Auto-Fix.'));
    }
  }, [autoFixOutputDirectory, selectedVideos]);

  const cancelAutoFix = useCallback(async (): Promise<void> => {
    if (!autoFixJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.autoFix.cancel(autoFixJobId);
      setAutoFixProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Fix canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoFixError(getErrorMessage(error, 'Could not cancel Auto-Fix.'));
    }
  }, [autoFixJobId]);

  const openAutoCropDialog = useCallback((): void => {
    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress(null);
    setIsAutoCropDialogVisible(true);

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
    }
  }, [autoCropOutputRootDir]);

  const closeAutoCropDialog = useCallback((): void => {
    if (isAutoCropActive) {
      return;
    }

    setIsAutoCropDialogVisible(false);
    setAutoCropError(null);
  }, [isAutoCropActive]);

  const startAutoCrop = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setAutoCropError('Select at least one video before running Auto-Crop.');
      return;
    }

    if (!autoCropOutputRootDir) {
      setAutoCropError('Choose an output folder before running Auto-Crop.');
      return;
    }

    setAutoCropError(null);
    setAutoCropResult(null);
    setAutoCropProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      outputRootDir: autoCropOutputRootDir,
      outputDir: null,
      totalFiles: selectedVideos.length,
      processedFiles: 0,
      succeededCount: 0,
      skippedCount: 0,
      errorCount: 0,
      currentFile: null,
      message: 'Starting Auto-Crop.',
      error: null
    });
    setActiveAction('autoCrop');

    try {
      const response = await window.videoAudit.autoCrop.start({
        videos: selectedVideos,
        outputRootDir: autoCropOutputRootDir
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setAutoCropError(response.message ?? 'Could not start Auto-Crop.');
        return;
      }

      setAutoCropJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Auto-Crop started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setAutoCropError(getErrorMessage(error, 'Could not start Auto-Crop.'));
    }
  }, [autoCropOutputRootDir, selectedVideos]);

  const cancelAutoCrop = useCallback(async (): Promise<void> => {
    if (!autoCropJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.autoCrop.cancel(autoCropJobId);
      setAutoCropProgress(progress);
      setWorkflowMessage(progress.message ?? 'Auto-Crop canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setAutoCropError(getErrorMessage(error, 'Could not cancel Auto-Crop.'));
    }
  }, [autoCropJobId]);

  const openThumbnailDialog = useCallback((): void => {
    if (visibleVideoRows.length === 0) {
      setWorkflowMessage('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewScope(selectedVideos.length > 0 ? 'selected' : 'all');
    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress(null);
    setIsThumbnailDialogVisible(true);
  }, [selectedVideos.length, visibleVideoRows.length]);

  const closeThumbnailDialog = useCallback((): void => {
    if (isMediaPreviewActive) {
      return;
    }

    setIsThumbnailDialogVisible(false);
    setMediaPreviewError(null);
  }, [isMediaPreviewActive]);

  const startThumbnailGeneration = useCallback(async (): Promise<void> => {
    const rows = mediaPreviewScope === 'selected' && selectedVideos.length > 0 ? selectedVideos : visibleVideoRows;

    if (rows.length === 0) {
      setMediaPreviewError('No videos are available for thumbnail generation.');
      return;
    }

    setMediaPreviewError(null);
    setMediaPreviewResult(null);
    setMediaPreviewProgress({
      jobId: null,
      status: 'starting',
      phase: 'validating',
      totalVideos: rows.length,
      processedVideos: 0,
      generatedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      currentFile: null,
      message: 'Starting thumbnail generation.',
      error: null
    });
    setActiveAction('mediaPreview');

    try {
      const response = await window.videoAudit.mediaPreview.start({
        videos: rows,
        mode: 'thumbnail'
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setMediaPreviewError(response.message ?? 'Could not start thumbnail generation.');
        return;
      }

      setMediaPreviewJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Thumbnail generation started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setMediaPreviewError(getErrorMessage(error, 'Could not start thumbnail generation.'));
    }
  }, [mediaPreviewScope, selectedVideos, visibleVideoRows]);

  const cancelThumbnailGeneration = useCallback(async (): Promise<void> => {
    if (!mediaPreviewJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.mediaPreview.cancel(mediaPreviewJobId);
      setMediaPreviewProgress(progress);
      setWorkflowMessage(progress.message ?? 'Thumbnail generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setMediaPreviewError(getErrorMessage(error, 'Could not cancel thumbnail generation.'));
    }
  }, [mediaPreviewJobId]);

  const startPreviewClipGeneration = useCallback(
    async (video: VideoRow, frames: VideoPreviewFrame[]): Promise<void> => {
      if (!video) {
        setPreviewClipError('Choose a video before generating preview clips.');
        return;
      }

      setPreviewClipError(null);
      setPreviewClipResult(null);
      setPreviewClipProgress({
        jobId: null,
        status: 'starting',
        phase: 'validating',
        totalClips: frames.length || null,
        processedClips: 0,
        generatedCount: 0,
        cachedCount: 0,
        failedCount: 0,
        currentFile: video.fileName,
        currentTimestampLabel: null,
        message: 'Starting preview clip generation.',
        error: null
      });
      setActiveAction('previewClip');

      try {
        const response = await window.videoAudit.mediaPreview.startClipGeneration({
          video,
          frames,
          clipDurationSeconds: settings?.previewClipDurationSecondsDefault ?? 5,
          width: settings?.previewClipWidthDefault ?? 640
        });

        if (response.status !== 'started' || !response.jobId) {
          setActiveAction(null);
          setPreviewClipError(response.message ?? 'Could not start preview clip generation.');
          return;
        }

        setPreviewClipJobId(response.jobId);
        setWorkflowMessage(response.message ?? 'Preview clip generation started.');
      } catch (error: unknown) {
        setActiveAction(null);
        setPreviewClipError(getErrorMessage(error, 'Could not start preview clip generation.'));
      }
    },
    [settings?.previewClipDurationSecondsDefault, settings?.previewClipWidthDefault]
  );

  const cancelPreviewClipGeneration = useCallback(async (): Promise<void> => {
    if (!previewClipJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.mediaPreview.cancelClipGeneration(previewClipJobId);
      setPreviewClipProgress(progress);
      setWorkflowMessage(progress.message ?? 'Preview clip generation canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setPreviewClipError(getErrorMessage(error, 'Could not cancel preview clip generation.'));
    }
  }, [previewClipJobId]);

  const editSelectedInPremiere = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
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
      const response = await window.videoAudit.premiere.createImportRequest({
        videos: selectedVideos.map(toPremiereRequestVideo)
      });

      if (response.premiereStatus) {
        setPremiereStatus(response.premiereStatus);
      }

      if (response.status !== 'queued' || !response.requestId) {
        throw new Error(response.message ?? 'Unable to import selected videos into Premiere.');
      }

      setPremiereImportResult(response);
      const importedCount = selectedVideos.length;
      const hiddenCount = await hideVideoPathsFromTable(selectedVideos.map((video) => video.path));
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
  }, [hideVideoPathsFromTable, premiereStatus?.status, refreshPremiereStatus, selectedVideos]);

  return {
    appInfo,
    appInfoMessage,
    settings,
    settingsMessage,
    selectionMessage,
    workflowMessage,
    activeAction,
    selectedFolders,
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
    globalFilter,
    showThumbnails: showThumbnailsState,
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
    premiereStatus,
    premiereStatusError,
    isPremiereStatusLoading,
    isPremiereImportSubmitting,
    premiereImportResult,
    premiereImportError,
    canEditSelectedInPremiere,
    canGenerateThumbnails,
    chooseFolders,
    chooseFiles,
    chooseOutputFolder,
    revealPath,
    updateAuditOption,
    updateSettingsField,
    resetSettings,
    runAudit,
    refreshAudit,
    cancelAudit,
    clearAuditData,
    removeSelectedVideos,
    restoreRemovedVideos,
    setSelectedVideos,
    setGlobalFilter,
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
    startPreviewClipGeneration,
    cancelPreviewClipGeneration,
    refreshPremiereStatus,
    editSelectedInPremiere
  };
}

function mergeMediaPreviewItems(rows: VideoRow[], items: MediaPreviewResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, MediaPreviewResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    const nextRow: VideoRow = {
      ...row,
      thumbnail: item.thumbnail
    };

    if (item.previewFrames) {
      nextRow.previewFrames = item.previewFrames.frames;
      nextRow.previewFrameBatchId = item.previewFrames.batchId;
      nextRow.maxPreviewFrameCount = item.previewFrames.maxPreviewFrameCount;
    }

    return nextRow;
  });
}

function mergePreviewClipItems(rows: VideoRow[], items: PreviewClipResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, PreviewClipResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    return {
      ...row,
      previewFrames: mergePreviewFrames(row.previewFrames ?? [], item.previewFrames),
      previewFrameBatchId: row.previewFrameBatchId ?? item.previewFrames[0]?.batchId,
      maxPreviewFrameCount: row.maxPreviewFrameCount ?? item.previewFrames.length
    };
  });
}

function mergePreviewFrames(
  existingFrames: VideoPreviewFrame[],
  incomingFrames: VideoPreviewFrame[]
): VideoPreviewFrame[] {
  if (existingFrames.length === 0) {
    return incomingFrames;
  }

  const incomingByKey = new Map(incomingFrames.map((frame) => [getPreviewFrameKey(frame), frame]));
  const mergedFrames = existingFrames.map((frame) => {
    const incoming = incomingByKey.get(getPreviewFrameKey(frame));

    if (!incoming) {
      return frame;
    }

    incomingByKey.delete(getPreviewFrameKey(frame));
    return {
      ...frame,
      thumbnail: incoming.thumbnail ?? frame.thumbnail,
      previewClip: incoming.previewClip ?? frame.previewClip
    };
  });

  return [...mergedFrames, ...incomingByKey.values()];
}

function getPreviewFrameKey(frame: VideoPreviewFrame): string {
  return `${frame.batchId}:${frame.index}:${frame.timestampSeconds}`;
}

function toPremiereRequestVideo(row: VideoRow): PremiereRequestVideo {
  return {
    id: row.id ?? row.path,
    fileName: row.fileName,
    absolutePath: row.path,
    directory: row.directory,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    displayAspectRatio: row.displayAspectRatio || null,
    frameRate: row.frameRate
  };
}

function settingsToAuditOptions(settings: AppSettings): AuditOptions {
  return {
    ...DEFAULT_AUDIT_OPTIONS,
    includeSubfolders: settings.includeSubfoldersDefault,
    includeLowResolutionAnalysis: settings.lowResolutionAnalysisEnabledDefault,
    includeBlackBorderAnalysis: settings.blackBorderAnalysisEnabledDefault
  };
}

function mergeRecentPaths(nextPaths: string[], currentPaths: string[]): string[] {
  return [...new Set([...nextPaths, ...currentPaths])].slice(0, 10);
}

function getProgressPercent(processedFiles?: number, totalFiles?: number | null): number | null {
  if (!totalFiles || totalFiles <= 0 || processedFiles === undefined) {
    return null;
  }

  return Math.min(100, Math.round((processedFiles / totalFiles) * 100));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
