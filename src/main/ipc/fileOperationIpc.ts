import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  CreateMoveOperationPlanRequest,
  CreateMoveOperationPlanResponse,
  CreateTrashOperationPlanRequest,
  CreateTrashOperationPlanResponse,
  ExecuteMoveOperationPlanRequest,
  ExecuteMoveOperationPlanResponse,
  ExecuteTrashOperationPlanRequest,
  ExecuteTrashOperationPlanResponse,
  KnownPathValidationRequest,
  KnownPathValidationResponse,
  RevealKnownPathRequest,
  RevealKnownPathResponse
} from '../../shared/types/fileOperations';
import {
  createMovePlan,
  createTrashPlan,
  executeMovePlan,
  executeTrashPlan
} from '../services/fileOperationService';
import {
  validateKnownPath,
  validateKnownPaths
} from '../utils/fileOperationSafety';

export function registerFileOperationIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.fileOperationValidateKnownPaths,
    async (_event, request: KnownPathValidationRequest): Promise<KnownPathValidationResponse> => {
      try {
        const items = Array.isArray(request?.items) ? request.items : [];
        const results = await validateKnownPaths(items);

        return {
          status: 'success',
          items: results,
          summary: {
            total: results.length,
            valid: results.filter((item) => item.isValid).length,
            invalid: results.filter((item) => !item.isValid).length,
            missing: results.filter((item) => !item.exists).length
          }
        };
      } catch (error: unknown) {
        return {
          status: 'error',
          items: [],
          summary: {
            total: 0,
            valid: 0,
            invalid: 0,
            missing: 0
          },
          message: error instanceof Error ? error.message : 'Unable to validate file paths.'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationRevealFile,
    async (_event, request: RevealKnownPathRequest): Promise<RevealKnownPathResponse> =>
      revealKnownPath({
        ...request,
        expectedKind: 'file'
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationRevealFolder,
    async (_event, request: RevealKnownPathRequest): Promise<RevealKnownPathResponse> =>
      revealKnownPath({
        ...request,
        expectedKind: 'directory'
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationCreateTrashPlan,
    async (_event, request: CreateTrashOperationPlanRequest): Promise<CreateTrashOperationPlanResponse> =>
      createTrashPlan(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationExecuteTrashPlan,
    async (_event, request: ExecuteTrashOperationPlanRequest): Promise<ExecuteTrashOperationPlanResponse> =>
      executeTrashPlan(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationCreateMovePlan,
    async (_event, request: CreateMoveOperationPlanRequest): Promise<CreateMoveOperationPlanResponse> =>
      createMovePlan(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.fileOperationExecuteMovePlan,
    async (_event, request: ExecuteMoveOperationPlanRequest): Promise<ExecuteMoveOperationPlanResponse> =>
      executeMovePlan(request)
  );
}

async function revealKnownPath(request: RevealKnownPathRequest): Promise<RevealKnownPathResponse> {
  const validation = await validateKnownPath(request);

  if (!validation.isValid) {
    return {
      ok: false,
      path: validation.path,
      identity: validation.identity,
      message: validation.errors[0] ?? 'Path could not be revealed in Finder.',
      validation
    };
  }

  shell.showItemInFolder(validation.path);

  return {
    ok: true,
    path: validation.path,
    identity: validation.identity,
    validation
  };
}
