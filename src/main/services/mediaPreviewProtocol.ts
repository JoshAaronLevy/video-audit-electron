import { protocol } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getMediaPreviewCacheDir } from './appPaths';

export const MEDIA_PREVIEW_PROTOCOL = 'media-preview';

const CONTENT_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.mp4', 'video/mp4']
]);

export function registerMediaPreviewProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PREVIEW_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ]);
}

export function registerMediaPreviewProtocolHandler(): void {
  protocol.handle(MEDIA_PREVIEW_PROTOCOL, async (request) => {
    try {
      const filePath = resolveMediaPreviewUrl(request.url);
      const fileStats = await stat(filePath);

      if (!fileStats.isFile()) {
        return new Response('Not found', { status: 404 });
      }

      const body = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES.get(extension) ?? 'application/octet-stream';

      return new Response(body, {
        headers: {
          'content-type': contentType,
          'cache-control': 'private, max-age=31536000, immutable'
        }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function resolveMediaPreviewUrl(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== 'asset') {
    throw new Error('Invalid media preview host.');
  }

  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

  if (!relativePath || relativePath.includes('\0')) {
    throw new Error('Invalid media preview path.');
  }

  const cacheDir = resolve(getMediaPreviewCacheDir());
  const filePath = resolve(cacheDir, relativePath);

  if (filePath !== cacheDir && !filePath.startsWith(`${cacheDir}/`)) {
    throw new Error('Media preview path is outside the cache.');
  }

  return filePath;
}
