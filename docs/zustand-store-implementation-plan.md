# Zustand Store Implementation Plan

## Current Context

This plan was refreshed against the current `collie-video` codebase on 2026-05-19.

The app is a standalone macOS Electron app. Runtime filesystem access, ffmpeg/ffprobe work, job orchestration, settings, native dialogs, operation history, and OS integrations stay behind the Electron main/preload boundary. The renderer uses React, PrimeReact, typed renderer API clients, and focused workflow hooks.

Zustand is already installed in `package.json` (`zustand` `^5.0.13`). The renderer does not currently have Zustand stores. State is currently managed with React hooks and controller composition:

- `src/renderer/hooks/useVideoAuditAppController.ts`
  Composes focused renderer hooks and exposes the compatibility controller consumed by `src/renderer/App.tsx`.
- `src/renderer/hooks/useAuditResults.ts`
  Owns audit result rows, summaries, errors, row visibility, `showThumbnails`, storage messages, IndexedDB persistence, row hiding/restoring, and media-preview row merges.
- `src/renderer/hooks/useResultFilters.ts`
  Owns top-level result search/filter state, result counts, and filtered rows.
- `src/renderer/hooks/useSelectionState.ts`
  Owns selected row objects as `selectedVideos`.
- `src/renderer/hooks/useSourceSelection.ts` and `useAuditSourceController.ts`
  Own selected folders, selected files, output folder, folder-tree source metadata, source messages, and audit options coordination.
- Workflow hooks such as `useAuditWorkflow`, `useMediaPreviewWorkflow`, `useAutoFixWorkflow`, `useAutoCropWorkflow`, `useFileOperationsWorkflow`, `usePostConversionWorkflow`, `useMigrationWorkflow`, and `usePremiereBridge`
  Own workflow execution state, progress state, dialog state, result/error state, and IPC-facing orchestration.
- `src/renderer/storage/auditResultStorage.ts`
  Persists the latest audit result in renderer IndexedDB database `collie-video` and archives audit-history metadata when cache/data is cleared.

The current app already includes Auto-Fix, Auto-Crop, thumbnail generation, fresh preview frames, preview clips, Premiere handoff, migration, move-to-trash, move-to-folder, archive originals, post-conversion replacement, and operation history.

## Goal

Implement Zustand strategically and intentionally where it improves the renderer architecture.

This is not a results-only plan. It is also not a plan to move the entire app into global state. The right target is a small set of focused stores for state that is shared, highly derived, mutation-prone, or currently awkward to coordinate through prop chains and controller callbacks.

The first recommended store is still a results workspace store because that is the clearest current pain point. Future stores should be added only where the same criteria apply.

## Store Decision Criteria

Use Zustand when state has most of these traits:

- it is read or updated by several distant components/hooks
- it has important derived selectors
- stale object references are a known risk
- updates can come from several workflows
- prop drilling or controller pass-through is obscuring ownership
- actions need one canonical mutation path
- UI needs consistent behavior after restore, refresh, clear, row merge, or row hiding

Avoid Zustand when state is:

- local to one dialog or component
- temporary progress state for one running job
- a simple open/closed boolean with one owner
- already cleanly owned by a focused workflow hook
- durable app settings owned by the main process
- filesystem, ffmpeg, ffprobe, Premiere, or file-operation execution state
- raw IPC subscription details

## Store Candidates

### Recommended First Store: Results Workspace

This should be implemented first.

Current state is split across `useAuditResults`, `useResultFilters`, `useSelectionState`, `VideoResultsTable`, and `ResultsToolbar`. This has real correctness risk:

- top-level counts are computed from `visibleVideoRows`, then PrimeReact global search is applied later inside `VideoResultsTable`
- selection is stored as row objects, which can become stale when rows are replaced or media metadata is merged
- row visibility, row merging, persistence, and workflow-driven row hiding all need one consistent path

This store should own the result/table workspace state and derived pipeline.

### Possible Later Store: Source Workspace

Consider this only after the results workspace migration is stable.

