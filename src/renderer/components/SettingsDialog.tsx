import type { ReactElement } from 'react';
import { Dialog } from 'primereact/dialog';
import type { AppInfo } from '../../shared/types/app';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { PremiereStatusResponse } from '../../shared/types/premiere';
import type { AppSettings } from '../../shared/types/settings';
import { SettingsPanel } from './SettingsPanel';

interface SettingsDialogProps {
  visible: boolean;
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  premiereStatus: PremiereStatusResponse | null;
  toolDiagnostics: ToolDiagnosticsResult | null;
  toolDiagnosticsError: string | null;
  isToolDiagnosticsLoading: boolean;
  activeAction: string | null;
  onHide: () => void;
  onUpdateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void;
  onResetSettings: () => void;
  onRunToolDiagnostics: () => void;
}

export function SettingsDialog({
  visible,
  appInfo,
  appInfoMessage,
  settings,
  settingsMessage,
  premiereStatus,
  toolDiagnostics,
  toolDiagnosticsError,
  isToolDiagnosticsLoading,
  activeAction,
  onHide,
  onUpdateSettingsField,
  onResetSettings,
  onRunToolDiagnostics
}: SettingsDialogProps): ReactElement {
  return (
    <Dialog
      header="Settings"
      visible={visible}
      className="app-dialog settings-dialog"
      modal
      onHide={onHide}
    >
      <SettingsPanel
        appInfo={appInfo}
        appInfoMessage={appInfoMessage}
        settings={settings}
        settingsMessage={settingsMessage}
        premiereStatus={premiereStatus}
        toolDiagnostics={toolDiagnostics}
        toolDiagnosticsError={toolDiagnosticsError}
        isToolDiagnosticsLoading={isToolDiagnosticsLoading}
        activeAction={activeAction}
        onUpdateSettingsField={onUpdateSettingsField}
        onResetSettings={onResetSettings}
        onRunToolDiagnostics={onRunToolDiagnostics}
      />
    </Dialog>
  );
}
