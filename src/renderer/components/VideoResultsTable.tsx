import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AuditError, AuditOptions, AuditSummary } from '../../shared/types/audit';
import type { KnownPathValidationItem } from '../../shared/types/fileOperations';
import type { PreviewClipJobSnapshot } from '../../shared/types/mediaPreview';
import type { PremiereRequestResponse } from '../../shared/types/premiere';
import type { VideoAdjustments, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import type { ResultsViewFilter } from '../types/resultsView';
import { VideoDetailsDialog } from './VideoDetailsDialog';

interface VideoResultsTableProps {
  rows: VideoRow[];
  allRows: VideoRow[] | null;
  selectedVideos: VideoRow[];
  globalFilter: string;
  resultsViewFilter: ResultsViewFilter;
  hasSources: boolean;
  selectedFolderCount: number;
  selectedFileCount: number;
  auditOptions: AuditOptions;
  auditSummary: AuditSummary | null;
  auditErrors: AuditError[];
  removedVideoCount: number;
  isAuditActive: boolean;
  canRunAudit: boolean;
  auditPercent: number | null;
  auditProgressMessage: string | null;
  isPreviewClipActive: boolean;
  isStorageLoading: boolean;
  storageMessage: string | null;
  storageSavedAt: string | null;
  previewClipProgress: PreviewClipJobSnapshot | null;
  previewClipPercent: number | null;
  previewClipError: string | null;
  isPreviewFrameFetching: boolean;
  previewFrameError: string | null;
  premiereImportResult: PremiereRequestResponse | null;
  premiereImportError: string | null;
  onSelectedVideosChange: (videos: VideoRow[]) => void;
  onOpenSourceSetup: () => void;
  onRunAudit: () => void;
  onClearPreviewFrameError: () => void;
  onGetFreshThumbnails: (video: VideoRow) => void | Promise<void>;
  onStartPreviewClipGeneration: (video: VideoRow, frames: VideoPreviewFrame[]) => void;
  onCancelPreviewClipGeneration: () => void;
  onRevealKnownFile: (item: KnownPathValidationItem) => void;
}

const globalFilterFields = [
  'displayFile',
  'fileName',
  'displayDirectory',
  'directory',
  'fileType',
  'resolution',
  'displayAspectRatio',
  'adjustments.blackBorder.classification',
  'adjustments.blackBorder.confidence',
  'adjustments.blackBorder.recommendedFix.reason',
  'reasons',
  'status'
];

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

const ROW_ACTION_TOOLTIP_OPTIONS = { position: 'top' } as const;

export function VideoResultsTable({
  rows,
  allRows,
  selectedVideos,
  globalFilter,
  resultsViewFilter,
  hasSources,
  selectedFolderCount,
  selectedFileCount,
  auditOptions,
  auditSummary,
  auditErrors,
  removedVideoCount,
  isAuditActive,
  canRunAudit,
  auditPercent,
  auditProgressMessage,
  isPreviewClipActive,
  isStorageLoading,
  storageMessage,
  storageSavedAt,
  previewClipProgress,
  previewClipPercent,
  previewClipError,
  isPreviewFrameFetching,
  previewFrameError,
  premiereImportResult,
  premiereImportError,
  onSelectedVideosChange,
  onOpenSourceSetup,
  onRunAudit,
  onClearPreviewFrameError,
  onGetFreshThumbnails,
  onStartPreviewClipGeneration,
  onCancelPreviewClipGeneration,
  onRevealKnownFile
}: VideoResultsTableProps): ReactElement {
  const [detailPath, setDetailPath] = useState<string | null>(null);
  const detailVideo = useMemo(() => {
    if (!detailPath) {
      return null;
    }

    return (allRows ?? rows).find((row) => row.path === detailPath) ?? null;
  }, [allRows, detailPath, rows]);

  useEffect(() => {
    if (detailPath) {
      onClearPreviewFrameError();
    }
  }, [detailPath, onClearPreviewFrameError]);
  const emptyState = getEmptyState({
    allRows,
    auditSummary,
    globalFilter,
    hasSources,
    selectedFileCount,
    selectedFolderCount,
    auditOptions,
    canRunAudit,
    isAuditActive,
    auditPercent,
    auditProgressMessage,
    isStorageLoading,
    resultsViewFilter,
    rows,
    onOpenSourceSetup,
    onRunAudit
  });
  const tableHeader = (
    <div className="table-header">
      <div className="table-title-group">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Results</p>
            <h2>{rows.length.toLocaleString()} Videos</h2>
          </div>
          <Tag value={auditSummary ? `${auditSummary.scannedVideos.toLocaleString()} scanned` : 'No audit'} />
        </div>
        <div className="table-summary">
          <span>Flagged: {auditSummary?.flaggedCount.toLocaleString() ?? '0'}</span>
          <span>Errors: {auditSummary?.errorCount.toLocaleString() ?? '0'}</span>
          <span>Selected: {selectedVideos.length.toLocaleString()}</span>
          {removedVideoCount > 0 ? <span>Removed: {removedVideoCount.toLocaleString()}</span> : null}
          <span>{storageSavedAt ? `Saved ${formatDateTime(storageSavedAt)}` : 'Unsaved'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="results-panel" aria-label="Loaded videos">
      {storageMessage ? <Message severity="info" text={storageMessage} /> : null}
      {isStorageLoading ? <Message severity="info" text="Loading saved audit data..." /> : null}
      {premiereImportError ? <Message severity="error" text={premiereImportError} /> : null}
      {premiereImportResult?.status === 'queued' ? (
        <Message
          severity="success"
          text={`Premiere import request queued${
            premiereImportResult.requestId ? ` (${premiereImportResult.requestId})` : ''
          }.`}
        />
      ) : null}

      <DataTable
        value={isStorageLoading ? [] : rows}
        header={tableHeader}
        dataKey="path"
        className="video-table"
        selectionMode="multiple"
        selection={selectedVideos}
        onSelectionChange={(event) => onSelectedVideosChange(event.value as VideoRow[])}
        metaKeySelection={false}
        paginator={!isStorageLoading && rows.length > 0}
        rows={50}
        rowsPerPageOptions={[25, 50, 100, 250, 500, 1000]}
        sortMode="multiple"
        removableSort
        globalFilter={globalFilter}
        globalFilterFields={globalFilterFields}
        stripedRows
        size="small"
        scrollable
        tableStyle={{ minWidth: '1320px' }}
        emptyMessage={
          <EmptyState
            title={emptyState.title}
            body={emptyState.body}
            icon={emptyState.icon}
            meta={emptyState.meta}
            progress={emptyState.progress}
            actions={emptyState.actions}
          />
        }
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ width: '3rem' }} />
        <Column header="Preview" body={thumbnailTemplate} style={{ width: '6.5rem' }} />
        <Column field="displayFile" header="File" sortable body={fileTemplate} style={{ width: '27rem' }} />
        <Column field="fileType" header="Type" sortable body={typeTemplate} style={{ width: '6.5rem' }} />
        <Column field="sizeMB" header="Size" sortable body={sizeTemplate} style={{ width: '7rem' }} />
        <Column field="durationSeconds" header="Duration" sortable body={durationTemplate} style={{ width: '7.5rem' }} />
        <Column field="modifiedAt" header="Modified" sortable body={modifiedTemplate} style={{ width: '8.5rem' }} />
        <Column field="width" header="Resolution" sortable body={resolutionTemplate} style={{ width: '8rem' }} />
        <Column
          field="displayAspectRatio"
          header="Aspect"
          sortable
          body={aspectTemplate}
          style={{ width: '7rem' }}
        />
        <Column field="adjustments" header="Crop" body={cropTemplate} style={{ width: '7.5rem' }} />
        <Column field="reasons" header="Issues" body={issuesTemplate} style={{ width: '16rem' }} />
        <Column
          header="Actions"
          body={(row: VideoRow) => actionsTemplate(row, setDetailPath, onRevealKnownFile)}
          style={{ width: '7rem' }}
        />
      </DataTable>

      {auditErrors.length > 0 ? <AuditErrorList errors={auditErrors} /> : null}

      <VideoDetailsDialog
        visible={Boolean(detailVideo)}
        video={detailVideo}
        previewClipProgress={previewClipProgress}
        previewClipPercent={previewClipPercent}
        previewClipError={previewClipError}
        isPreviewClipActive={isPreviewClipActive}
        isPreviewFrameFetching={isPreviewFrameFetching}
        previewFrameError={previewFrameError}
        onGetFreshThumbnails={onGetFreshThumbnails}
        onGeneratePreviewClips={onStartPreviewClipGeneration}
        onCancelPreviewClips={onCancelPreviewClipGeneration}
        onRevealKnownFile={onRevealKnownFile}
        onHide={() => setDetailPath(null)}
      />
    </section>
  );
}

