import { useCallback, useState } from 'react';
import type { AuditOptions } from '../../shared/types/audit';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import { DEFAULT_AUDIT_OPTIONS, settingsToAuditOptions } from '../helpers/auditOptions';
import {
  useSourceSelection,
  type SourceSelectionActiveAction,
  type UseSourceSelectionValue
} from './useSourceSelection';

export type AuditSourceActiveAction = SourceSelectionActiveAction;

interface UseAuditSourceControllerOptions {
  settings: AppSettings | null;
  persistSettings: (partialSettings: AppSettingsUpdate) => Promise<AppSettings | null>;
  resetStoredSettings: () => Promise<AppSettings | null>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: AuditSourceActiveAction) => void;
}

interface UseAuditSourceControllerValue extends UseSourceSelectionValue {
  auditOptions: AuditOptions;
  setAuditOptions: (options: AuditOptions) => void;
  updateAuditOption: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export function useAuditSourceController({
  settings,
  persistSettings,
  resetStoredSettings,
  setWorkflowMessage,
  setActiveAction
}: UseAuditSourceControllerOptions): UseAuditSourceControllerValue {
  const [auditOptions, setAuditOptionsState] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const sourceSelection = useSourceSelection({
    settings,
    includeSubfolders: auditOptions.includeSubfolders,
    persistSettings,
    setWorkflowMessage,
    setActiveAction
  });

  const setAuditOptions = useCallback((options: AuditOptions): void => {
    setAuditOptionsState(options);
  }, []);

  const updateAuditOption = useCallback(
    async <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]): Promise<void> => {
      const nextOptions = {
        ...auditOptions,
        [key]: value
      };

      setAuditOptionsState(nextOptions);

      if (key === 'includeSubfolders') {
        await persistSettings({
          includeSubfoldersDefault: Boolean(value),
          latestFolderTreeSource: settings?.latestFolderTreeSource
            ? {
                ...settings.latestFolderTreeSource,
                includeSubfolders: Boolean(value)
              }
            : null
        });
      }

      if (key === 'includeLowResolutionAnalysis') {
        await persistSettings({ lowResolutionAnalysisEnabledDefault: Boolean(value) });
      }

      if (key === 'includeBlackBorderAnalysis') {
        await persistSettings({ blackBorderAnalysisEnabledDefault: Boolean(value) });
      }
    },
    [auditOptions, persistSettings, settings?.latestFolderTreeSource]
  );

  const resetSettings = useCallback(async (): Promise<void> => {
    const reset = await resetStoredSettings();

    if (!reset) {
      return;
    }

    sourceSelection.applySourceSelectionState({
      outputFolder: reset.defaultOutputDirectory,
      selectedFolders: [],
      selectedFolderSummary: null,
      folderTreeRootPath: null,
      folderTreeLastScannedAt: null
    });
    setAuditOptionsState(settingsToAuditOptions(reset));
  }, [resetStoredSettings, sourceSelection.applySourceSelectionState]);

  return {
    ...sourceSelection,
    auditOptions,
    setAuditOptions,
    updateAuditOption,
    resetSettings
  };
}
