import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../../shared/types/app';
import type { AuditJobSnapshot } from '../../shared/types/audit';
import type { ToolDiagnosticItem, ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { PremiereStatusResponse } from '../../shared/types/premiere';
import type { AppSettings } from '../../shared/types/settings';
import { DialogHeader } from './DialogChrome';

interface DiagnosticsDialogProps {
  visible: boolean;
  appInfo: AppInfo | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  auditProgress: AuditJobSnapshot | null;
  activeAction: string | null;
  premiereStatus: PremiereStatusResponse | null;
  premiereStatusError: string | null;
  premiereLaunchMessage: string | null;
  isPremiereStatusLoading: boolean;
  isPremiereBridgeAppsLaunching: boolean;
  toolDiagnostics: ToolDiagnosticsResult | null;
  toolDiagnosticsError: string | null;
  isToolDiagnosticsLoading: boolean;
  outputFolder: string | null;
  storageSavedAt: string | null;
  onHide: () => void;
  onRefreshPremiereStatus: () => void;
  onOpenPremiereBridgeApps: () => void;
  onRunToolDiagnostics: () => void;
}

export function DiagnosticsDialog({
  visible,
  appInfo,
  settings,
  settingsMessage,
  auditProgress,
  activeAction,
  premiereStatus,
  premiereStatusError,
  premiereLaunchMessage,
  isPremiereStatusLoading,
  isPremiereBridgeAppsLaunching,
  toolDiagnostics,
  toolDiagnosticsError,
  isToolDiagnosticsLoading,
  outputFolder,
  storageSavedAt,
  onHide,
  onRefreshPremiereStatus,
  onOpenPremiereBridgeApps,
  onRunToolDiagnostics
}: DiagnosticsDialogProps): ReactElement {
  const ffmpeg = toolDiagnostics?.tools.find((tool) => tool.name === 'ffmpeg') ?? null;
  const ffprobe = toolDiagnostics?.tools.find((tool) => tool.name === 'ffprobe') ?? null;
  const lastError = premiereStatusError ?? toolDiagnosticsError ?? null;

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Diagnostics"
          title="Runtime Details"
          description="Inspect current jobs, Premiere bridge status, media tools, and local app paths."
        />
      }
      visible={visible}
      className="app-dialog diagnostics-dialog"
      modal
      draggable={false}
      onHide={onHide}
    >
      <div className="diagnostics-content">
        {lastError ? <Message severity="error" text={lastError} /> : null}
        {premiereLaunchMessage ? <Message severity="info" text={premiereLaunchMessage} /> : null}
        {settingsMessage ? <Message severity="info" text={settingsMessage} /> : null}

        <section className="diagnostics-card" aria-labelledby="diagnostics-runtime-heading">
          <div className="diagnostics-card-header">
            <div>
              <p className="eyebrow">Runtime</p>
              <h3 id="diagnostics-runtime-heading">Current Work</h3>
            </div>
            <StatusTag value={getRuntimeStatus(auditProgress, activeAction)} tone={activeAction ? 'info' : 'neutral'} />
          </div>
          <dl className="diagnostics-list">
            <InfoRow label="Active job" value={getRuntimeStatus(auditProgress, activeAction)} />
            <InfoRow label="Audit message" value={auditProgress?.message ?? 'None'} />
            <InfoRow label="Saved audit" value={storageSavedAt ? formatDateTime(storageSavedAt) : 'Unsaved'} />
            <InfoRow label="Results cache" value="IndexedDB collie-video / audit-results / current" />
            <InfoRow label="Output folder" value={outputFolder ?? 'Not set'} />
          </dl>
        </section>

        <section className="diagnostics-card" aria-labelledby="diagnostics-premiere-heading">
          <div className="diagnostics-card-header">
            <div>
              <p className="eyebrow">Premiere</p>
              <h3 id="diagnostics-premiere-heading">Bridge</h3>
            </div>
            <div className="diagnostics-actions">
              <StatusTag value={getPremiereLabel(premiereStatus, premiereStatusError)} tone={getPremiereTone(premiereStatus, premiereStatusError)} />
              <Button
                label="Open Apps"
                icon="pi pi-external-link"
                severity="secondary"
                outlined
                loading={isPremiereBridgeAppsLaunching}
                disabled={isPremiereBridgeAppsLaunching}
                onClick={onOpenPremiereBridgeApps}
              />
              <Button
                aria-label="Refresh Premiere status"
                icon="pi pi-refresh"
                severity="info"
                outlined
                loading={isPremiereStatusLoading}
                onClick={onRefreshPremiereStatus}
              />
            </div>
          </div>
          <dl className="diagnostics-list">
            <InfoRow label="Status" value={premiereStatus?.status ?? 'Unknown'} />
            <InfoRow label="Message" value={premiereStatus?.message ?? premiereStatusError ?? 'No status checked yet'} />
            <InfoRow label="Premiere running" value={formatBoolean(premiereStatus?.premiere?.running)} />
            <InfoRow label="Premiere detail" value={premiereStatus?.premiere?.message ?? premiereStatus?.premiere?.reason ?? 'None'} />
            <InfoRow label="Bridge connected" value={formatBoolean(premiereStatus?.bridge?.connected)} />
            <InfoRow label="Bridge state" value={premiereStatus?.bridge?.status ?? premiereStatus?.bridge?.reason ?? 'Unknown'} />
            <InfoRow label="Bridge updated" value={premiereStatus?.bridge?.updatedAt ? formatDateTime(premiereStatus.bridge.updatedAt) : 'Unknown'} />
            <InfoRow label="Bridge age" value={formatAge(premiereStatus?.bridge?.ageMs)} />
            <InfoRow label="Project" value={premiereStatus?.bridge?.activeProjectName ?? 'None'} />
            <InfoRow label="Project path" value={premiereStatus?.bridge?.activeProjectPath ?? 'None'} />
            <InfoRow label="Bridge output" value={premiereStatus?.bridge?.outputDirectory ?? 'None'} />
            <InfoRow label="Bridge directory" value={premiereStatus?.bridgeDir ?? 'Unknown'} />
          </dl>
        </section>

        <section className="diagnostics-card" aria-labelledby="diagnostics-tools-heading">
          <div className="diagnostics-card-header">
            <div>
              <p className="eyebrow">Media</p>
              <h3 id="diagnostics-tools-heading">Tools</h3>
            </div>
            <div className="diagnostics-actions">
              <StatusTag value={getToolsLabel(toolDiagnostics)} tone={getToolsTone(toolDiagnostics)} />
              <Button
                label="Check"
                icon="pi pi-bolt"
                severity="info"
                outlined
                loading={isToolDiagnosticsLoading}
                onClick={onRunToolDiagnostics}
              />
            </div>
          </div>
          <div className="diagnostics-tool-grid">
            <ToolCard tool={ffmpeg} fallbackName="ffmpeg" />
            <ToolCard tool={ffprobe} fallbackName="ffprobe" />
          </div>
          <dl className="diagnostics-list">
            <InfoRow label="Checked" value={toolDiagnostics?.checkedAt ? formatDateTime(toolDiagnostics.checkedAt) : 'Not checked'} />
            <InfoRow label="ffmpeg override" value={settings?.ffmpegPathOverride ?? 'None'} />
            <InfoRow label="ffprobe override" value={settings?.ffprobePathOverride ?? 'None'} />
          </dl>
        </section>

        <section className="diagnostics-card" aria-labelledby="diagnostics-settings-heading">
          <div className="diagnostics-card-header">
            <div>
              <p className="eyebrow">App</p>
              <h3 id="diagnostics-settings-heading">Paths & Defaults</h3>
            </div>
            <StatusTag value={appInfo?.version ? `v${appInfo.version}` : 'Loading'} tone="neutral" />
          </div>
          <dl className="diagnostics-list">
            <InfoRow label="Default output" value={settings?.defaultOutputDirectory ?? 'None'} />
            <InfoRow label="Auto-fix destination" value={settings?.defaultAutoFixDestinationRoot ?? 'None'} />
            <InfoRow label="Latest folder" value={settings?.latestSelectedFolder ?? 'None'} />
            <InfoRow label="Recent folders" value={settings ? String(settings.recentFolders.length) : 'Loading'} />
            <InfoRow label="Recent files" value={settings ? String(settings.recentFiles.length) : 'Loading'} />
            <InfoRow label="Last audit summary" value={formatLastAuditSummary(settings)} />
            <InfoRow label="Electron" value={appInfo?.electronVersion ?? 'Loading'} />
            <InfoRow label="Chrome" value={appInfo?.chromeVersion ?? 'Loading'} />
          </dl>
        </section>
      </div>
    </Dialog>
  );
}

