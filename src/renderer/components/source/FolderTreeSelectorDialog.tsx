import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { MAX_FOLDER_TREE_DISPLAY_PATH_LENGTH } from '../../../shared/constants/folderTree';
import type {
  FolderTreeScanJobSnapshot,
  FolderTreeScanResult,
  FolderTreeSelectionKeys,
  FolderTreeWarning,
  SelectedFolderSummary
} from '../../../shared/types/folderTree';
import { DialogFooter, DialogHeader } from '../DialogChrome';
import { formatBytes } from '../../helpers/fileSize';
import {
  getFolderTreeSelectionKeysForPaths,
  getFolderTreeSelectionSummary,
  isPathAtOrInside
} from '../../helpers/folderTreeSelection';
import { FolderTreeTable } from './FolderTreeTable';

interface FolderTreeSelectorDialogProps {
  visible: boolean;
  selectedFolderPaths: string[];
  initialRootPath: string | null;
  lastScannedAt: string | null;
  includeSubfolders: boolean;
  isAuditActive: boolean;
  onConfirm: (selection: FolderTreeSelectionConfirm) => Promise<void> | void;
  onHide: () => void;
}

interface FolderTreeSelectionConfirm {
  rootPath: string;
  selectedFolderPaths: string[];
  summary: SelectedFolderSummary;
  lastScannedAt: string | null;
}

