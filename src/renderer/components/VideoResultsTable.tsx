import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { FilterMatchMode, FilterService } from 'primereact/api';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { MultiSelect } from 'primereact/multiselect';
import { Tag } from 'primereact/tag';
import type { AuditError, AuditOptions, AuditSummary } from '../../shared/types/audit';
import type { KnownPathValidationItem } from '../../shared/types/fileOperations';
import type { PreviewClipJobSnapshot } from '../../shared/types/mediaPreview';
import type { PremiereRequestResponse } from '../../shared/types/premiere';
import type {
  SavedFileAvailability,
  VideoAdjustments,
  VideoPreviewFrame,
  VideoRow
} from '../../shared/types/video';
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
  displayRootPath: string | null;
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
  fileAvailabilityMessage: string | null;
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

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';
type DurationFilterValue =
  | 'under-5'
  | '5-10'
  | '10-20'
  | '20-30'
  | '30-45'
  | '45-60'
  | 'over-60';
type FileSizeFilterValue = 'very-small' | 'small' | 'medium' | 'large' | 'very-large';
type DirectoryFilterValue = string;
type AvailabilityFilterValue = SavedFileAvailability | 'unchecked';
type ModifiedFilterValue =
  | 'last-7'
  | 'last-30'
  | 'last-90'
  | 'last-180'
  | 'last-365'
  | 'more-than-365';
type ResolutionFilterValue = 'high' | 'medium' | 'low';
type CropFilterValue = 'Auto' | 'Review' | 'No' | 'Uncertain' | 'Error' | 'Not scanned';
type TableFilterMatchMode = 'custom' | 'equals';
type TableFilterDimension =
  | 'directory'
  | 'availability'
  | 'type'
  | 'size'
  | 'duration'
  | 'modified'
  | 'resolution'
  | 'aspect'
  | 'crop';

interface SelectOption<TValue> {
  label: string;
  value: TValue;
}

interface TableFilterMetaData<TValue = unknown> {
  value: TValue | null;
  matchMode: TableFilterMatchMode | undefined;
}

type TableFilterMeta = Record<string, TableFilterMetaData>;

interface FilterTemplateOptions<TValue> {
  value: TValue;
  filterApplyCallback: (value?: TValue, index?: number) => void;
}

interface ActiveTableFilters {
  directory: DirectoryFilterValue[];
  availability: AvailabilityFilterValue[];
  type: string[];
  size: FileSizeFilterValue[];
  duration: DurationFilterValue[];
  modified: ModifiedFilterValue[];
  resolution: ResolutionFilterValue | null;
  aspect: boolean | null;
  crop: CropFilterValue[];
}

const ROW_ACTION_TOOLTIP_OPTIONS = { position: 'top' } as const;
const DEFAULT_PAGE_SIZE = 100;
const TABLE_FILTER_FIELDS = {
  directory: 'path',
  availability: 'fileAvailability.status',
  type: 'fileType',
  size: 'sizeMB',
  duration: 'durationSeconds',
  modified: 'modifiedAt',
  resolution: 'resolution',
  aspect: 'isWrongAspectRatio',
  crop: 'adjustments'
} as const;
const DIRECTORY_FILTER_ROOT_PREFIX = 'root:';
const DIRECTORY_FILTER_DIRECTORY_PREFIX = 'dir:';
const CUSTOM_TABLE_FILTER_MATCH_MODE: TableFilterMatchMode = 'custom';
const EQUALS_TABLE_FILTER_MATCH_MODE: TableFilterMatchMode = 'equals';

const durationFilterOptions: SelectOption<DurationFilterValue>[] = [
  { label: 'Under 5 minutes', value: 'under-5' },
  { label: '5-10 minutes', value: '5-10' },
  { label: '10-20 minutes', value: '10-20' },
  { label: '20-30 minutes', value: '20-30' },
  { label: '30-45 minutes', value: '30-45' },
  { label: '45-60 minutes', value: '45-60' },
  { label: 'Over 60 minutes', value: 'over-60' }
];
const fileSizeFilterOptions: SelectOption<FileSizeFilterValue>[] = [
  { label: '0-99 MB', value: 'very-small' },
  { label: '100-249 MB', value: 'small' },
  { label: '250-499 MB', value: 'medium' },
  { label: '500-749 MB', value: 'large' },
  { label: '750+ MB', value: 'very-large' }
];
const modifiedFilterOptions: SelectOption<ModifiedFilterValue>[] = [
  { label: 'Last 7 days', value: 'last-7' },
  { label: 'Last 30 days', value: 'last-30' },
  { label: 'Last 90 days', value: 'last-90' },
  { label: 'Last 180 days', value: 'last-180' },
  { label: 'Last 365 days', value: 'last-365' },
  { label: 'More than 365 days ago', value: 'more-than-365' }
];
const resolutionFilterOptions: SelectOption<ResolutionFilterValue>[] = [
  { label: 'High Res', value: 'high' },
  { label: 'Medium Res', value: 'medium' },
  { label: 'Low Res', value: 'low' }
];
const aspectFilterOptions: SelectOption<boolean>[] = [
  { label: 'Correct', value: false },
  { label: 'Incorrect', value: true }
];
const cropFilterOptions: SelectOption<CropFilterValue>[] = [
  { label: 'Auto', value: 'Auto' },
  { label: 'Review', value: 'Review' },
  { label: 'No', value: 'No' },
  { label: 'Uncertain', value: 'Uncertain' },
  { label: 'Error', value: 'Error' },
  { label: 'Not scanned', value: 'Not scanned' }
];
const availabilityFilterOptionOrder: SelectOption<AvailabilityFilterValue>[] = [
  { label: 'Available', value: 'available' },
  { label: 'Changed', value: 'changed' },
  { label: 'Missing', value: 'missing' },
  { label: 'Unavailable', value: 'unavailable' },
  { label: 'Unchecked', value: 'unchecked' }
];

