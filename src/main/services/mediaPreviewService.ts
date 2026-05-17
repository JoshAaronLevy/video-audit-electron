import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { isSupportedVideoExtension, normalizeVideoExtension } from '../../shared/constants/videoExtensions';
import type {
  MediaPreviewItem,
  MediaPreviewManifest,
  MediaPreviewProgress,
  MediaPreviewRequest,
  MediaPreviewResult,
  MediaPreviewResultItem,
  PreviewClipProgress,
  PreviewClipRequest,
  PreviewClipResult,
  PreviewClipResultItem,
  PreviewFrameMode,
  PreviewFrameRequest
} from '../../shared/types/mediaPreview';
import type {
  VideoPreviewClip,
  VideoPreviewFrame,
  VideoPreviewFrameResult,
  VideoRow,
  VideoThumbnail
} from '../../shared/types/video';
import { getMediaPreviewCacheDir } from './appPaths';

const POSTER_THUMBNAIL_WIDTH = 320;
const PREVIEW_FRAME_WIDTH = 640;
const DEFAULT_PREVIEW_CLIP_DURATION_SECONDS = 5;
const DEFAULT_PREVIEW_CLIP_WIDTH = 640;

interface ValidMediaPreviewRequest {
  videos: VideoRow[];
}

interface ValidPreviewVideo {
  id?: string;
  fileName: string;
  filePath: string;
  durationSeconds: number | null;
  source: {
    path: string;
    sizeBytes: number;
    modifiedAtMs: number;
    durationSeconds: number | null;
  };
  cache: {
    videoHash: string;
    videoDir: string;
    thumbsDir: string;
    clipsDir: string;
    manifestPath: string;
  };
}

interface ValidPreviewClipRequest {
  video: VideoRow;
  frames: VideoPreviewFrame[];
  clipDurationSeconds: number;
  width: number;
}

interface ThumbnailGenerationResult {
  item: MediaPreviewResultItem;
  generated: boolean;
  cached: boolean;
  failed: boolean;
}

interface PreviewClipTarget {
  id: string;
  frame: VideoPreviewFrame;
  timestampSeconds: number;
  timestampLabel: string;
  thumbnailPath: string;
  thumbnailUrl?: string;
}

export async function validateMediaPreviewRequest(
  request: Partial<MediaPreviewRequest> | null | undefined
): Promise<{ ok: true; request: ValidMediaPreviewRequest } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Media preview request is required.'
    };
  }

  if (!Array.isArray(request.videos) || request.videos.length === 0) {
    return {
      ok: false,
      error: 'Choose at least one video before generating thumbnails.'
    };
  }

  return {
    ok: true,
    request: {
      videos: dedupeVideos(request.videos)
    }
  };
}

export async function validatePreviewClipRequest(
  request: Partial<PreviewClipRequest> | null | undefined
): Promise<{ ok: true; request: ValidPreviewClipRequest } | { ok: false; error: string }> {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Preview clip request is required.'
    };
  }

  if (!request.video || typeof request.video !== 'object') {
    return {
      ok: false,
      error: 'Choose a video before generating preview clips.'
    };
  }

  return {
    ok: true,
    request: {
      video: request.video,
      frames: normalizeRequestedPreviewFrames(request.frames),
      clipDurationSeconds: normalizePreviewClipDurationSeconds(request.clipDurationSeconds),
      width: normalizePreviewClipWidth(request.width)
    }
  };
}

export async function generateThumbnails({
  videos,
  ffmpegPath,
  signal,
  onProgress
}: ValidMediaPreviewRequest & {
  ffmpegPath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: Omit<MediaPreviewProgress, 'jobId' | 'status'>) => void;
}): Promise<Omit<MediaPreviewResult, 'jobId' | 'status'>> {
  assertNotCanceled(signal);
  const previewCacheDir = getMediaPreviewCacheDir();
  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';
  const summary: MediaPreviewResult['summary'] = {
    requested: videos.length,
    generated: 0,
    cached: 0,
    failed: 0
  };
  const items: MediaPreviewResultItem[] = [];

  await mkdir(previewCacheDir, { recursive: true });
  emitProgress(onProgress, {
    phase: 'generating_thumbnails',
    totalVideos: videos.length,
    processedVideos: 0,
    generatedCount: 0,
    cachedCount: 0,
    failedCount: 0,
    currentFile: null,
    message: 'Generating thumbnails.'
  });

  for (let index = 0; index < videos.length; index += 1) {
    assertNotCanceled(signal);
    const video = videos[index];
    const fileName = getOriginalFileName(video, getVideoPath(video));

    emitProgress(onProgress, {
      phase: 'generating_thumbnails',
      totalVideos: videos.length,
      processedVideos: index,
      generatedCount: summary.generated,
      cachedCount: summary.cached,
      failedCount: summary.failed,
      currentFile: fileName,
      message: 'Generating thumbnails.'
    });

    const result = await ensurePosterThumbnailForVideo({
      video,
      ffmpegPath: binaryPath,
      signal
    });

    items.push(result.item);

    if (result.cached) {
      summary.cached += 1;
    } else if (result.generated) {
      summary.generated += 1;
    } else {
      summary.failed += 1;
    }

    emitProgress(onProgress, {
      phase: 'generating_thumbnails',
      totalVideos: videos.length,
      processedVideos: index + 1,
      generatedCount: summary.generated,
      cachedCount: summary.cached,
      failedCount: summary.failed,
      currentFile: fileName,
      message: result.failed ? 'Thumbnail generation failed.' : 'Thumbnail ready.'
    });
  }

  emitProgress(onProgress, {
    phase: 'complete',
    totalVideos: videos.length,
    processedVideos: videos.length,
    generatedCount: summary.generated,
    cachedCount: summary.cached,
    failedCount: summary.failed,
    currentFile: null,
    message: 'Thumbnail generation complete.'
  });

  return {
    message: 'Thumbnail generation complete.',
    previewCacheDir,
    summary,
    items
  };
}