Potential scope:

- selected folders
- selected files
- output folder
- folder-tree root path and last scanned timestamp
- selected folder summary
- source selection messages
- maybe audit option UI state if it continues to be tightly coupled to source selection

Do not move source state just because Zustand exists. `useSourceSelection` and `useAuditSourceController` are already focused. A source store is only worthwhile if source state starts needing direct access from multiple non-parent surfaces or if source restore/reset behavior becomes hard to reason about.

### Possible Later Store: App UI Workspace

Consider only if shell UI state becomes more tangled.

Potential scope:

- source setup dialog visibility
- folder-tree selector visibility
- settings/utilities/diagnostics dialog visibility
- app-menu open requests, if the request-count pattern becomes hard to maintain

This state currently lives reasonably in `App.tsx` plus `useAppCommands`. Keep it local unless there is clear pressure.

### Usually Not A Store: Workflow Execution

Keep these in workflow hooks:

- audit progress
- discovery progress
- ffprobe progress
- thumbnail/preview progress
- Auto-Fix/Auto-Crop progress and dialogs
- migration progress and dialogs
- file-operation planning/execution dialogs
- replacement planning/execution dialogs
- Premiere status/import submission
- operation-history loading and selected record

Zustand may receive final row updates from these workflows, but it should not become the workflow engine.

### Not A Store: Main-Process Durable Domains

Do not move these into Zustand:

- app settings persistence
- file operations and operation history persistence
- ffmpeg/ffprobe execution
- filesystem validation
- native dialogs
- Premiere bridge internals
- raw IPC implementation

Renderer stores may reflect typed state returned from these domains, but main/preload remains the boundary.

## Important Corrections From The Original Plan

- Do not install Zustand as a new dependency unless it has been removed. It is already present.
- Do not frame the work as results-only. Results are the first store, not the entire strategy.
- Do not plan around a monolithic controller as the only source of state. The app now has focused renderer hooks.
- Do not describe file management as future-only. File-management workflows already exist and must be preserved.
- Do not assume audit-history snapshot restore exists. The current `audit-history` IndexedDB store archives metadata only; it does not restore full result snapshots.
- Do not confuse operation history with audit-result history. Operation history is a main-process file-operation history workflow.
- Do not move persistence to main-process JSON as part of this Zustand migration. The current implemented audit-result persistence boundary is renderer IndexedDB in `auditResultStorage.ts`.
- Do not assume `showThumbnails` currently controls table rendering. It is persisted and exposed by `useAuditResults`, but the current table always renders the Preview column. Verify the intended product behavior before making it a store-driven UI toggle.
- Do not assume top-level result counts are search-aware today. Current `resultsViewCounts` are computed from `visibleVideoRows` before the PrimeReact `DataTable` global search is applied.
- Do not absorb all PrimeReact row/column filter state in the first store pass. The table currently has column filters for file name, type, size, duration, modified date, resolution, aspect, and crop.

## Architectural Decision

Use Zustand for focused renderer workspace state, not as the whole app architecture.

Zustand may own:

- shared renderer state with multiple readers/writers
- selected IDs and stable UI selection state
- top-level search/filter state
- row visibility/removal state
- derived selectors and count pipelines
- workspace metadata needed for restore/refresh/display
- centralized row metadata updates
- future source or app-shell UI state if it meets the decision criteria

Zustand should not own:

- Electron main-process filesystem logic
- audit execution internals
- ffmpeg/ffprobe child process execution
- Premiere bridge internals
- file-operation execution or operation-history persistence
- raw IPC implementation details
- every dialog in the app
- app settings as a whole
- transient progress snapshots for long-running jobs
- durable persistence implementation details

Workflow hooks should continue owning execution. Stores should expose explicit actions for state changes that need to be shared or derived.

## Non-Goals