function thumbnailTemplate(row: VideoRow): ReactElement {
  const thumbnailUrl = row.thumbnail?.url;

  return thumbnailUrl ? (
    <div className="preview-cell">
      <img className="video-thumb" src={thumbnailUrl} alt={`Preview for ${row.fileName}`} />
    </div>
  ) : (
    <div className="preview-cell">
      <span className="thumb-placeholder" aria-label="No thumbnail">
        <i className="pi pi-image" aria-hidden="true" />
      </span>
    </div>
  );
}

function fileTemplate(row: VideoRow): ReactElement {
  return (
    <div className="file-cell">
      <span title={row.path}>{row.displayFile || row.fileName}</span>
      <small title={row.displayDirectory || row.directory}>{row.displayDirectory || row.directory}</small>
    </div>
  );
}

function typeTemplate(row: VideoRow): ReactElement {
  return <span className="metadata-pill">{row.fileType || row.fileExtension || 'Video'}</span>;
}

function sizeTemplate(row: VideoRow): string {
  if (row.sizeGB !== null && row.sizeGB >= 1) {
    return `${row.sizeGB} GB`;
  }

  if (row.sizeMB !== null) {
    return `${row.sizeMB} MB`;
  }

  return '';
}

function durationTemplate(row: VideoRow): string {
  return row.durationFormatted || '';
}

