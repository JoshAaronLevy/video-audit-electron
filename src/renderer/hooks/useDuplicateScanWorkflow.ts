import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DuplicateCandidateFile,
  DuplicateReviewScanJobSnapshot,
  DuplicateReviewScanResult,
  DuplicateScanCandidate,
  DuplicateScanJobSnapshot,
  DuplicateScanMode,
  DuplicateScanProfile,
  DuplicateScanSourceInput,
  ImprovedDuplicateScanJobSnapshot,
  ImprovedDuplicateScanRequest
} from '../../shared/types/duplicateScan';
import {
  IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE,
  IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE,
  IMPROVED_DUPLICATE_SCAN_FAST_PROFILE,
  IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE,
  isImprovedDuplicateScanResult
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

type DuplicateScanJobKind = 'exact' | 'improved';

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
  duplicateScanModes: DuplicateScanMode[];
  duplicateScanProfile: DuplicateScanProfile;
  duplicateScanProgress: DuplicateReviewScanJobSnapshot | null;
  duplicateScanPercent: number | null;
  duplicateScanResult: DuplicateReviewScanResult | null;
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
  canReviewMarkedDuplicateCandidates: boolean;
  hasDuplicateScanResults: boolean;
  hasDuplicateScanNoResults: boolean;
  setDuplicateScanFolder: (folder: string) => void;
  setDuplicateScanModes: (modes: DuplicateScanMode[]) => void;
  setDuplicateScanProfile: (profile: DuplicateScanProfile) => void;
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

const DEFAULT_DUPLICATE_SCAN_MODES: DuplicateScanMode[] = ['filename-exact'];
const FAST_SAMPLE_INTERVAL_SECONDS = 10;
const FAST_MAX_SAMPLES_PER_VIDEO = 120;
const DEEP_SAMPLE_INTERVAL_SECONDS = 2;
const DEEP_MAX_SAMPLES_PER_VIDEO = 600;
const DEFAULT_HASH_DISTANCE_THRESHOLD = 8;
const DEFAULT_VISUAL_MIN_SEQUENTIAL_MATCHES = 8;
const DEFAULT_CONTAINED_MIN_SEQUENTIAL_MATCHES = 5;

export function useDuplicateScanWorkflow({
  selectedVideos,
  previewOperationHistoryAfterExecution,
  openOperationHistory,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseDuplicateScanWorkflowOptions): UseDuplicateScanWorkflowValue {
  const [duplicateScanFolder, setDuplicateScanFolderState] = useState('');
  const [duplicateScanModes, setDuplicateScanModesState] = useState<DuplicateScanMode[]>(
    DEFAULT_DUPLICATE_SCAN_MODES
  );
  const [duplicateScanProfile, setDuplicateScanProfileState] = useState<DuplicateScanProfile>(
    IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE
  );
  const [duplicateScanJobId, setDuplicateScanJobId] = useState<string | null>(null);
  const [duplicateScanJobKind, setDuplicateScanJobKind] = useState<DuplicateScanJobKind | null>(null);
  const [duplicateScanProgress, setDuplicateScanProgress] =
    useState<DuplicateReviewScanJobSnapshot | null>(null);
  const [duplicateScanResult, setDuplicateScanResult] =
    useState<DuplicateReviewScanResult | null>(null);
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
  const canReviewMarkedDuplicateCandidates = Boolean(duplicateScanResult);
  const hasDuplicateScanResults = Boolean(duplicateScanResult && duplicateScanResult.groups.length > 0);
  const hasDuplicateScanNoResults = Boolean(duplicateScanResult && duplicateScanResult.groups.length === 0);

  const resetDuplicateScanWorkflow = useCallback((): void => {
    setDuplicateScanFolderState('');
    setDuplicateScanModesState(DEFAULT_DUPLICATE_SCAN_MODES);
    setDuplicateScanProfileState(IMPROVED_DUPLICATE_SCAN_DEFAULT_PROFILE);
    setDuplicateScanJobId(null);
    setDuplicateScanJobKind(null);
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

  const applyDuplicateScanResult = useCallback((result: DuplicateReviewScanResult): void => {
    const candidateCount = getDuplicateReviewCandidateCount(result);

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
        `Duplicate Scan complete. ${candidateCount.toLocaleString()} duplicate candidate(s) found.`
      );
      return;
    }

    setIsDuplicateScanDialogVisible(true);
    setWorkflowMessage('No duplicate candidates found.');
  }, [setWorkflowMessage]);

  const loadDuplicateScanResult = useCallback(async (
    jobId: string,
    jobKind: DuplicateScanJobKind
  ): Promise<void> => {
    try {
      const response =
        jobKind === 'improved'
          ? await duplicateScanClient.getImprovedDuplicateScanResult(jobId)
          : await duplicateScanClient.getDuplicateScanResult(jobId);

      if (response.status !== 'complete' || !response.result) {
        setDuplicateScanError(response.message ?? 'Duplicate Scan result is not ready.');
        return;
      }

      applyDuplicateScanResult(response.result);
    } catch (error: unknown) {
      setDuplicateScanError(getErrorMessage(error, 'Could not load Duplicate Scan result.'));
    }
  }, [applyDuplicateScanResult]);

  const handleDuplicateScanProgress = useCallback((
    progress: DuplicateReviewScanJobSnapshot,
    jobKind: DuplicateScanJobKind
  ): void => {
    setDuplicateScanProgress(progress);
    setDuplicateScanJobKind(jobKind);

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
        void loadDuplicateScanResult(progress.jobId, jobKind);
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
  }, [applyDuplicateScanResult, loadDuplicateScanResult, setActiveAction, setWorkflowMessage]);

  useEffect(() => {
    return duplicateScanClient.subscribeToDuplicateScanProgress((progress) => {
      if (duplicateScanJobKind && duplicateScanJobKind !== 'exact') {
        return;
      }

      handleDuplicateScanProgress(progress, 'exact');
    });
  }, [duplicateScanJobKind, handleDuplicateScanProgress]);

  useEffect(() => {
    return duplicateScanClient.subscribeToImprovedDuplicateScanProgress((progress) => {
      if (duplicateScanJobKind && duplicateScanJobKind !== 'improved') {
        return;
      }

      handleDuplicateScanProgress(progress, 'improved');
    });
  }, [duplicateScanJobKind, handleDuplicateScanProgress]);

  const setDuplicateScanFolder = useCallback((folder: string): void => {
    setDuplicateScanFolderState(folder);
    setDuplicateScanError(null);
  }, []);

  const setDuplicateScanModes = useCallback((modes: DuplicateScanMode[]): void => {
    setDuplicateScanModesState(normalizeDuplicateScanModes(modes));
    setDuplicateScanError(null);
  }, []);

  const setDuplicateScanProfile = useCallback((profile: DuplicateScanProfile): void => {
    setDuplicateScanProfileState(
      profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
        ? IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE
        : IMPROVED_DUPLICATE_SCAN_FAST_PROFILE
    );
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
    const modes = normalizeDuplicateScanModes(duplicateScanModes);
    const useImprovedScan = shouldUseImprovedDuplicateScan(modes);

    if (selectedVideos.length === 0) {
      setDuplicateScanError('Select at least one project video before starting a Duplicate Scan.');
      return;
    }

    if (!scanFolder) {
      setDuplicateScanError('Choose a folder before starting a Duplicate Scan.');
      return;
    }

    const sources = selectedVideos.map(toDuplicateScanSourceInput);

    setDuplicateScanError(null);
    setDuplicateScanResult(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setDuplicateScanJobKind(useImprovedScan ? 'improved' : 'exact');
    setDuplicateScanProgress(
      useImprovedScan
        ? createInitialImprovedDuplicateScanProgress()
        : createInitialExactDuplicateScanProgress()
    );
    setActiveAction('duplicateScan');

    try {
      const response = useImprovedScan
        ? await duplicateScanClient.startImprovedDuplicateScan(
            createImprovedDuplicateScanRequest(scanFolder, sources, modes, duplicateScanProfile)
          )
        : await duplicateScanClient.startDuplicateScan({
            scanFolder,
            sources
          });

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
  }, [
    duplicateScanFolder,
    duplicateScanModes,
    duplicateScanProfile,
    selectedVideos,
    setActiveAction,
    setWorkflowMessage
  ]);

  const cancelDuplicateScan = useCallback(async (): Promise<void> => {
    if (!duplicateScanJobId) {
      return;
    }

    try {
      const effectiveJobKind =
        duplicateScanJobKind ?? (isImprovedDuplicateScanProgress(duplicateScanProgress) ? 'improved' : 'exact');
      const progress =
        effectiveJobKind === 'improved'
          ? await duplicateScanClient.cancelImprovedDuplicateScan(duplicateScanJobId)
          : await duplicateScanClient.cancelDuplicateScan(duplicateScanJobId);
      setDuplicateScanProgress(progress);
      setWorkflowMessage(progress.message ?? 'Duplicate Scan canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setDuplicateScanError(getErrorMessage(error, 'Could not cancel Duplicate Scan.'));
    }
  }, [duplicateScanJobId, duplicateScanJobKind, duplicateScanProgress, setActiveAction, setWorkflowMessage]);

  const clearDuplicateScanResult = useCallback((): void => {
    setDuplicateScanResult(null);
    setDuplicateScanJobKind(null);
    setDuplicateMarkedCandidateIds([]);
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateTrashResult(null);
    setDuplicateTrashResultError(null);
    setIsDuplicateTrashConfirmDialogVisible(false);
    setIsDuplicateTrashResultDialogVisible(false);
  }, []);

  const markDuplicateCandidate = useCallback((candidateId: string, marked: boolean): void => {
    if (!duplicateScanResult || !hasMarkableDuplicateCandidate(duplicateScanResult, candidateId)) {
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
    if (!duplicateScanResult || !hasMarkableDuplicateCandidate(duplicateScanResult, candidateId)) {
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
    setDuplicateTrashPlan(null);
    setDuplicateTrashPlanError(null);
    setDuplicateScanResult((result) =>
      result ? clearDuplicateCandidateTrashPlan(result) : result
    );
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
    duplicateScanModes,
    duplicateScanProfile,
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
    canReviewMarkedDuplicateCandidates,
    hasDuplicateScanResults,
    hasDuplicateScanNoResults,
    setDuplicateScanFolder,
    setDuplicateScanModes,
    setDuplicateScanProfile,
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

function createInitialExactDuplicateScanProgress(): DuplicateScanJobSnapshot {
  return {
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
  };
}

function createInitialImprovedDuplicateScanProgress(): ImprovedDuplicateScanJobSnapshot {
  return {
    jobId: null,
    scanId: null,
    status: 'starting',
    phase: 'validating',
    totalFiles: null,
    processedFiles: 0,
    fingerprintedFiles: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheStale: 0,
    cacheErrors: 0,
    candidateGroupCount: 0,
    currentFile: null,
    message: 'Starting improved Duplicate Scan.',
    error: null
  };
}

function createImprovedDuplicateScanRequest(
  scanFolder: string,
  sources: DuplicateScanSourceInput[],
  modes: DuplicateScanMode[],
  profile: DuplicateScanProfile
): ImprovedDuplicateScanRequest {
  const isDeepProfile = profile === IMPROVED_DUPLICATE_SCAN_DEEP_PROFILE;

  return {
    scanFolder,
    sources,
    options: {
      sourceScope: IMPROVED_DUPLICATE_SCAN_SOURCE_SCOPE,
      modes,
      profile,
      sampleIntervalSeconds: isDeepProfile
        ? DEEP_SAMPLE_INTERVAL_SECONDS
        : FAST_SAMPLE_INTERVAL_SECONDS,
      maxSamplesPerVideo: isDeepProfile
        ? DEEP_MAX_SAMPLES_PER_VIDEO
        : FAST_MAX_SAMPLES_PER_VIDEO,
      minSequentialMatches: modes.includes('contained-clip')
        ? DEFAULT_CONTAINED_MIN_SEQUENTIAL_MATCHES
        : DEFAULT_VISUAL_MIN_SEQUENTIAL_MATCHES,
      hashDistanceThreshold: DEFAULT_HASH_DISTANCE_THRESHOLD,
      includeExistingExactFilenameMatches: modes.includes('filename-exact'),
      useCachedFingerprints: true
    }
  };
}

function getDuplicateScanPercent(progress: DuplicateReviewScanJobSnapshot | null): number | null {
  if (!progress) {
    return null;
  }

  if (isImprovedDuplicateScanProgress(progress)) {
    return (
      getProgressPercent(progress.processedFiles, progress.totalFiles) ??
      getProgressPercent(progress.fingerprintedFiles, progress.totalFiles)
    );
  }

  return (
    getProgressPercent(progress.metadataProcessedCount, progress.metadataTotalCount) ??
    getProgressPercent(progress.checkedVideoFileCount, progress.scannedFileCount)
  );
}

function isDuplicateScanActive(
  activeAction: string | null,
  progress: DuplicateReviewScanJobSnapshot | null
): boolean {
  return activeAction === 'duplicateScan' || progress?.status === 'starting' || progress?.status === 'running';
}

function normalizeDuplicateScanModes(modes: DuplicateScanMode[]): DuplicateScanMode[] {
  const normalizedModes: DuplicateScanMode[] = [];

  for (const mode of modes) {
    if (
      (mode === 'filename-exact' ||
        mode === 'visual-fingerprint' ||
        mode === 'contained-clip') &&
      !normalizedModes.includes(mode)
    ) {
      normalizedModes.push(mode);
    }
  }

  return normalizedModes.length > 0 ? normalizedModes : DEFAULT_DUPLICATE_SCAN_MODES;
}

function shouldUseImprovedDuplicateScan(modes: DuplicateScanMode[]): boolean {
  return modes.length !== 1 || modes[0] !== 'filename-exact';
}

function isImprovedDuplicateScanProgress(
  progress: DuplicateReviewScanJobSnapshot | null
): progress is ImprovedDuplicateScanJobSnapshot {
  return Boolean(progress && 'processedFiles' in progress && 'candidateGroupCount' in progress);
}

function getDuplicateReviewCandidateCount(result: DuplicateReviewScanResult): number {
  if (isImprovedDuplicateScanResult(result)) {
    return result.summary.candidateFileCount;
  }

  return result.matchCount;
}

function hasMarkableDuplicateCandidate(result: DuplicateReviewScanResult, candidateId: string): boolean {
  if (isImprovedDuplicateScanResult(result)) {
    return result.groups.some((group) =>
      group.files.some(
        (file) =>
          file.role === 'candidate' &&
          (file.id === candidateId || file.filePath === candidateId) &&
          file.reviewStatus !== 'moved-to-trash' &&
          file.reviewStatus !== 'archived' &&
          file.reviewStatus !== 'removed-from-table' &&
          file.reviewStatus !== 'failed'
      )
    );
  }

  return result.groups.some((group) =>
    group.candidates.some(
      (candidate) =>
        (candidate.id === candidateId || candidate.path === candidateId) &&
        candidate.trashStatus !== 'moved_to_trash'
    )
  );
}

function summarizeMarkedCandidates(
  result: DuplicateReviewScanResult | null,
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

  if (isImprovedDuplicateScanResult(result)) {
    return summarizeMarkedImprovedCandidates(result, markedCandidateIds);
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

function summarizeMarkedImprovedCandidates(
  result: DuplicateReviewScanResult,
  markedCandidateIds: string[]
): {
  count: number;
  sizeBytes: number;
  candidateIds: string[];
} {
  const markedIdSet = new Set(markedCandidateIds);
  const candidatesByPath = new Map<string, DuplicateCandidateFile>();

  if (!isImprovedDuplicateScanResult(result)) {
    return {
      count: 0,
      sizeBytes: 0,
      candidateIds: []
    };
  }

  for (const group of result.groups) {
    for (const file of group.files) {
      if (file.role === 'candidate' && (markedIdSet.has(file.id) || markedIdSet.has(file.filePath))) {
        candidatesByPath.set(file.filePath, file);
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
  result: DuplicateReviewScanResult,
  candidateIds: string[]
): DuplicateReviewScanResult {
  const candidateIdSet = new Set(candidateIds);

  if (isImprovedDuplicateScanResult(result)) {
    return {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        files: group.files.map((file) =>
          file.role === 'candidate' && (candidateIdSet.has(file.id) || candidateIdSet.has(file.filePath))
            ? {
                ...file,
                reviewStatus: 'marked-for-trash' as const
              }
            : file
        )
      }))
    };
  }

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

function clearDuplicateCandidateTrashPlan(result: DuplicateReviewScanResult): DuplicateReviewScanResult {
  if (isImprovedDuplicateScanResult(result)) {
    return {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        files: group.files.map((file) =>
          file.reviewStatus === 'marked-for-trash'
            ? {
                ...file,
                reviewStatus: 'unreviewed' as const
              }
            : file
        )
      }))
    };
  }

  return {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      candidates: group.candidates.map((candidate) =>
        candidate.trashStatus === 'planned'
          ? {
              ...candidate,
              trashStatus: 'unmarked',
              trashError: null
            }
          : candidate
      )
    }))
  };
}

function applyDuplicateTrashResult(
  result: DuplicateReviewScanResult,
  trashResult: FileOperationResult
): DuplicateReviewScanResult {
  const resultItemsByPath = new Map(trashResult.items.map((item) => [item.sourcePath, item]));

  if (isImprovedDuplicateScanResult(result)) {
    return {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        files: group.files.map((file) => {
          const resultItem = resultItemsByPath.get(file.filePath);

          if (!resultItem || file.role !== 'candidate') {
            return file;
          }

          return {
            ...file,
            reviewStatus:
              resultItem.status === 'success'
                ? 'moved-to-trash'
                : resultItem.status === 'skipped'
                  ? 'skipped'
                  : resultItem.status === 'failed'
                    ? 'failed'
                    : file.reviewStatus
          };
        })
      }))
    };
  }

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