export async function generatePreviewFrames({
  video,
  mode,
  ffmpegPath,
  signal
}: PreviewFrameRequest & {
  ffmpegPath?: string | null;
  signal?: AbortSignal;
}): Promise<VideoPreviewFrameResult> {
  assertNotCanceled(signal);
  const previewMode = normalizePreviewFrameMode(mode);
  const source = await readPreviewVideo(video);
  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';
  const maxPreviewFrameCount = getMaxPreviewFrameCount(source.durationSeconds);
  const batchSeed = previewMode === 'fresh' ? Date.now() : 0;
  const batchId = previewMode === 'fresh' ? `fresh-${batchSeed.toString(36)}` : 'default';
  const timestamps = buildPreviewTimestamps({
    mode: previewMode,
    count: maxPreviewFrameCount,
    durationSeconds: source.durationSeconds,
    seed: batchSeed
  });
  const summary = {
    requested: maxPreviewFrameCount,
    existing: 0,
    generated: 0,
    cached: 0,
    failed: 0,
    returned: 0
  };
  const frames: VideoPreviewFrame[] = [];

  await mkdir(source.cache.thumbsDir, { recursive: true });

  for (let index = 0; index < timestamps.length; index += 1) {
    assertNotCanceled(signal);
    const timestampSeconds = timestamps[index];
    const previewItemId = `frame-${batchId}-${String(index).padStart(3, '0')}`;
    const thumbnailFileName = buildPreviewFrameFileName({
      batchId,
      index,
      timestampSeconds,
      videoHash: source.cache.videoHash
    });
    const thumbnailPath = join(source.cache.thumbsDir, thumbnailFileName);
    const thumbnailUrl = toMediaPreviewAssetUrl(thumbnailPath);
    const existing = await isFile(thumbnailPath);

    if (existing) {
      summary.existing += 1;
      summary.cached += 1;
      frames.push(createPreviewFrame({
        index,
        batchId,
        timestampSeconds,
        thumbnail: createThumbnailMetadata({
          cached: true,
          generated: true,
          thumbnailPath,
          thumbnailUrl,
          timestampSeconds
        })
      }));
      continue;
    }

    const result = await runFfmpegThumbnail({
      inputPath: source.filePath,
      outputPath: thumbnailPath,
      ffmpegPath: binaryPath,
      scaleWidth: PREVIEW_FRAME_WIDTH,
      timestampSeconds,
      signal
    });

    if (result.canceled) {
      await removePartialFile(thumbnailPath);
      throw createMediaPreviewCancelError();
    }

    if (!result.ok) {
      await removePartialFile(thumbnailPath);
      summary.failed += 1;
      frames.push(createFailedPreviewFrame({ index, batchId, timestampSeconds }));
      continue;
    }

    summary.generated += 1;
    frames.push(createPreviewFrame({
      index,
      batchId,
      timestampSeconds,
      thumbnail: createThumbnailMetadata({
        cached: false,
        generated: true,
        thumbnailPath,
        thumbnailUrl,
        timestampSeconds
      })
    }));

    await upsertManifestItem(source, {
      id: previewItemId,
      timestampSeconds,
      timestampLabel: formatTimestampLabel(timestampSeconds),
      thumbnailPath,
      thumbnailUrl,
      previewClipStatus: 'not-generated'
    });
  }

  summary.returned = frames.length;

  return {
    durationSeconds: source.durationSeconds,
    maxPreviewFrameCount,
    mode: previewMode,
    batchId,
    summary,
    frames
  };
}

