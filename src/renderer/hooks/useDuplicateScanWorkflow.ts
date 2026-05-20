import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DuplicateScanCandidate,
  DuplicateScanJobSnapshot,
  DuplicateScanRequest,
  DuplicateScanResult,
  DuplicateScanSourceInput
} from '../../shared/types/duplicateScan';
import type { FileOperationResult, TrashOperationPlan } from '../../shared/types/fileOperations';
import type { VideoRow } from '../../shared/types/video';
import * as dialogClient from '../api/dialogClient';
import * as duplicateScanClient from '../api/duplicateScanClient';
import * as fileOperationsClient from '../api/fileOperationsClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type DuplicateScanWorkflowActiveAction =
  | 'duplicateScan'
  | 'duplicateTrashPlan'
  | 'duplicateTrashExecute'
  | null;

interface UseDuplicateScanWorkflowOptions {
  selectedVideos: VideoRow[];
  previewOperationHistoryAfterExecution?: boolean;
  openOperationHistory: () => Promise<void>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: DuplicateScanWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UseDuplicateScanWorkflowValue {
  duplicateScanFolder: string;
  duplicateScanProgress: DuplicateScanJobSnapshot | null;
  duplicateScanPercent: number | null;
  duplicateScanResult: DuplicateScanResult | null;
  duplicateScanError: string | null;
  duplicateMarkedCandidateIds: string[];
  duplicateMarkedCandidateCount: number;
  duplicateMarkedCandidateSizeBytes: number;
  duplicateTrashPlan: TrashOperationPlan | null;
  duplicateTrashPlanError: string | null;
  duplicateTrashResult: FileOperationResult | null;
  duplicateTrashResultError: string | null;
  isDuplicateScanDialogVisible: boolean;
  isDuplicateTrashConfirmDialogVisible: boolean;
  isDuplicateTrashResultDialogVisible: boolean;
  canStartDuplicateScan: boolean;
  hasDuplicateScanResults: boolean;
  hasDuplicateScanNoResults: boolean;
  setDuplicateScanFolder: (folder: string) => void;
  openDuplicateScanDialog: () => void;
  closeDuplicateScanDialog: () => void;
  selectDuplicateScanFolder: () => Promise<void>;
  startDuplicateScan: () => Promise<void>;
  cancelDuplicateScan: () => Promise<void>;
  clearDuplicateScanResult: () => void;
  markDuplicateCandidate: (candidateId: string, marked: boolean) => void;
  toggleDuplicateCandidateMark: (candidateId: string) => void;
  clearDuplicateCandidateMarks: () => void;
  createDuplicateTrashPlan: () => Promise<void>;
  closeDuplicateTrashDialog: () => void;
  executeDuplicateTrashPlan: (typedConfirmation: string | null) => Promise<void>;
  closeDuplicateTrashResultDialog: () => void;
  resetDuplicateScanWorkflow: () => void;
}

export function useDuplicateScanWorkflow({
  selectedVideos,
  previewOperationHistoryAfterExecution,
  openOperationHistory,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseDuplicateScanWorkflowOptions): UseDuplicateScanWorkflowValue {
  const [duplicateScanFolder, setDuplicateScanFolderState] = useState('');
  const [duplicateScanJobId, setDuplicateScanJobId] = useState<string | null>(null);
  const [duplicateScanProgress, setDuplicateScanProgress] = useState<DuplicateScanJobSnapshot | null>(null);
  const [duplicateScanResult, setDuplicateScanResult] = useState<DuplicateScanResult | null>(null);
  const [duplicateScanError, setDuplicateScanError] = useState<string | null>(null);
  const [duplicateMarkedCandidateIds, setDuplicateMarkedCandidateIds] = useState<string[]>([]);
  const [duplicateTrashPlan, setDuplicateTrashPlan] = useState<TrashOperationPlan | null>(null);
  const [duplicateTrashPlanError, setDuplicateTrashPlanError] = useState<string | null>(null);
  const [duplicateTrashResult, setDuplicateTrashResult] = useState<FileOperationResult | null>(null);
  const [duplicateTrashResultError, setDuplicateTrashResultError] = useState<string | null>(null);
  const [isDuplicateScanDialogVisible, setIsDuplicateScanDialogVisible] = useState(false);
  const [isDuplicateTrashConfirmDialogVisible, setIsDuplicateTrashConfirmDialogVisible] = useState(false);
  const [isDuplicateTrashResultDialogVisible, setIsDuplicateTrashResultDialogVisible] = useState(false);
  const duplicateScanPercent = getDuplicateScanPercent(duplicateScanProgress);
  const markedSummary = useMemo(
    () => summarizeMarkedCandidates(duplicateScanResult, duplicateMarkedCandidateIds),
    [duplicateMarkedCandidateIds, duplicateScanResult]
  );
  const canStartDuplicateScan = selectedVideos.length > 0 && !isDuplicateScanActive(
    busyState.activeAction,
    duplicateScanProgress
  );
  const hasDuplicateScanResults = Boolean(duplicateScanResult && duplicateScanResult.groups.length > 0);
  const hasDuplicateScanNoResults = Boolean(duplicateScanResult && duplicateScanResult.groups.length === 0);

  const resetDuplicateScanWorkflow = useCallback((): void => {
    setDuplicateScanFolderState('');
    setDuplicateScanJobId(null);
    setDuplicateScanProgress(null);
    setDuplicateScanResult(null);
    setDuplicateScanError(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setIsDuplicateScanDialogVisible(false);
    setIsDuplicateTrashConfirmDialogVisible(false);
    setIsDuplicateTrashResultDialogVisible(false);
  }, []);

  const applyDuplicateScanResult = useCallback((result: DuplicateScanResult): void => {
    setDuplicateScanResult(result);
    setDuplicateScanError(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);

    if (result.groups.length > 0) {
      setIsDuplicateScanDialogVisible(false);
      setWorkflowMessage(
        `Duplicate Scan complete. ${result.matchCount.toLocaleString()} duplicate candidate(s) found.`
      );
      return;
    }

    setIsDuplicateScanDialogVisible(true);
    setWorkflowMessage('No duplicate candidates found.');
  }, [setWorkflowMessage]);

  const loadDuplicateScanResult = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await duplicateScanClient.getDuplicateScanResult(jobId);

      if (response.status !== 'complete' || !response.result) {
        setDuplicateScanError(response.message ?? 'Duplicate Scan result is not ready.');
        return;
      }

      applyDuplicateScanResult(response.result);
    } catch (error: unknown) {
      setDuplicateScanError(getErrorMessage(error, 'Could not load Duplicate Scan result.'));
    }
  }, [applyDuplicateScanResult]);

