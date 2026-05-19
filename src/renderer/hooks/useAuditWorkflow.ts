import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditRequest
} from '../../shared/types/audit';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';
import * as auditClient from '../api/auditClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';
import type { UseAuditResultsValue } from './useAuditResults';

export type AuditStartOutcome = 'started' | 'not_started';
export type AuditWorkflowActiveAction = null;

interface RefreshSourceSelection {
  selectedFolders: string[];
  selectedFiles: string[];
}

interface UseAuditWorkflowOptions {
  selectedFolders: string[];
  selectedFiles: string[];
  auditOptions: AuditOptions;
  lastAuditRequest: AuditRequest | null;
  applyAuditResult: UseAuditResultsValue['applyAuditResult'];
  resetResultStateForAuditStart: UseAuditResultsValue['resetResultStateForAuditStart'];
  applyRefreshSourceSelection: (selection: RefreshSourceSelection) => void;
  setAuditOptions: (options: AuditOptions) => void;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: AuditWorkflowActiveAction) => void;
}

interface UseAuditWorkflowValue {
  auditProgress: AuditJobSnapshot | null;
  auditPercent: number | null;
  runAudit: () => Promise<AuditStartOutcome>;
  refreshAudit: () => Promise<void>;
  cancelAudit: () => Promise<void>;
  resetAuditWorkflow: () => void;
}

export function useAuditWorkflow({
  selectedFolders,
  selectedFiles,
  auditOptions,
  lastAuditRequest,
  applyAuditResult,
  resetResultStateForAuditStart,
  applyRefreshSourceSelection,
  setAuditOptions,
  setWorkflowMessage,
  setActiveAction
}: UseAuditWorkflowOptions): UseAuditWorkflowValue {
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditJobSnapshot | null>(null);
  const pendingAuditRequestRef = useRef<AuditRequest | null>(null);
  const auditPercent = getProgressPercent(auditProgress?.processedFiles, auditProgress?.totalFiles);

  useEffect(() => {
    return auditClient.subscribeToAuditProgress((progress) => {
      setAuditProgress(progress);

      if (progress.jobId) {
        setAuditJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit stopped.');
      }

      if (progress.result) {
        void applyAuditResult(progress.result, pendingAuditRequestRef.current, { persist: true });
      }
    });
  }, [applyAuditResult, setActiveAction, setWorkflowMessage]);

  const startAuditRequest = useCallback(async (request: AuditRequest): Promise<AuditStartOutcome> => {
    setWorkflowMessage(null);
    setAuditProgress(null);
    resetResultStateForAuditStart(request);
    setActiveAction(null);
    pendingAuditRequestRef.current = request;

    const response = await auditClient.startAudit(request);

    if (response.status !== 'started' || !response.jobId) {
      setWorkflowMessage(response.message ?? 'Could not start audit.');
      return 'not_started';
    }

    setAuditJobId(response.jobId);
    setWorkflowMessage(response.message ?? 'Audit started.');
    return 'started';
  }, [resetResultStateForAuditStart, setActiveAction, setWorkflowMessage]);

  const runAudit = useCallback(async (): Promise<AuditStartOutcome> => {
    const request = {
      folderPaths: dedupeOverlappingFolderPaths(selectedFolders),
      filePaths: selectedFiles,
      options: auditOptions
    };

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before running an audit.');
      return 'not_started';
    }

    if (!request.options.includeLowResolutionAnalysis && !request.options.includeBlackBorderAnalysis) {
      setWorkflowMessage('At least one audit option must be selected.');
      return 'not_started';
    }

    try {
      return await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not start audit.'));
      return 'not_started';
    }
  }, [auditOptions, selectedFiles, selectedFolders, setWorkflowMessage, startAuditRequest]);

  const refreshAudit = useCallback(async (): Promise<void> => {
    if (!lastAuditRequest) {
      setWorkflowMessage('No saved audit request is available.');
      return;
    }

    const dedupedFolderPaths = dedupeOverlappingFolderPaths(lastAuditRequest.folderPaths);
    const request = {
      ...lastAuditRequest,
      folderPaths: dedupedFolderPaths
    };

    applyRefreshSourceSelection({
      selectedFolders: dedupedFolderPaths,
      selectedFiles: lastAuditRequest.filePaths
    });
    setAuditOptions(lastAuditRequest.options);

    try {
      await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not refresh audit.'));
    }
  }, [
    applyRefreshSourceSelection,
    lastAuditRequest,
    setAuditOptions,
    setWorkflowMessage,
    startAuditRequest
  ]);

  const cancelAudit = useCallback(async (): Promise<void> => {
    if (!auditJobId) {
      return;
    }

    try {
      const progress = await auditClient.cancelAudit(auditJobId);
      setAuditProgress(progress);
      setWorkflowMessage(progress.message ?? 'Audit canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel audit.'));
    }
  }, [auditJobId, setActiveAction, setWorkflowMessage]);

  const resetAuditWorkflow = useCallback((): void => {
    setAuditJobId(null);
    setAuditProgress(null);
    pendingAuditRequestRef.current = null;
  }, []);

  return {
    auditProgress,
    auditPercent,
    runAudit,
    refreshAudit,
    cancelAudit,
    resetAuditWorkflow
  };
}