registerTableFilterFunctions();

export function VideoResultsTable({
  rows,
  allRows,
  selectedVideos,
  globalFilter,
  resultsViewFilter,
  hasSources,
  selectedFolderCount,
  selectedFileCount,
  displayRootPath,
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
  fileAvailabilityMessage,
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
  const [pageFirst, setPageFirst] = useState(0);
  const [pageRows, setPageRows] = useState(DEFAULT_PAGE_SIZE);
  const [tableFilters, setTableFilters] = useState<TableFilterMeta>(() => createInitialTableFilters());
  const detailVideo = useMemo(() => {
    if (!detailPath) {
      return null;
    }

    return (allRows ?? rows).find((row) => row.path === detailPath) ?? null;
  }, [allRows, detailPath, rows]);
  const availabilityCounts = useMemo(() => getFileAvailabilityCounts(allRows ?? rows), [allRows, rows]);
  const activeTableFilters = useMemo(() => getActiveTableFilters(tableFilters), [tableFilters]);
  const facetedRows = useMemo<Record<TableFilterDimension, VideoRow[]>>(
    () => ({
      directory: getRowsMatchingTableFilters(rows, activeTableFilters, 'directory'),
      availability: getRowsMatchingTableFilters(rows, activeTableFilters, 'availability'),
      type: getRowsMatchingTableFilters(rows, activeTableFilters, 'type'),
      size: getRowsMatchingTableFilters(rows, activeTableFilters, 'size'),
      duration: getRowsMatchingTableFilters(rows, activeTableFilters, 'duration'),
      modified: getRowsMatchingTableFilters(rows, activeTableFilters, 'modified'),
      resolution: getRowsMatchingTableFilters(rows, activeTableFilters, 'resolution'),
      aspect: getRowsMatchingTableFilters(rows, activeTableFilters, 'aspect'),
      crop: getRowsMatchingTableFilters(rows, activeTableFilters, 'crop')
    }),
    [activeTableFilters, rows]
  );
  const baseDirectoryFilterOptions = useMemo(
    () => buildDirectoryFilterOptions(rows, displayRootPath),
    [displayRootPath, rows]
  );
  const directoryFilterOptions = useMemo(
    () => addDirectoryFilterOptionCounts(baseDirectoryFilterOptions, facetedRows.directory, displayRootPath),
    [baseDirectoryFilterOptions, displayRootPath, facetedRows.directory]
  );
  const baseAvailabilityFilterOptions = useMemo(() => buildAvailabilityFilterOptions(rows), [rows]);
  const availabilityFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(baseAvailabilityFilterOptions, facetedRows.availability, (row, value) =>
        availabilityFilterFunction(row.fileAvailability?.status ?? null, [value])
      ),
    [baseAvailabilityFilterOptions, facetedRows.availability]
  );
  const baseFileTypeFilterOptions = useMemo(() => buildFileTypeFilterOptions(rows), [rows]);
  const fileTypeFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(baseFileTypeFilterOptions, facetedRows.type, (row, value) =>
        getFileTypeLabel(row) === value
      ),
    [baseFileTypeFilterOptions, facetedRows.type]
  );
  const countedFileSizeFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(fileSizeFilterOptions, facetedRows.size, (row, value) =>
        isFileSizeInRange(row.sizeMB, value)
      ),
    [facetedRows.size]
  );
  const countedDurationFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(durationFilterOptions, facetedRows.duration, (row, value) =>
        isDurationInRange(row.durationSeconds, value)
      ),
    [facetedRows.duration]
  );
  const countedModifiedFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(modifiedFilterOptions, facetedRows.modified, (row, value) =>
        isModifiedDateInRange(row.modifiedAt, value)
      ),
    [facetedRows.modified]
  );
  const countedResolutionFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(resolutionFilterOptions, facetedRows.resolution, (row, value) =>
        getResolutionCategoryFromRow(row).value === value
      ),
    [facetedRows.resolution]
  );
  const countedAspectFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(aspectFilterOptions, facetedRows.aspect, (row, value) =>
        row.isWrongAspectRatio === value
      ),
    [facetedRows.aspect]
  );
  const countedCropFilterOptions = useMemo(
    () =>
      addFilterOptionCounts(cropFilterOptions, facetedRows.crop, (row, value) =>
        getBlackBorderCropStatus(row.adjustments) === value
      ),
    [facetedRows.crop]
  );

  useEffect(() => {
    if (detailPath) {
      onClearPreviewFrameError();
    }
  }, [detailPath, onClearPreviewFrameError]);

  useEffect(() => {
    setPageFirst(0);
  }, [globalFilter, resultsViewFilter, rows.length]);

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
          {availabilityCounts.missing > 0 ? <span>Missing: {availabilityCounts.missing.toLocaleString()}</span> : null}
          {availabilityCounts.changed > 0 ? <span>Changed: {availabilityCounts.changed.toLocaleString()}</span> : null}
          {availabilityCounts.unavailable > 0 ? (
            <span>Unavailable: {availabilityCounts.unavailable.toLocaleString()}</span>
          ) : null}
          <span>{storageSavedAt ? `Saved ${formatDateTime(storageSavedAt)}` : 'Unsaved'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="results-panel" aria-label="Loaded videos">
      {storageMessage ? <Message severity="info" text={storageMessage} /> : null}
      {fileAvailabilityMessage ? (
        <Message
          severity={hasFileAvailabilityIssues(allRows ?? rows) ? 'warn' : 'info'}
          text={fileAvailabilityMessage}
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
        paginator={!isStorageLoading && rows.length > 0}
        first={pageFirst}
        rows={pageRows}
        rowsPerPageOptions={[25, 50, 100, 250, 500, 1000]}
        onPage={(event) => {
          setPageFirst(event.first);
          setPageRows(event.rows);
        }}
        sortMode="multiple"
        removableSort
        filters={tableFilters}
        filterDelay={0}
        onFilter={(event) => {
          setPageFirst(0);
          setTableFilters(normalizeTableFilters(event.filters as TableFilterMeta));
        }}
        filterDisplay="row"
        stripedRows
        size="small"
        scrollable
        tableStyle={{ minWidth: '1400px' }}
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
        <Column
          field="displayFile"
          filterField="path"
          header="File Name"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={directoryFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<DirectoryFilterValue[] | null>,
              directoryFilterOptions,
              'Directory'
            )
          }
          showFilterMenu={false}
          body={(row: VideoRow) => fileTemplate(row, displayRootPath)}
          style={{ width: '27rem' }}
        />
        <Column
          field="fileAvailability.status"
          header="Availability"
          body={availabilityTemplate}
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={availabilityFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<AvailabilityFilterValue[] | null>,
              availabilityFilterOptions,
              'Availability'
            )
          }
          showFilterMenu={false}
          style={{ width: '8rem' }}
        />
        <Column
          field="fileType"
          header="Type"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={fileTypeFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<string[] | null>,
              fileTypeFilterOptions,
              'Type'
            )
          }
          showFilterMenu={false}
          body={typeTemplate}
          style={{ width: '6.5rem' }}
        />
        <Column
          field="sizeMB"
          header="Size"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={fileSizeFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<FileSizeFilterValue[] | null>,
              countedFileSizeFilterOptions,
              'Size'
            )
          }
          showFilterMenu={false}
          body={sizeTemplate}
          style={{ width: '7rem' }}
        />
        <Column
          field="durationSeconds"
          header="Duration"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={durationFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<DurationFilterValue[] | null>,
              countedDurationFilterOptions,
              'Duration'
            )
          }
          showFilterMenu={false}
          body={durationTemplate}
          style={{ width: '7.5rem' }}
        />
        <Column
          field="modifiedAt"
          header="Modified"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={modifiedFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<ModifiedFilterValue[] | null>,
              countedModifiedFilterOptions,
              'Modified'
            )
          }
          showFilterMenu={false}
          body={modifiedTemplate}
          style={{ width: '8.5rem' }}
        />
        <Column
          field="width"
          filterField="resolution"
          header="Resolution"
          sortable
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={resolutionFilterFunction}
          filterElement={(options) =>
            dropdownFilterTemplate(
              options as FilterTemplateOptions<ResolutionFilterValue | null>,
              countedResolutionFilterOptions,
              'Resolution'
            )
          }
          showFilterMenu={false}
          body={resolutionTemplate}
          style={{ width: '8rem' }}
        />
        <Column
          field="displayAspectRatio"
          filterField="isWrongAspectRatio"
          header="Aspect"
          sortable
          filter
          filterMatchMode={FilterMatchMode.EQUALS}
          filterElement={(options) =>
            dropdownFilterTemplate(
              options as FilterTemplateOptions<boolean | null>,
              countedAspectFilterOptions,
              'Aspect'
            )
          }
          showFilterMenu={false}
          body={aspectTemplate}
          style={{ width: '7rem' }}
        />
        <Column
          field="adjustments"
          header="Crop"
          filter
          filterMatchMode={FilterMatchMode.CUSTOM}
          filterFunction={cropFilterFunction}
          filterElement={(options) =>
            multiSelectFilterTemplate(
              options as FilterTemplateOptions<CropFilterValue[] | null>,
              countedCropFilterOptions,
              'Crop'
            )
          }
          showFilterMenu={false}
          body={cropTemplate}
          style={{ width: '7.5rem' }}
        />
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

