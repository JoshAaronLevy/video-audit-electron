import { useShallow } from 'zustand/react/shallow';
import type { VideoRow } from '../../shared/types/video';
import {
  selectResultsViewCounts,
  selectVisibleRowCount,
  selectVisibleRowsForResultView
} from '../stores/videoResultsSelectors';
import { useVideoResultsStore } from '../stores/useVideoResultsStore';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

export interface UseResultFiltersValue {
  globalFilter: string;
  resultsViewFilter: ResultsViewFilter;
  resultsViewCounts: ResultsViewCounts;
  filteredVideoRows: VideoRow[];
  visibleRowCount: number;
  setGlobalFilter: (value: string) => void;
  setResultsViewFilter: (value: ResultsViewFilter) => void;
}

export function useResultFilters(): UseResultFiltersValue {
  const globalFilter = useVideoResultsStore((state) => state.searchQuery);
  const resultsViewFilter = useVideoResultsStore((state) => state.activeViewFilter);
  const resultsViewCounts = useVideoResultsStore(useShallow(selectResultsViewCounts));
  const filteredVideoRows = useVideoResultsStore(useShallow(selectVisibleRowsForResultView));
  const visibleRowCount = useVideoResultsStore(selectVisibleRowCount);
  const setGlobalFilter = useVideoResultsStore((state) => state.setSearchQuery);
  const setResultsViewFilter = useVideoResultsStore((state) => state.setActiveViewFilter);

  return {
    globalFilter,
    resultsViewFilter,
    resultsViewCounts,
    filteredVideoRows,
    visibleRowCount,
    setGlobalFilter,
    setResultsViewFilter
  };
}