- Do not move the whole renderer into Zustand.
- Do not migrate every hook at once.
- Do not add Redux, MobX, XState, or another state framework.
- Do not use Zustand `persist` with localStorage as the primary persistence mechanism.
- Do not replace `auditResultStorage.ts` with main-process JSON in this plan.
- Do not store dynamic counts as mutable state.
- Do not rewrite audit, discovery, ffprobe, Auto-Fix, Auto-Crop, thumbnails, preview clips, Premiere, migration, file operations, replacement, or operation-history execution.
- Do not redesign the UI.
- Do not write tests unless explicitly requested.

## Store Organization

Create a store folder:

```txt
src/renderer/stores/
```

Recommended initial files:

```txt
src/renderer/stores/useVideoResultsStore.ts
src/renderer/stores/videoResultsSelectors.ts
```

If later stores are added, keep them focused and named by workspace/domain:

```txt
src/renderer/stores/useSourceWorkspaceStore.ts
src/renderer/stores/useAppUiStore.ts
```

Do not create one broad `useAppStore` unless there is a very strong reason. A giant app store would recreate the previous "large controller" problem in a different form.

## First Store Scope: Results Workspace

The first store should own the result workspace state currently split across `useAuditResults`, `useResultFilters`, and `useSelectionState`:

- `auditResult`
- `rows`
- `summary`
- `errors`
- `lastAuditRequest`
- `selectedRowIds`
- `searchQuery`
- `activeViewFilter`
- `showThumbnails`, if still meaningful
- `storageSavedAt`
- current workspace metadata, if useful

Prefer the current row visibility model at first:

```txt
row.visible === false means removed/hidden from the table
```

Do not introduce separate `removedRowIds` and `hiddenRowIds` unless a specific UI distinction requires it. The current persistence already stores row visibility on the row object, and `restoreRemovedVideos` restores rows by marking them visible.

Do not migrate PrimeReact column filter state in the first pass. It can remain table-local unless the product requirement is to make toolbar counts include column filters too.

Suggested state shape:

```ts
type VideoResultsWorkspaceMeta = {
  source: 'empty' | 'audit' | 'stored-audit';
  savedAt: string | null;
};

type VideoResultsStoreState = {
  auditResult: AuditResult | null;
  rows: VideoRow[];
  summary: AuditSummary | null;
  errors: AuditError[];
  lastAuditRequest: AuditRequest | null;

  selectedRowIds: string[];
  searchQuery: string;
  activeViewFilter: ResultsViewFilter;

  showThumbnails: boolean;
  storageSavedAt: string | null;
  workspaceMeta: VideoResultsWorkspaceMeta;

  applyAuditResult: (input: {
    result: AuditResult;
    request: AuditRequest | null;
    source: VideoResultsWorkspaceMeta['source'];
    savedAt?: string | null;
    showThumbnails?: boolean;
  }) => void;
  clearResults: () => void;

  setSearchQuery: (query: string) => void;
  setActiveViewFilter: (filter: ResultsViewFilter) => void;
  setShowThumbnails: (value: boolean) => void;

  setSelectedRowIds: (ids: string[]) => void;
  clearSelection: () => void;

  hideRowsByPath: (paths: string[]) => number;
  restoreRemovedRows: () => void;
  mergeMediaPreviewItems: (items: MediaPreviewResultItem[]) => void;
  mergePreviewClipItems: (items: PreviewClipResultItem[]) => void;
};
```

Adapt names to project conventions while keeping the scope narrow.

## Row Identity

Use one helper everywhere selection or row lookup needs identity:

```ts
function getVideoRowId(row: VideoRow): string {
  return row.id ?? row.path;
}
```

The current `DataTable` uses `dataKey="path"`, and most workflows identify rows by path. That is acceptable for the first migration. If audit rows later receive a guaranteed stable `id`, the helper lets the app move without rewriting every selection call site.

Avoid storing selected rows as objects in global store state. Convert IDs to row objects only at adapter boundaries:

- PrimeReact `DataTable.selection`
- workflow hooks that still expect `selectedVideos`
- action bars that display selected row summaries

## Results Pipeline Semantics

Current top-level result filters are defined in `src/renderer/types/resultsView.ts`:

