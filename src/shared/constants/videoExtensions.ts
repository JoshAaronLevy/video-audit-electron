export const SUPPORTED_VIDEO_EXTENSION_NAMES = [
  '3g2',
  '3gp',
  'avi',
  'm2ts',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'mts',
  'mxf',
  'ts',
  'webm',
  'wmv'
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.3g2',
  '.3gp',
  '.avi',
  '.m2ts',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.mts',
  '.mxf',
  '.ts',
  '.webm',
  '.wmv'
] as const;

const SUPPORTED_VIDEO_EXTENSION_SET = new Set<string>(SUPPORTED_VIDEO_EXTENSIONS);

export function normalizeVideoExtension(value: string): string {
  if (value.trim() === '') {
    return '';
  }

  const fileName = value.split(/[\\/]/).pop() ?? value;
  const dotIndex = fileName.lastIndexOf('.');
  const extension = value.startsWith('.') ? value : dotIndex >= 0 ? fileName.slice(dotIndex) : '';

  return extension.toLowerCase();
}

export function getVideoFileType(value: string): string {
  const extension = normalizeVideoExtension(value);
  return extension ? extension.slice(1).toUpperCase() : '';
}

export function isSupportedVideoExtension(value: string): boolean {
  return SUPPORTED_VIDEO_EXTENSION_SET.has(normalizeVideoExtension(value));
}

export function isSupportedVideoFileName(fileName: string): boolean {
  return isSupportedVideoExtension(fileName);
}
