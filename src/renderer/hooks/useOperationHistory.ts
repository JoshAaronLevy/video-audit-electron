import { useCallback, useState } from 'react';
import type { OperationHistoryRecord } from '../../shared/types/operationHistory';
import * as operationHistoryClient from '../api/operationHistoryClient';
import { getErrorMessage } from '../helpers/errors';

export type OperationHistoryActiveAction = 'operationHistory' | null;

interface UseOperationHistoryOptions {
  setActiveAction: (action: OperationHistoryActiveAction) => void;
}

interface UseOperationHistoryValue {
  operationHistoryRecords: OperationHistoryRecord[];
  selectedOperationHistoryRecord: OperationHistoryRecord | null;
  operationHistoryError: string | null;
  isOperationHistoryVisible: boolean;
  isOperationHistoryLoading: boolean;
  openOperationHistory: () => Promise<void>;
  closeOperationHistory: () => void;
  refreshOperationHistory: () => Promise<void>;
  selectOperationHistoryRecord: (operationId: string) => Promise<void>;
}

export function useOperationHistory({
  setActiveAction
}: UseOperationHistoryOptions): UseOperationHistoryValue {
  const [operationHistoryRecords, setOperationHistoryRecords] = useState<OperationHistoryRecord[]>([]);
  const [selectedOperationHistoryRecord, setSelectedOperationHistoryRecord] =
    useState<OperationHistoryRecord | null>(null);
  const [operationHistoryError, setOperationHistoryError] = useState<string | null>(null);
  const [isOperationHistoryVisible, setIsOperationHistoryVisible] = useState(false);
  const [isOperationHistoryLoading, setIsOperationHistoryLoading] = useState(false);

  const loadOperationHistory = useCallback(async (): Promise<void> => {
    setOperationHistoryError(null);
    setIsOperationHistoryLoading(true);
    setActiveAction('operationHistory');

    try {
      const response = await operationHistoryClient.listRecentOperations({
        limit: 50
      });

      if (response.status !== 'success') {
        setOperationHistoryError(response.message ?? 'Could not load operation history.');
        return;
      }

      setOperationHistoryRecords(response.records);
      setSelectedOperationHistoryRecord((current) => {
        if (current && response.records.some((record) => record.id === current.id)) {
          return current;
        }

        return response.records[0] ?? null;
      });
    } catch (error: unknown) {
      setOperationHistoryError(getErrorMessage(error, 'Could not load operation history.'));
    } finally {
      setIsOperationHistoryLoading(false);
      setActiveAction(null);
    }
  }, [setActiveAction]);

  const openOperationHistory = useCallback(async (): Promise<void> => {
    setIsOperationHistoryVisible(true);
    await loadOperationHistory();
  }, [loadOperationHistory]);

  const closeOperationHistory = useCallback((): void => {
    if (isOperationHistoryLoading) {
      return;
    }

    setIsOperationHistoryVisible(false);
    setOperationHistoryError(null);
  }, [isOperationHistoryLoading]);

  const refreshOperationHistory = useCallback(async (): Promise<void> => {
    await loadOperationHistory();
  }, [loadOperationHistory]);

  const selectOperationHistoryRecord = useCallback(async (operationId: string): Promise<void> => {
    setOperationHistoryError(null);
    setIsOperationHistoryLoading(true);
    setActiveAction('operationHistory');

    try {
      const response = await operationHistoryClient.getOperationDetails(operationId);

      if (response.status !== 'success' || !response.record) {
        setOperationHistoryError(response.message ?? 'Could not load operation details.');
        return;
      }

      setSelectedOperationHistoryRecord(response.record);
      setOperationHistoryRecords((records) =>
        records.map((record) => (record.id === response.record?.id ? response.record : record))
      );
    } catch (error: unknown) {
      setOperationHistoryError(getErrorMessage(error, 'Could not load operation details.'));
    } finally {
      setIsOperationHistoryLoading(false);
      setActiveAction(null);
    }
  }, [setActiveAction]);

  return {
    operationHistoryRecords,
    selectedOperationHistoryRecord,
    operationHistoryError,
    isOperationHistoryVisible,
    isOperationHistoryLoading,
    openOperationHistory,
    closeOperationHistory,
    refreshOperationHistory,
    selectOperationHistoryRecord
  };
}