```txt
all
flagged
low-res
aspect
crop
errors
```

Do not add `high-res` or `good-res` unless the UI gets a matching product requirement. Resolution classification exists in the table column filter, not the top-level result view filter.

The results workspace store should expose this pipeline:

```txt
rows
-> remove rows where visible === false
-> apply top-level search query
-> derive top-level filter counts
-> apply selected top-level result filter
-> pass visible rows to the table
```

Counts should reflect the searched active row set before applying the selected result view filter.

Example:

```txt
search = "tennis"
searchedRows = 50

All (50)
Flagged (8)
Low-res (3)
Aspect (4)
Crop (2)
Errors (0)
```

If the selected filter is `Crop`, the counts still describe the searched row universe, not only the crop rows.

PrimeReact column filters are a separate layer in the current UI. Unless this plan is expanded, top-level counts do not need to include column filters such as Type, Size, Duration, Modified, Resolution, Aspect, or Crop. If a future task requires that, the table filters should become controlled state and join the shared pipeline deliberately.

## Persistence Policy

For this plan, keep the current implemented persistence boundary:

```txt
src/renderer/storage/auditResultStorage.ts
```

Current behavior:

- IndexedDB database: `collie-video`
- store `audit-results`: latest saved audit under key `current`
- store `audit-history`: archived metadata when cache/data is cleared
- `saveStoredAuditResult` stores the exact `AuditRequest`, normalized `AuditResult`, and `showThumbnails`
- startup restore flows through `useInitialVideoAuditState`
- refresh replays `lastAuditRequest`

The earlier persistence idea of sending snapshots through preload to main-process JSON files is a broader project/session persistence decision. Do not mix it into this Zustand migration unless explicitly requested.

If the results workspace store starts persisting additional workspace UI state, use a versioned IndexedDB schema. Keep compatibility with existing schema version 1:

```ts
type StoredAuditResultStateV1 = {
  key: 'current';
  schemaVersion: 1;
  savedAt: string;
  request: AuditRequest;
  result: AuditResult;
  showThumbnails: boolean;
};

type StoredAuditResultStateV2 = Omit<StoredAuditResultStateV1, 'schemaVersion'> & {
  schemaVersion: 2;
  workspace?: {
    searchQuery?: string;
    activeViewFilter?: ResultsViewFilter;
    selectedRowIds?: string[];
  };
};
```

Only persist search/filter/selection if that is desired. The current app restores rows, request/source state, audit options, folder-tree source metadata, and `showThumbnails`; it does not currently restore search, result filter, or selected rows.

## Stage 1 - Zustand Architecture And Conventions

### Goal

Add the store structure and conventions without changing behavior.

### Requirements

- Do not run `npm install zustand` unless the dependency has been removed.
- Create `src/renderer/stores/`.
- Add a short architecture note in code comments or docs describing:
  - when to add a store
  - when to keep state in hooks/components
  - how stores interact with workflow hooks
  - why stores must not own main-process execution
- Establish naming conventions for stores, actions, and selectors.
- Do not add a generic `useAppStore`.

### Acceptance Criteria

- App compiles.
- Store conventions are clear.
- No app behavior changes.

## Stage 2 - Results Workspace Store Shell

### Goal

Create the first focused store for result/table state.

### Requirements

- Create `src/renderer/stores/useVideoResultsStore.ts`.
- Create `src/renderer/stores/videoResultsSelectors.ts`.
- Reuse existing shared and renderer types:
  - `AuditRequest`, `AuditResult`, `AuditSummary`
  - `VideoRow`
  - `ResultsViewFilter`, `ResultsViewCounts`
- Keep `useAuditResults`, `useResultFilters`, and `useSelectionState` working during this stage.
- Add the row ID helper in one place.
- Do not migrate source selection, dialogs, or workflow progress in this stage.

### Deliverables

- Results workspace store file with state and explicit actions.
- Selector file with pure derived selectors.
- No persistence schema changes.
- No UI behavior changes.

### Acceptance Criteria

