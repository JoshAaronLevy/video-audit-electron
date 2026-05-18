import { useMemo, useRef, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { SelectButton } from 'primereact/selectbutton';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

interface ResultsToolbarProps {
  globalFilter: string;
  resultsViewFilter: ResultsViewFilter;
  resultsViewCounts: ResultsViewCounts;
  showThumbnails: boolean;
  isAuditActive: boolean;
  isStorageLoading: boolean;
  isCacheClearing: boolean;
  canRefreshAudit: boolean;
  hasAuditData: boolean;
  onGlobalFilterChange: (value: string) => void;
  onResultsViewFilterChange: (value: ResultsViewFilter) => void;
  onShowThumbnailsChange: (value: boolean) => void;
  onRefreshAudit: () => void;
  onClearData: () => void;
}

export function ResultsToolbar({
  globalFilter,
  resultsViewFilter,
  resultsViewCounts,
  showThumbnails,
  isAuditActive,
  isStorageLoading,
  isCacheClearing,
  canRefreshAudit,
  hasAuditData,
  onGlobalFilterChange,
  onResultsViewFilterChange,
  onShowThumbnailsChange,
  onRefreshAudit,
  onClearData
}: ResultsToolbarProps): ReactElement {
  const menuRef = useRef<Menu>(null);
  const viewOptions = useMemo(
    () =>
      [
        { label: 'All', value: 'all' },
        { label: 'Flagged', value: 'flagged' },
        { label: 'Low-res', value: 'low-res' },
        { label: 'Aspect', value: 'aspect' },
        { label: 'Crop', value: 'crop' },
        { label: 'Errors', value: 'errors' }
      ] satisfies { label: string; value: ResultsViewFilter }[],
    []
  );
  const overflowItems = useMemo<MenuItem[]>(
    () => [
      {
        label: 'Refresh Audit',
        icon: 'pi pi-refresh',
        disabled: !canRefreshAudit || isAuditActive,
        command: onRefreshAudit
      }
    ],
    [canRefreshAudit, isAuditActive, onRefreshAudit]
  );
  const activeCount = resultsViewCounts[resultsViewFilter] ?? 0;

  return (
    <section className="results-toolbar" aria-label="Results controls">
      <div className="results-toolbar-primary">
        <span className="p-input-icon-left table-search">
          <i className="pi pi-search" />
          <InputText
            value={globalFilter}
            placeholder="Search videos..."
            disabled={isAuditActive || isStorageLoading}
            onChange={(event) => onGlobalFilterChange(event.target.value)}
          />
        </span>

        <SelectButton
          aria-label="Filter results"
          value={resultsViewFilter}
          options={viewOptions}
          disabled={isStorageLoading}
          allowEmpty={false}
          className="results-view-filter"
          onChange={(event) => {
            if (event.value) {
              onResultsViewFilterChange(event.value as ResultsViewFilter);
            }
          }}
        />
      </div>

      <div className="results-toolbar-secondary">
        <span className="results-filter-count">
          {activeCount.toLocaleString()} shown
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

        <Menu id="results-toolbar-menu" model={overflowItems} popup ref={menuRef} />
        <Button
          label="Clear Cache"
          icon="pi pi-trash"
          severity="danger"
          outlined
          loading={isCacheClearing}
          disabled={isAuditActive || isStorageLoading || isCacheClearing || !hasAuditData}
          onClick={() => {
            void onClearData();
          }}
        />
        <Button
          label="View"
          icon="pi pi-sliders-h"
          severity="secondary"
          outlined
          aria-haspopup
          aria-controls="results-toolbar-menu"
          onClick={(event) => menuRef.current?.toggle(event)}
        />
      </div>
    </section>
  );
}
