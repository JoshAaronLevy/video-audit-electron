import { useEffect, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import type { AppInfo } from '../../shared/types/app';
import type { AppSettings } from '../../shared/types/settings';

interface SettingsPanelProps {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  activeAction: string | null;
  onUpdateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void;
  onResetSettings: () => void;
}

export function SettingsPanel({
  appInfo,
  appInfoMessage,
  settings,
  settingsMessage,
  activeAction,
  onUpdateSettingsField,
  onResetSettings
}: SettingsPanelProps): ReactElement {
  return (
    <Card className="workspace-card side-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">App</p>
          <h2>Settings</h2>
        </div>
      </div>

      {settings ? (
        <div className="settings-panel">
          <TextSetting
            label="Auto-fix destination"
            value={settings.defaultAutoFixDestinationRoot}
            disabled={activeAction === 'settings'}
            onSave={(value) => onUpdateSettingsField('defaultAutoFixDestinationRoot', value)}
          />
          <TextSetting
            label="ffmpeg path override"
            value={settings.ffmpegPathOverride}
            disabled={activeAction === 'settings'}
            onSave={(value) => onUpdateSettingsField('ffmpegPathOverride', value)}
          />
          <TextSetting
            label="ffprobe path override"
            value={settings.ffprobePathOverride}
            disabled={activeAction === 'settings'}
            onSave={(value) => onUpdateSettingsField('ffprobePathOverride', value)}
          />
          <ChoiceSetting
            label="Preview clip duration"
            value={settings.previewClipDurationSecondsDefault}
            options={[
              { label: '5s', value: 5 },
              { label: '10s', value: 10 }
            ]}
            disabled={activeAction === 'settings'}
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
            disabled={activeAction === 'settings'}
            onChange={(value) =>
              onUpdateSettingsField('previewClipWidthDefault', value as AppSettings['previewClipWidthDefault'])
            }
          />

          {settingsMessage ? <Message severity="info" text={settingsMessage} /> : null}

          <div className="settings-summary">
            <InfoRow label="Recent folders" value={String(settings.recentFolders.length)} />
            <InfoRow label="Recent files" value={String(settings.recentFiles.length)} />
            <InfoRow label="Latest folder" value={settings.latestSelectedFolder ?? 'None'} />
            <InfoRow label="Default output" value={settings.defaultOutputDirectory ?? 'None'} />
            <InfoRow
              label="Preview clips"
              value={`${settings.previewClipDurationSecondsDefault}s at ${settings.previewClipWidthDefault}px`}
            />
          </div>

          <Button
            label="Reset Settings"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            loading={activeAction === 'settings'}
            onClick={onResetSettings}
          />
        </div>
      ) : (
        <p className="empty-copy">{settingsMessage ?? 'Loading settings...'}</p>
      )}

      <Divider />

      {appInfoMessage ? (
        <p className="error-copy">{appInfoMessage}</p>
      ) : (
        <dl className="info-list" aria-label="Application information">
          <InfoRow label="App" value={appInfo?.name ?? 'Loading...'} />
          <InfoRow label="Version" value={appInfo?.version ?? 'Loading...'} />
          <InfoRow label="Electron" value={appInfo?.electronVersion ?? 'Loading...'} />
          <InfoRow label="Chrome" value={appInfo?.chromeVersion ?? 'Loading...'} />
          <InfoRow label="Node" value={appInfo?.nodeVersion ?? 'Loading...'} />
        </dl>
      )}
    </Card>
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
  value,
  disabled,
  onSave
}: {
  label: string;
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
      <dd>{value}</dd>
    </div>
  );
}
