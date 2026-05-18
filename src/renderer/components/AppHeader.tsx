import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../../shared/types/app';
import type { AuditSummary } from '../../shared/types/audit';
import type { PremiereStatusResponse } from '../../shared/types/premiere';

interface AppHeaderProps {
  appInfo: AppInfo | null;
  auditSummary: AuditSummary | null;
  visibleVideoCount: number;
  selectedVideoCount: number;
  premiereStatus: PremiereStatusResponse | null;
  onOpenUtilities: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({
  appInfo,
  auditSummary,
  visibleVideoCount,
  selectedVideoCount,
  premiereStatus,
  onOpenUtilities,
  onOpenSettings
}: AppHeaderProps): ReactElement {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Video Audit</p>
        <h1>Results Workspace</h1>
      </div>

      <div className="header-center" aria-label="Audit summary">
        <strong>{getResultSummary(auditSummary, visibleVideoCount)}</strong>
        <span>
          {selectedVideoCount > 0
            ? `${selectedVideoCount.toLocaleString()} selected`
            : 'No videos selected'}
        </span>
      </div>

      <div className="header-meta">
        <Tag value={getPremiereLabel(premiereStatus)} severity={getPremiereSeverity(premiereStatus)} />
        <Tag value={`v${appInfo?.version ?? '...'}`} severity="info" />
        <Button label="Tools" icon="pi pi-wrench" severity="info" onClick={onOpenUtilities} />
        <Button label="Settings" icon="pi pi-cog" severity="secondary" onClick={onOpenSettings} />
      </div>
    </header>
  );
}

function getResultSummary(auditSummary: AuditSummary | null, visibleVideoCount: number): string {
  if (auditSummary) {
    const scanned = auditSummary.scannedVideos.toLocaleString();
    const flagged = auditSummary.flaggedCount.toLocaleString();
    const errors = auditSummary.errorCount.toLocaleString();
    return `${scanned} scanned - ${flagged} flagged - ${errors} errors`;
  }

  if (visibleVideoCount > 0) {
    return `${visibleVideoCount.toLocaleString()} videos loaded`;
  }

  return 'No audit loaded';
}

function getPremiereLabel(status: PremiereStatusResponse | null): string {
  if (!status) {
    return 'Premiere unknown';
  }

  if (status.status === 'ready') {
    return 'Premiere ready';
  }

  return 'Premiere attention';
}

function getPremiereSeverity(
  status: PremiereStatusResponse | null
): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' {
  if (!status) {
    return 'secondary';
  }

  if (status.status === 'ready') {
    return 'success';
  }

  if (status.status === 'error') {
    return 'danger';
  }

  return 'warning';
}