function multiSelectFilterTemplate<TValue>(
  options: FilterTemplateOptions<TValue[] | null>,
  filterOptions: SelectOption<TValue>[],
  placeholder: string
): ReactElement {
  return (
    <MultiSelect
      value={options.value ?? []}
      options={filterOptions}
      placeholder={placeholder}
      className="table-column-filter"
      display="chip"
      maxSelectedLabels={1}
      onChange={(event) => {
        const nextValue = (event.value ?? []) as TValue[];
        options.filterApplyCallback(nextValue.length > 0 ? nextValue : null);
      }}
    />
  );
}

function dropdownFilterTemplate<TValue>(
  options: FilterTemplateOptions<TValue | null>,
  filterOptions: SelectOption<TValue>[],
  placeholder: string
): ReactElement {
  return (
    <Dropdown
      value={options.value ?? null}
      options={filterOptions}
      placeholder={placeholder}
      className="table-column-filter"
      showClear
      onChange={(event) => {
        options.filterApplyCallback((event.value ?? null) as TValue | null);
      }}
    />
  );
}

function directoryFilterFunction(value: string | null, filter: DirectoryFilterValue[] | null): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  const directory = getDirectoryFromPath(value ?? '');

  return filter.some((filterValue) => directoryMatchesFilterValue(directory, filterValue));
}

