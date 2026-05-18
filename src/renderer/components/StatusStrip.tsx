import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import type { AuditJobSnapshot } from '../../shared/types/audit';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import type { PremiereStatusResponse } from '../../shared/types/premiere';

interface StatusStripProps {
  auditProgress: AuditJobSnapshot | null;
  activeAction: string | null;
  premiereStatus: PremiereStatusResponse | null;
  premiereStatusError: string | null;
  isPremiereStatusLoading: boolean;
  toolDiagnostics: ToolDiagnosticsResult | null;
  storageSavedAt: string | null;
  outputFolder: string | null;
  onOpenDiagnostics: () => void;
  onRefreshPremiereStatus: () => void;
}

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function StatusStrip({
  auditProgress,
  activeAction,
  premiereStatus,
  premiereStatusError,
  isPremiereStatusLoading,
  toolDiagnostics,
  storageSavedAt,
  outputFolder,
  onOpenDiagnostics,
  onRefreshPremiereStatus
}: StatusStripProps): ReactElement {
  const toolStatus = getToolStatus(toolDiagnostics);

  return (
    <section className="status-strip" aria-label="Application status">
      <StatusItem
        label="Job"
        value={getJobLabel(auditProgress, activeAction)}
        tone={auditProgress?.status === 'error' ? 'danger' : activeAction ? 'info' : 'neutral'}
        onClick={onOpenDiagnostics}
      />
      <StatusItem
        label="Premiere"
        value={getPremiereStatusLabel(premiereStatus, premiereStatusError, isPremiereStatusLoading)}
        tone={getPremiereTone(premiereStatus, premiereStatusError, isPremiereStatusLoading)}
        onClick={onOpenDiagnostics}
      />
      <StatusItem
        label="ffmpeg"
        value={toolStatus.ffmpeg.label}
        tone={toolStatus.ffmpeg.tone}
        onClick={onOpenDiagnostics}
      />
      <StatusItem
        label="ffprobe"
        value={toolStatus.ffprobe.label}
        tone={toolStatus.ffprobe.tone}
        onClick={onOpenDiagnostics}
      />
      <StatusItem
        label="Audit"
        value={storageSavedAt ? `Saved ${formatDateTime(storageSavedAt)}` : 'Unsaved'}
        tone={storageSavedAt ? 'success' : 'neutral'}
        onClick={onOpenDiagnostics}
      />
      <StatusItem
        label="Output"
        value={outputFolder ? 'Set' : 'Not set'}
        tone={outputFolder ? 'success' : 'neutral'}
        onClick={onOpenDiagnostics}
      />

      <div className="status-strip-actions">
        <Button
          aria-label="Refresh Premiere status"
          icon="pi pi-refresh"
          severity="info"
          loading={isPremiereStatusLoading}
          onClick={onRefreshPremiereStatus}
        />
        <Button label="Details" icon="pi pi-chart-line" severity="secondary" onClick={onOpenDiagnostics} />
      </div>
    </section>
  );
}

function StatusItem({
  label,
  value,
  tone,
  onClick
}: {
  label: string;
  value: string;
  tone: StatusTone;
  onClick: () => void;
}): ReactElement {
  return (
    <button type="button" className="status-item" onClick={onClick}>
      <span className={`status-dot is-${tone}`} aria-hidden="true" />
      <span className="status-label">{label}</span>
      <strong title={value}>{value}</strong>
    </button>
  );
}

function getJobLabel(auditProgress: AuditJobSnapshot | null, activeAction: string | null): string {
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

function getPremiereStatusLabel(
  status: PremiereStatusResponse | null,
  error: string | null,
  isLoading: boolean
): string {
  if (isLoading) {
    return 'Checking';
  }

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
  error: string | null,
  isLoading: boolean
): StatusTone {
  if (isLoading) {
    return 'info';
  }

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

function getToolStatus(toolDiagnostics: ToolDiagnosticsResult | null): {
  ffmpeg: { label: string; tone: StatusTone };
  ffprobe: { label: string; tone: StatusTone };
} {
  const fallback = {
    label: 'Unchecked',
    tone: 'neutral' as StatusTone
  };

  if (!toolDiagnostics) {
    return {
      ffmpeg: fallback,
      ffprobe: fallback
    };
  }

  const ffmpeg = toolDiagnostics.tools.find((tool) => tool.name === 'ffmpeg');
  const ffprobe = toolDiagnostics.tools.find((tool) => tool.name === 'ffprobe');

  return {
    ffmpeg: ffmpeg ? toolToStatus(ffmpeg.ok) : fallback,
    ffprobe: ffprobe ? toolToStatus(ffprobe.ok) : fallback
  };
}

function toolToStatus(ok: boolean): { label: string; tone: StatusTone } {
  return ok
    ? {
        label: 'Ready',
        tone: 'success'
      }
    : {
        label: 'Missing',
        tone: 'danger'
      };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });
}
