import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  DuplicateCandidateEvidence,
  DuplicateCandidateFile,
  DuplicateCandidateMatchType,
  DuplicateCandidateReviewStatus,
  DuplicateReviewScanResult,
  DuplicateScanCandidate,
  DuplicateScanGroup,
  DuplicateScanSource,
  DuplicateTrashStatus
} from '../../shared/types/duplicateScan';
import { isImprovedDuplicateScanResult } from '../../shared/types/duplicateScan';
import { formatBytes } from '../helpers/fileSize';

interface DuplicateReviewWorkspaceProps {
  result: DuplicateReviewScanResult;
  markedCandidateIds: string[];
  markedCount: number;
  markedSizeBytes: number;
  trashPlanError: string | null;
  isPreparingTrashPlan: boolean;
  canReviewMarkedCandidates: boolean;
  onMarkCandidate: (candidateId: string, marked: boolean) => void;
  onClearMarks: () => void;
  onBackToResults: () => void;
  onReviewMarkedCandidates: () => void | Promise<void>;
}

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

interface ReviewFile {
  id: string;
  role: 'source' | 'candidate';
  filePath: string;
  fileName: string;
  directory: string;
  durationSeconds: number | null;
  durationFormatted?: string | null;
  width?: number | null;
  height?: number | null;
  resolution?: string | null;
  sizeBytes?: number | null;
  bitRate?: number | null;
  bitRateMbps?: number | null;
  modifiedAt?: string | null;
  modifiedAtMs?: number | null;
  fileType?: string;
  extension?: string;
  matchedStartSeconds?: number;
  matchedEndSeconds?: number;
  reviewStatus?: DuplicateCandidateReviewStatus;
  trashStatus?: DuplicateTrashStatus;
  trashError?: string | null;
}

interface ReviewGroup {
  id: string;
  mode: string;
  matchType: DuplicateCandidateMatchType;
  confidence: number;
  source: ReviewFile;
  files: ReviewFile[];
  candidates: ReviewFile[];
  evidence: DuplicateCandidateEvidence;
}

interface MatchTypeFilterOption {
  value: DuplicateCandidateMatchType;
  label: string;
  count: number;
}

