export type PremiereStatusCode = 'ready' | 'premiere_not_running' | 'bridge_disconnected' | 'error';

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
    ageMs?: number | null;
    updatedAt?: string | null;
    activeProjectName?: string | null;
    activeProjectPath?: string | null;
    outputDirectory?: string | null;
  };
  bridgeDir?: string;
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
  originalAbsolutePath?: string;
}

export interface PremiereImportRequest {
  videos: PremiereRequestVideo[];
}

export interface PremiereRequestResponse {
  status: string;
  requestId?: string;
  requestType?: string;
  requestPath?: string;
  message?: string;
  premiereStatus?: PremiereStatusResponse;
  details?: unknown;
}

export interface PremiereBridgeAppLaunchResult {
  app: 'premiere' | 'uxpDeveloperTool';
  label: string;
  status: 'opened' | 'failed' | 'unsupported';
  applicationName?: string;
  message?: string;
  attemptedApplicationNames?: string[];
}

export interface PremiereBridgeAppsLaunchResponse {
  status: 'opened' | 'partial' | 'unsupported' | 'error';
  message: string;
  bridgeDir: string;
  apps: PremiereBridgeAppLaunchResult[];
}

export interface PremiereBridgeRequestFile {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  videos: PremiereRequestVideo[];
}