function modifiedTemplate(row: VideoRow): string {
  if (!row.modifiedAt) {
    return '';
  }

  const date = new Date(row.modifiedAt);
  return Number.isNaN(date.getTime()) ? row.modifiedAt : date.toLocaleDateString();
}

function resolutionTemplate(row: VideoRow): ReactElement {
  return (
    <Tag
      value={row.resolution || 'Unknown'}
      severity={row.isLowResolution ? 'danger' : 'success'}
      className="result-tag"
    />
  );
}

function aspectTemplate(row: VideoRow): ReactElement {
  return (
    <Tag
      value={row.displayAspectRatio || String(row.calculatedAspectRatio ?? 'Unknown')}
      severity={row.isWrongAspectRatio ? 'warning' : 'success'}
      className="result-tag"
    />
  );
}

function cropTemplate(row: VideoRow): ReactElement {
  const crop = getBlackBorderCropDisplay(row);

  return (
    <Tag
      value={crop.value}
      severity={crop.severity}
      className="result-tag crop-tag"
      title={crop.detail}
    />
  );
}

function getBlackBorderCropDisplay(row: VideoRow): {
  value: string;
  severity: TagSeverity;
  detail: string;
} {
  const blackBorder = row.adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return {
      value: 'Not scanned',
      severity: 'secondary',
      detail: 'Black-border analysis did not run for this video.'
    };
  }

  const status = getBlackBorderCropStatus(row.adjustments);
  const detailParts = [
    blackBorder.error ? `Error: ${blackBorder.error}` : null,
    getBlackBorderClassificationDetail(status),
    blackBorder.confidence ? `Confidence: ${blackBorder.confidence}.` : null,
    formatVisibleAreaDetail(row),
    blackBorder.recommendedFix?.reason ?? null
  ].filter(Boolean);

  return {
    value: status,
    severity: getBlackBorderCropSeverity(status, blackBorder.classification === 'clean'),
    detail: detailParts.join(' ')
  };
}