export async function generatePreviewClips({
  video,
  frames,
  clipDurationSeconds,
  width,
  ffmpegPath,
  signal,
  onProgress
}: ValidPreviewClipRequest & {
  ffmpegPath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: Omit<PreviewClipProgress, 'jobId' | 'status'>) => void;
}): Promise<Omit<PreviewClipResult, 'jobId' | 'status'>> {
  assertNotCanceled(signal);
  const previewCacheDir = getMediaPreviewCacheDir();
  const source = await readPreviewVideo(video);
  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';
  const targets = await buildPreviewClipTargets({
    video,
    source,
    requestedFrames: frames,
    ffmpegPath: binaryPath,
    signal
  });
  const summary: PreviewClipResult['summary'] = {
    requested: targets.length,
    generated: 0,
    cached: 0,
    failed: 0
  };
  const outputFrames: VideoPreviewFrame[] = [];

  await mkdir(source.cache.clipsDir, { recursive: true });
  emitPreviewClipProgress(onProgress, {
    phase: 'generating_preview_clips',
    totalClips: targets.length,
    processedClips: 0,
    generatedCount: 0,
    cachedCount: 0,
    failedCount: 0,
    currentFile: source.fileName,
    currentTimestampLabel: null,
    message: 'Generating preview clips.'
  });

  if (targets.length === 0) {
    return {
      message: 'No thumbnail timestamps are available for preview clips.',
      previewCacheDir,
      summary,
      items: [
        {
          id: source.id,
          fileName: source.fileName,
          path: source.filePath,
          absolutePath: source.filePath,
          manifestPath: source.cache.manifestPath,
          previewFrames: []
        }
      ]
    };
  }

  for (let index = 0; index < targets.length; index += 1) {
    assertNotCanceled(signal);
    const target = targets[index];
    const clipStartSeconds = getPreviewClipStartSeconds({
      timestampSeconds: target.timestampSeconds,
      durationSeconds: source.durationSeconds,
      clipDurationSeconds
    });
    const clipFileName = buildPreviewClipFileName({
      itemId: target.id,
      timestampSeconds: target.timestampSeconds,
      clipDurationSeconds,
      width,
      videoHash: source.cache.videoHash
    });
    const clipPath = join(source.cache.clipsDir, clipFileName);
    const clipUrl = toMediaPreviewAssetUrl(clipPath);

    emitPreviewClipProgress(onProgress, {
      phase: 'generating_preview_clips',
      totalClips: targets.length,
      processedClips: index,
      generatedCount: summary.generated,
      cachedCount: summary.cached,
      failedCount: summary.failed,
      currentFile: source.fileName,
      currentTimestampLabel: target.timestampLabel,
      message: 'Generating preview clips.'
    });

    const existing = await isFile(clipPath);

    if (existing) {
      summary.cached += 1;
      outputFrames.push({
        ...target.frame,
        previewClip: createPreviewClipMetadata({
          cached: true,
          generated: true,
          clipPath,
          clipUrl,
          timestampSeconds: target.timestampSeconds,
          startSeconds: clipStartSeconds,
          durationSeconds: clipDurationSeconds,
          width
        })
      });
      await upsertManifestItem(source, {
        id: target.id,
        timestampSeconds: target.timestampSeconds,
        timestampLabel: target.timestampLabel,
        thumbnailPath: target.thumbnailPath,
        thumbnailUrl: target.thumbnailUrl,
        previewClipPath: clipPath,
        previewClipUrl: clipUrl,
        previewClipStatus: 'ready',
        previewClipStartSeconds: clipStartSeconds,
        previewClipDurationSeconds: clipDurationSeconds,
        previewClipWidth: width,
        previewClipError: null
      });
      emitPreviewClipProgress(onProgress, {
        phase: 'generating_preview_clips',
        totalClips: targets.length,
        processedClips: index + 1,
        generatedCount: summary.generated,
        cachedCount: summary.cached,
        failedCount: summary.failed,
        currentFile: source.fileName,
        currentTimestampLabel: target.timestampLabel,
        message: 'Preview clip ready.'
      });
      continue;
    }

    const result = await runFfmpegPreviewClip({
      inputPath: source.filePath,
      outputPath: clipPath,
      ffmpegPath: binaryPath,
      startSeconds: clipStartSeconds,
      durationSeconds: clipDurationSeconds,
      width,
      signal
    });

    if (result.canceled) {
      await removePartialFile(clipPath);
      throw createMediaPreviewCancelError();
    }

    if (!result.ok) {
      await removePartialFile(clipPath);
      summary.failed += 1;
      outputFrames.push({
        ...target.frame,
        previewClip: createFailedPreviewClip({
          timestampSeconds: target.timestampSeconds,
          startSeconds: clipStartSeconds,
          durationSeconds: clipDurationSeconds,
          width,
          error: result.error ?? 'Unable to generate preview clip.'
        })
      });
      await upsertManifestItem(source, {
        id: target.id,
        timestampSeconds: target.timestampSeconds,
        timestampLabel: target.timestampLabel,
        thumbnailPath: target.thumbnailPath,
        thumbnailUrl: target.thumbnailUrl,
        previewClipStatus: 'failed',
        previewClipStartSeconds: clipStartSeconds,
        previewClipDurationSeconds: clipDurationSeconds,
        previewClipWidth: width,
        previewClipError: result.error ?? 'Unable to generate preview clip.'
      });
      emitPreviewClipProgress(onProgress, {
        phase: 'generating_preview_clips',
        totalClips: targets.length,
        processedClips: index + 1,
        generatedCount: summary.generated,
        cachedCount: summary.cached,
        failedCount: summary.failed,
        currentFile: source.fileName,
        currentTimestampLabel: target.timestampLabel,
        message: 'Preview clip generation failed.'
      });
      continue;
    }

    summary.generated += 1;
    outputFrames.push({
      ...target.frame,
      previewClip: createPreviewClipMetadata({
        cached: false,
        generated: true,
        clipPath,
        clipUrl,
        timestampSeconds: target.timestampSeconds,
        startSeconds: clipStartSeconds,
        durationSeconds: clipDurationSeconds,
        width
      })
    });

    await upsertManifestItem(source, {
      id: target.id,
      timestampSeconds: target.timestampSeconds,
      timestampLabel: target.timestampLabel,
      thumbnailPath: target.thumbnailPath,
      thumbnailUrl: target.thumbnailUrl,
      previewClipPath: clipPath,
      previewClipUrl: clipUrl,
      previewClipStatus: 'ready',
      previewClipStartSeconds: clipStartSeconds,
      previewClipDurationSeconds: clipDurationSeconds,
      previewClipWidth: width,
      previewClipError: null
    });

    emitPreviewClipProgress(onProgress, {
      phase: 'generating_preview_clips',
      totalClips: targets.length,
      processedClips: index + 1,
      generatedCount: summary.generated,
      cachedCount: summary.cached,
      failedCount: summary.failed,
      currentFile: source.fileName,
      currentTimestampLabel: target.timestampLabel,
      message: 'Preview clip ready.'
    });
  }

  emitPreviewClipProgress(onProgress, {
    phase: 'complete',
    totalClips: targets.length,
    processedClips: targets.length,
    generatedCount: summary.generated,
    cachedCount: summary.cached,
    failedCount: summary.failed,
    currentFile: source.fileName,
    currentTimestampLabel: null,
    message: 'Preview clip generation complete.'
  });

  return {
    message: 'Preview clip generation complete.',
    previewCacheDir,
    summary,
    items: [
      {
        id: source.id,
        fileName: source.fileName,
        path: source.filePath,
        absolutePath: source.filePath,
        manifestPath: source.cache.manifestPath,
        previewFrames: outputFrames
      }
    ]
  };
}