export function FolderTreeSelectorDialog({
  visible,
  selectedFolderPaths,
  initialRootPath,
  lastScannedAt,
  includeSubfolders,
  isAuditActive,
  onConfirm,
  onHide
}: FolderTreeSelectorDialogProps): ReactElement {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<FolderTreeScanJobSnapshot | null>(null);
  const [scanResult, setScanResult] = useState<FolderTreeScanResult | null>(null);
  const [selectionKeys, setSelectionKeys] = useState<FolderTreeSelectionKeys>({});
  const [missingSelectedPaths, setMissingSelectedPaths] = useState<string[]>([]);
  const [isChoosingRoot, setIsChoosingRoot] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [isCancelingScan, setIsCancelingScan] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeScanIdRef = useRef<string | null>(null);

  const root = scanResult?.root ?? null;
  const selectedSummary = useMemo(
    () => getFolderTreeSelectionSummary(selectionKeys, root),
    [root, selectionKeys]
  );
  const isScanning = Boolean(scanId) && !scanResult;
  const isBusy = isChoosingRoot || isStartingScan || isScanning || isCancelingScan || isConfirming;
  const friendlyError = error ? getFolderTreeErrorMessage(error) : null;
  const displayRootPath = rootPath
    ? formatMiddleTruncatedPath(rootPath, MAX_FOLDER_TREE_DISPLAY_PATH_LENGTH)
    : 'No root selected';
  const confirmLabel =
    selectedSummary.dedupedFolderCount > 0 ? 'Use Selected Folders' : 'Select Folders to Continue';
  const canConfirm =
    Boolean(rootPath) &&
    Boolean(scanResult) &&
    selectedSummary.dedupedFolderCount > 0 &&
    !isAuditActive &&
    !isScanning &&
    !isConfirming;

  const clearScannedTreeState = useCallback((): void => {
    activeScanIdRef.current = null;
    setScanId(null);
    setScanProgress(null);
    setScanResult(null);
    setSelectionKeys({});
    setMissingSelectedPaths([]);
    setError(null);
  }, []);

  const loadScanResult = useCallback(async (completedScanId: string): Promise<void> => {
    try {
      const response = await window.videoAudit.folderTree.getResult(completedScanId);

      if (response.status === 'complete' && response.result) {
        activeScanIdRef.current = null;
        setScanId(null);
        setScanResult(response.result);
        setError(null);
        return;
      }

      if (response.status === 'error' || response.status === 'canceled') {
        activeScanIdRef.current = null;
        setScanId(null);
        setError(response.message ?? 'Folder tree scan did not complete.');
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not load folder tree scan result.'));
    }
  }, []);

  useEffect(() => {
    if (!visible || scanId || scanResult) {
      return;
    }

    setRootPath(initialRootPath);
  }, [initialRootPath, scanId, scanResult, visible]);

  useEffect(() => {
    return window.videoAudit.folderTree.onScanProgress((progress) => {
      if (progress.scanId !== activeScanIdRef.current) {
        return;
      }

      setScanProgress(progress);

      if (progress.status === 'complete') {
        activeScanIdRef.current = null;
        setScanId(null);
        setError(null);

        if (progress.result) {
          setScanResult(progress.result);
        } else {
          void loadScanResult(progress.scanId);
        }
      }

      if (progress.status === 'error') {
        activeScanIdRef.current = null;
        setScanId(null);
        setError(progress.error ?? progress.message ?? 'Folder tree scan failed.');
      }

      if (progress.status === 'canceled') {
        activeScanIdRef.current = null;
        setScanId(null);
      }
    });
  }, [loadScanResult]);

  useEffect(() => {
    if (!visible || !scanResult) {
      return;
    }

    const pathsOutsideRoot = selectedFolderPaths.filter(
      (folderPath) => !isPathAtOrInside(scanResult.root.path, folderPath)
    );
    const pathsInsideRoot = selectedFolderPaths.filter((folderPath) =>
      isPathAtOrInside(scanResult.root.path, folderPath)
    );
    const restoredSelection = getFolderTreeSelectionKeysForPaths(pathsInsideRoot, scanResult.root);

    setSelectionKeys(restoredSelection.selectionKeys);
    setMissingSelectedPaths([
      ...pathsOutsideRoot,
      ...restoredSelection.missingFolderPaths
    ]);
  }, [scanResult, selectedFolderPaths, visible]);

  const startScan = useCallback(async (nextRootPath: string): Promise<void> => {
    setIsStartingScan(true);
    setError(null);
    setScanProgress(null);
    setScanResult(null);
    setSelectionKeys({});
    setMissingSelectedPaths([]);

    try {
      const response = await window.videoAudit.folderTree.scanRoot(nextRootPath);

      if (response.status !== 'started' || !response.scanId) {
        setError(response.message ?? 'Could not start folder tree scan.');
        return;
      }

      activeScanIdRef.current = response.scanId;
      setScanId(response.scanId);
      setScanProgress({
        scanId: response.scanId,
        status: 'scanning',
        rootPath: nextRootPath,
        currentPath: null,
        foldersScanned: 0,
        foldersSkipped: 0,
        videoFilesFound: 0,
        videoSizeBytes: 0,
        message: response.message ?? 'Folder tree scan started.',
        warning: null,
        error: null
      });
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not start folder tree scan.'));
    } finally {
      setIsStartingScan(false);
    }
  }, []);

  const chooseRootFolder = useCallback(async (): Promise<void> => {
    if (isBusy || isAuditActive) {
      return;
    }

    setIsChoosingRoot(true);
    setError(null);

    try {
      const result = await window.videoAudit.folderTree.chooseRootFolder();

      if (result.canceled) {
        return;
      }

      if (!result.path) {
        setError(result.message ?? 'Choose a valid folder tree root.');
        return;
      }

      setRootPath(result.path);
      await startScan(result.path);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not choose folder tree root.'));
    } finally {
      setIsChoosingRoot(false);
    }
  }, [isAuditActive, isBusy, startScan]);

  const refreshTree = useCallback(async (): Promise<void> => {
    if (!rootPath || isBusy || isAuditActive) {
      return;
    }

    await startScan(rootPath);
  }, [isAuditActive, isBusy, rootPath, startScan]);

  const cancelActiveScan = useCallback(async (): Promise<void> => {
    const activeScanId = activeScanIdRef.current;

    if (!activeScanId) {
      return;
    }

    setIsCancelingScan(true);

    try {
      const response = await window.videoAudit.folderTree.cancelScan(activeScanId);

      if (response.progress) {
        setScanProgress(response.progress);
      }

      if (!response.ok) {
        setError(response.message ?? 'Could not cancel folder tree scan.');
        return;
      }

      activeScanIdRef.current = null;
      setScanId(null);
      setError(null);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not cancel folder tree scan.'));
    } finally {
      setIsCancelingScan(false);
    }
  }, []);

  const handleCancel = useCallback(async (): Promise<void> => {
    if (activeScanIdRef.current) {
      await cancelActiveScan();
    }

    clearScannedTreeState();
    onHide();
  }, [cancelActiveScan, clearScannedTreeState, onHide]);

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!rootPath || !canConfirm) {
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm({
        rootPath,
        selectedFolderPaths: selectedSummary.dedupedFolderPaths,
        summary: selectedSummary,
        lastScannedAt: scanResult?.generatedAt ?? null
      });
      clearScannedTreeState();
      onHide();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not apply selected folders.'));
    } finally {
      setIsConfirming(false);
    }
  }, [canConfirm, clearScannedTreeState, onConfirm, onHide, rootPath, scanResult?.generatedAt, selectedSummary]);

  const footer = (
    <DialogFooter
      left={
        isScanning ? (
          <Button
            label="Cancel Scan"
            icon="pi pi-times"
            severity="danger"
            outlined
            loading={isCancelingScan}
            onClick={() => {
              void cancelActiveScan();
            }}
          />
        ) : null
      }
    >
      <Button
        label="Cancel"
        icon="pi pi-ban"
        severity="secondary"
        outlined
        disabled={isConfirming}
        onClick={() => {
          void handleCancel();
        }}
      />
      <Button
        label={confirmLabel}
        icon="pi pi-check"
        severity="success"
        loading={isConfirming}
        disabled={!canConfirm}
        onClick={() => {
          void handleConfirm();
        }}
      />
    </DialogFooter>
  );

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Sources"
          title="Choose Folders"
          description="Select folders from a scanned directory tree."
          meta={
            scanResult ? (
              <Tag value={formatGeneratedAt(scanResult.generatedAt)} />
            ) : lastScannedAt ? (
              <Tag value={formatGeneratedAt(lastScannedAt)} severity="secondary" />
            ) : null
          }
        />
      }
      visible={visible}
      className="app-dialog folder-tree-selector-dialog"
      modal
      draggable={false}
      footer={footer}
      onHide={() => {
        void handleCancel();
      }}
    >
      <div className="folder-tree-selector-content">
        <section className="folder-tree-root-panel" aria-label="Folder tree root">
          <div className="folder-tree-root-copy">
            <span>Root</span>
            <strong title={rootPath ?? undefined}>{displayRootPath}</strong>
          </div>
          <div className="folder-tree-root-actions">
            <Button
              label={rootPath ? 'Change Root' : 'Choose Root'}
              icon="pi pi-folder-open"
              severity="info"
              loading={isChoosingRoot}
              disabled={isBusy || isAuditActive}
              onClick={() => {
                void chooseRootFolder();
              }}
            />
            <Button
              label="Refresh Tree"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              loading={isStartingScan || isScanning}
              disabled={!rootPath || isBusy || isAuditActive}
              onClick={() => {
                void refreshTree();
              }}
            />
          </div>
        </section>

        {scanProgress ? <FolderTreeScanStatus progress={scanProgress} /> : null}
        {isScanning ? <ProgressBar mode="indeterminate" className="folder-tree-progress-bar" /> : null}
        {friendlyError ? <Message severity="error" text={friendlyError} /> : null}
        {missingSelectedPaths.length > 0 ? (
          <Message
            severity="warn"
            text={`${missingSelectedPaths.length.toLocaleString()} previously selected folder(s) are not available in this tree.`}
          />
        ) : null}
        {scanResult ? <FolderTreeScanOutcome result={scanResult} /> : null}
        {scanResult?.warnings.length ? <FolderTreeWarnings warnings={scanResult.warnings} /> : null}

        {scanResult ? (
          <>
            <FolderTreeTable
              root={scanResult.root}
              selectionKeys={selectionKeys}
              onSelectionKeysChange={setSelectionKeys}
              emptyMessage="No folders found."
              scrollHeight="460px"
            />
            <FolderTreeSelectedSummary summary={selectedSummary} includeSubfolders={includeSubfolders} />
          </>
        ) : (
          <FolderTreeEmptyState
            isChoosingRoot={isChoosingRoot}
            isStartingScan={isStartingScan}
            isScanning={isScanning}
            progress={scanProgress}
            rootPath={rootPath}
            error={friendlyError}
          />
        )}
      </div>
    </Dialog>
  );
}

