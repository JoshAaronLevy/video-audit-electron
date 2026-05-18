import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  FolderTreeScanJobSnapshot,
  FolderTreeScanResult,
  FolderTreeSelectionKeys,
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
  isAuditActive: boolean;
  onConfirm: (selection: FolderTreeSelectionConfirm) => Promise<void> | void;
  onHide: () => void;
}

interface FolderTreeSelectionConfirm {
  rootPath: string;
  selectedFolderPaths: string[];
  summary: SelectedFolderSummary;
}

export function FolderTreeSelectorDialog({
  visible,
  selectedFolderPaths,
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
  const isScanning = Boolean(scanId);
  const isBusy = isChoosingRoot || isStartingScan || isScanning || isCancelingScan || isConfirming;
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
        setScanResult(response.result);
        setError(null);
        return;
      }

      if (response.status === 'error' || response.status === 'canceled') {
        setError(response.message ?? 'Folder tree scan did not complete.');
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not load folder tree scan result.'));
    }
  }, []);

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
        summary: selectedSummary
      });
      clearScannedTreeState();
      onHide();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Could not apply selected folders.'));
    } finally {
      setIsConfirming(false);
    }
  }, [canConfirm, clearScannedTreeState, onConfirm, onHide, rootPath, selectedSummary]);

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
        label="Use Selected Folders"
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
          meta={scanResult ? <Tag value={formatGeneratedAt(scanResult.generatedAt)} /> : null}
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
            <strong title={rootPath ?? undefined}>{rootPath ?? 'No root selected'}</strong>
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
        {error ? <Message severity="error" text={error} /> : null}
        {missingSelectedPaths.length > 0 ? (
          <Message
            severity="warn"
            text={`${missingSelectedPaths.length.toLocaleString()} previously selected folder(s) are not available in this tree.`}
          />
        ) : null}
        {scanResult?.warnings.length ? (
          <Message
            severity="warn"
            text={`${scanResult.warnings.length.toLocaleString()} folder tree warning(s) were recorded during the scan.`}
          />
        ) : null}

        {scanResult ? (
          <>
            <FolderTreeTable
              root={scanResult.root}
              selectionKeys={selectionKeys}
              onSelectionKeysChange={setSelectionKeys}
              emptyMessage="No folders found."
              scrollHeight="460px"
            />
            <FolderTreeSelectedSummary summary={selectedSummary} />
          </>
        ) : (
          <div className="folder-tree-empty-state">
            <i className="pi pi-folder-open" />
            <strong>{isScanning ? 'Scanning folder tree' : 'Choose a root folder'}</strong>
            <span>
              {isScanning
                ? 'The full directory tree is being scanned.'
                : 'The selected tree will appear here after the scan completes.'}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function FolderTreeScanStatus({ progress }: { progress: FolderTreeScanJobSnapshot }): ReactElement {
  return (
    <section className="folder-tree-scan-status" aria-label="Folder tree scan status">
      <div>
        <span>{progress.status === 'scanning' ? 'Scanning' : progress.status}</span>
        <strong>{progress.message ?? 'Folder tree scan update.'}</strong>
      </div>
      <div className="folder-tree-scan-counts">
        <Tag value={`${progress.foldersScanned.toLocaleString()} folders`} severity="info" />
        <Tag value={`${progress.videoFilesFound.toLocaleString()} videos`} severity="success" />
        <Tag value={formatBytes(progress.videoSizeBytes)} severity="secondary" />
      </div>
    </section>
  );
}

function FolderTreeSelectedSummary({ summary }: { summary: SelectedFolderSummary }): ReactElement {
  const folderText =
    summary.selectedFolderCount === summary.dedupedFolderCount
      ? `${summary.dedupedFolderCount.toLocaleString()} folders`
      : `${summary.selectedFolderCount.toLocaleString()} selected / ${summary.dedupedFolderCount.toLocaleString()} audited`;

  return (
    <section className="folder-tree-selected-summary" aria-label="Selected folder summary">
      <span>Selected</span>
      <strong>
        {folderText} - {summary.totalVideoCount.toLocaleString()} videos -{' '}
        {formatBytes(summary.totalVideoSizeBytes)}
      </strong>
    </section>
  );
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