export async function clearMediaPreviewCache(): Promise<void> {
  const cacheDir = getMediaPreviewCacheDir();
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
}

async function ensurePosterThumbnailForVideo({
  video,
  ffmpegPath,
  signal
}: {
  video: VideoRow;
  ffmpegPath: string;
  signal?: AbortSignal;
}): Promise<ThumbnailGenerationResult> {
  const filePath = getVideoPath(video);
  const fileName = getOriginalFileName(video, filePath);

  try {
    const source = await readPreviewVideo(video);
    const timestampSeconds = pickThumbnailTimestamp(source.durationSeconds);
    const thumbnailFileName = `${source.cache.videoHash}-poster.jpg`;
    const thumbnailPath = join(source.cache.thumbsDir, thumbnailFileName);
    const thumbnailUrl = toMediaPreviewAssetUrl(thumbnailPath);
    const existing = await isFile(thumbnailPath);

    await mkdir(source.cache.thumbsDir, { recursive: true });

    if (existing) {
      await upsertManifestItem(source, {
        id: 'poster',
        timestampSeconds,
        timestampLabel: formatTimestampLabel(timestampSeconds),
        thumbnailPath,
        thumbnailUrl,
        previewClipStatus: 'not-generated'
      });

      return {
        item: {
          id: source.id,
          fileName: source.fileName,
          path: source.filePath,
          absolutePath: source.filePath,
          manifestPath: source.cache.manifestPath,
          thumbnail: createThumbnailMetadata({
            cached: true,
            generated: true,
            thumbnailPath,
            thumbnailUrl,
            timestampSeconds
          })
        },
        generated: false,
        cached: true,
        failed: false
      };
    }

    const result = await runFfmpegThumbnail({
      inputPath: source.filePath,
      outputPath: thumbnailPath,
      ffmpegPath,
      scaleWidth: POSTER_THUMBNAIL_WIDTH,
      timestampSeconds,
      signal
    });

    if (result.canceled) {
      await removePartialFile(thumbnailPath);
      throw createMediaPreviewCancelError();
    }

    if (!result.ok) {
      await removePartialFile(thumbnailPath);
      return createFailedThumbnailResult({
        video,
        fileName: source.fileName,
        filePath: source.filePath,
        error: result.error ?? 'Unable to generate thumbnail.'
      });
    }

    await upsertManifestItem(source, {
      id: 'poster',
      timestampSeconds,
      timestampLabel: formatTimestampLabel(timestampSeconds),
      thumbnailPath,
      thumbnailUrl,
      previewClipStatus: 'not-generated'
    });

    return {
      item: {
        id: source.id,
        fileName: source.fileName,
        path: source.filePath,
        absolutePath: source.filePath,
        manifestPath: source.cache.manifestPath,
        thumbnail: createThumbnailMetadata({
          cached: false,
          generated: true,
          thumbnailPath,
          thumbnailUrl,
          timestampSeconds
        })
      },
      generated: true,
      cached: false,
      failed: false
    };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    return createFailedThumbnailResult({
      video,
      fileName,
      filePath,
      error: getErrorMessage(error, 'Unable to generate thumbnail.')
    });
  }
}

