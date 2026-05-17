import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/ipcChannels';
import type { AppInfo } from '../shared/types/app';
import type {
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest,
  FileDiscoveryStartResponse,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest,
  FfprobeMetadataStartResponse
} from '../shared/types/audit';
import type { PathSelectionResult, RevealPathResult } from '../shared/types/dialog';
import type { AppSettings, AppSettingsUpdate } from '../shared/types/settings';

export interface VideoAuditApi {
  app: {
    getInfo: () => Promise<AppInfo>;
  };
  dialog: {
    chooseFolders: () => Promise<PathSelectionResult>;
    chooseVideoFiles: () => Promise<PathSelectionResult>;
    chooseOutputFolder: () => Promise<PathSelectionResult>;
  };
  shell: {
    revealPath: (path: string) => Promise<RevealPathResult>;
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
  ffprobe: {
    start: (request: FfprobeMetadataRequest) => Promise<FfprobeMetadataStartResponse>;
    cancel: (jobId: string) => Promise<FfprobeMetadataJobSnapshot>;
    onProgress: (callback: (progress: FfprobeMetadataJobSnapshot) => void) => () => void;
  };
}

export const videoAuditApi: VideoAuditApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo)
  },
  dialog: {
    chooseFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseFolders),
    chooseVideoFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseVideoFiles),
    chooseOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseOutputFolder)
  },
  shell: {
    revealPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.shellRevealPath, path)
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
  }
};
