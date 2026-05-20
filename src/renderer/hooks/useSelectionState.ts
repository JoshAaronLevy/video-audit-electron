import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { VideoRow } from '../../shared/types/video';
import { getVideoRowId } from '../helpers/resultFilters';
import { selectSelectedPaths, selectSelectedRows } from '../stores/videoResultsSelectors';
import { useVideoResultsStore } from '../stores/useVideoResultsStore';

export interface UseSelectionStateValue {
  selectedVideos: VideoRow[];
  setSelectedVideos: (videos: VideoRow[]) => void;
  selectedVideoCount: number;
  selectedPaths: string[];
}

export function useSelectionState(): UseSelectionStateValue {
  const selectedVideos = useVideoResultsStore(useShallow(selectSelectedRows));
  const selectedPaths = useVideoResultsStore(useShallow(selectSelectedPaths));
  const setSelectedRowIds = useVideoResultsStore((state) => state.setSelectedRowIds);

  const setSelectedVideos = useCallback(
    (videos: VideoRow[]): void => {
      setSelectedRowIds(videos.map(getVideoRowId));
    },
    [setSelectedRowIds]
  );

  return {
    selectedVideos,
    setSelectedVideos,
    selectedVideoCount: selectedVideos.length,
    selectedPaths
  };
}