async function buildPreviewClipTargets({
  video,
  source,
  requestedFrames,
  ffmpegPath,
  signal
}: {
  video: VideoRow;
  source: ValidPreviewVideo;
  requestedFrames: VideoPreviewFrame[];
  ffmpegPath: string;
  signal?: AbortSignal;
}): Promise<PreviewClipTarget[]> {
  const frameCandidates = requestedFrames.length > 0 ? requestedFrames : (video.previewFrames ?? []);
  const targets = buildTargetsFromFrames(frameCandidates);

  if (targets.length > 0) {
    return targets;
  }

  const posterTarget = buildPosterPreviewClipTarget(video);

  if (posterTarget) {
    return [posterTarget];
  }

  const posterResult = await ensurePosterThumbnailForVideo({
    video,
    ffmpegPath,
    signal
  });
  const thumbnail = posterResult.item.thumbnail;

  if (!thumbnail.generated || !thumbnail.path) {
    return [];
  }

  return [
    createPreviewClipTarget({
      id: 'poster',
      frame: createPreviewFrame({
        index: 0,
        batchId: 'poster',
        timestampSeconds: thumbnail.timestampSeconds ?? pickThumbnailTimestamp(source.durationSeconds),
        thumbnail
      }),
      thumbnailPath: thumbnail.path,
      thumbnailUrl: thumbnail.url
    })
  ];
}

function buildTargetsFromFrames(frames: VideoPreviewFrame[]): PreviewClipTarget[] {
  const targets: PreviewClipTarget[] = [];
  const seen = new Set<string>();

  for (const frame of frames) {
    if (!frame.thumbnail.generated || !frame.thumbnail.path) {
      continue;
    }

    const id = getPreviewFrameManifestId(frame);
    const target = createPreviewClipTarget({
      id,
      frame,
      thumbnailPath: frame.thumbnail.path,
      thumbnailUrl: frame.thumbnail.url
    });
    const dedupeKey = `${target.id}:${target.timestampSeconds}`;

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      targets.push(target);
    }
  }

  return targets;
}

function buildPosterPreviewClipTarget(video: VideoRow): PreviewClipTarget | null {
  const thumbnail = video.thumbnail;

  if (!thumbnail?.generated || !thumbnail.path) {
    return null;
  }

  return createPreviewClipTarget({
    id: 'poster',
    frame: createPreviewFrame({
      index: 0,
      batchId: 'poster',
      timestampSeconds: thumbnail.timestampSeconds ?? pickThumbnailTimestamp(video.durationSeconds),
      thumbnail
    }),
    thumbnailPath: thumbnail.path,
    thumbnailUrl: thumbnail.url
  });
}

function createPreviewClipTarget({
  id,
  frame,
  thumbnailPath,
  thumbnailUrl
}: {
  id: string;
  frame: VideoPreviewFrame;
  thumbnailPath: string;
  thumbnailUrl?: string;
}): PreviewClipTarget {
  return {
    id,
    frame,
    timestampSeconds: frame.timestampSeconds,
    timestampLabel: frame.timestampLabel || formatTimestampLabel(frame.timestampSeconds),
    thumbnailPath,
    thumbnailUrl
  };
}

async function readPreviewVideo(video: VideoRow): Promise<ValidPreviewVideo> {
  const filePath = getVideoPath(video);
  const fileName = getOriginalFileName(video, filePath);

  if (!filePath || !isAbsolute(filePath)) {
    throw new Error('Video path must be an absolute path.');
  }

  const extension = normalizeVideoExtension(filePath);

  if (!isSupportedVideoExtension(extension)) {
    throw new Error('Unsupported video file extension.');
  }

  const fileStats = await stat(filePath).catch(() => null);

  if (!fileStats) {
    throw new Error('Video file does not exist or is unreadable.');
  }

  if (!fileStats.isFile()) {
    throw new Error('Video path must point to a file.');
  }

  const durationSeconds = readFiniteNumber(video.durationSeconds);
  const sizeBytes = fileStats.size;
  const modifiedAtMs = fileStats.mtimeMs;
  const videoHash = buildVideoCacheHash({
    filePath,
    modifiedAtMs,
    sizeBytes
  });
  const videoDir = join(getMediaPreviewCacheDir(), 'videos', videoHash);
  const thumbsDir = join(videoDir, 'thumbnails');
  const clipsDir = join(videoDir, 'clips');
  const manifestPath = join(videoDir, 'manifest.json');

  return {
    id: typeof video.id === 'string' ? video.id : undefined,
    fileName,
    filePath,
    durationSeconds,
    source: {
      path: filePath,
      sizeBytes,
      modifiedAtMs,
      durationSeconds
    },
    cache: {
      videoHash,
      videoDir,
      thumbsDir,
      clipsDir,
      manifestPath
    }
  };
}

async function upsertManifestItem(source: ValidPreviewVideo, item: MediaPreviewItem): Promise<void> {
  const manifest = await readManifest(source);
  const itemIndex = manifest.items.findIndex((candidate) => candidate.id === item.id);

  if (itemIndex >= 0) {
    manifest.items[itemIndex] = {
      ...manifest.items[itemIndex],
      ...item
    };
  } else {
    manifest.items.push(item);
  }

  manifest.updatedAt = nowIsoString();
  await writeManifest(source.cache.manifestPath, manifest);
}

