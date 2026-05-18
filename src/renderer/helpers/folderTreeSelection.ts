import type {
  FolderTreeNode,
  FolderTreeSelectionKey,
  FolderTreeSelectionKeys,
  SelectedFolderSummary
} from '../../shared/types/folderTree';
import {
  dedupeOverlappingFolderPaths,
  normalizeFolderPathForComparison
} from '../../shared/utils/folderPathSelection';
export { dedupeOverlappingFolderPaths, isPathAtOrInside } from '../../shared/utils/folderPathSelection';

interface FolderTreeSelectionRestoreResult {
  selectionKeys: FolderTreeSelectionKeys;
  matchedFolderPaths: string[];
  missingFolderPaths: string[];
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

export function getFolderTreeSelectionKeysForPaths(
  folderPaths: string[],
  root: FolderTreeNode | null
): FolderTreeSelectionRestoreResult {
  if (!root) {
    return {
      selectionKeys: {},
      matchedFolderPaths: [],
      missingFolderPaths: folderPaths
    };
  }

  const nodeByPath = buildFolderNodeByPath(root);
  const selectionKeys: FolderTreeSelectionKeys = {};
  const matchedFolderPaths: string[] = [];
  const missingFolderPaths: string[] = [];
  const seenPaths = new Set<string>();

  folderPaths.forEach((folderPath) => {
    const normalizedPath = normalizeFolderPathForComparison(folderPath);

    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      return;
    }

    seenPaths.add(normalizedPath);
    const node = nodeByPath.get(normalizedPath);

    if (!node) {
      missingFolderPaths.push(folderPath);
      return;
    }

    selectionKeys[node.key] = {
      checked: true,
      partialChecked: false
    };
    matchedFolderPaths.push(node.path);
  });

  return {
    selectionKeys,
    matchedFolderPaths,
    missingFolderPaths
  };
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
      const node = nodeByPath.get(normalizeFolderPathForComparison(folderPath));

      if (!node) {
        return summary;
      }

      return {
        directVideoCount: summary.directVideoCount + node.directVideoCount,
        directVideoSizeBytes: summary.directVideoSizeBytes + node.directVideoSizeBytes,
        totalVideoCount: summary.totalVideoCount + node.totalVideoCount,
        totalVideoSizeBytes: summary.totalVideoSizeBytes + node.totalVideoSizeBytes
      };
    },
    {
      directVideoCount: 0,
      directVideoSizeBytes: 0,
      totalVideoCount: 0,
      totalVideoSizeBytes: 0
    }
  );

  return {
    selectedFolderPaths,
    dedupedFolderPaths,
    selectedFolderCount: selectedFolderPaths.length,
    dedupedFolderCount: dedupedFolderPaths.length,
    directVideoCount: totals.directVideoCount,
    directVideoSizeBytes: totals.directVideoSizeBytes,
    totalVideoCount: totals.totalVideoCount,
    totalVideoSizeBytes: totals.totalVideoSizeBytes
  };
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
    nodeByPath.set(normalizeFolderPathForComparison(node.path), node);
  });

  return nodeByPath;
}

export function getCheckedFolderTreeKeys(selectionKeys: FolderTreeSelectionKeys): string[] {
  return Object.entries(selectionKeys)
    .filter(([, value]) => isCheckedSelectionKey(value))
    .map(([key]) => key);
}

function isCheckedSelectionKey(value: FolderTreeSelectionKey | boolean | undefined): boolean {
  return value === true || Boolean(value && typeof value === 'object' && value.checked === true);
}

function visitFolderTree(node: FolderTreeNode, visit: (node: FolderTreeNode) => void): void {
  visit(node);
  node.children.forEach((child) => visitFolderTree(child, visit));
}