- App compiles.
- The first Zustand store exists and is focused on result/table workspace state.
- No whole-app store is introduced.
- Existing UI behavior is unchanged.

## Stage 3 - Shared Results Pipeline Helpers

### Goal

Move result row derivation into pure helpers/selectors that can be used by the store and UI.

### Requirements

Create or update helpers for:

- `getVideoRowId`
- `getActiveRows`
- `getSearchedRows`
- `getResultsViewCounts`
- `getVisibleRowsForResultView`
- `getSelectedRows`
- `getSelectedPaths`
- `getSelectedSummary`

Search should match the current table search fields as closely as practical:

- `displayFile`
- `fileName`
- `displayDirectory`
- `directory`
- `fileType`
- `resolution`
- `displayAspectRatio`
- black-border classification/confidence/recommended-fix reason
- `reasons`
- `status`

Reuse and extend `src/renderer/helpers/resultFilters.ts` rather than duplicating classification logic in components.

### Acceptance Criteria

- The pipeline can derive active rows, searched rows, counts, visible rows, and selected rows from one state object.
- Counts are derived, not stored.
- Search is applied before counts.
- Rows with `visible === false` are excluded from active rows.

## Stage 4 - Bridge Existing Result Hooks To The Store

### Goal

Adopt the results workspace store through existing hook boundaries before changing component contracts broadly.

### Requirements

Convert `useAuditResults` into a store-backed adapter, or progressively move its internals to store actions while preserving its public return shape.

Current behaviors to preserve:

- `applyAuditResult` normalizes `row.visible`.
- new audit results clear selection.
- stored audit results restore `showThumbnails`, `storageSavedAt`, `lastAuditRequest`, rows, summary, and errors.
- `resetResultStateForAuditStart` clears current rows and stores the pending request.
- `hideVideoPathsFromTable` marks matching rows `visible: false`, prunes selected rows, persists the updated result, and returns the hidden count.
- `restoreRemovedVideos` marks all rows visible and persists.
- media preview and preview clip results merge into both rows and current selection.
- `archiveCurrentResultToHistory` stores metadata only.

Keep storage messages/loading state in `useAuditResults` unless there is a clear benefit to moving them. They are UI/status state, not core row derivation.

### Acceptance Criteria

- Fresh audit, startup restore, refresh, clear data, row hide/restore, and media-preview merges still flow through the existing controller API.
- The store is the canonical source for rows and row visibility.
- There is no long-lived duplicate row source between hook state and store state.

## Stage 5 - Selection By Stable IDs

### Goal

Replace global selected row objects with selected row IDs.

### Requirements

- Store `selectedRowIds`.
- Derive `selectedVideos` from `rows` and `selectedRowIds`.
- Keep PrimeReact `DataTable` integration working by passing selected row objects to `selection`.
- Convert `onSelectionChange` row objects back to IDs.
- Prune selected IDs when rows are hidden, cleared, or replaced.
- Preserve the existing workflow interface initially by continuing to provide `selectedVideos`, `selectedVideoCount`, and `selectedPaths` from the controller.

### Acceptance Criteria

- Selection survives row metadata merges.
- Hidden/removed rows are removed from selection.
- Starting a new audit clears selection.
- Existing workflows still receive the selected row objects they need.

## Stage 6 - Search, Top-Level Filters, And Counts

### Goal

Make the toolbar search/filter/count UI read from the shared results pipeline.

### Current Bug/Risk

Today, `useResultFilters` computes counts from `visibleVideoRows`, then `VideoResultsTable` applies `globalFilter` inside PrimeReact. That means toolbar counts are not search-aware and can disagree with the visible table rows.

### Requirements

- Move `globalFilter` and `resultsViewFilter` into the store as `searchQuery` and `activeViewFilter`.
- Derive:
  - `activeRows`
  - `searchedRows`
  - `filterCounts`
  - `visibleRows`
  - `visibleRowCount`