async function readManifest(source: ValidPreviewVideo): Promise<MediaPreviewManifest> {
  const rawManifest = await readFile(source.cache.manifestPath, 'utf8').catch(() => null);

  if (!rawManifest) {
    return createEmptyManifest(source);
  }

  try {
    const parsed = JSON.parse(rawManifest) as Partial<MediaPreviewManifest>;

    if (
      parsed.schemaVersion === 1 &&
      parsed.source?.path === source.source.path &&
      parsed.source.sizeBytes === source.source.sizeBytes &&
      parsed.source.modifiedAtMs === source.source.modifiedAtMs &&
      Array.isArray(parsed.items)
    ) {
      return {
        ...createEmptyManifest(source),
        ...parsed,
        items: parsed.items
      };
    }
  } catch {
    // Invalid manifests are replaced below.
  }

  return createEmptyManifest(source);
}

function createEmptyManifest(source: ValidPreviewVideo): MediaPreviewManifest {
  const now = nowIsoString();

  return {
    schemaVersion: 1,
    videoId: source.id ?? null,
    fileName: source.fileName,
    source: source.source,
    createdAt: now,
    updatedAt: now,
    items: []
  };
}

async function writeManifest(manifestPath: string, manifest: MediaPreviewManifest): Promise<void> {
  const tempPath = `${manifestPath}.tmp`;

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(tempPath, manifestPath);
}