function getBlackBorderCropStatus(adjustments?: VideoAdjustments): string {
  const blackBorder = adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return 'Not scanned';
  }

  switch (blackBorder.classification) {
    case 'analysis_error':
      return 'Error';
    case 'uncertain':
      return 'Uncertain';
    case 'nested_borders':
      return blackBorder.recommendedFix?.eligible ? 'Auto' : 'Review';
    case 'asymmetric_border':
    case 'pillarboxed':
    case 'letterboxed':
      return 'Review';
    case 'clean':
      return 'No';
  }
}

function getBlackBorderCropSeverity(status: string, isClean: boolean): TagSeverity {
  if (isClean || status === 'No') {
    return 'success';
  }

  if (status === 'Auto' || status === 'Error') {
    return 'danger';
  }

  if (status === 'Review' || status === 'Uncertain') {
    return 'warning';
  }

  return 'secondary';
}

function getBlackBorderClassificationDetail(status: string): string {
  switch (status) {
    case 'Auto':
      return 'High-confidence nested borders can be cropped and scaled.';
    case 'Review':
      return 'Black-border analysis found a video that needs review.';
    case 'Uncertain':
      return 'Black-border analysis was inconclusive.';
    case 'Error':
      return 'Black-border analysis could not be completed.';
    case 'No':
      return 'No crop review is needed based on black-border analysis.';
    default:
      return 'Black-border analysis has not run.';
  }
}

function formatVisibleAreaDetail(row: VideoRow): string | null {
  const blackBorder = row.adjustments?.blackBorder;
  const visibleArea = blackBorder?.visibleArea;

  if (!visibleArea) {
    return null;
  }

  return `Visible area: ${visibleArea.width}x${visibleArea.height} at ${visibleArea.x},${visibleArea.y}.`;
}

function issuesTemplate(row: VideoRow): ReactElement {
  const issues = getIssueBadges(row);

  return (
    <div className="issue-badges" title={row.reasons || undefined}>
      {issues.map((issue) => (
        <Tag
          key={issue.label}
          value={issue.label}
          severity={issue.severity}
          className="issue-badge"
          title={issue.detail}
        />
      ))}
    </div>
  );
}

function actionsTemplate(
  row: VideoRow,
  onOpenDetails: (path: string) => void,
  onRevealKnownFile: (item: KnownPathValidationItem) => void
): ReactElement {
  return (
    <div className="row-action-buttons">
      <Button
        aria-label={`Open details for ${row.fileName}`}
        icon="pi pi-search"
        severity="secondary"
        text
        rounded
        tooltip="Details"
        tooltipOptions={ROW_ACTION_TOOLTIP_OPTIONS}
        onClick={() => onOpenDetails(row.path)}
      />
      <Button
        aria-label={`Reveal ${row.fileName} in Finder`}
        icon="pi pi-external-link"
        severity="secondary"
        text
        rounded
        tooltip="Reveal in Finder"
        tooltipOptions={ROW_ACTION_TOOLTIP_OPTIONS}
        onClick={() => onRevealKnownFile(toKnownVideoFile(row))}
      />
    </div>
  );
}

function toKnownVideoFile(row: VideoRow): KnownPathValidationItem {
  return {
    id: row.id ?? row.path,
    path: row.path,
    expectedKind: 'file',
    expectedFileName: row.fileName,
    expectedSizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
    expectedModifiedAtMs: row.modifiedAtMs ?? null,
    requireSupportedVideoExtension: true
  };
}

interface TableEmptyState {
  title: string;
  body: string;
  icon: string;
  meta?: string[];
  progress?: {
    percent: number | null;
    label: string;
  };
  actions?: {
    label: string;
    icon: string;
    severity: 'primary' | 'secondary' | 'info';
    disabled?: boolean;
    onClick: () => void;
  }[];
}