function FolderTreeScanStatus({ progress }: { progress: FolderTreeScanJobSnapshot }): ReactElement {
  const currentPath = progress.currentPath
    ? formatMiddleTruncatedPath(progress.currentPath)
    : formatMiddleTruncatedPath(progress.rootPath);

  return (
    <section className="folder-tree-scan-status" aria-label="Folder tree scan status">
      <div className="folder-tree-scan-copy">
        <span>{formatScanStatus(progress.status)}</span>
        <strong>{progress.message ?? 'Folder tree scan update.'}</strong>
        <small title={progress.currentPath ?? progress.rootPath}>{currentPath}</small>
      </div>
      <div className="folder-tree-scan-counts">
        <Tag value={`${progress.foldersScanned.toLocaleString()} folders`} severity="info" />
        <Tag value={`${progress.videoFilesFound.toLocaleString()} videos`} severity="success" />
        <Tag value={formatBytes(progress.videoSizeBytes)} severity="secondary" />
        {progress.foldersSkipped > 0 ? (
          <Tag value={`${progress.foldersSkipped.toLocaleString()} skipped`} severity="warning" />
        ) : null}
      </div>
    </section>
  );
}

function FolderTreeScanOutcome({ result }: { result: FolderTreeScanResult }): ReactElement | null {
  const noVideosFound = result.summary.videoFilesFound === 0;
  const rootOnly = result.root.totalFolderCount <= 1;

  if (noVideosFound) {
    return (
      <Message
        severity="info"
        text={
          rootOnly
            ? 'No videos found under this folder. The root has no scanned subfolders.'
            : 'No videos found under this folder.'
        }
      />
    );
  }

  if (rootOnly) {
    return (
      <Message
        severity="info"
        text="This root has no scanned subfolders. Select the root folder to audit the videos directly inside it."
      />
    );
  }

  return null;
}

