import { useCallback } from 'react';
import type { UseAuditResultsValue } from './useAuditResults';

interface UseSelectedVideoActionsOptions {
  selectedVideoCount: number;
  selectedPaths: string[];
  hideVideoPathsFromTable: UseAuditResultsValue['hideVideoPathsFromTable'];
}

interface UseSelectedVideoActionsValue {
  removeSelectedVideos: () => Promise<void>;
}

export function useSelectedVideoActions({
  selectedVideoCount,
  selectedPaths,
  hideVideoPathsFromTable
}: UseSelectedVideoActionsOptions): UseSelectedVideoActionsValue {
  const removeSelectedVideos = useCallback(async (): Promise<void> => {
    if (selectedVideoCount === 0) {
      return;
    }

    await hideVideoPathsFromTable(selectedPaths);
  }, [hideVideoPathsFromTable, selectedPaths, selectedVideoCount]);

  return {
    removeSelectedVideos
  };
}
