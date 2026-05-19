import { create } from 'zustand';
import type { AuditError, AuditRequest, AuditResult, AuditSummary } from '../../shared/types/audit';
import type {
  MediaPreviewResultItem,
  PreviewClipResultItem
} from '../../shared/types/mediaPreview';
import type { VideoRow } from '../../shared/types/video';
import { mergeMediaPreviewItems, mergePreviewClipItems } from '../helpers/mediaPreviewRows';
import { getVideoRowId } from '../helpers/resultFilters';
import type { ResultsViewFilter } from '../types/resultsView';

export type VideoResultsWorkspaceSource = 'empty' | 'audit' | 'stored-audit';

export interface VideoResultsWorkspaceMeta {
  source: VideoResultsWorkspaceSource;
  savedAt: string | null;
}

export interface ApplyVideoResultsInput {
  result: AuditResult;
  request: AuditRequest | null;
  source: VideoResultsWorkspaceSource;
  savedAt?: string | null;
  showThumbnails?: boolean;
}

export interface VideoResultsStoreState {
  auditResult: AuditResult | null;
  rows: VideoRow[];
  summary: AuditSummary | null;
  errors: AuditError[];
  lastAuditRequest: AuditRequest | null;

  selectedRowIds: string[];
  searchQuery: string;
  activeViewFilter: ResultsViewFilter;

  showThumbnails: boolean;
  storageSavedAt: string | null;
  workspaceMeta: VideoResultsWorkspaceMeta;

  applyAuditResult: (input: ApplyVideoResultsInput) => void;
  clearResults: () => void;
  resetForAuditStart: (request: AuditRequest) => void;

  setSearchQuery: (query: string) => void;
  setActiveViewFilter: (filter: ResultsViewFilter) => void;
  setShowThumbnails: (value: boolean) => void;

  setSelectedRowIds: (ids: string[]) => void;
  clearSelection: () => void;

  hideRowsByPath: (paths: string[]) => number;
  restoreRemovedRows: () => void;
  mergeMediaPreviewItems: (items: MediaPreviewResultItem[]) => void;
  mergePreviewClipItems: (items: PreviewClipResultItem[]) => void;
}

function getInitialVideoResultsState(): Pick<
  VideoResultsStoreState,
  | 'auditResult'
  | 'rows'
  | 'summary'
  | 'errors'
  | 'lastAuditRequest'
  | 'selectedRowIds'
  | 'searchQuery'
  | 'activeViewFilter'
  | 'showThumbnails'
  | 'storageSavedAt'
  | 'workspaceMeta'
> {
  return {
    auditResult: null,
    rows: [],
    summary: null,
    errors: [],
    lastAuditRequest: null,
    selectedRowIds: [],
    searchQuery: '',
    activeViewFilter: 'all',
    showThumbnails: true,
    storageSavedAt: null,
    workspaceMeta: {
      source: 'empty',
      savedAt: null
    }
  };
}

function normalizeResultRows(result: AuditResult): AuditResult {
  const rows = result.videos.map((row) => ({
    ...row,
    visible: row.visible !== false
  }));

  return {
    ...result,
    videos: rows
  };
}

function updateRowsInResult(result: AuditResult | null, rows: VideoRow[]): AuditResult | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    videos: rows
  };
}

export const useVideoResultsStore = create<VideoResultsStoreState>()((set, get) => ({
  ...getInitialVideoResultsState(),

  applyAuditResult: ({ result, request, source, savedAt = null, showThumbnails }) => {
    const state = get();
    const normalizedResult = normalizeResultRows(result);

    set({
      auditResult: normalizedResult,
      rows: normalizedResult.videos,
      summary: normalizedResult.summary,
      errors: normalizedResult.errors,
      lastAuditRequest: request ?? state.lastAuditRequest,
      selectedRowIds: [],
      showThumbnails: showThumbnails ?? state.showThumbnails,
      storageSavedAt: savedAt,
      workspaceMeta: {
        source,
        savedAt
      }
    });
  },

  clearResults: () => {
    set(getInitialVideoResultsState());
  },

  resetForAuditStart: (request) => {
    set({
      auditResult: null,
      rows: [],
      summary: null,
      errors: [],
      lastAuditRequest: request,
      selectedRowIds: [],
      storageSavedAt: null,
      workspaceMeta: {
        source: 'empty',
        savedAt: null
      }
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setActiveViewFilter: (filter) => {
    set({ activeViewFilter: filter });
  },

  setShowThumbnails: (value) => {
    set({ showThumbnails: value });
  },

  setSelectedRowIds: (ids) => {
    set({ selectedRowIds: [...new Set(ids)] });
  },

  clearSelection: () => {
    set({ selectedRowIds: [] });
  },

  hideRowsByPath: (paths) => {
    const state = get();

    if (!state.auditResult || paths.length === 0) {
      return 0;
    }

    const pathSet = new Set(paths);
    const hiddenRowIds = new Set<string>();
    let hiddenCount = 0;
    const nextRows = state.rows.map((row) => {
      if (!pathSet.has(row.path) || row.visible === false) {
        return row;
      }

      hiddenCount += 1;
      hiddenRowIds.add(getVideoRowId(row));

      return {
        ...row,
        visible: false
      };
    });

    if (hiddenCount === 0) {
      return 0;
    }

    set({
      auditResult: updateRowsInResult(state.auditResult, nextRows),
      rows: nextRows,
      selectedRowIds: state.selectedRowIds.filter((id) => !hiddenRowIds.has(id))
    });

    return hiddenCount;
  },

  restoreRemovedRows: () => {
    const state = get();

    if (!state.auditResult) {
      return;
    }

    const nextRows = state.rows.map((row) => ({ ...row, visible: true }));

    set({
      auditResult: updateRowsInResult(state.auditResult, nextRows),
      rows: nextRows
    });
  },

  mergeMediaPreviewItems: (items) => {
    const state = get();

    if (!state.auditResult || items.length === 0) {
      return;
    }

    const nextRows = mergeMediaPreviewItems(state.rows, items);

    set({
      auditResult: updateRowsInResult(state.auditResult, nextRows),
      rows: nextRows
    });
  },

  mergePreviewClipItems: (items) => {
    const state = get();

    if (!state.auditResult || items.length === 0) {
      return;
    }

    const nextRows = mergePreviewClipItems(state.rows, items);

    set({
      auditResult: updateRowsInResult(state.auditResult, nextRows),
      rows: nextRows
    });
  }
}));
