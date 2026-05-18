import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  OperationHistoryDetailsResponse,
  OperationHistoryListRequest,
  OperationHistoryListResponse
} from '../../shared/types/operationHistory';
import {
  getOperationDetails,
  listRecentOperations
} from '../services/operationHistoryService';

export function registerOperationHistoryIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.operationHistoryList,
    async (_event, request?: OperationHistoryListRequest): Promise<OperationHistoryListResponse> =>
      listRecentOperations(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.operationHistoryGetDetails,
    async (_event, operationId: string): Promise<OperationHistoryDetailsResponse> =>
      getOperationDetails(operationId)
  );
}