- Pass `visibleRows` to `VideoResultsTable`.
- Avoid double-searching. Either remove `globalFilter` from `DataTable` or ensure it is no longer doing the authoritative toolbar search.
- Update `ResultsToolbar` filter labels to include counts:

```txt
All (482)
Flagged (37)
Low-res (12)
Aspect (18)
Crop (7)
Errors (3)
```

- Keep the existing `shown` text meaningful. It should represent rows after top-level search and selected result filter. If column filters remain uncontrolled in PrimeReact, do not claim that number includes column filters.

### Count Update Requirements

Counts must update after:

- fresh audit completion
- startup saved-audit restore
- audit refresh completion
- search query changes
- active result filter changes
- rows are hidden/removed
- rows are restored
- table data is cleared
- thumbnail/preview metadata is merged if a future filter depends on that metadata
- any row data changes that affect top-level classification

Selection changes should not change top-level filter counts.

### Acceptance Criteria

- Counts appear in the top-level filter UI.
- Counts are search-aware.
- Counts do not collapse to only the selected filter's count.
- The displayed table rows and toolbar counts come from the same pipeline.

## Stage 7 - Row Update/Merge Actions

### Goal

Centralize row metadata updates that currently happen in `useAuditResults`.

### Requirements

Store actions should support:

- replacing rows from an audit result
- hiding rows by path
- restoring all removed rows
- merging thumbnail/preview-frame metadata
- merging preview-clip metadata
- future row availability/status patches

Rules:

- preserve row order
- keep row updates immutable
- preserve selected IDs when rows remain
- prune selected IDs when rows are no longer active
- persist through `auditResultStorage.ts` only when existing behavior requires persistence
- do not execute filesystem work inside the store

Existing helpers in `src/renderer/helpers/mediaPreviewRows.ts` should be reused or moved only if that improves the boundary.

### Acceptance Criteria

- Thumbnail, fresh-frame, and preview-clip results update rows through one store-owned path.
- File-management, Premiere, Auto-Fix, Auto-Crop, and post-conversion workflows still hide affected source rows through a single row-hiding action.
- Future file availability can be represented as row metadata without rewriting the pipeline.

## Stage 8 - Persistence Hydration And Optional Workspace Snapshot

### Goal

Ensure every current result row-loading path hydrates the store consistently.

### Current Loading Paths

- fresh audit completion through `useAuditWorkflow`
- startup latest-audit restore through `useInitialVideoAuditState`
- audit refresh completion through `lastAuditRequest`
- clear data/cache through `useClearAuditDataWorkflow`

There is no full audit-history snapshot restore path today.

### Requirements

- Add a single hydration action such as `applyAuditResult` or `hydrateFromStoredAudit`.
- Keep `loadStoredAuditResult` and `saveStoredAuditResult` in `auditResultStorage.ts`.
- Preserve existing schema version 1 reads.
- If persisting workspace UI state, add a backward-compatible schema version 2.
- Do not persist transient state:
  - open dialogs
  - running job progress
  - temporary errors/toasts
  - hover state
  - active action

### Acceptance Criteria

- Fresh audit loads rows into the store.
- Stored latest audit loads rows into the store.
- Refresh replaces rows through the same path.
- Clear data clears rows, search/filter state, and selection.
- Existing saved audits remain readable.

## Stage 9 - Controller And Component Cleanup

### Goal

Remove obsolete duplicated table/result state while preserving the current component architecture.

### Requirements

Inspect and simplify:

- `useVideoAuditAppController.ts`
- `useAuditResults.ts`
- `useResultFilters.ts`
- `useSelectionState.ts`
- `VideoAuditAppController` type
- `App.tsx` prop grouping
- `ResultsToolbar.tsx`
- `VideoResultsTable.tsx`
- `SelectionActionBar.tsx`
- `AppHeader.tsx`

After migration:

- `useVideoAuditAppController` should remain a composition adapter.
- workflow hooks should keep owning workflow execution.
- workspace-level components may read from the store directly if that reduces prop churn.
- leaf components should stay presentational when practical.
- avoid introducing store imports into every small component.

### Acceptance Criteria

