import type { AuditRequest, AuditSummary } from '../../shared/types/audit';
import type { VideoRow } from '../../shared/types/video';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

export interface SelectedRowsSummary {
  count: number;
  paths: string[];
  totalSizeMB: number;
}

export function getAuditedRootDirectory(
  request: AuditRequest | null,
  summary: AuditSummary | null
): string | null {
  if (request?.folderPaths.length === 1) {
    return request.folderPaths[0];
  }

  if (request?.folderPaths && request.folderPaths.length !== 1) {
    return null;
  }

  const summaryPath = summary?.resolvedDirectory ?? summary?.directoryPath ?? null;

  if (!summaryPath || summaryPath === 'Selected files') {
    return null;
  }

  return summaryPath;
}

export function getVideoRowId(row: VideoRow): string {
  return row.id ?? row.path;
}

export function getActiveRows(rows: VideoRow[]): VideoRow[] {
  return rows.filter((row) => row.visible !== false);
}

export function getRemovedRows(rows: VideoRow[]): VideoRow[] {
  return rows.filter((row) => row.visible === false);
}

export function getRemovedRowCount(rows: VideoRow[]): number {
  return getRemovedRows(rows).length;
}

export function getSearchedRows(rows: VideoRow[], searchQuery: string): VideoRow[] {
  const normalizedQuery = normalizeSearchValue(searchQuery);

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => matchesResultSearch(row, normalizedQuery));
}

export function getResultsViewCounts(rows: VideoRow[]): ResultsViewCounts {
  return {
    all: rows.length,
    flagged: rows.filter(isFlaggedRow).length,
    'low-res': rows.filter((row) => row.isLowResolution).length,
    aspect: rows.filter((row) => row.isWrongAspectRatio).length,
    crop: rows.filter(hasCropIssue).length,
    errors: rows.filter(hasRowError).length
  };
}

export function getVisibleRowsForResultView(
  rows: VideoRow[],
  filter: ResultsViewFilter
): VideoRow[] {
  return rows.filter((row) => matchesResultsViewFilter(row, filter));
}

export function getSelectedRows(rows: VideoRow[], selectedRowIds: string[]): VideoRow[] {
  if (selectedRowIds.length === 0) {
    return [];
  }

  const selectedIdSet = new Set(selectedRowIds);

  return rows.filter((row) => selectedIdSet.has(getVideoRowId(row)));
}

export function getSelectedPaths(rows: VideoRow[], selectedRowIds: string[]): string[] {
  return getSelectedRows(rows, selectedRowIds).map((row) => row.path);
}

export function getSelectedSummary(rows: VideoRow[], selectedRowIds: string[]): SelectedRowsSummary {
  const selectedRows = getSelectedRows(rows, selectedRowIds);

  return {
    count: selectedRows.length,
    paths: selectedRows.map((row) => row.path),
    totalSizeMB: selectedRows.reduce((total, row) => total + (row.sizeMB ?? 0), 0)
  };
}

export function matchesResultsViewFilter(row: VideoRow, filter: ResultsViewFilter): boolean {
  switch (filter) {
    case 'flagged':
      return isFlaggedRow(row);
    case 'low-res':
      return row.isLowResolution;
    case 'aspect':
      return row.isWrongAspectRatio;
    case 'crop':
      return hasCropIssue(row);
    case 'errors':
      return hasRowError(row);
    case 'all':
      return true;
  }
}

export function isFlaggedRow(row: VideoRow): boolean {
  return row.isLowResolution || row.isWrongAspectRatio || hasCropIssue(row) || hasRowError(row) || Boolean(row.reasons);
}

export function hasCropIssue(row: VideoRow): boolean {
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

export function hasRowError(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  return (
    Boolean(blackBorder?.error) ||
    blackBorder?.classification === 'analysis_error' ||
    row.reasons.toLowerCase().includes('error')
  );
}

function matchesResultSearch(row: VideoRow, normalizedQuery: string): boolean {
  return getSearchableResultValues(row).some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery)
  );
}

function getSearchableResultValues(row: VideoRow): Array<string | null | undefined> {
  const blackBorder = row.adjustments?.blackBorder;

  return [
    row.displayFile,
    row.fileName,
    row.displayDirectory,
    row.directory,
    row.fileType,
    row.resolution,
    row.displayAspectRatio,
    blackBorder?.classification,
    blackBorder?.confidence,
    blackBorder?.recommendedFix?.reason,
    row.reasons,
    row.status
  ];
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
