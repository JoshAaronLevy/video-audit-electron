import { useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  ReplacementAction,
  ReplacementPlan,
  ReplacementPlanBulkAction,
  ReplacementPlanItem
} from '../../shared/types/replacementWorkflow';

interface ReplacementReviewTableProps {
  plan: ReplacementPlan;
  isBusy: boolean;
  canExecute: boolean;
  onActionChange: (itemId: string, selectedAction: ReplacementAction) => void;
  onBulkAction: (action: ReplacementPlanBulkAction) => void;
  onExecute: () => void;
}

interface ActionOption {
  label: string;
  value: ReplacementAction;
  disabled?: boolean;
}

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

const ACTION_OPTIONS: ActionOption[] = [
  { label: 'Replace Original', value: 'replace-original' },
  { label: 'Keep Output', value: 'keep-output' },
  { label: 'Trash Original', value: 'trash-original' },
  { label: 'Archive Original', value: 'archive-original' },
  { label: 'Move Output to Chosen Folder', value: 'move-output' },
  { label: 'Skip', value: 'skip' }
];

const EXECUTABLE_STATUSES = new Set<ReplacementPlanItem['status']>(['ready', 'warning']);

export function ReplacementReviewTable({
  plan,
  isBusy,
  canExecute,
  onActionChange,
  onBulkAction,
  onExecute
}: ReplacementReviewTableProps): ReactElement {
  const [query, setQuery] = useState('');
  const actionCounts = useMemo(() => getActionCounts(plan.items), [plan.items]);
  const readyCount = plan.items.filter((item) => item.status === 'ready').length;
  const warningCount = plan.items.filter((item) => item.status === 'warning').length;
  const executableCount = plan.items.filter(isExecutableReplacementItem).length;
  const blockedSelectedCount = plan.items.filter(
    (item) => !isExecutableStatus(item) && item.selectedAction !== 'skip' && item.selectedAction !== 'keep-output'
  ).length;
  const filteredItems = useMemo(() => filterItems(plan.items, query), [plan.items, query]);

  return (
    <section className="replacement-review-workspace" aria-label="Manual replacement review">
      <Message
        severity="info"
        text="Execute Selected Actions currently runs Replace Original items. Keep Output and Skip leave files untouched; blocked rows are skipped by execution."
      />

      <div className="replacement-review-toolbar">
        <span className="p-input-icon-left replacement-review-search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText
            value={query}
            placeholder="Search replacement plan"
            aria-label="Search replacement plan"
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
        <div className="replacement-review-actions" aria-label="Bulk replacement actions">
          <Button
            label="Set Ready To Replace"
            icon="pi pi-sync"
            severity="secondary"
            outlined
            size="small"
            disabled={isBusy || readyCount === 0}
            onClick={() => onBulkAction('ready-replace')}
          />
          <Button
            label="Skip Warnings"
            icon="pi pi-ban"
            severity="secondary"
            outlined
            size="small"
            disabled={isBusy || warningCount === 0}
            onClick={() => onBulkAction('warning-skip')}
          />
          <Button
            label="Keep Outputs"
            icon="pi pi-folder-open"
            severity="secondary"
            outlined
            size="small"
            disabled={isBusy || plan.items.length === 0}
            onClick={() => onBulkAction('keep-output')}
          />
          <Button
            label="Clear Actions"
            icon="pi pi-eraser"
            severity="secondary"
            outlined
            size="small"
            disabled={isBusy || plan.items.length === 0}
            onClick={() => onBulkAction('clear-actions')}
          />
          <Button
            label="Execute Selected Actions"
            icon="pi pi-play"
            severity="danger"
            size="small"
            disabled={!canExecute || isBusy}
            onClick={onExecute}
          />
        </div>
      </div>

      <div className="replacement-action-counts" aria-label="Replacement action counts">
        <Tag value={`${filteredItems.length.toLocaleString()} shown`} />
        <Tag value={`${executableCount.toLocaleString()} executable`} severity="success" />
        <Tag value={`${actionCounts.replaceOriginal.toLocaleString()} replace`} severity="danger" />
        <Tag value={`${actionCounts.keepOutput.toLocaleString()} keep`} severity="info" />
        <Tag value={`${actionCounts.trashOriginal.toLocaleString()} trash`} severity="warning" />
        <Tag value={`${actionCounts.archiveOriginal.toLocaleString()} archive`} severity="warning" />
        <Tag value={`${actionCounts.moveOutput.toLocaleString()} move`} severity="info" />
        <Tag value={`${actionCounts.skip.toLocaleString()} skip`} severity="secondary" />
        {blockedSelectedCount > 0 ? (
          <Tag value={`${blockedSelectedCount.toLocaleString()} blocked action(s)`} severity="warning" />
        ) : null}
      </div>

      <DataTable
        value={filteredItems}
        dataKey="id"
        rows={10}
        paginator={filteredItems.length > 10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        sortMode="multiple"
        removableSort
        stripedRows
        size="small"
        scrollable
        className="replacement-review-table"
        tableStyle={{ minWidth: '1500px' }}
        emptyMessage="No replacement plan items match the current search."
      >
        <Column header="Preview" body={previewTemplate} style={{ width: '7rem' }} />
        <Column field="originalFileName" header="Original" sortable body={originalTemplate} style={{ width: '19rem' }} />
        <Column field="outputFileName" header="Converted" sortable body={convertedTemplate} style={{ width: '19rem' }} />
        <Column header="Original Info" body={originalInfoTemplate} style={{ width: '12rem' }} />
        <Column header="Converted Info" body={outputInfoTemplate} style={{ width: '12rem' }} />
        <Column
          field="proposedFinalPath"
          header="Proposed Final Location"
          sortable
          body={proposedPathTemplate}
          style={{ width: '24rem' }}
        />
        <Column
          field="selectedAction"
          header="Action"
          body={(item: ReplacementPlanItem) => actionTemplate(item, isBusy, onActionChange)}
          style={{ width: '16rem' }}
        />
        <Column
          field="status"
          header="Status / Warning"
          sortable
          body={statusTemplate}
          style={{ width: '19rem' }}
        />
      </DataTable>
    </section>
  );
}

function previewTemplate(): ReactElement {
  return (
    <div className="replacement-preview-cell">
      <i className="pi pi-video" aria-hidden="true" />
      <span>No preview</span>
    </div>
  );
}

function originalTemplate(item: ReplacementPlanItem): ReactElement {
  return <FileCell fileName={item.originalFileName} path={item.originalPath} directory={item.originalDirectory} />;
}

function convertedTemplate(item: ReplacementPlanItem): ReactElement {
  return <FileCell fileName={item.outputFileName} path={item.outputPath} directory={item.outputDirectory} />;
}

function FileCell({
  fileName,
  path,
  directory
}: {
  fileName: string;
  path: string;
  directory: string;
}): ReactElement {
  return (
    <div className="replacement-file-cell">
      <strong title={path}>{fileName}</strong>
      <code title={directory || path}>{directory || 'Unknown folder'}</code>
    </div>
  );
}

function originalInfoTemplate(item: ReplacementPlanItem): ReactElement {
  return (
    <MetadataCell
      sizeBytes={item.originalSizeBytes}
      modifiedAtMs={item.originalModifiedAtMs}
      extension={item.originalExtension}
    />
  );
}

function outputInfoTemplate(item: ReplacementPlanItem): ReactElement {
  return (
    <MetadataCell
      sizeBytes={item.outputSizeBytes}
      modifiedAtMs={item.outputModifiedAtMs}
      extension={item.outputExtension}
    />
  );
}

function MetadataCell({
  sizeBytes,
  modifiedAtMs,
  extension
}: {
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  extension: string;
}): ReactElement {
  return (
    <dl className="replacement-meta-cell">
      <div>
        <dt>Size</dt>
        <dd>{formatBytes(sizeBytes)}</dd>
      </div>
      <div>
        <dt>Modified</dt>
        <dd>{formatTimestamp(modifiedAtMs)}</dd>
      </div>
      <div>
        <dt>Ext</dt>
        <dd>{extension || 'Unknown'}</dd>
      </div>
    </dl>
  );
}

function proposedPathTemplate(item: ReplacementPlanItem): ReactElement {
  return (
    <code className="replacement-final-path" title={item.proposedFinalPath}>
      {item.proposedFinalPath || 'No final path'}
    </code>
  );
}

function actionTemplate(
  item: ReplacementPlanItem,
  isBusy: boolean,
  onActionChange: (itemId: string, selectedAction: ReplacementAction) => void
): ReactElement {
  return (
    <Dropdown
      value={item.selectedAction}
      options={getActionOptions(item)}
      optionLabel="label"
      optionValue="value"
      optionDisabled="disabled"
      disabled={isBusy}
      className="replacement-action-dropdown"
      aria-label={`Replacement action for ${item.originalFileName}`}
      onChange={(event) => onActionChange(item.id, event.value as ReplacementAction)}
    />
  );
}

function statusTemplate(item: ReplacementPlanItem): ReactElement {
  const details = [...item.errors, ...item.warnings];

  return (
    <div className="replacement-status-cell">
      <Tag value={formatStatus(item.status)} severity={getStatusSeverity(item)} />
      {details.length > 0 ? <small>{details.join(' ')}</small> : <small>No warnings</small>}
    </div>
  );
}

function getActionOptions(item: ReplacementPlanItem): ActionOption[] {
  if (isExecutableStatus(item)) {
    return ACTION_OPTIONS;
  }

  return ACTION_OPTIONS.map((option) =>
    option.value === 'skip' || option.value === 'keep-output'
      ? option
      : {
          ...option,
          disabled: true
        }
  );
}

function filterItems(items: ReplacementPlanItem[], query: string): ReplacementPlanItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    [
      item.originalFileName,
      item.originalPath,
      item.outputFileName,
      item.outputPath,
      item.proposedFinalPath,
      item.status,
      item.selectedAction,
      item.conversionStatus ?? '',
      ...item.warnings,
      ...item.errors
    ].some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}

