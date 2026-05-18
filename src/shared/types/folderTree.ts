export type FolderTreeScanStatus =
  | 'idle'
  | 'scanning'
  | 'complete'
  | 'canceled'
  | 'error';

export type FolderTreeNodeStatus = 'ready' | 'skipped' | 'error';

export type FolderTreeSkipReason =
  | 'system-folder'
  | 'app-temp-folder'
  | 'symlink'
  | 'unreadable'
  | 'invalid-root';

export interface FolderTreeWarning {
  code:
    | 'folder-skipped'
    | 'symlink-skipped'
    | 'unreadable-folder'
    | 'unreadable-video-file'
    | 'invalid-root'
    | 'scan-canceled';
  path: string;
  message: string;
  reason?: FolderTreeSkipReason;
}

export interface FolderTreeNode {
  key: string;
  path: string;
  name: string;
  relativePath: string;
  directVideoCount: number;
  totalVideoCount: number;
  directVideoSizeBytes: number;
  totalVideoSizeBytes: number;
  childFolderCount: number;
  totalFolderCount: number;
  status: FolderTreeNodeStatus;
  children: FolderTreeNode[];
  warning?: FolderTreeWarning | null;
  error?: string | null;
  skipped?: boolean;
  skipReason?: FolderTreeSkipReason | null;
}

export interface FolderTreeRoot {
  path: string;
  name: string;
  label: string;
}

export interface FolderTreeScanProgress {
  scanId: string;
  status: FolderTreeScanStatus;
  rootPath: string;
  currentPath: string | null;
  foldersScanned: number;
  foldersSkipped: number;
  videoFilesFound: number;
  videoSizeBytes: number;
  message: string;
  warning?: FolderTreeWarning | null;
  error?: string | null;
}

export interface FolderTreeScanJobSnapshot extends FolderTreeScanProgress {
  result?: FolderTreeScanResult;
}

export interface FolderTreeScanSummary {
  foldersScanned: number;
  foldersSkipped: number;
  videoFilesFound: number;
  videoSizeBytes: number;
  skippedFolderCount: number;
  errorCount: number;
  warningCount: number;
}

export interface FolderTreeScanResult {
  scanId: string;
  rootPath: string;
  generatedAt: string;
  root: FolderTreeNode;
  summary: FolderTreeScanSummary;
  warnings: FolderTreeWarning[];
}

export interface ChooseFolderTreeRootResult {
  canceled: boolean;
  path: string | null;
  message?: string;
}

export interface ScanFolderTreeRequest {
  rootPath: string;
}

export interface ScanFolderTreeStartResponse {
  scanId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
}

export interface ScanFolderTreeResultResponse {
  scanId?: string;
  status: 'complete' | 'not_found' | 'not_ready' | 'canceled' | 'error' | string;
  message?: string;
  result?: FolderTreeScanResult;
}

export interface CancelFolderTreeScanResponse {
  scanId: string;
  ok: boolean;
  progress?: FolderTreeScanJobSnapshot;
  message?: string;
}

export interface SelectedFolderSummary {
  selectedFolderPaths: string[];
  dedupedFolderPaths: string[];
  selectedFolderCount: number;
  totalVideoCount: number;
  totalVideoSizeBytes: number;
}

export interface FolderTreeSelectionKey {
  checked?: boolean;
  partialChecked?: boolean;
}

export type FolderTreeSelectionKeys = Record<string, FolderTreeSelectionKey>;