  useEffect(() => {
    return duplicateScanClient.subscribeToDuplicateScanProgress((progress) => {
      setDuplicateScanProgress(progress);

      if (progress.jobId) {
        setDuplicateScanJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('duplicateScan');
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setDuplicateScanError(null);

        if (progress.result) {
          applyDuplicateScanResult(progress.result);
        } else if (progress.jobId) {
          void loadDuplicateScanResult(progress.jobId);
        }
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setDuplicateScanError(progress.error ?? progress.message ?? 'Duplicate Scan failed.');
        setWorkflowMessage(progress.message ?? 'Duplicate Scan failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setDuplicateScanError(null);
        setWorkflowMessage(progress.message ?? 'Duplicate Scan canceled.');
      }
    });
  }, [applyDuplicateScanResult, loadDuplicateScanResult, setActiveAction, setWorkflowMessage]);

  const setDuplicateScanFolder = useCallback((folder: string): void => {
    setDuplicateScanFolderState(folder);
    setDuplicateScanError(null);
  }, []);

  const openDuplicateScanDialog = useCallback((): void => {
    if (selectedVideos.length === 0) {
      setWorkflowMessage('Select at least one project video before starting a Duplicate Scan.');
      return;
    }

    setDuplicateScanError(null);
    setDuplicateScanProgress(null);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setIsDuplicateTrashConfirmDialogVisible(false);
    setIsDuplicateTrashResultDialogVisible(false);
    setIsDuplicateScanDialogVisible(true);
  }, [selectedVideos.length, setWorkflowMessage]);

  const closeDuplicateScanDialog = useCallback((): void => {
    if (isDuplicateScanActive(busyState.activeAction, duplicateScanProgress)) {
      return;
    }

    setIsDuplicateScanDialogVisible(false);
    setDuplicateScanError(null);
  }, [busyState.activeAction, duplicateScanProgress]);

  const selectDuplicateScanFolder = useCallback(async (): Promise<void> => {
    setActiveAction('duplicateScan');
    setDuplicateScanError(null);

    try {
      const result = await dialogClient.chooseDuplicateScanFolder();

      if (result.canceled) {
        return;
      }

      const selectedPath = result.paths[0];

      if (selectedPath) {
        setDuplicateScanFolderState(selectedPath);
      }

      if (result.invalidPaths.length > 0) {
        setDuplicateScanError(`${result.invalidPaths.length.toLocaleString()} selected path(s) could not be used.`);
      }
    } catch (error: unknown) {
      setDuplicateScanError(getErrorMessage(error, 'Could not choose a Duplicate Scan folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setActiveAction]);

  const startDuplicateScan = useCallback(async (): Promise<void> => {
    const scanFolder = duplicateScanFolder.trim();

    if (selectedVideos.length === 0) {
      setDuplicateScanError('Select at least one project video before starting a Duplicate Scan.');
      return;
    }

    if (!scanFolder) {
      setDuplicateScanError('Choose a folder before starting a Duplicate Scan.');
      return;
    }

    const request: DuplicateScanRequest = {
      scanFolder,
      sources: selectedVideos.map(toDuplicateScanSourceInput)
    };

    setDuplicateScanError(null);
    setDuplicateScanResult(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setDuplicateScanProgress({
      jobId: null,
      scanId: null,
      status: 'starting',
      phase: 'validating',
      scannedFileCount: 0,
      checkedVideoFileCount: 0,
      filenameMatchesFound: 0,
      metadataProcessedCount: 0,
      metadataTotalCount: null,
      currentFile: null,
      message: 'Starting Duplicate Scan.',
      error: null
    });
    setActiveAction('duplicateScan');

    try {
      const response = await duplicateScanClient.startDuplicateScan(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setDuplicateScanError(response.message ?? 'Could not start Duplicate Scan.');
        return;
      }

      setDuplicateScanJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Duplicate Scan started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setDuplicateScanError(getErrorMessage(error, 'Could not start Duplicate Scan.'));
    }
  }, [duplicateScanFolder, selectedVideos, setActiveAction, setWorkflowMessage]);

  const cancelDuplicateScan = useCallback(async (): Promise<void> => {
    if (!duplicateScanJobId) {
      return;
    }

    try {
      const progress = await duplicateScanClient.cancelDuplicateScan(duplicateScanJobId);
      setDuplicateScanProgress(progress);
      setWorkflowMessage(progress.message ?? 'Duplicate Scan canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setDuplicateScanError(getErrorMessage(error, 'Could not cancel Duplicate Scan.'));
    }
  }, [duplicateScanJobId, setActiveAction, setWorkflowMessage]);

  const clearDuplicateScanResult = useCallback((): void => {
    setDuplicateScanResult(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setIsDuplicateTrashConfirmDialogVisible(false);
    setIsDuplicateTrashResultDialogVisible(false);
  }, []);

  const markDuplicateCandidate = useCallback((candidateId: string, marked: boolean): void => {
    if (!duplicateScanResult || !hasDuplicateCandidate(duplicateScanResult, candidateId)) {
      return;
    }

    setDuplicateMarkedCandidateIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (marked) {
        nextIds.add(candidateId);
      } else {
        nextIds.delete(candidateId);
      }

      return [...nextIds];
    });
  }, [duplicateScanResult]);

  const toggleDuplicateCandidateMark = useCallback((candidateId: string): void => {
    if (!duplicateScanResult || !hasDuplicateCandidate(duplicateScanResult, candidateId)) {
      return;
    }

    setDuplicateMarkedCandidateIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(candidateId)) {
        nextIds.delete(candidateId);
      } else {
        nextIds.add(candidateId);
      }

      return [...nextIds];
    });
  }, [duplicateScanResult]);

  const clearDuplicateCandidateMarks = useCallback((): void => {
    setDuplicateMarkedCandidateIds([]);
  }, []);

  const createDuplicateTrashPlan = useCallback(async (): Promise<void> => {
    if (!duplicateScanResult) {
      setDuplicateTrashPlanError('Run a Duplicate Scan before creating a Move to Trash plan.');
      return;
    }

    if (markedSummary.count === 0) {
      setDuplicateTrashPlanError('Mark at least one duplicate candidate before creating a Move to Trash plan.');
      return;
    }

    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setActiveAction('duplicateTrashPlan');

    try {
      const response = await duplicateScanClient.createDuplicateScanTrashPlan({
        scanId: duplicateScanResult.scanId,
        candidateIds: markedSummary.candidateIds
      });

      if (response.status !== 'planned' || !response.plan) {
        const message = response.message ?? 'Could not create a duplicate candidate Move to Trash plan.';
        setDuplicateTrashPlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setDuplicateTrashPlan(response.plan);
      setDuplicateScanResult((result) =>
        result ? applyDuplicateCandidateTrashPlan(result, markedSummary.candidateIds) : result
      );
      setIsDuplicateTrashConfirmDialogVisible(true);
      setWorkflowMessage(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not create a duplicate candidate Move to Trash plan.');
      setDuplicateTrashPlanError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [duplicateScanResult, markedSummary, setActiveAction, setWorkflowMessage]);

  const closeDuplicateTrashDialog = useCallback((): void => {
    if (busyState.activeAction === 'duplicateTrashExecute') {
      return;
    }

    setIsDuplicateTrashConfirmDialogVisible(false);
    setDuplicateTrashPlanError(null);
  }, [busyState.activeAction]);

  const executeDuplicateTrashPlan = useCallback(async (typedConfirmation: string | null): Promise<void> => {
    if (!duplicateTrashPlan) {
      setDuplicateTrashPlanError('Create a duplicate candidate Move to Trash plan before executing.');
      return;
    }

    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setActiveAction('duplicateTrashExecute');

    try {
      const response = await fileOperationsClient.executeTrashPlan({
        planId: duplicateTrashPlan.id,
        confirmed: true,
        typedConfirmation
      });

      if (!response.result) {
        const message = response.message ?? 'Move to Trash did not complete.';
        setDuplicateTrashPlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setDuplicateTrashResult(response.result);
      setDuplicateScanResult((result) =>
        result ? applyDuplicateTrashResult(result, response.result as FileOperationResult) : result
      );
      setDuplicateMarkedCandidateIds([]);
      setIsDuplicateTrashConfirmDialogVisible(false);
      setIsDuplicateTrashResultDialogVisible(true);
      setDuplicateTrashPlan(null);
      setWorkflowMessage(response.message ?? 'Duplicate candidate Move to Trash complete.');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not move duplicate candidates to Trash.');
      setDuplicateTrashPlanError(message);
      setDuplicateTrashResultError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [duplicateTrashPlan, setActiveAction, setWorkflowMessage]);

  const closeDuplicateTrashResultDialog = useCallback((): void => {
    setIsDuplicateTrashResultDialogVisible(false);
    setDuplicateTrashResultError(null);
    if (previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, previewOperationHistoryAfterExecution]);

  return {
    duplicateScanFolder,
    duplicateScanProgress,
    duplicateScanPercent,
    duplicateScanResult,
    duplicateScanError,
    duplicateMarkedCandidateIds,
    duplicateMarkedCandidateCount: markedSummary.count,
    duplicateMarkedCandidateSizeBytes: markedSummary.sizeBytes,
    duplicateTrashPlan,
    duplicateTrashPlanError,
    duplicateTrashResult,
    duplicateTrashResultError,
    isDuplicateScanDialogVisible,
    isDuplicateTrashConfirmDialogVisible,
    isDuplicateTrashResultDialogVisible,
    canStartDuplicateScan,
    hasDuplicateScanResults,
    hasDuplicateScanNoResults,
    setDuplicateScanFolder,
    openDuplicateScanDialog,
    closeDuplicateScanDialog,
    selectDuplicateScanFolder,
    startDuplicateScan,
    cancelDuplicateScan,
    clearDuplicateScanResult,
    markDuplicateCandidate,
    toggleDuplicateCandidateMark,
    clearDuplicateCandidateMarks,
    createDuplicateTrashPlan,
    closeDuplicateTrashDialog,
    executeDuplicateTrashPlan,
    closeDuplicateTrashResultDialog,
    resetDuplicateScanWorkflow
  };
}

function toDuplicateScanSourceInput(video: VideoRow): DuplicateScanSourceInput {
  return {
    id: video.id ?? video.path,
    path: video.path,
    fileName: video.fileName,
    directory: video.directory,
    durationSeconds: video.durationSeconds,
    durationFormatted: video.durationFormatted,
    sizeBytes: video.sizeBytes,
    width: video.width,
    height: video.height,
    resolution: video.resolution,
    bitRate: video.bitRate,
    bitRateMbps: video.bitRateMbps,
    modifiedAt: video.modifiedAt,
    modifiedAtMs: video.modifiedAtMs ?? null,
    fileSystemSizeBytes: video.fileSystemSizeBytes,
    fileType: video.fileType,
    extension: video.extension,
    fileExtension: video.fileExtension
  };
}

function getDuplicateScanPercent(progress: DuplicateScanJobSnapshot | null): number | null {
  if (!progress) {
    return null;
  }

  return (
    getProgressPercent(progress.metadataProcessedCount, progress.metadataTotalCount) ??
    getProgressPercent(progress.checkedVideoFileCount, progress.scannedFileCount)
  );
}

function isDuplicateScanActive(
  activeAction: string | null,
  progress: DuplicateScanJobSnapshot | null
): boolean {
  return activeAction === 'duplicateScan' || progress?.status === 'starting' || progress?.status === 'running';
}

function hasDuplicateCandidate(result: DuplicateScanResult, candidateId: string): boolean {
  return result.groups.some((group) =>
    group.candidates.some((candidate) => candidate.id === candidateId || candidate.path === candidateId)
  );
}

function summarizeMarkedCandidates(
  result: DuplicateScanResult | null,
  markedCandidateIds: string[]
): {
  count: number;
  sizeBytes: number;
  candidateIds: string[];
} {
  if (!result || markedCandidateIds.length === 0) {
    return {
      count: 0,
      sizeBytes: 0,
      candidateIds: []
    };
  }

  const markedIdSet = new Set(markedCandidateIds);
  const candidatesByPath = new Map<string, DuplicateScanCandidate>();

  for (const group of result.groups) {
    for (const candidate of group.candidates) {
      if (markedIdSet.has(candidate.id) || markedIdSet.has(candidate.path)) {
        candidatesByPath.set(candidate.path, candidate);
      }
    }
  }

  const candidates = [...candidatesByPath.values()];

  return {
    count: candidates.length,
    sizeBytes: candidates.reduce((total, candidate) => total + (candidate.sizeBytes ?? 0), 0),
    candidateIds: candidates.map((candidate) => candidate.id)
  };
}

function applyDuplicateCandidateTrashPlan(
  result: DuplicateScanResult,
  candidateIds: string[]
): DuplicateScanResult {
  const candidateIdSet = new Set(candidateIds);

  return {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      candidates: group.candidates.map((candidate) =>
        candidateIdSet.has(candidate.id) || candidateIdSet.has(candidate.path)
          ? {
              ...candidate,
              trashStatus: 'planned',
              trashError: null
            }
          : candidate
      )
    }))
  };
}

function applyDuplicateTrashResult(
  result: DuplicateScanResult,
  trashResult: FileOperationResult
): DuplicateScanResult {
  const resultItemsByPath = new Map(trashResult.items.map((item) => [item.sourcePath, item]));

  return {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      candidates: group.candidates.map((candidate) => {
        const resultItem = resultItemsByPath.get(candidate.path);

        if (!resultItem) {
          return candidate;
        }

        return {
          ...candidate,
          trashStatus:
            resultItem.status === 'success'
              ? 'moved_to_trash'
              : resultItem.status === 'skipped'
                ? 'skipped'
                : resultItem.status === 'failed'
                  ? 'failed'
                  : candidate.trashStatus,
          trashError: resultItem.error ?? null
        };
      })
    }))
  };
}
