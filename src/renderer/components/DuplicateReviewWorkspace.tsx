import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  DuplicateScanCandidate,
  DuplicateScanGroup,
  DuplicateScanResult,
  DuplicateScanSource,
  DuplicateTrashStatus
} from '../../shared/types/duplicateScan';
import { formatBytes } from '../helpers/fileSize';

interface DuplicateReviewWorkspaceProps {
  result: DuplicateScanResult;
  markedCandidateIds: string[];
  markedCount: number;
  markedSizeBytes: number;
  trashPlanError: string | null;
  isPreparingTrashPlan: boolean;
  onMarkCandidate: (candidateId: string, marked: boolean) => void;
  onClearMarks: () => void;
  onBackToResults: () => void;
  onReviewMarkedCandidates: () => void | Promise<void>;
}

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

export function DuplicateReviewWorkspace({
  result,
  markedCandidateIds,
  markedCount,
  markedSizeBytes,
  trashPlanError,
  isPreparingTrashPlan,
  onMarkCandidate,
  onClearMarks,
  onBackToResults,
  onReviewMarkedCandidates
}: DuplicateReviewWorkspaceProps): ReactElement {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const markedIdSet = useMemo(() => new Set(markedCandidateIds), [markedCandidateIds]);

  useEffect(() => {
    setExpandedRows({});
  }, [result.scanId]);

  return (
    <section className="duplicate-review-workspace" aria-label="Duplicate Review workspace">
      <div className="duplicate-review-header">
        <div>
          <p className="eyebrow">Duplicate Review</p>
          <h2>Dupe Scan Results</h2>
          <span title={result.scannedFolder}>Scanned folder: {result.scannedFolder}</span>
        </div>
        <Button label="Back to Results" icon="pi pi-table" severity="secondary" outlined onClick={onBackToResults} />
      </div>

      <div className="duplicate-review-summary-grid">
        <SummaryMetric label="Source videos" value={result.sourceCount.toLocaleString()} />
        <SummaryMetric label="Groups with matches" value={result.groups.length.toLocaleString()} />
        <SummaryMetric label="Duplicate candidates" value={result.matchCount.toLocaleString()} />
        <SummaryMetric label="Videos checked" value={result.checkedVideoFileCount.toLocaleString()} />
        <SummaryMetric label="Files scanned" value={result.scannedFileCount.toLocaleString()} />
        <SummaryMetric
          label="Marked for Trash"
          value={`${markedCount.toLocaleString()} - ${formatBytes(markedSizeBytes)}`}
        />
      </div>

      <Message
        severity="info"
        text="Review possible duplicates by source video. Project sources are protected; only scanned duplicate candidates can be marked for Trash."
      />
      {trashPlanError ? <Message severity="error" text={trashPlanError} /> : null}

      <DataTable
        value={result.groups}
        dataKey="id"
        expandedRows={expandedRows}
        onRowToggle={(event) => setExpandedRows((event.data ?? {}) as Record<string, boolean>)}
        rowExpansionTemplate={(group: DuplicateScanGroup) =>
          groupExpansionTemplate(group, markedIdSet, onMarkCandidate)
        }
        rows={10}
        paginator={result.groups.length > 10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        sortMode="multiple"
        removableSort
        stripedRows
        size="small"
        scrollable
        className="duplicate-groups-table"
        tableStyle={{ minWidth: '1280px' }}
        emptyMessage="No duplicate candidate groups found."
      >
        <Column expander style={{ width: '3rem' }} />
        <Column
          field="source.fileName"
          header="Source Filename"
          sortable
          body={(group: DuplicateScanGroup) => sourceFileTemplate(group.source)}
          style={{ width: '22rem' }}
        />
        <Column
          field="source.directory"
          header="Source Folder"
          sortable
          body={(group: DuplicateScanGroup) => pathTemplate(group.source.directory || group.source.path)}
          style={{ width: '28rem' }}
        />
        <Column
          header="Matches"
          body={(group: DuplicateScanGroup) => group.candidates.length.toLocaleString()}
          style={{ width: '7rem' }}
        />
        <Column
          header="Marked for Trash"
          body={(group: DuplicateScanGroup) => getGroupMarkedCount(group, markedIdSet).toLocaleString()}
          style={{ width: '10rem' }}
        />
        <Column
          header="Duration"
          body={(group: DuplicateScanGroup) => formatDuration(group.source.durationSeconds, group.source.durationFormatted)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Size"
          body={(group: DuplicateScanGroup) => formatBytes(group.source.sizeBytes)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Resolution"
          body={(group: DuplicateScanGroup) => metadataText(group.source.resolution)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Modified"
          body={(group: DuplicateScanGroup) => formatDate(group.source.modifiedAt, group.source.modifiedAtMs)}
          style={{ width: '9rem' }}
        />
      </DataTable>

      <div className="duplicate-review-footer" aria-label="Duplicate candidate Trash review summary">
        <div>
          <strong>{markedCount.toLocaleString()} Marked for Trash</strong>
          <span>{formatBytes(markedSizeBytes)} total</span>
        </div>
        <div>
          <Button
            label="Clear Marks"
            icon="pi pi-eraser"
            severity="secondary"
            outlined
            disabled={markedCount === 0 || isPreparingTrashPlan}
            onClick={onClearMarks}
          />
          <Button
            label="Review & Move to Trash"
            icon="pi pi-trash"
            severity="danger"
            loading={isPreparingTrashPlan}
            disabled={markedCount === 0}
            title="Review marked duplicate candidates before moving them to Trash."
            onClick={() => {
              void onReviewMarkedCandidates();
            }}
          />
        </div>
      </div>
    </section>
  );
}

function groupExpansionTemplate(
  group: DuplicateScanGroup,
  markedIdSet: Set<string>,
  onMarkCandidate: (candidateId: string, marked: boolean) => void
): ReactElement {
  return (
    <div className="duplicate-review-expanded">
      <section className="duplicate-source-summary" aria-label={`Protected source summary for ${group.source.fileName}`}>
        <div className="duplicate-source-heading">
          <div>
            <Tag value="Project Source" severity="success" />
            <Tag value="Source -- not markable for deletion" severity="secondary" />
          </div>
          <strong title={group.source.path}>{group.source.fileName}</strong>
        </div>

        <div className="duplicate-source-metadata-grid">
          <MetadataItem label="Full path" value={group.source.path} code />
          <MetadataItem
            label="Duration"
            value={formatDuration(group.source.durationSeconds, group.source.durationFormatted)}
          />
          <MetadataItem label="Size" value={formatBytes(group.source.sizeBytes)} />
          <MetadataItem label="Resolution" value={metadataText(group.source.resolution)} />
          <MetadataItem label="Bitrate" value={formatBitrate(group.source.bitRateMbps, group.source.bitRate)} />
          <MetadataItem label="Modified" value={formatDate(group.source.modifiedAt, group.source.modifiedAtMs)} />
        </div>
      </section>

      <DataTable
        value={group.candidates}
        dataKey="id"
        rows={8}
        paginator={group.candidates.length > 8}
        rowsPerPageOptions={[8, 15, 25, 50]}
        sortMode="multiple"
        removableSort
        stripedRows
        size="small"
        scrollable
        className="duplicate-candidates-table"
        tableStyle={{ minWidth: '1500px' }}
        emptyMessage="No duplicate candidates for this source."
      >
        <Column
          header="Marked for Trash"
          body={(candidate: DuplicateScanCandidate) => markTemplate(candidate, markedIdSet, onMarkCandidate)}
          style={{ width: '9rem' }}
        />
        <Column
          field="fileName"
          header="Filename"
          sortable
          body={(candidate: DuplicateScanCandidate) => candidateFileTemplate(candidate)}
          style={{ width: '20rem' }}
        />
        <Column
          field="directory"
          header="Folder"
          sortable
          body={(candidate: DuplicateScanCandidate) => pathTemplate(candidate.directory || candidate.path)}
          style={{ width: '25rem' }}
        />
        <Column
          header="Duration"
          body={(candidate: DuplicateScanCandidate) =>
            formatDuration(candidate.durationSeconds, candidate.durationFormatted)
          }
          style={{ width: '8rem' }}
        />
        <Column
          header="Duration Delta"
          body={(candidate: DuplicateScanCandidate) => formatSignedDuration(candidate.durationDeltaSeconds)}
          style={{ width: '9rem' }}
        />
        <Column
          header="Size"
          body={(candidate: DuplicateScanCandidate) => formatBytes(candidate.sizeBytes)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Size Delta"
          body={(candidate: DuplicateScanCandidate) => formatSignedBytes(candidate.sizeDeltaBytes)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Resolution"
          body={(candidate: DuplicateScanCandidate) => metadataText(candidate.resolution)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Bitrate"
          body={(candidate: DuplicateScanCandidate) => formatBitrate(candidate.bitRateMbps, candidate.bitRate)}
          style={{ width: '8rem' }}
        />
        <Column
          header="Modified"
          body={(candidate: DuplicateScanCandidate) => formatDate(candidate.modifiedAt, candidate.modifiedAtMs)}
          style={{ width: '9rem' }}
        />
        <Column
          header="Match"
          body={() => <Tag value="Exact filename match" severity="info" />}
          style={{ width: '11rem' }}
        />
        <Column
          field="trashStatus"
          header="Trash Status"
          sortable
          body={(candidate: DuplicateScanCandidate) => trashStatusTemplate(candidate)}
          style={{ width: '11rem' }}
        />
      </DataTable>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function MetadataItem({
  label,
  value,
  code
}: {
  label: string;
  value: string;
  code?: boolean;
}): ReactElement {
  return (
    <div>
      <span>{label}</span>
      {code ? <code title={value}>{value}</code> : <strong title={value}>{value}</strong>}
    </div>
  );
}

function sourceFileTemplate(source: DuplicateScanSource): ReactElement {
  return (
    <div className="duplicate-file-cell">
      <strong title={source.path}>{source.fileName}</strong>
      <span>Project Source</span>
    </div>
  );
}

function candidateFileTemplate(candidate: DuplicateScanCandidate): ReactElement {
  return (
    <div className="duplicate-file-cell">
      <strong title={candidate.path}>{candidate.fileName}</strong>
      <span>{candidate.fileType || candidate.extension || 'Video'}</span>
    </div>
  );
}

function pathTemplate(value: string): ReactElement {
  return (
    <code className="duplicate-path-cell" title={value}>
      {value || 'Unknown folder'}
    </code>
  );
}

function markTemplate(
  candidate: DuplicateScanCandidate,
  markedIdSet: Set<string>,
  onMarkCandidate: (candidateId: string, marked: boolean) => void
): ReactElement {
  const checked = isCandidateMarked(candidate, markedIdSet);
  const disabled = candidate.trashStatus === 'moved_to_trash';
  const inputId = getCandidateInputId(candidate);

  return (
    <div className="duplicate-mark-cell">
      <Checkbox
        inputId={inputId}
        checked={checked}
        disabled={disabled}
        title={disabled ? 'This candidate was already moved to Trash.' : 'Mark duplicate candidate for Trash.'}
        onChange={(event) => onMarkCandidate(candidate.id, Boolean(event.checked))}
      />
      <label htmlFor={inputId}>Marked for Trash</label>
    </div>
  );
}

function trashStatusTemplate(candidate: DuplicateScanCandidate): ReactElement {
  return (
    <div className="duplicate-status-cell">
      <Tag value={formatTrashStatus(candidate.trashStatus)} severity={getTrashStatusSeverity(candidate.trashStatus)} />
      {candidate.trashError ? <small title={candidate.trashError}>{candidate.trashError}</small> : null}
    </div>
  );
}

function getGroupMarkedCount(group: DuplicateScanGroup, markedIdSet: Set<string>): number {
  return group.candidates.filter((candidate) => isCandidateMarked(candidate, markedIdSet)).length;
}

function isCandidateMarked(candidate: DuplicateScanCandidate, markedIdSet: Set<string>): boolean {
  return markedIdSet.has(candidate.id) || markedIdSet.has(candidate.path);
}

function getCandidateInputId(candidate: DuplicateScanCandidate): string {
  return `duplicate-mark-${hashDomId(`${candidate.sourceId}:${candidate.id}:${candidate.path}`)}`;
}

function hashDomId(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function metadataText(value: string | null | undefined): string {
  return value?.trim() || 'Unknown';
}

function formatDuration(seconds: number | null | undefined, formatted?: string | null): string {
  if (formatted?.trim()) {
    return formatted;
  }

  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return 'Unknown';
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatSignedDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return 'Unknown';
  }

  const sign = seconds > 0 ? '+' : seconds < 0 ? '-' : '';
  return `${sign}${formatDuration(Math.abs(seconds))}`;
}

function formatSignedBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return 'Unknown';
  }

  const sign = bytes > 0 ? '+' : bytes < 0 ? '-' : '';
  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function formatBitrate(bitRateMbps: number | null | undefined, bitRate: number | null | undefined): string {
  if (bitRateMbps !== null && bitRateMbps !== undefined && Number.isFinite(bitRateMbps)) {
    return `${bitRateMbps.toFixed(2)} Mbps`;
  }

  if (bitRate !== null && bitRate !== undefined && Number.isFinite(bitRate)) {
    return `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
  }

  return 'Unknown';
}

function formatDate(value: string | null | undefined, valueMs?: number | null): string {
  const date = valueMs !== null && valueMs !== undefined ? new Date(valueMs) : value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return value?.trim() || 'Unknown';
  }

  return date.toLocaleDateString();
}

function formatTrashStatus(status: DuplicateTrashStatus): string {
  switch (status) {
    case 'unmarked':
      return 'Unmarked';
    case 'planned':
      return 'Planned';
    case 'moved_to_trash':
      return 'Moved to Trash';
    case 'skipped':
      return 'Skipped';
    case 'failed':
      return 'Failed';
  }
}

function getTrashStatusSeverity(status: DuplicateTrashStatus): TagSeverity {
  switch (status) {
    case 'unmarked':
      return 'secondary';
    case 'planned':
      return 'warning';
    case 'moved_to_trash':
      return 'success';
    case 'skipped':
      return 'warning';
    case 'failed':
      return 'danger';
  }
}
