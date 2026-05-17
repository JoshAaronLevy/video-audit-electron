export type PremiereStatusCode = 'ready' | 'premiere_not_running' | 'bridge_disconnected' | 'error';

export interface PremierePreset {
  id: string;
  label: string;
  resolution: string;
  presetFileName?: string;
  available?: boolean;
  unavailableReason?: string;
  unavailableMessage?: string;
}

export interface PremiereStatusResponse {
  status: PremiereStatusCode;
  message: string;
  premiere?: {
    running: boolean | null;
    reason?: string;
    message?: string;
  };
  bridge?: {
    connected: boolean;
    status?: string | null;
    reason?: string;
    updatedAt?: string | null;
    activeProjectName?: string | null;
    activeProjectPath?: string | null;
    outputDirectory?: string | null;
  };
  bridgeDir?: string;
  outputDirectory?: string;
  presets?: PremierePreset[];
}

export interface PremiereRequestVideo {
  id: string;
  fileName: string;
  absolutePath: string;
  directory: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  displayAspectRatio: string | null;
  frameRate: number | null;
}

export interface PremiereExportRequest {
  presetId: string;
  videos: PremiereRequestVideo[];
}

export interface PremiereImportRequest {
  videos: PremiereRequestVideo[];
}

export interface PremiereRequestResponse {
  status: string;
  requestId?: string;
  message?: string;
  premiereStatus?: PremiereStatusResponse;
}

export interface PremiereBridgeRequestFile {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  videos: PremiereRequestVideo[];
  presetId?: string;
  presetFileName?: string;
  outputDirectory?: string;
}