function FolderTreeWarnings({ warnings }: { warnings: FolderTreeWarning[] }): ReactElement {
  const unreadableFolderCount = warnings.filter((warning) => warning.code === 'unreadable-folder').length;
  const skippedFolderCount = warnings.filter(
    (warning) => warning.code === 'folder-skipped' || warning.code === 'symlink-skipped'
  ).length;
  const unreadableVideoCount = warnings.filter((warning) => warning.code === 'unreadable-video-file').length;
  const warningText = [
    unreadableFolderCount > 0
      ? `${unreadableFolderCount.toLocaleString()} unreadable folder(s)`
      : null,
    skippedFolderCount > 0 ? `${skippedFolderCount.toLocaleString()} skipped folder(s)` : null,
    unreadableVideoCount > 0
      ? `${unreadableVideoCount.toLocaleString()} unreadable video file(s)`
      : null
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="folder-tree-warning-panel" aria-label="Folder tree scan warnings">
      <div>
        <i className="pi pi-exclamation-triangle" />
        <strong>Some folders could not be read and were skipped.</strong>
      </div>
      <span>
        {warningText.length > 0
          ? warningText.join(' - ')
          : `${warnings.length.toLocaleString()} folder tree warning(s) were recorded during the scan.`}
      </span>
      <ul>
        {warnings.slice(0, 3).map((warning) => (
          <li key={`${warning.code}:${warning.path}`} title={warning.path}>
            {formatMiddleTruncatedPath(warning.path)} - {warning.message}
          </li>
        ))}
      </ul>
      {warnings.length > 3 ? (
        <small>{(warnings.length - 3).toLocaleString()} more warning(s) hidden.</small>
      ) : null}
    </section>
  );
}

