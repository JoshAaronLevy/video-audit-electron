import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile, copyFile, link } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, parse, resolve } from 'node:path';
import {
  DEFAULT_PREMIERE_BRIDGE_DIR,
  DEFAULT_PREMIERE_EXPORT_OUTPUT_DIR,
  DEFAULT_PREMIERE_HEARTBEAT_MAX_AGE_MS,
  MAX_PREMIERE_REQUEST_VIDEOS,
  PREMIERE_BRIDGE_DIRECTORY_NAMES,
  PREMIERE_BRIDGE_FILE_NAMES,
  PREMIERE_BRIDGE_PLUGIN_ID,
  PREMIERE_BRIDGE_STATUS,
  PREMIERE_EXPORT_PRESETS,
  PREMIERE_REQUEST_LIFECYCLE_STATE,
  PREMIERE_REQUEST_TYPES
} from '../../shared/constants/premiereBridge';
import type {
  PremiereBridgeRequestFile,
  PremiereImportRequest,
  PremierePreset,
  PremiereRequestResponse,
  PremiereRequestVideo,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import { runChildProcess } from '../utils/childProcess';

interface PremiereBridgePaths {
  bridgeDir: string;
  statusPath: string;
  requestsDir: string;
  completedDir: string;
  failedDir: string;
  presetsDir: string;
  importsDir: string;
  outputDirectory: string;
}

interface PremiereProcessStatus {
  running: boolean | null;
  processName?: string;
  pids?: string[];
  checkedProcessNames?: string[];
  reason?: string;
  message?: string;
}

interface BridgeStatusFileResult {
  ok: boolean;
  reason?: string;
  message?: string;
  status?: Record<string, unknown>;
}

interface StatusFreshness {
  fresh: boolean;
  ageMs: number | null;
  reason: string | null;
}

interface ValidationResult {
  ok: boolean;
  response?: PremiereRequestResponse;
}

export async function getPremiereStatus(): Promise<PremiereStatusResponse> {
  const paths = await ensurePremiereBridgeDirectories();
  const [premiere, statusFileResult] = await Promise.all([
    isPremiereRunning(),
    readStatusFile(paths.statusPath)
  ]);
  const baseResponse = {
    premiere,
    bridgeDir: paths.bridgeDir,
    outputDirectory: paths.outputDirectory,
    presets: serializeDeprecatedPresets()
  };

  if (premiere.running === false) {
    return {
      ...baseResponse,
      status: 'premiere_not_running',
      bridge: { connected: false },
      message: 'Premiere Pro is not open.'
    };
  }

  if (!statusFileResult.ok) {
    return {
      ...baseResponse,
      status: 'bridge_disconnected',
      bridge: serializeDisconnectedBridge(statusFileResult.reason ?? 'missing_status', statusFileResult),
      message:
        premiere.running === null
          ? 'Unable to confirm Premiere Pro is running, and the Video Audit bridge plugin is not connected.'
          : 'Premiere Pro is open, but the Video Audit bridge plugin is not connected.'
    };
  }

  const status = statusFileResult.status ?? {};
  const freshness = getStatusFreshness(status, getHeartbeatMaxAgeMs());
  let disconnectedReason: string | null = null;

  if (status.plugin !== PREMIERE_BRIDGE_PLUGIN_ID) {
    disconnectedReason = 'plugin_mismatch';
  } else if (status.status !== PREMIERE_BRIDGE_STATUS.ready) {
    disconnectedReason = 'plugin_not_ready';
  } else if (!freshness.fresh) {
    disconnectedReason = freshness.reason ?? 'stale_status';
  } else if (premiere.running !== true) {
    disconnectedReason = 'premiere_process_unknown';
  }

  if (disconnectedReason) {
    return {
      ...baseResponse,
      status: 'bridge_disconnected',
      bridge: serializeDisconnectedBridge(disconnectedReason, statusFileResult, freshness),
      message:
        disconnectedReason === 'premiere_process_unknown'
          ? 'Unable to confirm Premiere Pro is running.'
          : 'Premiere Pro is open, but the Video Audit bridge plugin is not connected.'
    };
  }

  return {
    ...baseResponse,
    status: 'ready',
    bridge: serializeReadyBridge(status, freshness.ageMs),
    message: 'Premiere bridge is ready.'
  };
}

export async function createPremiereImportRequest(
  request: Partial<PremiereImportRequest> | null | undefined
): Promise<PremiereRequestResponse> {
  const requestValidation = validateImportRequest(request);

  if (!requestValidation.ok && requestValidation.response) {
    return requestValidation.response;
  }

  const paths = await ensurePremiereBridgeDirectories();
  const videos = (request?.videos ?? []).map(toPremiereRequestVideo);
  const fileValidation = await validateSelectedVideoFiles(videos);

  if (!fileValidation.ok && fileValidation.response) {
    return fileValidation.response;
  }

  const premiereStatus = await getPremiereStatus();

  if (premiereStatus.status !== 'ready') {
    return {
      status: 'bridge_not_ready',
      message: premiereStatus.message,
      premiereStatus
    };
  }

  const requestId = randomUUID();
  const importVideos = await preparePremiereImportVideos({
    paths,
    requestId,
    videos
  });
  const bridgeRequest: PremiereBridgeRequestFile = {
    id: requestId,
    type: PREMIERE_REQUEST_TYPES.importSelectedVideos,
    status: PREMIERE_REQUEST_LIFECYCLE_STATE.queued,
    createdAt: new Date().toISOString(),
    videos: importVideos
  };
  const requestPath = await writePremiereBridgeRequest(paths, bridgeRequest);

  return {
    status: 'queued',
    requestId,
    requestType: PREMIERE_REQUEST_TYPES.importSelectedVideos,
    requestPath,
    message: 'Import request queued for Premiere.'
  };
}

export async function ensurePremiereBridgeDirectories(): Promise<PremiereBridgePaths> {
  const paths = getBridgePaths();

  await Promise.all([
    mkdir(paths.bridgeDir, { recursive: true }),
    mkdir(paths.requestsDir, { recursive: true }),
    mkdir(paths.completedDir, { recursive: true }),
    mkdir(paths.failedDir, { recursive: true }),
    mkdir(paths.presetsDir, { recursive: true }),
    mkdir(paths.importsDir, { recursive: true })
  ]);

  return paths;
}

function getBridgePaths(): PremiereBridgePaths {
  const bridgeDir = getPremiereBridgeDir();

  return {
    bridgeDir,
    statusPath: join(bridgeDir, PREMIERE_BRIDGE_FILE_NAMES.status),
    requestsDir: join(bridgeDir, PREMIERE_BRIDGE_DIRECTORY_NAMES.requests),
    completedDir: join(bridgeDir, PREMIERE_BRIDGE_DIRECTORY_NAMES.completed),
    failedDir: join(bridgeDir, PREMIERE_BRIDGE_DIRECTORY_NAMES.failed),
    presetsDir: join(bridgeDir, PREMIERE_BRIDGE_DIRECTORY_NAMES.presets),
    importsDir: join(bridgeDir, PREMIERE_BRIDGE_DIRECTORY_NAMES.imports),
    outputDirectory: DEFAULT_PREMIERE_EXPORT_OUTPUT_DIR
  };
}

function getPremiereBridgeDir(): string {
  const configuredBridgeDir = process.env.PREMIERE_BRIDGE_DIR?.trim();
  return resolve(expandHomePath(configuredBridgeDir || DEFAULT_PREMIERE_BRIDGE_DIR));
}

function getHeartbeatMaxAgeMs(): number {
  const configuredMaxAgeMs = Number(process.env.PREMIERE_BRIDGE_HEARTBEAT_MAX_MS);
  return Number.isFinite(configuredMaxAgeMs) && configuredMaxAgeMs > 0
    ? configuredMaxAgeMs
    : DEFAULT_PREMIERE_HEARTBEAT_MAX_AGE_MS;
}

function expandHomePath(value: string): string {
  if (value === '~') {
    return homedir();
  }

  if (value.startsWith('~/')) {
    return join(homedir(), value.slice(2));
  }

  return value;
}

async function isPremiereRunning(): Promise<PremiereProcessStatus> {
  const processNames = getPremiereProcessNames();
  let lastUnexpectedError: string | null = null;

  for (const processName of processNames) {
    const result = await runChildProcess('pgrep', ['-x', processName]);

    if (result.ok) {
      const pids = result.stdout.trim().split(/\s+/).filter(Boolean);

      if (pids.length > 0) {
        return {
          running: true,
          processName,
          pids
        };
      }
    }

    if (!result.ok && result.code !== 1) {
      lastUnexpectedError = result.error ?? result.stderr;
      break;
    }
  }

  if (lastUnexpectedError) {
    return {
      running: null,
      reason: 'process_check_failed',
      message: lastUnexpectedError || 'Unable to check whether Premiere Pro is running.'
    };
  }

  return {
    running: false,
    checkedProcessNames: processNames
  };
}

function getPremiereProcessNames(): string[] {
  const currentYear = new Date().getFullYear();
  const yearCandidates = [currentYear - 1, currentYear, currentYear + 1];

  return [
    'Adobe Premiere Pro',
    ...yearCandidates.map((year) => `Adobe Premiere Pro ${year}`)
  ];
}

async function readStatusFile(statusPath: string): Promise<BridgeStatusFileResult> {
  const rawStatus = await readFile(statusPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }).catch((error: unknown) => ({
    error
  }));

  if (rawStatus === null) {
    return {
      ok: false,
      reason: 'missing_status'
    };
  }

  if (typeof rawStatus !== 'string') {
    return {
      ok: false,
      reason: 'status_read_failed',
      message: rawStatus.error instanceof Error ? rawStatus.error.message : 'Unable to read bridge status.'
    };
  }

  try {
    const parsed = JSON.parse(rawStatus);

    if (!isRecord(parsed)) {
      return {
        ok: false,
        reason: 'invalid_status_json'
      };
    }

    return {
      ok: true,
      status: parsed
    };
  } catch {
    return {
      ok: false,
      reason: 'invalid_status_json'
    };
  }
}

