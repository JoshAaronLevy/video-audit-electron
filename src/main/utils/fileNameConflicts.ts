import { lstat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { DestinationConflictStrategy } from '../../shared/types/fileOperations';

export interface DestinationPathResult {
  destinationPath: string;
  hasConflict: boolean;
  wasRenamed: boolean;
}

export async function resolveDestinationPath({
  destinationDirectory,
  fileName,
  conflictStrategy,
  reservedDestinations
}: {
  destinationDirectory: string;
  fileName: string;
  conflictStrategy: DestinationConflictStrategy;
  reservedDestinations: Set<string>;
}): Promise<DestinationPathResult> {
  const destinationPath = join(destinationDirectory, fileName);
  const hasInitialConflict =
    reservedDestinations.has(destinationPath) || (await pathExists(destinationPath));

  if (!hasInitialConflict || conflictStrategy === 'skip') {
    return {
      destinationPath,
      hasConflict: hasInitialConflict,
      wasRenamed: false
    };
  }

  const extension = extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  for (let index = 1; index <= 9999; index += 1) {
    const candidatePath = join(destinationDirectory, `${baseName} (video-audit ${index})${extension}`);

    if (!reservedDestinations.has(candidatePath) && !(await pathExists(candidatePath))) {
      return {
        destinationPath: candidatePath,
        hasConflict: true,
        wasRenamed: true
      };
    }
  }

  return {
    destinationPath,
    hasConflict: true,
    wasRenamed: false
  };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}
