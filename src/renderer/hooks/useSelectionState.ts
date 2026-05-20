import { useCallback, useMemo } from 'react';
import type { VideoRow } from '../../shared/types/video';
import { getActiveRows, getSelectedRows, getVideoRowId } from '../helpers/resultFilters';
import { useVideoResultsStore } from '../stores/useVideoResultsStore';

export interface UseSelectionStateValue {
  selectedVideos: VideoRow[];
  setSelectedVideos: (videos: VideoRow[]) => void;
  clearSelectedVideos: () => void;
  selectedVideoCount: number;
  selectedPaths: string[];
}

export function useSelectionState(): UseSelectionStateValue {
  const rows = useVideoResultsStore((state) => state.rows);
  const selectedRowIds = useVideoResultsStore((state) => state.selectedRowIds);
  const setSelectedRowIds = useVideoResultsStore((state) => state.setSelectedRowIds);
  const clearSelectedVideos = useVideoResultsStore((state) => state.clearSelection);
  const selectedVideos = useMemo(
    () => getSelectedRows(getActiveRows(rows), selectedRowIds),
    [rows, selectedRowIds]
  );

  const setSelectedVideos = useCallback(
    (videos: VideoRow[]): void => {
      setSelectedRowIds(videos.map(getVideoRowId));
    },
    [setSelectedRowIds]
  );
  const selectedPaths = useMemo(
    () => selectedVideos.map((video) => video.path),
    [selectedVideos]
  );

  return {
    selectedVideos,
    setSelectedVideos,
    clearSelectedVideos,
    selectedVideoCount: selectedVideos.length,
    selectedPaths
  };
}
