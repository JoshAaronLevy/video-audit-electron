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
  activeProjectName: string | null;
  projectSavedAt: string | null;
  projectMessage: string | null;
  projectError: string | null;
  isProjectSaving: boolean;
  isProjectDirty: boolean;
  onOpenProjects: () => void;
  onSaveProject: () => void;
  onOpenOperationHistory: () => void;
  onOpenUtilities: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({
  appInfo,
  auditSummary,
  visibleVideoCount,
  selectedVideoCount,
  premiereStatus,
  activeProjectName,
  projectSavedAt,
  projectMessage,
  projectError,
  isProjectSaving,
  isProjectDirty,
  onOpenProjects,
  onSaveProject,
  onOpenOperationHistory,
  onOpenUtilities,
  onOpenSettings
}: AppHeaderProps): ReactElement {
  const projectName = activeProjectName ?? 'Untitled Project';
  const projectStatus = getProjectStatus({
    isProjectSaving,
    isProjectDirty,
    projectError,
    projectMessage,
    projectSavedAt
  });

  return (
    <header className="app-header">
      <div className="app-header-title">
        <p className="eyebrow">Collie Video</p>
        <h1>Results Workspace</h1>
        <div className="project-status-line" aria-label="Project save status">
          <strong className="project-status-name" title={projectName}>
            {projectName}
          </strong>
          <span className={`project-save-status ${projectStatus.className}`} title={projectStatus.text}>
            {projectStatus.text}
          </span>
        </div>
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
        <Button
          label="Projects"
          icon="pi pi-folder-open"
          severity="info"
          outlined
          onClick={onOpenProjects}
        />
        <Button
          label="Save"
          icon="pi pi-save"
          severity="success"
          loading={isProjectSaving}
          onClick={onSaveProject}
        />
        <Tag value={getPremiereLabel(premiereStatus)} severity={getPremiereSeverity(premiereStatus)} />
        <Tag value={`v${appInfo?.version ?? '...'}`} severity="info" />
        <Button label="History" icon="pi pi-history" severity="secondary" onClick={onOpenOperationHistory} />
        <Button label="Tools" icon="pi pi-wrench" severity="info" onClick={onOpenUtilities} />
        <Button label="Settings" icon="pi pi-cog" severity="secondary" onClick={onOpenSettings} />
      </div>
    </header>
  );
}

interface ProjectStatusInput {
  isProjectSaving: boolean;
  isProjectDirty: boolean;
  projectError: string | null;
  projectMessage: string | null;
  projectSavedAt: string | null;
}

function getProjectStatus({
  isProjectSaving,
  isProjectDirty,
  projectError,
  projectMessage,
  projectSavedAt
}: ProjectStatusInput): { text: string; className: string } {
  if (isProjectSaving) {
    return {
      text: 'Saving...',
      className: 'is-saving'
    };
  }

  if (projectError) {
    return {
      text: `Save failed: ${projectError}`,
      className: 'is-error'
    };
  }

  if (isProjectDirty) {
    return {
      text: 'Unsaved changes',
      className: 'is-unsaved'
    };
  }

  if (projectMessage) {
    return {
      text: projectMessage,
      className: 'is-saved'
    };
  }

  if (projectSavedAt) {
    return {
      text: formatSavedAt(projectSavedAt),
      className: 'is-saved'
    };
  }

  return {
    text: 'Not saved yet',
    className: 'is-unsaved'
  };
}

function formatSavedAt(value: string): string {
  const savedAt = new Date(value);

  if (Number.isNaN(savedAt.getTime())) {
    return 'Saved';
  }

  return `Saved ${savedAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}`;
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
