import type {
  FolderTreeNode,
  FolderTreeSelectionKey,
  FolderTreeSelectionKeys,
  SelectedFolderSummary
} from '../../shared/types/folderTree';

interface PathRecord {
  originalPath: string;
  normalizedPath: string;
  depth: number;
}

export function getSelectedFolderPathsFromTree(
  selectionKeys: FolderTreeSelectionKeys,
  root: FolderTreeNode | null
): string[] {
  if (!root) {
    return [];
  }

  const nodePathByKey = buildFolderPathByKey(root);

  return getCheckedFolderTreeKeys(selectionKeys)
    .map((key) => nodePathByKey.get(key))
    .filter((path): path is string => Boolean(path));
}

export function getDedupedSelectedFolderPathsFromTree(
  selectionKeys: FolderTreeSelectionKeys,
  root: FolderTreeNode | null
): string[] {
  return dedupeOverlappingFolderPaths(getSelectedFolderPathsFromTree(selectionKeys, root));
}

export function getFolderTreeSelectionSummary(
  selectionKeys: FolderTreeSelectionKeys,
  root: FolderTreeNode | null
): SelectedFolderSummary {
  const selectedFolderPaths = getSelectedFolderPathsFromTree(selectionKeys, root);
  const dedupedFolderPaths = dedupeOverlappingFolderPaths(selectedFolderPaths);
  const nodeByPath = root ? buildFolderNodeByPath(root) : new Map<string, FolderTreeNode>();

  const totals = dedupedFolderPaths.reduce(
    (summary, folderPath) => {
      const node = nodeByPath.get(normalizeFolderPath(folderPath));

      if (!node) {
        return summary;
      }

      return {
        totalVideoCount: summary.totalVideoCount + node.totalVideoCount,
        totalVideoSizeBytes: summary.totalVideoSizeBytes + node.totalVideoSizeBytes
      };
    },
    { totalVideoCount: 0, totalVideoSizeBytes: 0 }
  );

  return {
    selectedFolderPaths,
    dedupedFolderPaths,
    selectedFolderCount: selectedFolderPaths.length,
    dedupedFolderCount: dedupedFolderPaths.length,
    totalVideoCount: totals.totalVideoCount,
    totalVideoSizeBytes: totals.totalVideoSizeBytes
  };
}

export function dedupeOverlappingFolderPaths(folderPaths: string[]): string[] {
  const recordsByNormalizedPath = new Map<string, PathRecord>();

  folderPaths.forEach((folderPath) => {
    const normalizedPath = normalizeFolderPath(folderPath);

    if (!normalizedPath || recordsByNormalizedPath.has(normalizedPath)) {
      return;
    }

    recordsByNormalizedPath.set(normalizedPath, {
      originalPath: folderPath,
      normalizedPath,
      depth: getFolderPathDepth(normalizedPath)
    });
  });

  return Array.from(recordsByNormalizedPath.values())
    .sort((first, second) => {
      if (first.depth !== second.depth) {
        return first.depth - second.depth;
      }

      return first.normalizedPath.localeCompare(second.normalizedPath);
    })
    .reduce<string[]>((keptPaths, record) => {
      const isContainedByKeptPath = keptPaths.some((keptPath) =>
        isPathAtOrInside(keptPath, record.originalPath)
      );

      if (!isContainedByKeptPath) {
        keptPaths.push(record.originalPath);
      }

      return keptPaths;
    }, []);
}

export function isPathAtOrInside(parentPath: string, childPath: string): boolean {
  const normalizedParentPath = normalizeFolderPath(parentPath);
  const normalizedChildPath = normalizeFolderPath(childPath);

  if (!normalizedParentPath || !normalizedChildPath) {
    return false;
  }

  if (normalizedParentPath === normalizedChildPath) {
    return true;
  }

  if (normalizedParentPath === '/') {
    return normalizedChildPath.startsWith('/');
  }

  return normalizedChildPath.startsWith(`${normalizedParentPath}/`);
}

export function buildFolderPathByKey(root: FolderTreeNode): Map<string, string> {
  const nodePathByKey = new Map<string, string>();

  visitFolderTree(root, (node) => {
    nodePathByKey.set(node.key, node.path);
  });

  return nodePathByKey;
}

export function buildFolderNodeByPath(root: FolderTreeNode): Map<string, FolderTreeNode> {
  const nodeByPath = new Map<string, FolderTreeNode>();

  visitFolderTree(root, (node) => {
    nodeByPath.set(normalizeFolderPath(node.path), node);
  });

  return nodeByPath;
}

export function getCheckedFolderTreeKeys(selectionKeys: FolderTreeSelectionKeys): string[] {
  return Object.entries(selectionKeys)
    .filter(([, value]) => isCheckedSelectionKey(value))
    .map(([key]) => key);
}

function isCheckedSelectionKey(value: FolderTreeSelectionKey | undefined): boolean {
  return Boolean(value && value.checked === true);
}

function visitFolderTree(node: FolderTreeNode, visit: (node: FolderTreeNode) => void): void {
  visit(node);
  node.children.forEach((child) => visitFolderTree(child, visit));
}

function normalizeFolderPath(folderPath: string): string {
  const normalizedPath = folderPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  if (normalizedPath === '/' || /^[A-Za-z]:\/$/.test(normalizedPath)) {
    return normalizedPath;
  }

  return normalizedPath.replace(/\/+$/g, '');
}

function getFolderPathDepth(folderPath: string): number {
  if (folderPath === '/') {
    return 0;
  }

  return normalizeFolderPath(folderPath)
    .split('/')
    .filter((part) => part.length > 0).length;
}