function getActionCounts(items: ReplacementPlanItem[]): {
  replaceOriginal: number;
  keepOutput: number;
  trashOriginal: number;
  archiveOriginal: number;
  moveOutput: number;
  skip: number;
} {
  return {
    replaceOriginal: items.filter((item) => item.selectedAction === 'replace-original').length,
    keepOutput: items.filter((item) => item.selectedAction === 'keep-output').length,
    trashOriginal: items.filter((item) => item.selectedAction === 'trash-original').length,
    archiveOriginal: items.filter((item) => item.selectedAction === 'archive-original').length,
    moveOutput: items.filter((item) => item.selectedAction === 'move-output').length,
    skip: items.filter((item) => item.selectedAction === 'skip').length
  };
}

function isExecutableReplacementItem(item: ReplacementPlanItem): boolean {
  return item.selectedAction === 'replace-original' && isExecutableStatus(item);
}

function isExecutableStatus(item: ReplacementPlanItem): boolean {
  return EXECUTABLE_STATUSES.has(item.status);
}

function getStatusSeverity(item: ReplacementPlanItem): TagSeverity {
  if (item.status === 'ready') {
    return 'success';
  }

  if (item.status === 'warning') {
    return 'warning';
  }

  return 'danger';
}

function formatStatus(status: ReplacementPlanItem['status']): string {
  return status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return 'Unknown';
  }

  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${bytes.toLocaleString()} B`;
}

function formatTimestamp(value: number | null): string {
  if (value === null) {
    return 'Unknown';
  }

  return new Date(value).toLocaleString();
}
