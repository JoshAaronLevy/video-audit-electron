import type { VideoRow } from '../../shared/types/video';
import { getResultsViewCounts, matchesResultsViewFilter } from '../helpers/resultFilters';
import type { ResultsViewCounts } from '../types/resultsView';
import type { VideoResultsStoreState } from './useVideoResultsStore';

export function getVideoRowId(row: VideoRow): string {
  return row.id ?? row.path;
}

export function getActiveRows(rows: VideoRow[]): VideoRow[] {
  return rows.filter((row) => row.visible !== false);
}

export function getRemovedRows(rows: VideoRow[]): VideoRow[] {
  return rows.filter((row) => row.visible === false);
}

export function getRemovedRowCount(rows: VideoRow[]): number {
  return getRemovedRows(rows).length;
}

export function getSelectedRows(rows: VideoRow[], selectedRowIds: string[]): VideoRow[] {
  if (selectedRowIds.length === 0) {
    return [];
  }

  const selectedIdSet = new Set(selectedRowIds);

  return rows.filter((row) => selectedIdSet.has(getVideoRowId(row)));
}

export function selectActiveRows(state: VideoResultsStoreState): VideoRow[] {
  return getActiveRows(state.rows);
}

export function selectRemovedRowCount(state: VideoResultsStoreState): number {
  return getRemovedRowCount(state.rows);
}

export function selectResultsViewCounts(state: VideoResultsStoreState): ResultsViewCounts {
  return getResultsViewCounts(selectActiveRows(state));
}

export function selectRowsForActiveView(state: VideoResultsStoreState): VideoRow[] {
  return selectActiveRows(state).filter((row) =>
    matchesResultsViewFilter(row, state.activeViewFilter)
  );
}

export function selectSelectedRows(state: VideoResultsStoreState): VideoRow[] {
  return getSelectedRows(state.rows, state.selectedRowIds);
}

export function selectSelectedPaths(state: VideoResultsStoreState): string[] {
  return selectSelectedRows(state).map((row) => row.path);
}