function runFfmpegThumbnail({
  inputPath,
  outputPath,
  ffmpegPath,
  scaleWidth,
  timestampSeconds,
  signal
}: {
  inputPath: string;
  outputPath: string;
  ffmpegPath: string;
  scaleWidth: number;
  timestampSeconds: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({
        ok: false,
        canceled: true,
        error: 'Media preview generation canceled.'
      });
      return;
    }

    const args = [
      '-y',
      '-ss',
      String(timestampSeconds),
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${scaleWidth}:-1`,
      '-q:v',
      '3',
      outputPath
    ];
    const child = spawn(ffmpegPath, args);
    let stderr = '';
    let didCancel = false;
    let didSettle = false;
    let forceKillTimeout: NodeJS.Timeout | null = null;

    const settle = (result: { ok: boolean; canceled?: boolean; error?: string }): void => {
      if (didSettle) {
        return;
      }

      didSettle = true;

      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }

      signal?.removeEventListener('abort', handleAbort);
      resolveResult(result);
    };

    const handleAbort = (): void => {
      didCancel = true;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        if (!didSettle) {
          child.kill('SIGKILL');
        }
      }, 5000);
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      settle({
        ok: false,
        error: error.message
      });
    });

    child.on('close', (code) => {
      if (didCancel || signal?.aborted) {
        settle({
          ok: false,
          canceled: true,
          error: 'Media preview generation canceled.'
        });
        return;
      }

      if (code !== 0) {
        settle({
          ok: false,
          error: getConciseFfmpegError(stderr, code)
        });
        return;
      }

      settle({ ok: true });
    });
  });
}

function runFfmpegPreviewClip({
  inputPath,
  outputPath,
  ffmpegPath,
  startSeconds,
  durationSeconds,
  width,
  signal
}: {
  inputPath: string;
  outputPath: string;
  ffmpegPath: string;
  startSeconds: number;
  durationSeconds: number;
  width: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({
        ok: false,
        canceled: true,
        error: 'Preview clip generation canceled.'
      });
      return;
    }

    const args = [
      '-y',
      '-ss',
      String(startSeconds),
      '-i',
      inputPath,
      '-t',
      String(durationSeconds),
      '-vf',
      `scale=${width}:-2`,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '24',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath
    ];
    const child = spawn(ffmpegPath, args);
    let stderr = '';
    let didCancel = false;
    let didSettle = false;
    let forceKillTimeout: NodeJS.Timeout | null = null;

    const settle = (result: { ok: boolean; canceled?: boolean; error?: string }): void => {
      if (didSettle) {
        return;
      }

      didSettle = true;

      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }

      signal?.removeEventListener('abort', handleAbort);
      resolveResult(result);
    };

    const handleAbort = (): void => {
      didCancel = true;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        if (!didSettle) {
          child.kill('SIGKILL');
        }
      }, 5000);
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      settle({
        ok: false,
        error: error.message
      });
    });

    child.on('close', (code) => {
      if (didCancel || signal?.aborted) {
        settle({
          ok: false,
          canceled: true,
          error: 'Preview clip generation canceled.'
        });
        return;
      }

      if (code !== 0) {
        settle({
          ok: false,
          error: getConciseFfmpegError(stderr, code)
        });
        return;
      }

      settle({ ok: true });
    });
  });
}

function createFailedThumbnailResult({
  video,
  fileName,
  filePath,
  error
}: {
  video: VideoRow;
  fileName: string;
  filePath: string;
  error: string;
}): ThumbnailGenerationResult {
  return {
    item: {
      id: typeof video.id === 'string' ? video.id : undefined,
      fileName,
      path: filePath,
      absolutePath: filePath,
      thumbnail: {
        generated: false,
        cached: false,
        error
      }
    },
    generated: false,
    cached: false,
    failed: true
  };
}

function createThumbnailMetadata({
  cached,
  generated,
  thumbnailPath,
  thumbnailUrl,
  timestampSeconds
}: {
  cached: boolean;
  generated: boolean;
  thumbnailPath: string;
  thumbnailUrl: string;
  timestampSeconds: number;
}): VideoThumbnail {
  return {
    cached,
    generated,
    fileName: basename(thumbnailPath),
    path: thumbnailPath,
    url: thumbnailUrl,
    timestampSeconds
  };
}

function createPreviewFrame({
  index,
  batchId,
  timestampSeconds,
  thumbnail
}: {
  index: number;
  batchId: string;
  timestampSeconds: number;
  thumbnail: VideoThumbnail;
}): VideoPreviewFrame {
  return {
    index,
    batchId,
    timestampSeconds,
    timestampLabel: formatTimestampLabel(timestampSeconds),
    thumbnail
  };
}

function createFailedPreviewFrame({
  index,
  batchId,
  timestampSeconds
}: {
  index: number;
  batchId: string;
  timestampSeconds: number;
}): VideoPreviewFrame {
  return createPreviewFrame({
    index,
    batchId,
    timestampSeconds,
    thumbnail: {
      generated: false,
      cached: false,
      error: 'Unable to generate preview frame.'
    }
  });
}

function createPreviewClipMetadata({
  cached,
  generated,
  clipPath,
  clipUrl,
  timestampSeconds,
  startSeconds,
  durationSeconds,
  width
}: {
  cached: boolean;
  generated: boolean;
  clipPath: string;
  clipUrl: string;
  timestampSeconds: number;
  startSeconds: number;
  durationSeconds: number;
  width: number;
}): VideoPreviewClip {
  return {
    cached,
    generated,
    fileName: basename(clipPath),
    path: clipPath,
    url: clipUrl,
    status: 'ready',
    timestampSeconds,
    startSeconds,
    durationSeconds,
    width
  };
}

function createFailedPreviewClip({
  timestampSeconds,
  startSeconds,
  durationSeconds,
  width,
  error
}: {
  timestampSeconds: number;
  startSeconds: number;
  durationSeconds: number;
  width: number;
  error: string;
}): VideoPreviewClip {
  return {
    generated: false,
    cached: false,
    status: 'failed',
    timestampSeconds,
    startSeconds,
    durationSeconds,
    width,
    error
  };
}

function buildPreviewFrameFileName({
  batchId,
  index,
  timestampSeconds,
  videoHash
}: {
  batchId: string;
  index: number;
  timestampSeconds: number;
  videoHash: string;
}): string {
  const frameHash = createHash('sha1')
    .update([videoHash, batchId, index, timestampSeconds].join(':'))
    .digest('hex')
    .slice(0, 12);

  return `${videoHash}-preview-${sanitizeCacheSegment(batchId)}-${String(index).padStart(3, '0')}-${frameHash}.jpg`;
}

function buildPreviewClipFileName({
  itemId,
  timestampSeconds,
  clipDurationSeconds,
  width,
  videoHash
}: {
  itemId: string;
  timestampSeconds: number;
  clipDurationSeconds: number;
  width: number;
  videoHash: string;
}): string {
  const clipHash = createHash('sha1')
    .update([videoHash, itemId, timestampSeconds, clipDurationSeconds, width].join(':'))
    .digest('hex')
    .slice(0, 12);

  return `${videoHash}-clip-${sanitizeCacheSegment(itemId)}-${clipDurationSeconds}s-${width}w-${clipHash}.mp4`;
}

function buildVideoCacheHash({
  filePath,
  modifiedAtMs,
  sizeBytes
}: {
  filePath: string;
  modifiedAtMs: number;
  sizeBytes: number;
}): string {
  return createHash('sha1').update(`${filePath}:${modifiedAtMs}:${sizeBytes}`).digest('hex');
}

function toMediaPreviewAssetUrl(filePath: string): string {
  const cacheDir = resolve(getMediaPreviewCacheDir());
  const resolvedFilePath = resolve(filePath);
  const relativePath = relative(cacheDir, resolvedFilePath);

  if (relativePath.startsWith('..') || resolve(cacheDir, relativePath) !== resolvedFilePath) {
    throw new Error('Media preview file is outside the cache.');
  }

  return `media-preview://asset/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function getVideoPath(video: VideoRow): string {
  const candidates = [video.path];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }

  return '';
}

function getOriginalFileName(video: VideoRow, sourcePath: string): string {
  const candidates = [video.fileName, video.displayFile, sourcePath ? basename(sourcePath) : ''];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const fileName = basename(candidate.trim().replace(/\\/g, '/'));

    if (fileName && fileName !== '.' && fileName !== '/') {
      return fileName;
    }
  }

  return 'video';
}

function pickThumbnailTimestamp(durationSeconds: number | null): number {
  const duration = Number(durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 1;
  }

  if (duration <= 3) {
    return normalizeTimestamp(Math.max(duration / 2, 0));
  }

  return normalizeTimestamp(Math.min(Math.max(duration * 0.1, 3), Math.max(duration - 1, 0)));
}

function getMaxPreviewFrameCount(durationSeconds: number | null): number {
  const duration = Number(durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) return 4;
  if (duration <= 30) return 4;
  if (duration <= 120) return 6;
  if (duration <= 600) return 10;
  if (duration <= 1800) return 14;
  if (duration <= 2700) return 18;
  if (duration <= 3600) return 22;
  return 26;
}

