import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../../shared/types/app';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { PremiereStatusResponse } from '../../shared/types/premiere';
import type { AppSettings } from '../../shared/types/settings';

interface SettingsPanelProps {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  premiereStatus: PremiereStatusResponse | null;
  toolDiagnostics: ToolDiagnosticsResult | null;
  toolDiagnosticsError: string | null;
  isToolDiagnosticsLoading: boolean;
  activeAction: string | null;
  onUpdateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void;
  onResetSettings: () => void;
  onRunToolDiagnostics: () => void;
}

export function SettingsPanel({
  appInfo,
  appInfoMessage,
  settings,
  settingsMessage,
  premiereStatus,
  toolDiagnostics,
  toolDiagnosticsError,
  isToolDiagnosticsLoading,
  activeAction,
  onUpdateSettingsField,
  onResetSettings,
  onRunToolDiagnostics
}: SettingsPanelProps): ReactElement {
  const isSavingSettings = activeAction === 'settings';

  if (!settings) {
    return (
      <div className="settings-panel">
        <Message severity="info" text={settingsMessage ?? 'Loading settings...'} />
      </div>
    );
  }

  return (
    <div className="settings-panel settings-panel-grouped">
      <div className="settings-hero">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Video Audit Settings</h2>
          <span>Changes save as you update each setting.</span>
        </div>
        <div className="settings-hero-actions">
          <Tag value={appInfo?.version ? `v${appInfo.version}` : 'Loading'} />
          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            loading={isSavingSettings}
            onClick={onResetSettings}
          />
        </div>
      </div>

      {settingsMessage ? <Message severity="info" text={settingsMessage} /> : null}
      {toolDiagnosticsError ? <Message severity="error" text={toolDiagnosticsError} /> : null}
      {appInfoMessage ? <Message severity="error" text={appInfoMessage} /> : null}

      <div className="settings-section-grid">
        <SettingsSection eyebrow="General" title="App State">
          <dl className="settings-info-list">
            <InfoRow label="Recent folders" value={String(settings.recentFolders.length)} />
            <InfoRow label="Recent files" value={String(settings.recentFiles.length)} />
            <InfoRow label="Latest folder" value={settings.latestSelectedFolder ?? 'None'} />
            <InfoRow
              label="Window"
              value={settings.windowState ? `${settings.windowState.width}x${settings.windowState.height}` : 'Default size'}
            />
          </dl>
        </SettingsSection>

        <SettingsSection eyebrow="Audit" title="Defaults">
          <ToggleSetting
            label="Include subfolders"
            description="Use recursive folder scans for new audits."
            checked={settings.includeSubfoldersDefault}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('includeSubfoldersDefault', value)}
          />
          <ToggleSetting
            label="Low-resolution analysis"
            description="Flag videos below the configured minimum height."
            checked={settings.lowResolutionAnalysisEnabledDefault}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('lowResolutionAnalysisEnabledDefault', value)}
          />
          <ToggleSetting
            label="Black-border analysis"
            description="Analyze crop and border review candidates."
            checked={settings.blackBorderAnalysisEnabledDefault}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('blackBorderAnalysisEnabledDefault', value)}
          />
        </SettingsSection>

        <SettingsSection eyebrow="Output" title="Paths">
          <TextSetting
            label="Default output directory"
            description="Used as the saved output location when available."
            value={settings.defaultOutputDirectory}
            disabled={isSavingSettings}
            onSave={(value) => onUpdateSettingsField('defaultOutputDirectory', value)}
          />
          <TextSetting
            label="Auto-fix destination"
            description="Destination root for copied Auto-Fix outputs."
            value={settings.defaultAutoFixDestinationRoot}
            disabled={isSavingSettings}
            onSave={(value) => onUpdateSettingsField('defaultAutoFixDestinationRoot', value)}
          />
        </SettingsSection>

        <SettingsSection eyebrow="File Management" title="Safety Defaults">
          <ChoiceSetting
            label="Original disposal"
            value={settings.defaultOriginalDisposition}
            options={[
              { label: 'Trash', value: 'trash' },
              { label: 'Archive', value: 'archive' }
            ]}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('defaultOriginalDisposition', value)}
          />
          <ChoiceSetting
            label="Conflict handling"
            value={settings.fileManagementConflictStrategy}
            options={[
              { label: 'Block', value: 'skip' },
              { label: 'Rename', value: 'rename-with-suffix' }
            ]}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('fileManagementConflictStrategy', value)}
          />
          <ToggleSetting
            label="Extra typed confirmation"
            description="Require typed confirmation at or below the safe baseline thresholds."
            checked={settings.requireTypedConfirmationForLargeOperations}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('requireTypedConfirmationForLargeOperations', value)}
          />
          <ChoiceSetting
            label="Confirmation file count"
            value={settings.typedConfirmationFileCountThreshold}
            options={[
              { label: '1 file', value: 1 },
              { label: '5 files', value: 5 },
              { label: '10 files', value: 10 }
            ]}
            disabled={isSavingSettings || !settings.requireTypedConfirmationForLargeOperations}
            onChange={(value) => onUpdateSettingsField('typedConfirmationFileCountThreshold', value)}
          />
          <ChoiceSetting
            label="Confirmation size"
            value={settings.typedConfirmationSizeThresholdBytes}
            options={[
              { label: '1 GB', value: 1024 ** 3 },
              { label: '5 GB', value: 5 * 1024 ** 3 },
              { label: '10 GB', value: 10 * 1024 ** 3 }
            ]}
            disabled={isSavingSettings || !settings.requireTypedConfirmationForLargeOperations}
            onChange={(value) => onUpdateSettingsField('typedConfirmationSizeThresholdBytes', value)}
          />
          <TextSetting
            label="Archive folder pattern"
            description="Relative archive pattern reserved for archive workflows."
            value={settings.defaultArchiveFolderPattern}
            disabled={isSavingSettings}
            onSave={(value) => onUpdateSettingsField('defaultArchiveFolderPattern', value ?? '.video-audit-archive/{YYYY-MM-DD}')}
          />
          <ToggleSetting
            label="Show post-conversion dialog"
            description="Ask what to do after Auto-Fix or Auto-Crop produces converted videos."
            checked={settings.showPostConversionDialogAutomatically}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('showPostConversionDialogAutomatically', value)}
          />
          <ChoiceSetting
            label="Post-conversion default"
            value={settings.defaultPostConversionAction}
            options={[
              { label: 'Ask', value: 'ask-every-time' },
              { label: 'Leave Outputs', value: 'leave-outputs' },
              { label: 'Review', value: 'review-manually' }
            ]}
            disabled={isSavingSettings || !settings.showPostConversionDialogAutomatically}
            onChange={(value) => onUpdateSettingsField('defaultPostConversionAction', value)}
          />
          <ToggleSetting
            label="Preview operation history"
            description="Keep operation history easy to inspect after file-management work."
            checked={settings.previewOperationHistoryAfterExecution}
            disabled={isSavingSettings}
            onChange={(value) => onUpdateSettingsField('previewOperationHistoryAfterExecution', value)}
          />
          <Message
            severity="info"
            text="Permanent delete and overwrite-by-default are not available settings."
          />
        </SettingsSection>

        <SettingsSection eyebrow="Media Tools" title="ffmpeg / ffprobe">
          <TextSetting
            label="ffmpeg path override"
            description="Leave blank to use the bundled or PATH-resolved command."
            value={settings.ffmpegPathOverride}
            disabled={isSavingSettings}
            onSave={(value) => onUpdateSettingsField('ffmpegPathOverride', value)}
          />
          <TextSetting
            label="ffprobe path override"
            description="Leave blank to use the bundled or PATH-resolved command."
            value={settings.ffprobePathOverride}
            disabled={isSavingSettings}
            onSave={(value) => onUpdateSettingsField('ffprobePathOverride', value)}
          />
        </SettingsSection>

        <SettingsSection eyebrow="Premiere" title="Bridge">
          <dl className="settings-info-list">
            <InfoRow label="Status" value={formatPremiereStatus(premiereStatus)} />
            <InfoRow label="Message" value={premiereStatus?.message ?? 'Not checked'} />
            <InfoRow label="Project" value={premiereStatus?.bridge?.activeProjectName ?? 'None'} />
            <InfoRow label="Output" value={premiereStatus?.bridge?.outputDirectory ?? 'None'} />
          </dl>
        </SettingsSection>

        <SettingsSection eyebrow="Thumbnails" title="Preview Cache">
          <ChoiceSetting
            label="Preview clip duration"
            value={settings.previewClipDurationSecondsDefault}
            options={[
              { label: '5s', value: 5 },
              { label: '10s', value: 10 }
            ]}
            disabled={isSavingSettings}
            onChange={(value) =>
              onUpdateSettingsField(
                'previewClipDurationSecondsDefault',
                value as AppSettings['previewClipDurationSecondsDefault']
              )
            }
          />
          <ChoiceSetting
            label="Preview clip width"
            value={settings.previewClipWidthDefault}
            options={[
              { label: '480px', value: 480 },
              { label: '640px', value: 640 }
            ]}
            disabled={isSavingSettings}
            onChange={(value) =>
              onUpdateSettingsField('previewClipWidthDefault', value as AppSettings['previewClipWidthDefault'])
            }
          />
          <dl className="settings-info-list">
            <InfoRow
              label="Last audit"
              value={
                settings.lastAuditResultSummary
                  ? `${settings.lastAuditResultSummary.totalFiles} files, ${settings.lastAuditResultSummary.flaggedCount} flagged`
                  : 'None'
              }
            />
          </dl>
        </SettingsSection>

        <SettingsSection eyebrow="Diagnostics" title="Runtime">
          <div className="tool-diagnostics">
            <div className="compact-heading">
              <h3>Media Tools</h3>
              <Button
                label="Check"
                icon="pi pi-bolt"
                severity="info"
                outlined
                loading={isToolDiagnosticsLoading}
                disabled={isSavingSettings}
                onClick={onRunToolDiagnostics}
              />
            </div>
            {toolDiagnostics ? (
              <ul>
                {toolDiagnostics.tools.map((tool) => (
                  <li key={tool.name}>
                    <span>{tool.name}</span>
                    <strong className={tool.ok ? 'tool-ok' : 'tool-error'}>
                      {tool.ok ? 'Available' : 'Missing'}
                    </strong>
                    <small title={tool.command}>{tool.versionLine ?? tool.message}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">Check ffmpeg and ffprobe availability before running media workflows.</p>
            )}
          </div>
          <dl className="settings-info-list">
            <InfoRow label="App" value={appInfo?.name ?? 'Loading...'} />
            <InfoRow label="Electron" value={appInfo?.electronVersion ?? 'Loading...'} />
            <InfoRow label="Chrome" value={appInfo?.chromeVersion ?? 'Loading...'} />
            <InfoRow label="Node" value={appInfo?.nodeVersion ?? 'Loading...'} />
          </dl>
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="settings-section" aria-label={`${eyebrow} settings`}>
      <div className="settings-section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <div className="settings-section-content">{children}</div>
    </section>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): ReactElement {
  const inputId = `setting-${label.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <label className="toggle-setting" htmlFor={inputId}>
      <Checkbox
        inputId={inputId}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(Boolean(event.checked))}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function ChoiceSetting<Value extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: Value;
  options: { label: string; value: Value }[];
  disabled: boolean;
  onChange: (value: Value) => void;
}): ReactElement {
  const inputId = `setting-${label.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <div className="choice-setting">
      <label id={inputId}>{label}</label>
      <SelectButton
        aria-labelledby={inputId}
        value={value}
        options={options}
        disabled={disabled}
        allowEmpty={false}
        onChange={(event) => onChange(event.value as Value)}
      />
    </div>
  );
}

function TextSetting({
  label,
  description,
  value,
  disabled,
  onSave
}: {
  label: string;
  description: string;
  value: string | null;
  disabled: boolean;
  onSave: (value: string | null) => void;
}): ReactElement {
  const [draftValue, setDraftValue] = useState(value ?? '');
  const inputId = `setting-${label.toLowerCase().replaceAll(' ', '-')}`;

  useEffect(() => {
    setDraftValue(value ?? '');
  }, [value]);

  return (
    <div className="text-setting">
      <label htmlFor={inputId}>{label}</label>
      <small>{description}</small>
      <div className="text-setting-row">
        <InputText
          id={inputId}
          value={draftValue}
          disabled={disabled}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder="Not set"
        />
        <Button
          label="Save"
          icon="pi pi-check"
          severity="secondary"
          outlined
          disabled={disabled}
          onClick={() => onSave(draftValue.trim() === '' ? null : draftValue.trim())}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function formatPremiereStatus(status: PremiereStatusResponse | null): string {
  if (!status) {
    return 'Unknown';
  }

  if (status.status === 'ready') {
    return 'Ready';
  }

  if (status.status === 'premiere_not_running') {
    return 'Premiere not running';
  }

  if (status.status === 'bridge_disconnected') {
    return 'Bridge disconnected';
  }

  return 'Error';
}