function EmptyState({ title, body, icon, meta, progress, actions }: TableEmptyState): ReactElement {
  return (
    <div className="table-empty-state">
      <i className={icon} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
      {meta && meta.length > 0 ? (
        <div className="table-empty-meta">
          {meta.map((item) => (
            <Tag key={item} value={item} />
          ))}
        </div>
      ) : null}
      {progress ? (
        <div
          className="table-empty-progress"
          aria-label={progress.label}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress.percent ?? undefined}
          role="progressbar"
        >
          <div>
            <span style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
          <small>{progress.percent === null ? progress.label : `${progress.label} (${progress.percent}%)`}</small>
        </div>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="table-empty-actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              icon={action.icon}
              severity={action.severity === 'primary' ? undefined : action.severity}
              disabled={action.disabled}
              onClick={action.onClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getEmptyState({
  allRows,
  auditSummary,
  globalFilter,
  hasSources,
  selectedFolderCount,
  selectedFileCount,
  auditOptions,
  canRunAudit,
  isAuditActive,
  auditPercent,
  auditProgressMessage,
  isStorageLoading,
  resultsViewFilter,
  rows,
  onOpenSourceSetup,
  onRunAudit
}: {
  allRows: VideoRow[] | null;
  auditSummary: AuditSummary | null;
  globalFilter: string;
  hasSources: boolean;
  selectedFolderCount: number;
  selectedFileCount: number;
  auditOptions: AuditOptions;
  canRunAudit: boolean;
  isAuditActive: boolean;
  auditPercent: number | null;
  auditProgressMessage: string | null;
  isStorageLoading: boolean;
  resultsViewFilter: ResultsViewFilter;
  rows: VideoRow[];
  onOpenSourceSetup: () => void;
  onRunAudit: () => void;
}): TableEmptyState {
  if (isStorageLoading) {
    return {
      title: 'Loading saved audit data',
      body: 'Restoring the latest local results.',
      icon: 'pi pi-spin pi-spinner'
    };
  }

  if (isAuditActive && !allRows) {
    const optionLabels = getAuditOptionLabels(auditOptions);

    return {
      title: 'Audit running',
      body: auditProgressMessage ?? 'Scanning selected videos and preparing results.',
      icon: 'pi pi-spin pi-spinner',
      meta: optionLabels,
      progress: {
        percent: auditPercent,
        label: 'Audit progress'
      }
    };
  }

  if (!hasSources && !allRows) {
    return {
      title: 'Start by choosing videos to audit',
      body: 'Select a folder or individual files, then run an audit to find low-resolution, wrong-aspect-ratio, or black-border videos.',
      icon: 'pi pi-folder-open',
      actions: [
        {
          label: 'Choose Sources',
          icon: 'pi pi-folder-open',
          severity: 'primary',
          onClick: onOpenSourceSetup
        }
      ]
    };
  }

  if (hasSources && !allRows) {
    const optionLabels = getAuditOptionLabels(auditOptions);

    return {
      title: `Ready to audit ${formatSourceCount(selectedFolderCount, selectedFileCount)}`,
      body: `Audit options: ${optionLabels.join(', ') || 'none selected'}.`,
      icon: 'pi pi-play-circle',
      meta: optionLabels,
      actions: [
        {
          label: 'Run Audit',
          icon: 'pi pi-shield',
          severity: 'primary',
          disabled: !canRunAudit,
          onClick: onRunAudit
        },
        {
          label: 'Edit Sources',
          icon: 'pi pi-pencil',
          severity: 'secondary',
          onClick: onOpenSourceSetup
        }
      ]
    };
  }

  if ((auditSummary?.scannedVideos ?? 0) === 0 && allRows && allRows.length === 0) {
    return {
      title: 'No videos found in selected sources.',
      body: 'Try another folder, file selection, or audit option.',
      icon: 'pi pi-video'
    };
  }

  if ((auditSummary?.scannedVideos ?? 0) > 0 && allRows && allRows.length === 0) {
    return {
      title: 'No flagged videos found.',
      body: 'The audit completed without finding videos that need review.',
      icon: 'pi pi-check-circle'
    };
  }

  if (rows.length === 0 || globalFilter.trim()) {
    return {
      title: 'No videos match the current view.',
      body: getFilteredEmptyStateBody(resultsViewFilter, globalFilter),
      icon: 'pi pi-filter'
    };
  }

  return {
    title: 'No videos found.',
    body: 'Run or refresh an audit to reload results.',
    icon: 'pi pi-search'
  };
}

function formatSourceCount(folderCount: number, fileCount: number): string {
  const parts: string[] = [];

  if (folderCount > 0) {
    parts.push(`${folderCount.toLocaleString()} ${folderCount === 1 ? 'folder' : 'folders'}`);
  }

  if (fileCount > 0) {
    parts.push(`${fileCount.toLocaleString()} ${fileCount === 1 ? 'file' : 'files'}`);
  }

  return parts.join(' and ') || 'selected sources';
}

function getAuditOptionLabels(options: AuditOptions): string[] {
  const labels: string[] = [];

  if (options.includeSubfolders) {
    labels.push('subfolders');
  }

  if (options.includeLowResolutionAnalysis) {
    labels.push('low-res');
  }

  if (options.includeBlackBorderAnalysis) {
    labels.push('black borders');
  }

  return labels;
}

function getViewFilterLabel(filter: ResultsViewFilter): string {
  const labels: Record<ResultsViewFilter, string> = {
    all: 'All',
    flagged: 'Flagged',
    'low-res': 'Low-res',
    aspect: 'Aspect',
    crop: 'Crop',
    errors: 'Errors'
  };

  return labels[filter];
}

function getFilteredEmptyStateBody(filter: ResultsViewFilter, globalFilter: string): string {
  if (globalFilter.trim() && filter !== 'all') {
    return `Clear search or switch from ${getViewFilterLabel(filter)} to All.`;
  }

  if (globalFilter.trim()) {
    return 'Clear search to see every loaded result.';
  }

  if (filter !== 'all') {
    return `Switch from ${getViewFilterLabel(filter)} to All to broaden the table.`;
  }

  return 'Run or refresh an audit to reload results.';
}

function getIssueBadges(row: VideoRow): { label: string; severity: TagSeverity; detail: string }[] {
  const issues: { label: string; severity: TagSeverity; detail: string }[] = [];
  const blackBorder = row.adjustments?.blackBorder;

  if (row.isLowResolution) {
    issues.push({
      label: 'Low-res',
      severity: 'danger',
      detail: 'Video resolution is below the configured minimum.'
    });
  }

  if (row.isWrongAspectRatio) {
    issues.push({
      label: 'Not 16:9',
      severity: 'warning',
      detail: 'Video aspect ratio is outside the configured tolerance.'
    });
  }

  if (hasBlackBorderIssue(row)) {
    issues.push({
      label: 'Black borders',
      severity: blackBorder?.classification === 'analysis_error' ? 'danger' : 'warning',
      detail: blackBorder?.recommendedFix?.reason ?? getBlackBorderCropDisplay(row).detail
    });
  }

  if (hasRowError(row)) {
    issues.push({
      label: 'Error',
      severity: 'danger',
      detail: blackBorder?.error ?? row.reasons
    });
  }

  if (issues.length === 0 && row.reasons) {
    issues.push({
      label: 'Review',
      severity: 'info',
      detail: row.reasons
    });
  }

  if (issues.length === 0) {
    issues.push({
      label: 'OK',
      severity: 'success',
      detail: 'No issues detected for this row.'
    });
  }

  return issues;
}

function hasBlackBorderIssue(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return false;
  }

  return (
    blackBorder.detected ||
    blackBorder.classification === 'nested_borders' ||
    blackBorder.classification === 'asymmetric_border' ||
    blackBorder.classification === 'pillarboxed' ||
    blackBorder.classification === 'letterboxed' ||
    blackBorder.classification === 'uncertain' ||
    blackBorder.classification === 'analysis_error' ||
    blackBorder.recommendedFix?.eligible === true ||
    blackBorder.recommendedFix?.type === 'crop-scale' ||
    blackBorder.recommendedFix?.type === 'manual-review'
  );
}

function hasRowError(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  return (
    Boolean(blackBorder?.error) ||
    blackBorder?.classification === 'analysis_error' ||
    row.reasons.toLowerCase().includes('error')
  );
}

function AuditErrorList({ errors }: { errors: AuditError[] }): ReactElement {
  return (
    <section className="audit-errors" aria-label="Audit errors">
      <div className="compact-heading">
        <h3>Errors</h3>
        <Tag value={String(errors.length)} severity="danger" />
      </div>
      <ul>
        {errors.map((error) => (
          <li key={`${error.path}-${error.error}`}>
            <span title={error.path}>{error.fileName}</span>
            <small>{error.error}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