function availabilityFilterFunction(
  value: SavedFileAvailability | null | undefined,
  filter: AvailabilityFilterValue[] | null
): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.includes(getAvailabilityFilterValue(value));
}

function fileTypeFilterFunction(value: string | null, filter: string[] | null): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.includes(getFileTypeLabelFromValue(value));
}

function fileSizeFilterFunction(
  value: number | null | undefined,
  filter: FileSizeFilterValue[] | null
): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.some((range) => isFileSizeInRange(value, range));
}

function isFileSizeInRange(
  sizeMB: number | null | undefined,
  range: FileSizeFilterValue
): boolean {
  if (sizeMB === null || sizeMB === undefined) {
    return false;
  }

  const roundedSizeMB = Math.round(sizeMB);

  switch (range) {
    case 'very-small':
      return roundedSizeMB < 100;
    case 'small':
      return roundedSizeMB >= 100 && roundedSizeMB < 250;
    case 'medium':
      return roundedSizeMB >= 250 && roundedSizeMB < 500;
    case 'large':
      return roundedSizeMB >= 500 && roundedSizeMB < 750;
    case 'very-large':
      return roundedSizeMB >= 750;
  }
}

function durationFilterFunction(
  value: number | null | undefined,
  filter: DurationFilterValue[] | null
): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.some((range) => isDurationInRange(value, range));
}

function isDurationInRange(
  durationSeconds: number | null | undefined,
  range: DurationFilterValue
): boolean {
  if (durationSeconds === null || durationSeconds === undefined) {
    return false;
  }

  const durationMinutes = durationSeconds / 60;

  switch (range) {
    case 'under-5':
      return durationMinutes < 5;
    case '5-10':
      return durationMinutes >= 5 && durationMinutes < 10;
    case '10-20':
      return durationMinutes >= 10 && durationMinutes < 20;
    case '20-30':
      return durationMinutes >= 20 && durationMinutes < 30;
    case '30-45':
      return durationMinutes >= 30 && durationMinutes < 45;
    case '45-60':
      return durationMinutes >= 45 && durationMinutes < 60;
    case 'over-60':
      return durationMinutes >= 60;
  }
}

function modifiedFilterFunction(value: string | null, filter: ModifiedFilterValue[] | null): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.some((range) => isModifiedDateInRange(value, range));
}

function resolutionFilterFunction(value: string | null | undefined, filter: ResolutionFilterValue | null): boolean {
  if (!filter) {
    return true;
  }

  return getResolutionCategoryFromResolution(value).value === filter;
}