function ToolCard({ tool, fallbackName }: { tool: ToolDiagnosticItem | null; fallbackName: string }): ReactElement {
  return (
    <div className="diagnostics-tool-card">
      <div className="diagnostics-tool-heading">
        <strong>{tool?.name ?? fallbackName}</strong>
        <StatusTag
          value={tool ? (tool.ok ? 'Ready' : 'Missing') : 'Unchecked'}
          tone={tool ? (tool.ok ? 'success' : 'danger') : 'neutral'}
        />
      </div>
      <p title={tool?.command ?? ''}>{tool?.command ?? 'No command checked yet'}</p>
      <small>{tool?.versionLine ?? tool?.message ?? 'Run diagnostics to confirm availability.'}</small>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </>
  );
}

function StatusTag({ value, tone }: { value: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }): ReactElement {
  const severity = tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info';

  return <Tag severity={severity} value={value} className={tone === 'neutral' ? 'status-tag-neutral' : undefined} />;
}

function getRuntimeStatus(auditProgress: AuditJobSnapshot | null, activeAction: string | null): string {
  if (auditProgress?.status === 'running' || auditProgress?.status === 'starting') {
    return `Audit ${auditProgress.status}`;
  }

  if (activeAction) {
    return formatAction(activeAction);
  }

  return 'No active job';
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    folders: 'Choosing folders',
    files: 'Choosing files',
    output: 'Choosing output',
    settings: 'Saving settings',
    reveal: 'Opening Finder',
    discovery: 'Scanning files',
    ffprobe: 'Reading metadata',
    autoFix: 'Auto-Fix running',
    autoCrop: 'Crop running',
    mediaPreview: 'Thumbnails running',
    previewClip: 'Preview clips running',
    migrationScan: 'Migration scan',
    migrationExecute: 'Migration running',
    premiereStatus: 'Checking Premiere',
    premiereImport: 'Premiere import'
  };

  return labels[action] ?? action;
}

