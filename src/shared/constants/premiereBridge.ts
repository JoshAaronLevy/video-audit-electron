export const PREMIERE_BRIDGE_PLUGIN_ID = 'video-audit-premiere-bridge';
export const DEFAULT_PREMIERE_BRIDGE_DIR = '~/VideoAudit/premiere-bridge';
export const DEFAULT_PREMIERE_EXPORT_OUTPUT_DIR = '/Users/joshlevy/Movies/Edited';
export const PREMIERE_EXPORT_PROJECT_BIN_NAME = 'Video Audit Exports';

export const PREMIERE_REQUEST_TYPES = {
  exportSelectedVideos: 'export-selected-videos',
  importSelectedVideos: 'import-selected-videos'
} as const;

export const PREMIERE_BRIDGE_FILE_NAMES = {
  status: 'status.json'
} as const;

export const PREMIERE_BRIDGE_DIRECTORY_NAMES = {
  requests: 'requests',
  completed: 'completed',
  failed: 'failed',
  presets: 'presets',
  imports: 'imports'
} as const;

export const PREMIERE_BRIDGE_STATUS = {
  ready: 'ready',
  notReady: 'not_ready',
  error: 'error'
} as const;

export const PREMIERE_REQUEST_LIFECYCLE_STATE = {
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed'
} as const;

export const DEFAULT_PREMIERE_HEARTBEAT_MAX_AGE_MS = 30_000;
export const MAX_PREMIERE_REQUEST_VIDEOS = 100;

export const PREMIERE_EXPORT_PRESETS = [
  {
    id: 'video-audit-preset-1080p-5mbps',
    label: 'video-audit-preset-1080p-5mbps',
    resolution: '1920x1080',
    presetFileName: 'video-audit-preset-1080p-5mbps.epr'
  }
] as const;
