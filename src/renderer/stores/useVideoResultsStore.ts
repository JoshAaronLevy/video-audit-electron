import { create } from 'zustand';
import type { AuditError, AuditRequest, AuditResult, AuditSummary } from '../../shared/types/audit';
import type {
  MediaPreviewResultItem,
  PreviewClipResultItem
} from '../../shared/types/mediaPreview';
import type { VideoRow } from '../../shared/types/video';
import {
  mergeMediaPreviewItems as mergeMediaPreviewItemsIntoRows,
  mergePreviewClipItems as mergePreviewClipItemsIntoRows
} from '../helpers/mediaPreviewRows';
import { getActiveRows, getVideoRowId } from '../helpers/resultFilters';
import type { ResultsViewFilter } from '../types/resultsView';

export type VideoResultsWorkspaceSource = 'empty' | 'audit' | 'stored-audit';

export interface VideoResultsWorkspaceMeta {
  source: VideoResultsWorkspaceSource;
  savedAt: string | null;
}

export interface HydrateVideoResultsInput {
  result: AuditResult;
  request: AuditRequest | null;
  source: VideoResultsWorkspaceSource;
  savedAt?: string | null;
  showThumbnails?: boolean;
}

export type ApplyVideoResultsInput = HydrateVideoResultsInput;

export interface VideoRowPatch {
  path: string;
  patch: Partial<VideoRow> | ((row: VideoRow) => VideoRow);
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
  setStorageSavedAt: (savedAt: string | null) => void;

  setSelectedRowIds: (ids: string[]) => void;
  clearSelection: () => void;

  hideRowsByPath: (paths: string[]) => number;
  restoreRemovedRows: () => void;
  mergeMediaPreviewItems: (items: MediaPreviewResultItem[]) => void;
  mergePreviewClipItems: (items: PreviewClipResultItem[]) => void;
  patchRowsByPath: (patches: VideoRowPatch[]) => number;
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

function getHydratedVideoResultsState(
  state: VideoResultsStoreState,
  { result, request, source, savedAt, showThumbnails }: HydrateVideoResultsInput
): Pick<
  VideoResultsStoreState,
  | 'auditResult'
  | 'rows'
  | 'summary'
  | 'errors'
  | 'lastAuditRequest'
  | 'selectedRowIds'
  | 'showThumbnails'
  | 'storageSavedAt'
  | 'workspaceMeta'
> {
  const normalizedResult = normalizeResultRows(result);
  const nextSavedAt = savedAt === undefined ? state.storageSavedAt : savedAt;

  return {
    auditResult: normalizedResult,
    rows: normalizedResult.videos,
    summary: normalizedResult.summary,
    errors: normalizedResult.errors,
    lastAuditRequest: request ?? state.lastAuditRequest,
    selectedRowIds: [],
    showThumbnails: showThumbnails ?? state.showThumbnails,
    storageSavedAt: nextSavedAt,
    workspaceMeta: {
      source,
      savedAt: nextSavedAt
    }
  };
}

function pruneSelectedRowIdsForActiveRows(selectedRowIds: string[], rows: VideoRow[]): string[] {
  if (selectedRowIds.length === 0) {
    return [];
  }

  const activeRowIds = new Set(getActiveRows(rows).map(getVideoRowId));

  return selectedRowIds.filter((id) => activeRowIds.has(id));
}

function getRowsCommitState(
  state: VideoResultsStoreState,
  rows: VideoRow[]
): Pick<VideoResultsStoreState, 'auditResult' | 'rows' | 'selectedRowIds'> {
  return {
    auditResult: updateRowsInResult(state.auditResult, rows),
    rows,
    selectedRowIds: pruneSelectedRowIdsForActiveRows(state.selectedRowIds, rows)
  };
}

export const useVideoResultsStore = create<VideoResultsStoreState>()((set, get) => ({
  ...getInitialVideoResultsState(),

  applyAuditResult: (input) => {
    set(getHydratedVideoResultsState(get(), input));
  },

  clearResults: () => {
    set(getInitialVideoResultsState());
  },

  resetForAuditStart: (request) => {
    const state = get();

    set({
      auditResult: null,
      rows: [],
      summary: null,
      errors: [],
      lastAuditRequest: request,
      selectedRowIds: [],
      workspaceMeta: {
        source: 'empty',
        savedAt: state.storageSavedAt
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

  setStorageSavedAt: (savedAt) => {
    const state = get();

    set({
      storageSavedAt: savedAt,
      workspaceMeta: {
        ...state.workspaceMeta,
        savedAt
      }
    });
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
    let hiddenCount = 0;
    const nextRows = state.rows.map((row) => {
      if (!pathSet.has(row.path) || row.visible === false) {
        return row;
      }

      hiddenCount += 1;

      return {
        ...row,
        visible: false
      };
    });

    if (hiddenCount === 0) {
      return 0;
    }

    set(getRowsCommitState(state, nextRows));

    return hiddenCount;
  },

  restoreRemovedRows: () => {
    const state = get();

    if (!state.auditResult) {
      return;
    }

    const nextRows = state.rows.map((row) => ({ ...row, visible: true }));

    set(getRowsCommitState(state, nextRows));
  },

  mergeMediaPreviewItems: (items) => {
    const state = get();

    if (!state.auditResult || items.length === 0) {
      return;
    }

    const nextRows = mergeMediaPreviewItemsIntoRows(state.rows, items);

    set(getRowsCommitState(state, nextRows));
  },

  mergePreviewClipItems: (items) => {
    const state = get();

    if (!state.auditResult || items.length === 0) {
      return;
    }

    const nextRows = mergePreviewClipItemsIntoRows(state.rows, items);

    set(getRowsCommitState(state, nextRows));
  },

  patchRowsByPath: (patches) => {
    const state = get();

    if (!state.auditResult || patches.length === 0) {
      return 0;
    }

    const patchesByPath = new Map<string, VideoRowPatch['patch']>();

    for (const patch of patches) {
      patchesByPath.set(patch.path, patch.patch);
    }

    let patchedCount = 0;
    const nextRows = state.rows.map((row) => {
      const patch = patchesByPath.get(row.path);

      if (!patch) {
        return row;
      }

      patchedCount += 1;

      if (typeof patch === 'function') {
        return patch(row);
      }

      return {
        ...row,
        ...patch
      };
    });

    if (patchedCount === 0) {
      return 0;
    }

    set(getRowsCommitState(state, nextRows));

    return patchedCount;
  }
}));