function FolderTreeEmptyState({
  isChoosingRoot,
  isStartingScan,
  isScanning,
  progress,
  rootPath,
  error
}: {
  isChoosingRoot: boolean;
  isStartingScan: boolean;
  isScanning: boolean;
  progress: FolderTreeScanJobSnapshot | null;
  rootPath: string | null;
  error: string | null;
}): ReactElement {
  if (error) {
    return (
      <div className="folder-tree-empty-state is-error">
        <i className="pi pi-exclamation-triangle" />
        <strong>Tree unavailable</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (progress?.status === 'canceled') {
    return (
      <div className="folder-tree-empty-state is-canceled">
        <i className="pi pi-ban" />
        <strong>Scan canceled</strong>
        <span>Refresh the tree to scan this root again.</span>
      </div>
    );
  }

  if (isChoosingRoot) {
    return (
      <div className="folder-tree-empty-state">
        <i className="pi pi-folder-open" />
        <strong>Choosing root folder</strong>
        <span>Select the top-level folder to scan.</span>
      </div>
    );
  }

  if (isStartingScan || isScanning) {
    return (
      <div className="folder-tree-empty-state">
        <i className="pi pi-spin pi-spinner" />
        <strong>{isStartingScan ? 'Starting scan' : 'Scanning folder tree'}</strong>
        <span>The full directory tree is being scanned eagerly before it is displayed.</span>
      </div>
    );
  }

  return (
    <div className="folder-tree-empty-state">
      <i className="pi pi-folder-open" />
      <strong>{rootPath ? 'Refresh the saved root' : 'Choose a root folder'}</strong>
      <span>
        {rootPath
          ? 'The saved root is ready to rescan. No folder tree is loaded from cache.'
          : 'The selected tree will appear here after the scan completes.'}
      </span>
    </div>
  );
}

function FolderTreeSelectedSummary({
  summary,
  includeSubfolders
}: {
  summary: SelectedFolderSummary;
  includeSubfolders: boolean;
}): ReactElement {
  const folderText =
    summary.dedupedFolderCount === 0
      ? 'No folders selected'
      : summary.selectedFolderCount === summary.dedupedFolderCount
      ? `${summary.dedupedFolderCount.toLocaleString()} folders`
      : `${summary.selectedFolderCount.toLocaleString()} selected / ${summary.dedupedFolderCount.toLocaleString()} audited`;
  const videoCount = includeSubfolders ? summary.totalVideoCount : summary.directVideoCount;
  const videoSizeBytes = includeSubfolders
    ? summary.totalVideoSizeBytes
    : summary.directVideoSizeBytes;
  const countLabel = includeSubfolders ? 'recursive videos' : 'direct videos';

  return (
    <section className="folder-tree-selected-summary" aria-label="Selected folder summary">
      <span>{summary.dedupedFolderCount > 0 ? 'Selected' : 'Selection required'}</span>
      <strong>
        {summary.dedupedFolderCount > 0
          ? `${folderText} - ${videoCount.toLocaleString()} ${countLabel} - ${formatBytes(videoSizeBytes)}`
          : 'Select at least one folder to continue.'}
      </strong>
    </section>
  );
}

function formatScanStatus(status: FolderTreeScanJobSnapshot['status']): string {
  if (status === 'scanning') {
    return 'Scanning';
  }

  if (status === 'complete') {
    return 'Complete';
  }

  if (status === 'canceled') {
    return 'Canceled';
  }

  if (status === 'error') {
    return 'Error';
  }

  return 'Idle';
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Scanned';
  }

  return `Scanned ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

function formatMiddleTruncatedPath(
  value: string,
  maxLength = MAX_FOLDER_TREE_DISPLAY_PATH_LENGTH
): string {
  if (value.length <= maxLength) {
    return value;
  }

  const sideLength = Math.floor((maxLength - 3) / 2);
  const start = value.slice(0, sideLength);
  const end = value.slice(value.length - sideLength);

  return `${start}...${end}`;
}

function getFolderTreeErrorMessage(error: string): string {
  if (isRootUnavailableError(error)) {
    return 'The selected root is no longer available. Choose a new root or reconnect the drive, then refresh the tree.';
  }

  return error;
}

function isRootUnavailableError(error: string): boolean {
  const lowerError = error.toLowerCase();

  return (
    lowerError.includes('root could not be read') ||
    lowerError.includes('enoent') ||
    lowerError.includes('no such file')
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
