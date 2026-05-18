import { useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AuditError, AuditSummary } from '../../shared/types/audit';
import type { PreviewClipJobSnapshot } from '../../shared/types/mediaPreview';
import type { PremiereRequestResponse } from '../../shared/types/premiere';
import type { VideoAdjustments, VideoPreviewFrame, VideoRow } from '../../shared/types/video';
import { VideoDetailsDialog } from './VideoDetailsDialog';

interface VideoResultsTableProps {
  rows: VideoRow[];
  allRows: VideoRow[] | null;
  selectedVideos: VideoRow[];
  globalFilter: string;
  showThumbnails: boolean;
  auditSummary: AuditSummary | null;
  auditErrors: AuditError[];
  removedVideoCount: number;
  isPreviewClipActive: boolean;
  isStorageLoading: boolean;
  storageMessage: string | null;
  storageSavedAt: string | null;
  previewClipProgress: PreviewClipJobSnapshot | null;
  previewClipPercent: number | null;
  previewClipError: string | null;
  premiereImportResult: PremiereRequestResponse | null;
  premiereImportError: string | null;
  onSelectedVideosChange: (videos: VideoRow[]) => void;
  onStartPreviewClipGeneration: (video: VideoRow, frames: VideoPreviewFrame[]) => void;
  onCancelPreviewClipGeneration: () => void;
  onRevealPath: (path: string) => void;
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

export function VideoResultsTable({
  rows,
  allRows,
  selectedVideos,
  globalFilter,
  showThumbnails,
  auditSummary,
  auditErrors,
  removedVideoCount,
  isPreviewClipActive,
  isStorageLoading,
  storageMessage,
  storageSavedAt,
  previewClipProgress,
  previewClipPercent,
  previewClipError,
  premiereImportResult,
  premiereImportError,
  onSelectedVideosChange,
  onStartPreviewClipGeneration,
  onCancelPreviewClipGeneration,
  onRevealPath
}: VideoResultsTableProps): ReactElement {
  const [detailPath, setDetailPath] = useState<string | null>(null);
  const detailVideo = useMemo(() => {
    if (!detailPath) {
      return null;
    }

    return (allRows ?? rows).find((row) => row.path === detailPath) ?? null;
  }, [allRows, detailPath, rows]);
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
      {!isStorageLoading && !allRows ? (
        <Message
          severity="info"
          text="Choose a folder or video files, then run an audit to populate the results table."
        />
      ) : null}
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
        paginator={!isStorageLoading}
        rows={50}
        rowsPerPageOptions={[25, 50, 100, 250, 500, 1000]}
        sortMode="multiple"
        removableSort
        globalFilter={globalFilter}
        globalFilterFields={globalFilterFields}
        stripedRows
        size="small"
        scrollable
        tableStyle={{ minWidth: showThumbnails ? '1380px' : '1280px' }}
        emptyMessage={isStorageLoading ? 'Loading saved audit...' : 'No videos found.'}
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ width: '3rem' }} />
        {showThumbnails ? (
          <Column header="Preview" body={thumbnailTemplate} style={{ width: '7rem' }} />
        ) : null}
        <Column field="displayFile" header="File" sortable body={fileTemplate} style={{ width: '28%' }} />
        <Column field="fileType" header="Type" sortable style={{ width: '8%' }} />
        <Column field="sizeMB" header="Size" sortable body={sizeTemplate} style={{ width: '9%' }} />
        <Column field="durationSeconds" header="Duration" sortable body={durationTemplate} style={{ width: '9%' }} />
        <Column field="modifiedAt" header="Modified" sortable body={modifiedTemplate} style={{ width: '12%' }} />
        <Column field="width" header="Resolution" sortable body={resolutionTemplate} style={{ width: '10%' }} />
        <Column
          field="displayAspectRatio"
          header="Aspect"
          sortable
          body={aspectTemplate}
          style={{ width: '10%' }}
        />
        <Column field="adjustments" header="Crop" body={cropTemplate} style={{ width: '10%' }} />
        <Column field="reasons" header="Issues" body={issuesTemplate} style={{ width: '16%' }} />
        <Column
          header="Actions"
          body={(row: VideoRow) => actionsTemplate(row, setDetailPath, onRevealPath)}
          style={{ width: '7.5rem' }}
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
        onGeneratePreviewClips={onStartPreviewClipGeneration}
        onCancelPreviewClips={onCancelPreviewClipGeneration}
        onRevealPath={onRevealPath}
        onHide={() => setDetailPath(null)}
      />
    </section>
  );
}

function thumbnailTemplate(row: VideoRow): ReactElement {
  const thumbnailUrl = row.thumbnail?.url;

  return thumbnailUrl ? (
    <img className="video-thumb" src={thumbnailUrl} alt={`Preview for ${row.fileName}`} />
  ) : (
    <span className="thumb-placeholder" aria-label="No thumbnail" />
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

function issuesTemplate(row: VideoRow): string {
  return row.reasons || 'Review needed';
}

function actionsTemplate(
  row: VideoRow,
  onOpenDetails: (path: string) => void,
  onRevealPath: (path: string) => void
): ReactElement {
  return (
    <div className="row-action-buttons">
      <Button
        aria-label={`Open details for ${row.fileName}`}
        icon="pi pi-search"
        severity="secondary"
        text
        rounded
        onClick={() => onOpenDetails(row.path)}
      />
      <Button
        aria-label={`Reveal ${row.fileName} in Finder`}
        icon="pi pi-external-link"
        severity="secondary"
        text
        rounded
        onClick={() => onRevealPath(row.path)}
      />
    </div>
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