function getStatusFreshness(status: Record<string, unknown>, heartbeatMaxAgeMs: number): StatusFreshness {
  if (typeof status.updatedAt !== 'string') {
    return {
      fresh: false,
      ageMs: null,
      reason: 'missing_updated_at'
    };
  }

  const updatedAtMs = Date.parse(status.updatedAt);

  if (!Number.isFinite(updatedAtMs)) {
    return {
      fresh: false,
      ageMs: null,
      reason: 'invalid_updated_at'
    };
  }

  const ageMs = Date.now() - updatedAtMs;

  return {
    fresh: ageMs >= 0 && ageMs <= heartbeatMaxAgeMs,
    ageMs,
    reason: ageMs >= 0 && ageMs <= heartbeatMaxAgeMs ? null : 'stale_status'
  };
}

function serializeDeprecatedPresets(): PremierePreset[] {
  return PREMIERE_EXPORT_PRESETS.map(({ id, label, resolution, presetFileName }) => ({
    id,
    label,
    resolution,
    presetFileName,
    available: true,
    deprecated: true,
    message: 'Premiere export presets are deprecated. Edit in Premiere now imports selected videos only.'
  }));
}

function serializeReadyBridge(status: Record<string, unknown>, ageMs: number | null): PremiereStatusResponse['bridge'] {
  return {
    connected: true,
    status: typeof status.status === 'string' ? status.status : null,
    updatedAt: typeof status.updatedAt === 'string' ? status.updatedAt : null,
    ageMs,
    activeProjectName: typeof status.activeProjectName === 'string' ? status.activeProjectName : null,
    activeProjectPath: typeof status.activeProjectPath === 'string' ? status.activeProjectPath : null,
    outputDirectory: typeof status.outputDirectory === 'string' ? status.outputDirectory : null
  };
}