- No duplicate canonical row state remains.
- No duplicate canonical top-level search/filter state remains.
- No duplicate canonical selection state remains.
- The controller return shape is smaller where safe.
- Existing workflows and dialogs still behave the same.

## Stage 10 - Evaluate Next Zustand Store

### Goal

Decide whether another store is actually warranted after the results workspace migration.

### Requirements

Review the remaining renderer state against the decision criteria:

- source workspace state
- app shell/dialog state
- settings UI state
- operation history UI state
- workflow busy/capability derivation

For each candidate, decide:

- keep in focused hook
- move to a new focused Zustand store
- leave local to component
- document as a future option

Do not add a second store in the same pass unless there is a clear, current problem to solve.

### Acceptance Criteria

- The plan does not accidentally stop at results forever.
- The app also does not drift into a broad global store.
- Any next store has a concrete reason and owner boundary.

## Stage 11 - Documentation

### Goal

Document the Zustand state boundary so future tasks do not dump everything into stores.

### Requirements

Update `docs/renderer-architecture.md` or create a focused `docs/renderer-state-architecture.md` with:

- when Zustand should be used
- when state should stay in hooks/components
- what the first results workspace store owns
- what Zustand stores do not own
- row derivation pipeline
- count semantics
- selected row ID semantics
- IndexedDB persistence/hydration behavior
- how workflow hooks should update store-owned state
- how future source/app UI stores should be evaluated
- how file-management workflows should reflect row state without moving filesystem execution into the renderer store

Include a future integration note for file availability validation:

- main process validates files
- renderer receives typed availability/status results
- store merges row status if the results workspace owns that field
- selectors derive capabilities and disabled reasons
- table renders status from row data

### Acceptance Criteria

- Future tasks can tell where Zustand belongs.
- Future tasks can tell where row/table state belongs.
- Future tasks can tell where workflow execution belongs.
- Persistence boundaries are explicit.

## Stage 12 - Verification And Cleanup

### Required Checks

Run available checks:

```bash
npm run typecheck
npm run build
```

There is no `npm run lint` script currently. Do not add one as part of this plan unless requested.

### Manual Verification Checklist

- start with no saved audit
- restore latest saved audit on launch
- run a fresh folder audit
- run a fresh selected-file audit
- refresh the latest audit
- search rows and verify counts update
- switch top-level filters and verify counts stay search-aware
- use table column filters and verify top-level count wording is still honest
- select rows after searching/filtering
- generate thumbnails for selected rows
- generate thumbnails for all visible rows
- fetch fresh thumbnails from details
- generate preview clips
- remove selected rows from the table
- restore removed rows
- send selected rows to Premiere
- run Auto-Fix and Auto-Crop enough to verify row hiding/post-conversion handoff
- use move-to-trash, move-to-folder, archive originals, and post-conversion replacement enough to verify row hiding still works
- clear cache/data
- relaunch app and verify latest-state restore behavior

### Cleanup

Remove:

- unused imports
- obsolete local row state
- obsolete local search/filter state
- obsolete local selection state
- duplicated row filter helpers
- stale comments
- dead props
- old manual count calculations

## Definition Of Done

This implementation is complete when:

- Zustand has clear usage criteria and store conventions
- at least the first high-value store is implemented intentionally
- result/table state has a focused results workspace store
- dynamic top-level filter counts are derived and search-aware
- table visible rows use a single derivation pipeline
- selected rows are tracked by stable IDs
- fresh audit, latest-audit restore, refresh, clear data, row hide/restore, and media-preview merges hydrate/update the same store
- row updates use centralized actions/helpers
- durable audit-result persistence still goes through the existing IndexedDB storage boundary unless a separate persistence plan changes that boundary
- workflow hooks still own execution and IPC-facing orchestration
- the main app controller no longer duplicates result/table state
- current file-management, Premiere, Auto-Fix, Auto-Crop, thumbnail, preview, migration, and replacement workflows still work
- any future Zustand store has a concrete reason instead of existing just because Zustand is available
