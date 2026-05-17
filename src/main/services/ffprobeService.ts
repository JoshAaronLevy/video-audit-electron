import { basename } from 'node:path';
import type {
  FfprobeFormat,
  FfprobeResult,
  FfprobeVideoStream
} from '../../shared/types/video';
import { runChildProcess } from '../utils/childProcess';

export interface ProbeVideoFilesOptions {
  filePaths: string[];
  ffprobePath?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: FfprobeServiceProgress) => void;
}

export interface FfprobeServiceProgress {
  processedFiles: number;
  succeededCount: number;
  errorCount: number;
  currentFile: string | null;
  message: string | null;
}

export interface ProbeVideoFilesResult {
  items: FfprobeResult[];
  succeededCount: number;
  errorCount: number;
}

export async function probeVideoFiles({
  filePaths,
  ffprobePath = 'ffprobe',
  signal,
  onProgress
}: ProbeVideoFilesOptions): Promise<ProbeVideoFilesResult> {
  const items: FfprobeResult[] = [];
  let succeededCount = 0;
  let errorCount = 0;
  const binaryPath = ffprobePath?.trim() || 'ffprobe';

  emitProgress(onProgress, {
    processedFiles: 0,
    succeededCount,
    errorCount,
    currentFile: null,
    message: 'Starting ffprobe metadata extraction.'
  });

  for (let index = 0; index < filePaths.length; index += 1) {
    throwIfAborted(signal);

    const filePath = filePaths[index];
    const fileName = basename(filePath);

    emitProgress(onProgress, {
      processedFiles: index,
      succeededCount,
      errorCount,
      currentFile: fileName,
      message: `Reading metadata for ${fileName}...`
    });

    const result = await runFfprobe(filePath, {
      ffprobePath: binaryPath,
      signal
    });

    if (result.canceled) {
      throw createFfprobeCancelError();
    }

    items.push({
      ...result,
      fileName
    });

    if (result.ok) {
      succeededCount += 1;
    } else {
      errorCount += 1;
    }

    emitProgress(onProgress, {
      processedFiles: index + 1,
      succeededCount,
      errorCount,
      currentFile: fileName,
      message: result.ok ? 'Metadata ready.' : 'Metadata extraction failed.'
    });
  }

  emitProgress(onProgress, {
    processedFiles: filePaths.length,
    succeededCount,
    errorCount,
    currentFile: null,
    message: 'ffprobe metadata extraction complete.'
  });

  return {
    items,
    succeededCount,
    errorCount
  };
}

export async function runFfprobe(
  filePath: string,
  {
    ffprobePath = 'ffprobe',
    signal
  }: {
    ffprobePath?: string;
    signal?: AbortSignal;
  } = {}
): Promise<FfprobeResult> {
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    [
      'stream=width',
      'height',
      'duration',
      'display_aspect_ratio',
      'sample_aspect_ratio',
      'codec_name',
      'codec_long_name',
      'profile',
      'pix_fmt',
      'level',
      'bit_rate',
      'avg_frame_rate',
      'r_frame_rate',
      'nb_frames'
    ].join(','),
    '-show_entries',
    'format=duration,size,bit_rate,format_name,format_long_name',
    '-of',
    'json',
    filePath
  ];

  const result = await runChildProcess(ffprobePath, args, { signal });

  if (result.canceled) {
    return {
      path: filePath,
      ok: false,
      canceled: true,
      error: 'ffprobe canceled.'
    };
  }

  if (!result.ok) {
    return {
      path: filePath,
      ok: false,
      error: result.error || 'ffprobe failed.'
    };
  }

  try {
    const parsed = JSON.parse(result.stdout) as {
      streams?: FfprobeVideoStream[];
      format?: FfprobeFormat;
    };
    const stream = parsed.streams?.[0];

    if (!stream) {
      return {
        path: filePath,
        ok: false,
        error: 'No video stream found.'
      };
    }

    return {
      path: filePath,
      ok: true,
      stream,
      format: parsed.format ?? {}
    };
  } catch (error: unknown) {
    return {
      path: filePath,
      ok: false,
      error: error instanceof Error ? `Failed to parse ffprobe JSON: ${error.message}` : 'Failed to parse ffprobe JSON.'
    };
  }
}

function emitProgress(
  onProgress: ProbeVideoFilesOptions['onProgress'],
  progress: FfprobeServiceProgress
): void {
  onProgress?.(progress);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createFfprobeCancelError();
  }
}

export function createFfprobeCancelError(): Error {
  const error = new Error('ffprobe metadata extraction canceled.');
  error.name = 'AbortError';
  return error;
}