function serializeDisconnectedBridge(
  reason: string,
  statusFileResult: BridgeStatusFileResult,
  freshness?: StatusFreshness
): PremiereStatusResponse['bridge'] {
  const status = statusFileResult.status;

  return {
    connected: false,
    reason,
    status: status && typeof status.status === 'string' ? status.status : null,
    updatedAt: status && typeof status.updatedAt === 'string' ? status.updatedAt : null,
    ageMs: freshness?.ageMs ?? null,
    activeProjectName: status && typeof status.activeProjectName === 'string' ? status.activeProjectName : null,
    activeProjectPath: status && typeof status.activeProjectPath === 'string' ? status.activeProjectPath : null,
    outputDirectory: status && typeof status.outputDirectory === 'string' ? status.outputDirectory : null
  };
}

function validateImportRequest(request: Partial<PremiereImportRequest> | null | undefined): ValidationResult {
  if (!request || typeof request !== 'object') {
    return validationError('Premiere import request is required.');
  }

  if (!Array.isArray(request.videos)) {
    return validationError('videos must be an array.');
  }

  if (request.videos.length === 0) {
    return validationError('Select at least one video to import into Premiere.');
  }

  if (request.videos.length > MAX_PREMIERE_REQUEST_VIDEOS) {
    return validationError(`No more than ${MAX_PREMIERE_REQUEST_VIDEOS} videos can be imported at once.`);
  }

  for (const [index, video] of request.videos.entries()) {
    if (!isRecord(video)) {
      return validationError(`videos[${index}] must be an object.`);
    }

    if (typeof video.id !== 'string' || video.id.trim() === '') {
      return validationError(`videos[${index}].id is required.`);
    }

    if (typeof video.fileName !== 'string' || video.fileName.trim() === '') {
      return validationError(`videos[${index}].fileName is required.`);
    }

    if (typeof video.absolutePath !== 'string' || video.absolutePath.trim() === '') {
      return validationError(`videos[${index}].absolutePath is required.`);
    }

    if (!isAbsolute(video.absolutePath)) {
      return validationError(`videos[${index}].absolutePath must be absolute.`);
    }

    if (typeof video.directory !== 'string') {
      return validationError(`videos[${index}].directory is required.`);
    }

    for (const field of ['durationSeconds', 'width', 'height', 'frameRate'] as const) {
      if (!isNumberOrNull(video[field])) {
        return validationError(`videos[${index}].${field} must be a number or null.`);
      }
    }

    if (typeof video.displayAspectRatio !== 'string' && video.displayAspectRatio !== null) {
      return validationError(`videos[${index}].displayAspectRatio must be a string or null.`);
    }
  }

  return { ok: true };
}

