import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';

interface ResultsToolbarProps {
  globalFilter: string;
  showThumbnails: boolean;
  isAuditActive: boolean;
  isStorageLoading: boolean;
  canRefreshAudit: boolean;
  hasAuditData: boolean;
  onGlobalFilterChange: (value: string) => void;
  onShowThumbnailsChange: (value: boolean) => void;
  onRefreshAudit: () => void;
  onClearData: () => void;
}

export function ResultsToolbar({
  globalFilter,
  showThumbnails,
  isAuditActive,
  isStorageLoading,
  canRefreshAudit,
  hasAuditData,
  onGlobalFilterChange,
  onShowThumbnailsChange,
  onRefreshAudit,
  onClearData
}: ResultsToolbarProps): ReactElement {
  return (
    <section className="results-toolbar" aria-label="Results controls">
      <span className="p-input-icon-left table-search">
        <i className="pi pi-search" />
        <InputText
          value={globalFilter}
          placeholder="Search videos"
          disabled={isAuditActive || isStorageLoading}
          onChange={(event) => onGlobalFilterChange(event.target.value)}
        />
      </span>

      <label className="inline-toggle" htmlFor="show-thumbnails">
        <Checkbox
          inputId="show-thumbnails"
          checked={showThumbnails}
          disabled={isStorageLoading}
          onChange={(event) => onShowThumbnailsChange(Boolean(event.checked))}
        />
        <span>Thumbnails</span>
      </label>

      <div className="results-toolbar-actions">
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="info"
          disabled={!canRefreshAudit || isAuditActive}
          onClick={onRefreshAudit}
        />
        <Button
          label="Clear Data"
          icon="pi pi-trash"
          severity="danger"
          disabled={isAuditActive || isStorageLoading || !hasAuditData}
          onClick={onClearData}
        />
      </div>
    </section>
  );
}