function getPremiereLabel(status: PremiereStatusResponse | null, error: string | null): string {
  if (error) {
    return 'Error';
  }

  if (!status) {
    return 'Unknown';
  }

  if (status.status === 'ready') {
    return 'Ready';
  }

  if (status.status === 'premiere_not_running') {
    return 'Not running';
  }

  if (status.status === 'bridge_disconnected') {
    return 'Bridge disconnected';
  }

  return 'Error';
}

function getPremiereTone(
  status: PremiereStatusResponse | null,
  error: string | null
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (error || status?.status === 'error') {
    return 'danger';
  }

  if (status?.status === 'ready') {
    return 'success';
  }

  if (!status) {
    return 'neutral';
  }

  return 'warning';
}

function getToolsLabel(toolDiagnostics: ToolDiagnosticsResult | null): string {
  if (!toolDiagnostics) {
    return 'Unchecked';
  }

  return toolDiagnostics.tools.every((tool) => tool.ok) ? 'Ready' : 'Needs attention';
}

function getToolsTone(toolDiagnostics: ToolDiagnosticsResult | null): 'neutral' | 'success' | 'danger' {
  if (!toolDiagnostics) {
    return 'neutral';
  }

  return toolDiagnostics.tools.every((tool) => tool.ok) ? 'success' : 'danger';
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return 'Unknown';
}

function formatAge(ageMs: number | null | undefined): string {
  if (typeof ageMs !== 'number') {
    return 'Unknown';
  }

  if (ageMs < 1000) {
    return `${ageMs} ms`;
  }

  return `${Math.round(ageMs / 1000)} s`;
}

function formatLastAuditSummary(settings: AppSettings | null): string {
  const summary = settings?.lastAuditResultSummary;

  if (!summary) {
    return 'None';
  }

  return `${summary.totalFiles} files, ${summary.flaggedCount} flagged, ${summary.errorCount} errors`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
}