async function validateSelectedVideoFiles(videos: PremiereRequestVideo[]): Promise<ValidationResult> {
  const invalidVideos: unknown[] = [];

  await Promise.all(videos.map(async (video, index) => {
    const fileStats = await stat(video.absolutePath).catch((error: NodeJS.ErrnoException) => {
      invalidVideos.push({
        index,
        fileName: video.fileName,
        absolutePath: video.absolutePath,
        reason: error.code === 'ENOENT' ? 'missing' : 'unavailable',
        error: error.message
      });

      return null;
    });

    if (fileStats && !fileStats.isFile()) {
      invalidVideos.push({
        index,
        fileName: video.fileName,
        absolutePath: video.absolutePath,
        reason: 'not_file'
      });
    }
  }));

  if (invalidVideos.length > 0) {
    return validationError('One or more selected video files could not be read.', {
      videos: invalidVideos
    });
  }

  return { ok: true };
}

function toPremiereRequestVideo(video: PremiereRequestVideo): PremiereRequestVideo {
  return {
    id: video.id.trim(),
    fileName: video.fileName.trim(),
    absolutePath: video.absolutePath,
    directory: video.directory,
    durationSeconds: video.durationSeconds,
    width: video.width,
    height: video.height,
    displayAspectRatio: video.displayAspectRatio,
    frameRate: video.frameRate
  };
}

async function preparePremiereImportVideos({
  paths,
  requestId,
  videos
}: {
  paths: PremiereBridgePaths;
  requestId: string;
  videos: PremiereRequestVideo[];
}): Promise<PremiereRequestVideo[]> {
  const importRunDir = join(paths.importsDir, requestId);
  let createdImportRunDir = false;
  const preparedVideos: PremiereRequestVideo[] = [];

  for (const [index, video] of videos.entries()) {
    const sourceExtension = extname(video.absolutePath);
    const fileNameExtension = extname(video.fileName);

    if (sourceExtension || !fileNameExtension) {
      preparedVideos.push(video);
      continue;
    }

    if (!createdImportRunDir) {
      await mkdir(importRunDir, { recursive: true });
      createdImportRunDir = true;
    }

    const importFileName = sanitizeImportFileName(video.fileName, index);
    const importPath = join(importRunDir, importFileName);

    await linkOrCopyFile(video.absolutePath, importPath);

    preparedVideos.push({
      ...video,
      absolutePath: importPath,
      directory: importRunDir,
      originalAbsolutePath: video.absolutePath
    });
  }

  return preparedVideos;
}

function sanitizeImportFileName(fileName: string, index: number): string {
  const parsed = parse(fileName || '');
  const baseName = parsed.name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 180);
  const extension = parsed.ext.toLowerCase();

  return `${String(index + 1).padStart(3, '0')}-${baseName || 'video'}${extension}`;
}

async function linkOrCopyFile(sourcePath: string, destinationPath: string): Promise<void> {
  await link(sourcePath, destinationPath).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') {
      await unlink(destinationPath);
      await link(sourcePath, destinationPath).catch(() => copyFile(sourcePath, destinationPath));
      return;
    }

    await copyFile(sourcePath, destinationPath);
  });
}

async function writePremiereBridgeRequest(
  paths: PremiereBridgePaths,
  request: PremiereBridgeRequestFile
): Promise<string> {
  const requestPath = join(paths.requestsDir, `${request.id}.json`);
  const tempRequestPath = `${requestPath}.tmp`;

  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(tempRequestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  await rename(tempRequestPath, requestPath);

  return requestPath;
}

function validationError(message: string, details?: unknown): ValidationResult {
  return {
    ok: false,
    response: {
      status: 'invalid_request',
      message,
      ...(details ? { details } : {})
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}