function isModifiedDateInRange(value: string | null, range: ModifiedFilterValue): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const ageDays = (Date.now() - timestamp) / (24 * 60 * 60 * 1000);

  switch (range) {
    case 'last-7':
      return ageDays >= 0 && ageDays <= 7;
    case 'last-30':
      return ageDays >= 0 && ageDays <= 30;
    case 'last-90':
      return ageDays >= 0 && ageDays <= 90;
    case 'last-180':
      return ageDays >= 0 && ageDays <= 180;
    case 'last-365':
      return ageDays >= 0 && ageDays <= 365;
    case 'more-than-365':
      return ageDays > 365;
  }
}

function cropFilterFunction(
  value: VideoAdjustments | null | undefined,
  filter: CropFilterValue[] | null
): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  return filter.includes(getBlackBorderCropStatus(value ?? undefined) as CropFilterValue);
}

function registerTableFilterFunctions(): void {
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.directory}`, directoryFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.availability}`, availabilityFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.type}`, fileTypeFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.size}`, fileSizeFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.duration}`, durationFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.modified}`, modifiedFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.resolution}`, resolutionFilterFunction);
  FilterService.register(`custom_${TABLE_FILTER_FIELDS.crop}`, cropFilterFunction);
}

function createInitialTableFilters(): TableFilterMeta {
  return {
    [TABLE_FILTER_FIELDS.directory]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.availability]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.type]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.size]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.duration]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.modified]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.resolution]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.aspect]: { value: null, matchMode: EQUALS_TABLE_FILTER_MATCH_MODE },
    [TABLE_FILTER_FIELDS.crop]: { value: null, matchMode: CUSTOM_TABLE_FILTER_MATCH_MODE }
  };
}

function normalizeTableFilters(filters: TableFilterMeta): TableFilterMeta {
  return {
    ...createInitialTableFilters(),
    ...filters
  };
}

function getActiveTableFilters(filters: TableFilterMeta): ActiveTableFilters {
  return {
    directory: getArrayFilterValue<DirectoryFilterValue>(filters, TABLE_FILTER_FIELDS.directory),
    availability: getArrayFilterValue<AvailabilityFilterValue>(filters, TABLE_FILTER_FIELDS.availability),
    type: getArrayFilterValue<string>(filters, TABLE_FILTER_FIELDS.type),
    size: getArrayFilterValue<FileSizeFilterValue>(filters, TABLE_FILTER_FIELDS.size),
    duration: getArrayFilterValue<DurationFilterValue>(filters, TABLE_FILTER_FIELDS.duration),
    modified: getArrayFilterValue<ModifiedFilterValue>(filters, TABLE_FILTER_FIELDS.modified),
    resolution: getStringFilterValue<ResolutionFilterValue>(filters, TABLE_FILTER_FIELDS.resolution),
    aspect: getBooleanFilterValue(filters, TABLE_FILTER_FIELDS.aspect),
    crop: getArrayFilterValue<CropFilterValue>(filters, TABLE_FILTER_FIELDS.crop)
  };
}

function getArrayFilterValue<TValue>(filters: TableFilterMeta, field: string): TValue[] {
  const value = filters[field]?.value;
  return Array.isArray(value) ? (value as TValue[]) : [];
}

function getStringFilterValue<TValue extends string>(filters: TableFilterMeta, field: string): TValue | null {
  const value = filters[field]?.value;
  return typeof value === 'string' ? (value as TValue) : null;
}

function getBooleanFilterValue(filters: TableFilterMeta, field: string): boolean | null {
  const value = filters[field]?.value;
  return typeof value === 'boolean' ? value : null;
}

function getRowsMatchingTableFilters(
  rows: VideoRow[],
  filters: ActiveTableFilters,
  omittedDimension?: TableFilterDimension
): VideoRow[] {
  return rows.filter((row) => rowMatchesActiveTableFilters(row, filters, omittedDimension));
}

function rowMatchesActiveTableFilters(
  row: VideoRow,
  filters: ActiveTableFilters,
  omittedDimension?: TableFilterDimension
): boolean {
  if (omittedDimension !== 'directory' && !directoryFilterFunction(row.path, filters.directory)) {
    return false;
  }

  if (
    omittedDimension !== 'availability' &&
    !availabilityFilterFunction(row.fileAvailability?.status ?? null, filters.availability)
  ) {
    return false;
  }

  if (omittedDimension !== 'type' && !fileTypeFilterFunction(row.fileType, filters.type)) {
    return false;
  }

  if (omittedDimension !== 'size' && !fileSizeFilterFunction(row.sizeMB, filters.size)) {
    return false;
  }

  if (omittedDimension !== 'duration' && !durationFilterFunction(row.durationSeconds, filters.duration)) {
    return false;
  }

  if (omittedDimension !== 'modified' && !modifiedFilterFunction(row.modifiedAt, filters.modified)) {
    return false;
  }

  if (omittedDimension !== 'resolution' && !resolutionFilterFunction(row.resolution, filters.resolution)) {
    return false;
  }

  if (omittedDimension !== 'aspect' && filters.aspect !== null && row.isWrongAspectRatio !== filters.aspect) {
    return false;
  }

  if (omittedDimension !== 'crop' && !cropFilterFunction(row.adjustments, filters.crop)) {
    return false;
  }

  return true;
}

function addFilterOptionCounts<TValue>(
  options: SelectOption<TValue>[],
  rows: VideoRow[],
  matchesOption: (row: VideoRow, value: TValue) => boolean
): SelectOption<TValue>[] {
  return options.map((option) => ({
    ...option,
    label: `${option.label} (${rows.filter((row) => matchesOption(row, option.value)).length.toLocaleString()})`
  }));
}

function buildDirectoryFilterOptions(
  rows: VideoRow[],
  displayRootPath: string | null
): SelectOption<DirectoryFilterValue>[] {
  const normalizedRoot = normalizePathForDisplay(displayRootPath ?? '');
  const directoryOptions = new Map<string, string>();

  rows.forEach((row) => {
    const directory = normalizePathForDisplay(row.directory || getDirectoryFromPath(row.path));

    getDirectoryFilterPaths(directory, normalizedRoot).forEach((directoryPath) => {
      if (!directoryPath || directoryPath === normalizedRoot) {
        return;
      }

      directoryOptions.set(directoryPath, getDirectoryFilterLabel(directoryPath, normalizedRoot));
    });
  });

  const options = Array.from(directoryOptions.entries())
    .map(([directoryPath, label]) => ({
      label,
      value: encodeDirectoryFilterValue('directory', directoryPath)
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  return normalizedRoot
    ? [{ label: 'Root', value: encodeDirectoryFilterValue('root', normalizedRoot) }, ...options]
    : options;
}

function addDirectoryFilterOptionCounts(
  options: SelectOption<DirectoryFilterValue>[],
  rows: VideoRow[],
  displayRootPath: string | null
): SelectOption<DirectoryFilterValue>[] {
  const countByValue = new Map<DirectoryFilterValue, number>();
  const optionValues = new Set(options.map((option) => option.value));
  const normalizedRoot = normalizePathForDisplay(displayRootPath ?? '');
  const rootFilterValue = normalizedRoot ? encodeDirectoryFilterValue('root', normalizedRoot) : null;

  rows.forEach((row) => {
    const directory = normalizePathForDisplay(row.directory || getDirectoryFromPath(row.path));

    if (rootFilterValue && directory === normalizedRoot) {
      incrementOptionCount(countByValue, rootFilterValue);
    }

    getDirectoryFilterPaths(directory, normalizedRoot).forEach((directoryPath) => {
      const filterValue = encodeDirectoryFilterValue('directory', directoryPath);

      if (optionValues.has(filterValue)) {
        incrementOptionCount(countByValue, filterValue);
      }
    });
  });

  return options.map((option) => ({
    ...option,
    label: `${option.label} (${(countByValue.get(option.value) ?? 0).toLocaleString()})`
  }));
}

function incrementOptionCount(counts: Map<DirectoryFilterValue, number>, value: DirectoryFilterValue): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function getDirectoryFilterPaths(directory: string, normalizedRoot: string): string[] {
  if (!directory) {
    return [];
  }

  if (!normalizedRoot || !isSameOrChildPath(directory, normalizedRoot)) {
    return [directory];
  }

  if (directory === normalizedRoot) {
    return [normalizedRoot];
  }

  const relativeDirectory = directory.slice(normalizedRoot.length + 1);
  const pathParts = relativeDirectory.split('/').filter(Boolean);

  return pathParts.map((_, index) => `${normalizedRoot}/${pathParts.slice(0, index + 1).join('/')}`);
}

function getDirectoryFilterLabel(directory: string, normalizedRoot: string): string {
  if (!normalizedRoot || !isSameOrChildPath(directory, normalizedRoot) || directory === normalizedRoot) {
    return directory;
  }

  return directory.slice(normalizedRoot.length + 1);
}

function encodeDirectoryFilterValue(kind: 'root' | 'directory', directory: string): DirectoryFilterValue {
  const prefix = kind === 'root' ? DIRECTORY_FILTER_ROOT_PREFIX : DIRECTORY_FILTER_DIRECTORY_PREFIX;
  return `${prefix}${directory}`;
}

function parseDirectoryFilterValue(value: DirectoryFilterValue): { kind: 'root' | 'directory'; directory: string } | null {
  if (value.startsWith(DIRECTORY_FILTER_ROOT_PREFIX)) {
    return {
      kind: 'root',
      directory: value.slice(DIRECTORY_FILTER_ROOT_PREFIX.length)
    };
  }

  if (value.startsWith(DIRECTORY_FILTER_DIRECTORY_PREFIX)) {
    return {
      kind: 'directory',
      directory: value.slice(DIRECTORY_FILTER_DIRECTORY_PREFIX.length)
    };
  }

  return null;
}

function directoryMatchesFilterValue(directory: string, filterValue: DirectoryFilterValue): boolean {
  const parsedFilter = parseDirectoryFilterValue(filterValue);

  if (!parsedFilter) {
    return false;
  }

  if (parsedFilter.kind === 'root') {
    return directory === parsedFilter.directory;
  }

  return isSameOrChildPath(directory, parsedFilter.directory);
}

function isSameOrChildPath(path: string, parentPath: string): boolean {
  return path === parentPath || path.startsWith(`${parentPath}/`);
}

function buildAvailabilityFilterOptions(rows: VideoRow[]): SelectOption<AvailabilityFilterValue>[] {
  const availableValues = new Set(rows.map((row) => getAvailabilityFilterValue(row.fileAvailability?.status ?? null)));

  return availabilityFilterOptionOrder.filter((option) => availableValues.has(option.value));
}

function getAvailabilityFilterValue(value: SavedFileAvailability | null | undefined): AvailabilityFilterValue {
  return value ?? 'unchecked';
}

function fileTemplate(row: VideoRow, displayRootPath: string | null): ReactElement {
  const displayFileName = getDisplayFileName(row);
  const displayDirectory = getDisplayDirectory(row, displayRootPath);
  const directoryTitle = row.displayDirectory || row.directory;

  return (
    <div className="file-cell">
      <span title={row.path}>{displayFileName}</span>
      <small title={directoryTitle}>{displayDirectory}</small>
    </div>
  );
}

function getDisplayFileName(row: VideoRow): string {
  const fileName = getFileNameFromPath(row.fileName || row.displayFile || row.path) || 'Untitled video';
  return removeFinalExtension(fileName);
}

function getDisplayDirectory(row: VideoRow, displayRootPath: string | null): string {
  const directory = normalizePathForDisplay(row.directory || getDirectoryFromPath(row.path));
  const fallbackDirectory = row.displayDirectory || row.directory;
  const normalizedRoot = normalizePathForDisplay(displayRootPath ?? '');

  if (!directory || !normalizedRoot) {
    return fallbackDirectory;
  }

  if (directory === normalizedRoot) {
    return getPathBaseName(normalizedRoot) || fallbackDirectory;
  }

  if (!directory.startsWith(`${normalizedRoot}/`)) {
    return fallbackDirectory;
  }

  const rootName = getPathBaseName(normalizedRoot);
  const relativeDirectory = directory.slice(normalizedRoot.length + 1);

  return [rootName, relativeDirectory].filter(Boolean).join('/');
}

function normalizePathForDisplay(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
}

function getDirectoryFromPath(value: string): string {
  const normalizedPath = normalizePathForDisplay(value);
  const pathParts = normalizedPath.split('/').filter(Boolean);

  if (pathParts.length <= 1) {
    return '';
  }

  const directoryParts = pathParts.slice(0, -1);
  return normalizedPath.startsWith('/') ? `/${directoryParts.join('/')}` : directoryParts.join('/');
}

function getFileNameFromPath(value: string): string {
  return value.split(/[\\/]+/).filter(Boolean).at(-1) ?? value;
}

function getPathBaseName(value: string): string {
  return value.split('/').filter(Boolean).at(-1) ?? '';
}

function removeFinalExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionIndex);
}

function buildFileTypeFilterOptions(rows: VideoRow[]): SelectOption<string>[] {
  return Array.from(new Set(rows.map(getFileTypeLabel).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second))
    .map((fileType) => ({
      label: fileType,
      value: fileType
    }));
}

function getFileTypeLabel(row: VideoRow): string {
  return getFileTypeLabelFromValue(row.fileType || row.fileExtension);
}

function getFileTypeLabelFromValue(value: string | null | undefined): string {
  return (value ?? '').replace(/^\./, '').toUpperCase();
}

function typeTemplate(row: VideoRow): ReactElement {
  return <span className="metadata-pill">{getFileTypeLabel(row) || 'Video'}</span>;
}

function availabilityTemplate(row: VideoRow): ReactElement {
  const availability = getFileAvailabilityDisplay(row);

  return (
    <Tag
      value={availability.label}
      severity={availability.severity}
      className="result-tag"
      title={availability.detail}
    />
  );
}

function getFileAvailabilityDisplay(row: VideoRow): {
  label: string;
  severity: TagSeverity;
  detail: string;
} {
  const availability = row.fileAvailability;

  if (!availability) {
    return {
      label: 'Unchecked',
      severity: 'secondary',
      detail: 'File availability has not been checked for this row.'
    };
  }

  return {
    label: getFileAvailabilityLabel(availability.status),
    severity: getFileAvailabilitySeverity(availability.status),
    detail: availability.message ?? 'File availability was checked after project restore.'
  };
}

function getFileAvailabilityLabel(status: SavedFileAvailability): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'missing':
      return 'Missing';
    case 'changed':
      return 'Changed';
    case 'unavailable':
      return 'Unavailable';
  }
}

function getFileAvailabilitySeverity(status: SavedFileAvailability): TagSeverity {
  switch (status) {
    case 'available':
      return 'success';
    case 'missing':
      return 'danger';
    case 'changed':
      return 'warning';
    case 'unavailable':
      return 'danger';
  }
}

function sizeTemplate(row: VideoRow): string {
  const sizeBytes = getBestSizeBytes(row);

  if (sizeBytes !== null) {
    return formatTableFileSize(sizeBytes);
  }

  if (row.sizeGB !== null && row.sizeGB >= 1) {
    return `${row.sizeGB.toFixed(2)} GB`;
  }

  if (row.sizeMB !== null) {
    return `${Math.round(row.sizeMB).toLocaleString()} MB`;
  }

  return '';
}

function getBestSizeBytes(row: VideoRow): number | null {
  const sizeBytes = row.fileSystemSizeBytes ?? row.sizeBytes ?? row.ffprobeFormatSizeBytes;

  return typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) ? sizeBytes : null;
}

function formatTableFileSize(bytes: number): string {
  const sizeGB = bytes / 1024 ** 3;

  if (sizeGB >= 1) {
    return `${sizeGB.toFixed(2)} GB`;
  }

  return `${Math.round(bytes / 1024 ** 2).toLocaleString()} MB`;
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
  const resolutionCategory = getResolutionCategoryFromRow(row);

  return (
    <Tag
      value={resolutionCategory.label}
      severity={resolutionCategory.severity}
      className="result-tag"
      title={row.resolution || 'Unknown resolution'}
    />
  );
}

function getResolutionCategoryFromRow(row: VideoRow): {
  value: ResolutionFilterValue;
  label: string;
  severity: TagSeverity;
} {
  return getResolutionCategory(row.width, row.height);
}

function getResolutionCategoryFromResolution(value: string | null | undefined): {
  value: ResolutionFilterValue;
  label: string;
  severity: TagSeverity;
} {
  const dimensions = parseResolution(value);
  return getResolutionCategory(dimensions?.width ?? null, dimensions?.height ?? null);
}

function getResolutionCategory(
  width: number | null | undefined,
  height: number | null | undefined
): {
  value: ResolutionFilterValue;
  label: string;
  severity: TagSeverity;
} {
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return {
      value: 'low',
      label: 'Low Res',
      severity: 'danger'
    };
  }

  if (width > 1280 && height > 720) {
    return {
      value: 'high',
      label: 'High Res',
      severity: 'success'
    };
  }

  if (width >= 1280 && height >= 720) {
    return {
      value: 'medium',
      label: 'Medium Res',
      severity: 'warning'
    };
  }

  return {
    value: 'low',
    label: 'Low Res',
    severity: 'danger'
  };
}

function parseResolution(value: string | null | undefined): { width: number; height: number } | null {
  const match = String(value ?? '').match(/(\d+)\s*x\s*(\d+)/i);

  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return { width, height };
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

function actionsTemplate(
  row: VideoRow,
  onOpenDetails: (path: string) => void,
  onRevealKnownFile: (item: KnownPathValidationItem) => void
): ReactElement {
  const isRevealDisabled =
    row.fileAvailability?.status === 'missing' || row.fileAvailability?.status === 'unavailable';
  const revealTooltip = isRevealDisabled
    ? row.fileAvailability?.message ?? 'File is not available.'
    : 'Reveal in Finder';

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
        disabled={isRevealDisabled}
        tooltip={revealTooltip}
        tooltipOptions={ROW_ACTION_TOOLTIP_OPTIONS}
        onClick={() => onRevealKnownFile(toKnownVideoFile(row))}
      />
    </div>
  );
}

function hasFileAvailabilityIssues(rows: VideoRow[]): boolean {
  return rows.some((row) => {
    const status = row.fileAvailability?.status;
    return status === 'missing' || status === 'changed' || status === 'unavailable';
  });
}

function getFileAvailabilityCounts(rows: VideoRow[]): {
  missing: number;
  changed: number;
  unavailable: number;
} {
  return rows.reduce(
    (counts, row) => {
      if (row.fileAvailability?.status === 'missing') {
        counts.missing += 1;
      }

      if (row.fileAvailability?.status === 'changed') {
        counts.changed += 1;
      }

      if (row.fileAvailability?.status === 'unavailable') {
        counts.unavailable += 1;
      }

      return counts;
    },
    {
      missing: 0,
      changed: 0,
      unavailable: 0
    }
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
    title: 'No videos match the current table filters.',
    body: 'Clear one or more column filters to broaden the table.',
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
