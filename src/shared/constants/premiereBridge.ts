export const PREMIERE_BRIDGE_PLUGIN_ID = 'collie-video-premiere-bridge';
export const DEFAULT_PREMIERE_BRIDGE_DIR = '~/Library/Application Support/CollieVideo/premiere-bridge';

export const PREMIERE_REQUEST_TYPES = {
  importSelectedVideos: 'import-selected-videos'
} as const;

export const PREMIERE_BRIDGE_FILE_NAMES = {
  status: 'status.json'
} as const;

export const PREMIERE_BRIDGE_DIRECTORY_NAMES = {
  requests: 'requests',
  completed: 'completed',
  failed: 'failed',
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