function buildPreviewTimestamps({
  mode,
  count,
  durationSeconds,
  seed
}: {
  mode: PreviewFrameMode;
  count: number;
  durationSeconds: number | null;
  seed: number;
}): number[] {
  const duration = Number(durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    return Array.from({ length: count }, (_item, index) => normalizeTimestamp(0.5 + index * 0.75));
  }

  const startPercent = mode === 'fresh' ? 0.05 : 0.1;
  const endPercent = mode === 'fresh' ? 0.95 : 0.9;
  const start = Math.max(duration * startPercent, 0.1);
  const end = Math.max(start, duration * endPercent);
  const span = Math.max(end - start, 0);
  const freshOffset = mode === 'fresh' ? getFreshOffset({ count, seed }) : 0;

  return Array.from({ length: count }, (_item, index) => {
    const basePosition =
      mode === 'fresh'
        ? clamp((index + 0.5) / count + freshOffset, 0.01, 0.99)
        : (index + 1) / (count + 1);
    return normalizeTimestamp(start + span * basePosition);
  });
}

function normalizePreviewFrameMode(value: unknown): PreviewFrameMode {
  return value === 'fresh' ? 'fresh' : 'additional';
}

function normalizeRequestedPreviewFrames(value: unknown): VideoPreviewFrame[] {
  return Array.isArray(value) ? value.filter(isPreviewFrameLike) : [];
}

function normalizePreviewClipDurationSeconds(value: unknown): number {
  return Number(value) === 10 ? 10 : DEFAULT_PREVIEW_CLIP_DURATION_SECONDS;
}

function normalizePreviewClipWidth(value: unknown): number {
  return Number(value) === 480 ? 480 : DEFAULT_PREVIEW_CLIP_WIDTH;
}

function getPreviewClipStartSeconds({
  timestampSeconds,
  durationSeconds,
  clipDurationSeconds
}: {
  timestampSeconds: number;
  durationSeconds: number | null;
  clipDurationSeconds: number;
}): number {
  const timestamp = normalizeTimestamp(Math.max(0, Number(timestampSeconds) || 0));
  const duration = Number(durationSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    return timestamp;
  }

  return normalizeTimestamp(Math.max(0, Math.min(timestamp, duration - clipDurationSeconds)));
}

function getPreviewFrameManifestId(frame: VideoPreviewFrame): string {
  if (frame.batchId === 'poster') {
    return 'poster';
  }

  return `frame-${frame.batchId}-${String(frame.index).padStart(3, '0')}`;
}

function isPreviewFrameLike(value: unknown): value is VideoPreviewFrame {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<VideoPreviewFrame>;

  return (
    typeof candidate.index === 'number' &&
    typeof candidate.batchId === 'string' &&
    typeof candidate.timestampSeconds === 'number' &&
    Boolean(candidate.thumbnail)
  );
}

function getFreshOffset({ count, seed }: { count: number; seed: number }): number {
  if (!Number.isFinite(seed) || count <= 0) {
    return 0;
  }

  const normalized = (seed % 997) / 997;
  return ((normalized - 0.5) * 0.9) / count;
}

function formatTimestampLabel(timestampSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number(timestampSeconds) || 0));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}

function dedupeVideos(videos: VideoRow[]): VideoRow[] {
  const byPath = new Map<string, VideoRow>();

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    const filePath = getVideoPath(video);
    const dedupeKey = filePath ? resolve(filePath) : `missing-path:${index}`;

    if (!byPath.has(dedupeKey)) {
      byPath.set(dedupeKey, video);
    }
  }

  return Array.from(byPath.values());
}

async function isFile(filePath: string): Promise<boolean> {
  const fileStats = await stat(filePath).catch(() => null);
  return Boolean(fileStats?.isFile());
}

async function removePartialFile(filePath: string): Promise<void> {
  await unlink(filePath).catch(() => undefined);
}

function emitProgress(
  onProgress: ((progress: Omit<MediaPreviewProgress, 'jobId' | 'status'>) => void) | undefined,
  progress: Omit<MediaPreviewProgress, 'jobId' | 'status'>
): void {
  onProgress?.(progress);
}

function emitPreviewClipProgress(
  onProgress: ((progress: Omit<PreviewClipProgress, 'jobId' | 'status'>) => void) | undefined,
  progress: Omit<PreviewClipProgress, 'jobId' | 'status'>
): void {
  onProgress?.(progress);
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getConciseFfmpegError(stderr: unknown, code: number | null): string {
  const lines = String(stderr || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const usefulLine = [...lines]
    .reverse()
    .find((line) => !line.startsWith('frame=') && !line.startsWith('size='));

  return usefulLine || `FFmpeg exited with code ${code ?? 'unknown'}.`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sanitizeCacheSegment(value: unknown): string {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeTimestamp(value: number): number {
  return Number(value.toFixed(3));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function assertNotCanceled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createMediaPreviewCancelError();
  }
}

function createMediaPreviewCancelError(): Error {
  const error = new Error('Media preview generation canceled.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
