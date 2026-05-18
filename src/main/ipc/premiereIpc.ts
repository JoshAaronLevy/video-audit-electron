import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  PremiereBridgeAppsLaunchResponse,
  PremiereImportRequest,
  PremiereRequestResponse,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import {
  createPremiereImportRequest,
  getPremiereStatus,
  openPremiereBridgeApps
} from '../services/premiereBridgeService';

export function registerPremiereIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.premiereGetStatus, async (): Promise<PremiereStatusResponse> => {
    try {
      return await getPremiereStatus();
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to check Premiere bridge status.',
        premiere: {
          running: null,
          reason: 'status_check_failed',
          message: error instanceof Error ? error.message : undefined
        },
        bridge: {
          connected: false,
          reason: 'status_check_failed'
        }
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.premiereOpenBridgeApps,
    async (): Promise<PremiereBridgeAppsLaunchResponse> => {
      try {
        return await openPremiereBridgeApps();
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to open Premiere bridge apps.',
          bridgeDir: '',
          apps: []
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.premiereCreateImportRequest,
    async (_event, request: PremiereImportRequest): Promise<PremiereRequestResponse> => {
      try {
        return await createPremiereImportRequest(request);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to queue Premiere import request.'
        };
      }
    }
  );
}