export function DuplicateReviewWorkspace({
  result,
  markedCandidateIds,
  markedCount,
  markedSizeBytes,
  trashPlanError,
  isPreparingTrashPlan,
  canReviewMarkedCandidates,
  onMarkCandidate,
  onClearMarks,
  onBackToResults,
  onReviewMarkedCandidates
}: DuplicateReviewWorkspaceProps): ReactElement {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [activeMatchTypes, setActiveMatchTypes] = useState<DuplicateCandidateMatchType[]>([]);
  const markedIdSet = useMemo(() => new Set(markedCandidateIds), [markedCandidateIds]);
  const reviewGroups = useMemo(() => normalizeReviewGroups(result), [result]);
  const filterOptions = useMemo(() => buildMatchTypeFilterOptions(reviewGroups), [reviewGroups]);
  const filterKey = filterOptions.map((option) => `${option.value}:${option.count}`).join('|');
  const activeMatchTypeSet = useMemo(() => {
    const fallbackTypes = filterOptions.map((option) => option.value);
    return new Set(activeMatchTypes.length > 0 ? activeMatchTypes : fallbackTypes);
  }, [activeMatchTypes, filterOptions]);
  const filteredGroups = useMemo(
    () => reviewGroups.filter((group) => activeMatchTypeSet.has(group.matchType)),
    [activeMatchTypeSet, reviewGroups]
  );
  const summary = useMemo(() => getReviewSummary(result, reviewGroups), [result, reviewGroups]);
  const markedLabel = canReviewMarkedCandidates ? 'Marked for Trash' : 'Marked for Review';

  useEffect(() => {
    setExpandedRows({});
    setActiveMatchTypes(filterOptions.map((option) => option.value));
  }, [filterKey, filterOptions, result.scanId]);

  const toggleMatchTypeFilter = (matchType: DuplicateCandidateMatchType): void => {
    setActiveMatchTypes((currentTypes) => {
      const allTypes = filterOptions.map((option) => option.value);
      const current = currentTypes.length > 0 ? currentTypes : allTypes;
      const nextTypes = current.includes(matchType)
        ? current.filter((type) => type !== matchType)
        : [...current, matchType];

      return nextTypes.length > 0 ? nextTypes : allTypes;
    });
  };

  return (
    <section className="duplicate-review-workspace" aria-label="Duplicate candidate review workspace">
      <div className="duplicate-review-header">
        <div>
          <p className="eyebrow">Duplicate Review</p>
          <h2>Duplicate Candidate Review</h2>
          <span title={result.scannedFolder}>Scanned folder: {result.scannedFolder}</span>
        </div>
        <Button label="Back to Results" icon="pi pi-table" severity="secondary" outlined onClick={onBackToResults} />
      </div>

      <div className="duplicate-review-summary-grid">
        <SummaryMetric label="Source videos" value={result.sourceCount.toLocaleString()} />
        <SummaryMetric label="Candidate groups" value={reviewGroups.length.toLocaleString()} />
        <SummaryMetric label="Candidate files" value={summary.candidateFileCount.toLocaleString()} />
        <SummaryMetric label="Visual groups" value={summary.visualGroupCount.toLocaleString()} />
        <SummaryMetric label="Contained groups" value={summary.containedClipGroupCount.toLocaleString()} />
        <SummaryMetric
          label={markedLabel}
          value={`${markedCount.toLocaleString()} - ${formatBytes(markedSizeBytes)}`}
        />
      </div>

      <div className="duplicate-review-toolbar">
        <div className="duplicate-mode-filter-bar" aria-label="Duplicate match filters">
          <Button
            label="All"
            icon="pi pi-list"
            size="small"
            severity="secondary"
            outlined={activeMatchTypes.length !== filterOptions.length}
            onClick={() => setActiveMatchTypes(filterOptions.map((option) => option.value))}
          />
          {filterOptions.map((option) => {
            const isActive = activeMatchTypeSet.has(option.value);

            return (
              <Button
                key={option.value}
                label={`${option.label} (${option.count.toLocaleString()})`}
                icon={getMatchTypeIcon(option.value)}
                size="small"
                severity={getMatchTypeSeverity(option.value)}
                outlined={!isActive}
                onClick={() => toggleMatchTypeFilter(option.value)}
              />
            );
          })}
        </div>
        <span>{filteredGroups.length.toLocaleString()} group(s) shown</span>
      </div>

      <Message
        severity="info"
        text={
          canReviewMarkedCandidates
            ? 'Review possible duplicates by source video. Project sources are protected; only scanned duplicate candidates can be marked for Trash.'
            : 'Review likely matches by evidence. Improved visual and contained-clip actions are not connected to file operations in this stage.'
        }
      />
      {isImprovedDuplicateScanResult(result) && result.warnings.length > 0 ? (
        <Message severity="warn" text={`${result.warnings.length.toLocaleString()} scan warning(s) were recorded.`} />
      ) : null}
      {trashPlanError ? <Message severity="error" text={trashPlanError} /> : null}

      <div className="duplicate-table-shell" role="region" aria-label="Duplicate candidate groups">
        <DataTable
          value={filteredGroups}
          dataKey="id"
          expandedRows={expandedRows}
          onRowToggle={(event) => setExpandedRows((event.data ?? {}) as Record<string, boolean>)}
          rowExpansionTemplate={(group: ReviewGroup) =>
            groupExpansionTemplate(group, markedIdSet, canReviewMarkedCandidates, onMarkCandidate)
          }
          rows={10}
          paginator={filteredGroups.length > 10}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sortMode="multiple"
          removableSort
          stripedRows
          size="small"
          scrollable
          className="duplicate-groups-table"
          tableStyle={{ minWidth: '1400px' }}
          emptyMessage="No duplicate candidate groups match the current filters."
        >
          <Column expander style={{ width: '3rem' }} />
          <Column
            field="confidence"
            header="Confidence"
            sortable
            body={(group: ReviewGroup) => confidenceTemplate(group)}
            style={{ width: '8rem' }}
          />
          <Column
            field="matchType"
            header="Match Type"
            sortable
            body={(group: ReviewGroup) => matchTypeTemplate(group)}
            style={{ width: '12rem' }}
          />
          <Column
            field="source.fileName"
            header="Source Filename"
            sortable
            body={(group: ReviewGroup) => fileTemplate(group.source)}
            style={{ width: '22rem' }}
          />
          <Column
            field="source.directory"
            header="Source Folder"
            sortable
            body={(group: ReviewGroup) => pathTemplate(group.source.directory || group.source.filePath)}
            style={{ width: '24rem' }}
          />
          <Column
            header="Candidates"
            body={(group: ReviewGroup) => group.candidates.length.toLocaleString()}
            style={{ width: '7rem' }}
          />
          <Column
            header="Segment"
            body={(group: ReviewGroup) => segmentSummaryTemplate(group)}
            style={{ width: '16rem' }}
          />
          <Column
            header="Evidence"
            body={(group: ReviewGroup) => evidenceSummaryTemplate(group)}
            style={{ width: '18rem' }}
          />
          <Column
            header={markedLabel}
            body={(group: ReviewGroup) => getGroupMarkedCount(group, markedIdSet).toLocaleString()}
            style={{ width: '10rem' }}
          />
        </DataTable>
      </div>

      <div className="duplicate-review-footer" aria-label="Duplicate candidate review summary">
        <div>
          <strong>
            {markedCount.toLocaleString()} {markedLabel}
          </strong>
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
            disabled={markedCount === 0 || !canReviewMarkedCandidates}
            title={
              canReviewMarkedCandidates
                ? 'Review marked duplicate candidates before moving them to Trash.'
                : 'Run a duplicate scan before reviewing candidates for Trash.'
            }
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
  group: ReviewGroup,
  markedIdSet: Set<string>,
  canReviewMarkedCandidates: boolean,
  onMarkCandidate: (candidateId: string, marked: boolean) => void
): ReactElement {
  return (
    <div className="duplicate-review-expanded">
      <section className="duplicate-evidence-panel" aria-label={`Evidence for ${group.source.fileName}`}>
        <div className="duplicate-evidence-heading">
          <div>
            <Tag value={getMatchTypeLabel(group.matchType)} severity={getMatchTypeSeverity(group.matchType)} />
            <Tag value={formatConfidence(group.confidence)} severity={getConfidenceSeverity(group.confidence)} />
            <Tag value={getModeLabel(group.mode)} severity="secondary" />
          </div>
          <strong>{formatSegmentSummary(group)}</strong>
        </div>

        <div className="duplicate-evidence-grid">
          <EvidenceItem label="Matched frames" value={formatNumber(group.evidence.matchedFrameCount)} />
          <EvidenceItem label="Sequential run" value={formatNumber(group.evidence.sequentialMatchCount)} />
          <EvidenceItem label="Matched duration" value={formatDuration(group.evidence.matchedDurationSeconds)} />
          <EvidenceItem label="Coverage" value={formatPercent(group.evidence.shorterVideoCoverageRatio)} />
          <EvidenceItem label="Average distance" value={formatDecimal(group.evidence.averageHashDistance)} />
          <EvidenceItem label="Offset" value={formatSignedTimestamp(group.evidence.offsetSeconds)} />
          <EvidenceItem label="Sample interval" value={formatDuration(group.evidence.sampleIntervalSeconds)} />
          <EvidenceItem label="Algorithm" value={group.evidence.algorithm ?? 'Filename'} />
        </div>

        {group.evidence.notes?.length ? (
          <ul className="duplicate-evidence-notes">
            {group.evidence.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div
        className="duplicate-table-shell"
        role="region"
        aria-label={`Duplicate files for ${group.source.fileName}`}
      >
        <DataTable
          value={group.files}
          dataKey="id"
          rows={8}
          paginator={group.files.length > 8}
          rowsPerPageOptions={[8, 15, 25, 50]}
          sortMode="multiple"
          removableSort
          stripedRows
          size="small"
          scrollable
          className="duplicate-candidates-table"
          tableStyle={{ minWidth: '1500px' }}
          emptyMessage="No files for this candidate group."
        >
          <Column
            header={canReviewMarkedCandidates ? 'Marked for Trash' : 'Marked for Review'}
            body={(file: ReviewFile) =>
              markTemplate(file, group, markedIdSet, canReviewMarkedCandidates, onMarkCandidate)
            }
            style={{ width: '7.5rem' }}
          />
          <Column
            field="role"
            header="Role"
            sortable
            body={(file: ReviewFile) => roleTemplate(file)}
            style={{ width: '8rem' }}
          />
          <Column
            field="fileName"
            header="Filename"
            sortable
            body={(file: ReviewFile) => fileTemplate(file)}
            style={{ width: '20rem' }}
          />
          <Column
            field="directory"
            header="Folder"
            sortable
            body={(file: ReviewFile) => pathTemplate(file.directory || file.filePath)}
            style={{ width: '24rem' }}
          />
          <Column
            header="Matched Segment"
            body={(file: ReviewFile) => fileSegmentTemplate(file)}
            style={{ width: '12rem' }}
          />
          <Column
            header="Duration"
            body={(file: ReviewFile) => formatDuration(file.durationSeconds, file.durationFormatted)}
            style={{ width: '8rem' }}
          />
          <Column
            header="Size"
            body={(file: ReviewFile) => formatBytes(file.sizeBytes)}
            style={{ width: '8rem' }}
          />
          <Column
            header="Resolution"
            body={(file: ReviewFile) => formatResolution(file)}
            style={{ width: '8rem' }}
          />
          <Column
            header="Bitrate"
            body={(file: ReviewFile) => formatBitrate(file.bitRateMbps, file.bitRate)}
            style={{ width: '8rem' }}
          />
          <Column
            header="Modified"
            body={(file: ReviewFile) => formatDate(file.modifiedAt, file.modifiedAtMs)}
            style={{ width: '9rem' }}
          />
          <Column
            header="Status"
            body={(file: ReviewFile) => statusTemplate(file)}
            style={{ width: '11rem' }}
          />
        </DataTable>
      </div>
    </div>
  );
}

function normalizeReviewGroups(result: DuplicateReviewScanResult): ReviewGroup[] {
  if (isImprovedDuplicateScanResult(result)) {
    return result.groups.map((group): ReviewGroup => {
      const files = group.files.map(improvedFileToReviewFile);
      const source = files.find((file) => file.role === 'source') ?? files[0];
      const candidates = files.filter((file) => file.role === 'candidate');

      return {
        id: group.id,
        mode: group.mode,
        matchType: group.matchType,
        confidence: group.confidence,
        source,
        files,
        candidates,
        evidence: group.evidence
      };
    });
  }

  return result.groups.map(legacyGroupToReviewGroup);
}

function legacyGroupToReviewGroup(group: DuplicateScanGroup): ReviewGroup {
  const source = legacySourceToReviewFile(group.source);
  const candidates = group.candidates.map(legacyCandidateToReviewFile);

  return {
    id: group.id,
    mode: 'filename-exact',
    matchType: 'exact-filename',
    confidence: 1,
    source,
    files: [source, ...candidates],
    candidates,
    evidence: {
      matchedFrameCount: group.candidates.length,
      filenameMatchKey: group.source.matchKey,
      notes: ['Exact filename candidate. Duration and metadata are not used for this match.']
    }
  };
}

function legacySourceToReviewFile(source: DuplicateScanSource): ReviewFile {
  return {
    id: source.id,
    role: 'source',
    filePath: source.path,
    fileName: source.fileName,
    directory: source.directory,
    durationSeconds: source.durationSeconds ?? null,
    durationFormatted: source.durationFormatted,
    width: source.width,
    height: source.height,
    resolution: source.resolution,
    sizeBytes: source.sizeBytes,
    bitRate: source.bitRate,
    bitRateMbps: source.bitRateMbps,
    modifiedAt: source.modifiedAt,
    modifiedAtMs: source.modifiedAtMs,
    fileType: source.fileType,
    extension: source.extension
  };
}

function legacyCandidateToReviewFile(candidate: DuplicateScanCandidate): ReviewFile {
  return {
    id: candidate.id,
    role: 'candidate',
    filePath: candidate.path,
    fileName: candidate.fileName,
    directory: candidate.directory,
    durationSeconds: candidate.durationSeconds,
    durationFormatted: candidate.durationFormatted,
    width: candidate.width,
    height: candidate.height,
    resolution: candidate.resolution,
    sizeBytes: candidate.sizeBytes,
    bitRate: candidate.bitRate,
    bitRateMbps: candidate.bitRateMbps,
    modifiedAt: candidate.modifiedAt,
    modifiedAtMs: candidate.modifiedAtMs,
    fileType: candidate.fileType,
    extension: candidate.extension,
    trashStatus: candidate.trashStatus,
    trashError: candidate.trashError
  };
}

function improvedFileToReviewFile(file: DuplicateCandidateFile): ReviewFile {
  return {
    id: file.id,
    role: file.role,
    filePath: file.filePath,
    fileName: file.fileName,
    directory: file.directory,
    durationSeconds: file.durationSeconds,
    width: file.width,
    height: file.height,
    sizeBytes: file.sizeBytes,
    modifiedAtMs: file.modifiedAtMs,
    matchedStartSeconds: file.matchedStartSeconds,
    matchedEndSeconds: file.matchedEndSeconds,
    reviewStatus: file.reviewStatus
  };
}

function buildMatchTypeFilterOptions(groups: ReviewGroup[]): MatchTypeFilterOption[] {
  const orderedTypes: DuplicateCandidateMatchType[] = [
    'exact-filename',
    'near-duplicate',
    'contained-clip',
    'shared-segment'
  ];

  return orderedTypes
    .map((matchType) => ({
      value: matchType,
      label: getMatchTypeLabel(matchType),
      count: groups.filter((group) => group.matchType === matchType).length
    }))
    .filter((option) => option.count > 0);
}

function getReviewSummary(result: DuplicateReviewScanResult, groups: ReviewGroup[]): {
  candidateFileCount: number;
  visualGroupCount: number;
  containedClipGroupCount: number;
} {
  if (isImprovedDuplicateScanResult(result)) {
    return {
      candidateFileCount: result.summary.candidateFileCount,
      visualGroupCount: result.summary.visualGroupCount,
      containedClipGroupCount: result.summary.containedClipGroupCount
    };
  }

  return {
    candidateFileCount: result.matchCount,
    visualGroupCount: groups.filter((group) => group.matchType === 'near-duplicate').length,
    containedClipGroupCount: groups.filter((group) => group.matchType === 'contained-clip').length
  };
}

function SummaryMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function confidenceTemplate(group: ReviewGroup): ReactElement {
  return <Tag value={formatConfidence(group.confidence)} severity={getConfidenceSeverity(group.confidence)} />;
}

function matchTypeTemplate(group: ReviewGroup): ReactElement {
  return <Tag value={getMatchTypeLabel(group.matchType)} severity={getMatchTypeSeverity(group.matchType)} />;
}

function roleTemplate(file: ReviewFile): ReactElement {
  return (
    <Tag
      value={file.role === 'source' ? 'Project Source' : 'Candidate'}
      severity={file.role === 'source' ? 'success' : 'info'}
    />
  );
}

function fileTemplate(file: ReviewFile): ReactElement {
  return (
    <div className="duplicate-file-cell">
      <strong title={file.filePath}>{file.fileName}</strong>
      <span>{file.role === 'source' ? 'Project Source' : file.fileType || file.extension || 'Video'}</span>
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
  file: ReviewFile,
  group: ReviewGroup,
  markedIdSet: Set<string>,
  canReviewMarkedCandidates: boolean,
  onMarkCandidate: (candidateId: string, marked: boolean) => void
): ReactElement {
  if (file.role === 'source') {
    return (
      <div className="duplicate-mark-cell">
        <Tag value="Kept" severity="success" />
      </div>
    );
  }

  const checked = isReviewFileMarked(file, markedIdSet);
  const disabled = isReviewFileTerminal(file);
  const inputId = getCandidateInputId(group, file);
  const targetLabel = canReviewMarkedCandidates ? 'Trash' : 'Review';
  const label = checked
    ? `Unmark ${file.fileName} for ${targetLabel}.`
    : `Mark ${file.fileName} for ${targetLabel}.`;

  return (
    <div className="duplicate-mark-cell">
      <Checkbox
        inputId={inputId}
        checked={checked}
        disabled={disabled}
        title={disabled ? 'This candidate already has a terminal review status.' : label}
        onChange={(event) => onMarkCandidate(file.id, Boolean(event.checked))}
      />
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
    </div>
  );
}

function statusTemplate(file: ReviewFile): ReactElement {
  if (file.role === 'source') {
    return <Tag value="Protected" severity="success" />;
  }

  if (file.trashStatus) {
    return (
      <div className="duplicate-status-cell">
        <Tag value={formatTrashStatus(file.trashStatus)} severity={getTrashStatusSeverity(file.trashStatus)} />
        {file.trashError ? <small title={file.trashError}>{file.trashError}</small> : null}
      </div>
    );
  }

  const reviewStatus = file.reviewStatus ?? 'unreviewed';

  return (
    <Tag
      value={formatReviewStatus(reviewStatus)}
      severity={getReviewStatusSeverity(reviewStatus)}
    />
  );
}

function segmentSummaryTemplate(group: ReviewGroup): ReactElement {
  return (
    <div className="duplicate-evidence-summary-cell">
      <strong>{formatSegmentSummary(group)}</strong>
      {group.evidence.offsetSeconds !== undefined ? (
        <span>Offset {formatSignedTimestamp(group.evidence.offsetSeconds)}</span>
      ) : null}
    </div>
  );
}

function evidenceSummaryTemplate(group: ReviewGroup): ReactElement {
  return (
    <div className="duplicate-evidence-summary-cell">
      <strong>
        {group.evidence.sequentialMatchCount
          ? `${group.evidence.sequentialMatchCount.toLocaleString()} sequential`
          : group.evidence.matchedFrameCount
            ? `${group.evidence.matchedFrameCount.toLocaleString()} matched`
            : getMatchTypeLabel(group.matchType)}
      </strong>
      <span>
        {group.evidence.averageHashDistance !== undefined
          ? `avg distance ${formatDecimal(group.evidence.averageHashDistance)}`
          : group.evidence.filenameMatchKey
            ? `key ${group.evidence.filenameMatchKey}`
            : 'Evidence in expanded row'}
      </span>
    </div>
  );
}

function fileSegmentTemplate(file: ReviewFile): ReactElement {
  const segment = formatTimestampRange(file.matchedStartSeconds, file.matchedEndSeconds);

  return (
    <div className="duplicate-evidence-summary-cell">
      <strong>{segment}</strong>
      <span>{file.role === 'source' ? 'Source segment' : 'Candidate segment'}</span>
    </div>
  );
}

function getGroupMarkedCount(group: ReviewGroup, markedIdSet: Set<string>): number {
  return group.candidates.filter((candidate) => isReviewFileMarked(candidate, markedIdSet)).length;
}

function isReviewFileMarked(file: ReviewFile, markedIdSet: Set<string>): boolean {
  return markedIdSet.has(file.id) || markedIdSet.has(file.filePath);
}

function isReviewFileTerminal(file: ReviewFile): boolean {
  return (
    file.trashStatus === 'moved_to_trash' ||
    file.reviewStatus === 'moved-to-trash' ||
    file.reviewStatus === 'archived' ||
    file.reviewStatus === 'removed-from-table' ||
    file.reviewStatus === 'failed'
  );
}

function getCandidateInputId(group: ReviewGroup, file: ReviewFile): string {
  return `duplicate-mark-${hashDomId(`${group.id}:${file.id}:${file.filePath}`)}`;
}

function hashDomId(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function getMatchTypeLabel(matchType: DuplicateCandidateMatchType): string {
  switch (matchType) {
    case 'exact-filename':
      return 'Exact Filename';
    case 'near-duplicate':
      return 'Visual Match';
    case 'contained-clip':
      return 'Contained Clip';
    case 'shared-segment':
      return 'Shared Segment';
  }
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'filename-exact':
      return 'Filename Mode';
    case 'visual-fingerprint':
      return 'Visual Mode';
    case 'contained-clip':
      return 'Contained Mode';
    default:
      return mode;
  }
}

function getMatchTypeIcon(matchType: DuplicateCandidateMatchType): string {
  switch (matchType) {
    case 'exact-filename':
      return 'pi pi-file';
    case 'near-duplicate':
      return 'pi pi-eye';
    case 'contained-clip':
      return 'pi pi-clone';
    case 'shared-segment':
      return 'pi pi-link';
  }
}

function getMatchTypeSeverity(matchType: DuplicateCandidateMatchType): TagSeverity {
  switch (matchType) {
    case 'exact-filename':
      return 'info';
    case 'near-duplicate':
      return 'success';
    case 'contained-clip':
      return 'warning';
    case 'shared-segment':
      return 'secondary';
  }
}

function getConfidenceSeverity(confidence: number): TagSeverity {
  if (confidence >= 0.85) {
    return 'success';
  }

  if (confidence >= 0.7) {
    return 'info';
  }

  if (confidence >= 0.55) {
    return 'warning';
  }

  return 'danger';
}

function formatConfidence(confidence: number): string {
  if (!Number.isFinite(confidence)) {
    return 'Unknown';
  }

  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function formatSegmentSummary(group: ReviewGroup): string {
  if (group.matchType === 'exact-filename') {
    return 'Filename match';
  }

  const sourceSegment = formatTimestampRange(group.source.matchedStartSeconds, group.source.matchedEndSeconds);
  const candidate = group.candidates[0];
  const candidateSegment = candidate
    ? formatTimestampRange(candidate.matchedStartSeconds, candidate.matchedEndSeconds)
    : 'Unknown';

  return `Source ${sourceSegment} / Candidate ${candidateSegment}`;
}

function formatTimestampRange(
  startSeconds: number | null | undefined,
  endSeconds: number | null | undefined
): string {
  if (
    startSeconds === null ||
    startSeconds === undefined ||
    endSeconds === null ||
    endSeconds === undefined
  ) {
    return 'Not segmented';
  }

  return `${formatDuration(startSeconds)} - ${formatDuration(endSeconds)}`;
}

function formatSignedTimestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return 'Unknown';
  }

  const sign = seconds > 0 ? '+' : seconds < 0 ? '-' : '';
  return `${sign}${formatDuration(Math.abs(seconds))}`;
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

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unknown';
  }

  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unknown';
  }

  return value.toFixed(2);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unknown';
  }

  return value.toLocaleString();
}

function formatResolution(file: ReviewFile): string {
  if (file.resolution?.trim()) {
    return file.resolution;
  }

  if (
    file.width !== null &&
    file.width !== undefined &&
    file.height !== null &&
    file.height !== undefined
  ) {
    return `${file.width}x${file.height}`;
  }

  return 'Unknown';
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

function formatReviewStatus(status: DuplicateCandidateReviewStatus): string {
  switch (status) {
    case 'unreviewed':
      return 'Unreviewed';
    case 'ignored':
      return 'Ignored';
    case 'keep':
      return 'Keep';
    case 'marked-for-trash':
      return 'Marked for Trash';
    case 'marked-for-archive':
      return 'Marked for Archive';
    case 'moved-to-trash':
      return 'Moved to Trash';
    case 'archived':
      return 'Archived';
    case 'removed-from-table':
      return 'Removed from Table';
    case 'skipped':
      return 'Skipped';
    case 'failed':
      return 'Failed';
  }
}

function getReviewStatusSeverity(status: DuplicateCandidateReviewStatus): TagSeverity {
  switch (status) {
    case 'unreviewed':
      return 'secondary';
    case 'ignored':
      return 'secondary';
    case 'keep':
      return 'success';
    case 'marked-for-trash':
    case 'marked-for-archive':
      return 'warning';
    case 'moved-to-trash':
    case 'archived':
    case 'removed-from-table':
      return 'success';
    case 'skipped':
      return 'warning';
    case 'failed':
      return 'danger';
  }
}
