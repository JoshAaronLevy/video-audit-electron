import type { VideoRow } from '../../shared/types/video';
import {
  getActiveRows,
  getRemovedRowCount,
  getResultsViewCounts,
  getSearchedRows,
  getSelectedPaths,
  getSelectedRows,
  getSelectedSummary,
  getVideoRowId,
  getVisibleRowsForResultView
} from '../helpers/resultFilters';
import type { SelectedRowsSummary } from '../helpers/resultFilters';
import type { ResultsViewCounts } from '../types/resultsView';
import type { VideoResultsStoreState } from './useVideoResultsStore';

export { getVideoRowId };

export function selectActiveRows(state: VideoResultsStoreState): VideoRow[] {
  return getActiveRows(state.rows);
}

export function selectSearchedRows(state: VideoResultsStoreState): VideoRow[] {
  return getSearchedRows(selectActiveRows(state), state.searchQuery);
}

export function selectRemovedRowCount(state: VideoResultsStoreState): number {
  return getRemovedRowCount(state.rows);
}

export function selectResultsViewCounts(state: VideoResultsStoreState): ResultsViewCounts {
  return getResultsViewCounts(selectSearchedRows(state));
}

export function selectVisibleRowsForResultView(state: VideoResultsStoreState): VideoRow[] {
  return getVisibleRowsForResultView(selectSearchedRows(state), state.activeViewFilter);
}

export function selectRowsForActiveView(state: VideoResultsStoreState): VideoRow[] {
  return selectVisibleRowsForResultView(state);
}

export function selectSelectedRows(state: VideoResultsStoreState): VideoRow[] {
  return getSelectedRows(selectActiveRows(state), state.selectedRowIds);
}

export function selectSelectedPaths(state: VideoResultsStoreState): string[] {
  return getSelectedPaths(selectActiveRows(state), state.selectedRowIds);
}

export function selectSelectedSummary(state: VideoResultsStoreState): SelectedRowsSummary {
  return getSelectedSummary(selectActiveRows(state), state.selectedRowIds);
}
