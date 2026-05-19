# Zustand Results Store Plan

## Project Context

The app is a standalone Electron version of `video-audit`.

The UI has become more feature-rich: audit results, filter dropdowns, hidden/removed rows, selected rows, thumbnails, preview clips, history restore, fresh scans, auto-fix/crop actions, Premiere handoff, and eventually file management.

The current React hook/controller structure is starting to become fragile for table/result state. In particular, features like dynamic filter counts need to update consistently whenever any table-affecting event occurs:

- a new audit completes
- a previous audit snapshot is restored
- a fresh audit is run from history
- search changes
- a filter changes
- rows are hidden/removed/restored
- selected rows change
- table state is restored from persistence
- thumbnail/preview metadata is merged into rows
- future file-management actions update row availability/status

This plan introduces a focused Zustand store for video result/table state.

## Important Architectural Decision

Zustand should be used for **renderer-side results workspace state**, not as the entire app architecture.

Zustand should own state like:

- current video rows
- selected row IDs
- hidden/removed row IDs
- search query
- active result filter
- table sort/view state
- thumbnail visibility
- derived visible rows
- derived filter counts
- current restored/audit snapshot metadata

Zustand should **not** own:

- Electron main-process filesystem logic
- audit execution internals
- ffmpeg child process execution
- ffprobe logic
- durable persistence itself
- Premiere bridge internals
- raw IPC implementation details
- every dialog in the app
- every app setting

The main process remains the source of truth for filesystem operations and durable persistence. Zustand is the live renderer state model for the results workspace.

## Why This Refactor Is Needed

The table is becoming the center of the app.

A feature like filter counts seems simple:

```txt
Low-res (12)
High-res (384)
Crop needed (6)
Errors (3)
```

But those counts need to agree with the table after multiple kinds of changes.

If counts are computed in a component, search state in a hook, removed rows in another hook, and restored history state in yet another place, bugs become likely.

This plan creates a single consistent data pipeline:

```txt
allRows
→ activeRows
→ searchedRows
→ filterCounts
→ visibleRows
→ selectedRows
```

The key idea:

* `filterCounts` should be derived, not manually stored.
* `visibleRows` should be derived, not manually maintained in multiple places.
* selection should be tracked by stable row IDs, not stale row object references.
* persistence should hydrate/dehydrate the store through explicit snapshots.

## Non-Goals

* Do not move the whole app into Zustand.
* Do not migrate every hook at once.
* Do not add Redux, MobX, XState, or another state framework.
* Do not use Zustand as the primary durable persistence layer.
* Do not store dynamic counts as mutable state.
* Do not rewrite audit, auto-fix, auto-crop, thumbnail, preview clip, Premiere, or migration logic unless needed for integration.
* Do not add file-management workflows yet.
* Do not redesign the UI.
* Do not write tests unless explicitly requested.

## Store Scope

Create one focused store first:

```txt
src/renderer/stores/useVideoResultsStore.ts
```

or, if the existing project prefers a `state` folder:

```txt
src/renderer/state/useVideoResultsStore.ts
```

The store should initially own:

* `rows`
* `removedRowIds`
* `hiddenRowIds`
* `selectedRowIds`
* `searchQuery`
* `activeViewFilter`
* `sortField`
* `sortOrder`
* `showThumbnails`
* `columnVisibility`, if currently tracked
* current audit/snapshot metadata, if useful

The store should expose actions for:

* setting/replacing rows
* clearing rows
* hydrating from a persisted snapshot
* creating a persistable snapshot
* setting search query
* setting active view filter
* setting sort state
* setting thumbnail visibility
* setting selected rows by ID
* removing/hiding rows
* restoring removed/hidden rows
* merging row updates, such as thumbnail/preview metadata

The store should expose selectors/helpers for:

* all rows
* active rows
* searched rows
* visible rows
* filter counts
* selected rows
* selected row capabilities
* summary counts

## Definitions

### All Rows

The complete current row list loaded into the app.

```txt
allRows = rows
```

### Active Rows

Rows after applying hidden/removed state.

This depends on app semantics. In most cases:

```txt
activeRows = rows - removedRows - hiddenRows
```

If the app has a “show hidden” mode, then hidden rows may remain visible when that mode is active.

### Searched Rows

Rows after applying the current search query, but before the active result filter.

```txt
searchedRows = applySearch(activeRows, searchQuery)
```

### Filter Counts

Counts derived from `searchedRows`.

Important: filter counts should usually be computed **before** applying the currently selected result filter.

This means if the user searches `tennis`, the dropdown labels answer:

```txt
Among videos matching "tennis", how many are low-res, crop-needed, errors, etc.?
```

That is usually more useful than counts from the entire unsearched table.

### Visible Rows

Rows that the table actually displays after applying the selected filter.

```txt
visibleRows = applyViewFilter(searchedRows, activeViewFilter)
```

### Selected Rows

Rows derived from `selectedRowIds`.

Internally, store selected row IDs. Convert to row objects only when feeding PrimeReact DataTable or action handlers.

```txt
selectedRows = rows.filter(row => selectedRowIds.includes(row.id))
```

## Row Identity

Use a stable row ID.

Preferred:

```txt
row.id
```

If no stable `id` exists, use:

```txt
row.path
```

A video path is not perfect if files move, but it is stable enough for current audit table state and matches how most app workflows identify videos.

Avoid tracking selected rows as objects in global store state. Object references become stale after rows are refreshed, restored, or merged.

## Dynamic Filter Counts Semantics

Use this pipeline for dropdown/filter counts:

```txt
rows
→ remove hidden/removed rows
→ apply search
→ derive counts
→ apply selected filter
→ render table
```

Example:

If search is empty:

```txt
All (500)
Low-res (40)
High-res (460)
Crop needed (12)
Errors (3)
```

If search is `tennis` and 50 rows match:

```txt
All (50)
Low-res (8)
High-res (42)
Crop needed (2)
Errors (0)
```

If the selected filter is `Low-res`, the counts should still show the distribution within the searched set, not only within low-res rows.

## Persistence Philosophy

Zustand should not directly persist important app state to localStorage as the primary mechanism.

Instead:

1. Zustand owns live renderer result/table state.
2. Renderer creates a persistable snapshot from the store.
3. Renderer sends that snapshot through typed preload APIs.
4. Electron main writes it to durable JSON files under app `userData`.

This allows integration with:

* latest session restore
* audit history snapshots
* future projects
* future file-management operation history

Small UI-only preferences may use localStorage if already established, but important result/table state should go through main-process persistence.

---

## Stage 1 — Add Zustand and Result Store Shell

**Intelligence Level: High**

### Goal

Introduce Zustand with a focused store for video results/table state.

This stage should create the structure without migrating all logic at once.

### Why This Stage Exists

Right now, result/table state is probably scattered across a large controller hook and child components. Before implementing dynamic filter counts, the app needs one clear place for the current result workspace state.

The goal is to establish the store shape and make a small, safe first migration.

### Requirements

Install Zustand:

```bash
npm install zustand
```

Create:

```txt
src/renderer/stores/useVideoResultsStore.ts
```

or match the app’s existing folder conventions.

The initial store should include:

* `rows`
* `removedRowIds`
* `hiddenRowIds`
* `selectedRowIds`
* `searchQuery`
* `activeViewFilter`
* `sortField`
* `sortOrder`
* `showThumbnails`
* `columnVisibility`, if currently tracked
* `snapshotMeta`, if useful

Suggested state shape:

```ts
type VideoResultsStoreState = {
  rows: VideoRow[];

  removedRowIds: string[];
  hiddenRowIds: string[];
  selectedRowIds: string[];

  searchQuery: string;
  activeViewFilter: VideoViewFilter;

  sortField: string | null;
  sortOrder: 1 | -1 | 0 | null;

  showThumbnails: boolean;
  columnVisibility: Record<string, boolean>;

  snapshotMeta: {
    auditId: string | null;
    historyId: string | null;
    label: string | null;
    restoredAt: string | null;
  };

  setRows: (rows: VideoRow[], meta?: Partial<SnapshotMeta>) => void;
  clearRows: () => void;

  setSearchQuery: (query: string) => void;
  setActiveViewFilter: (filter: VideoViewFilter) => void;
  setSortState: (sort: { field: string | null; order: 1 | -1 | 0 | null }) => void;
  setShowThumbnails: (value: boolean) => void;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;

  setSelectedRowIds: (ids: string[]) => void;
  clearSelection: () => void;

  removeRows: (ids: string[]) => void;
  hideRows: (ids: string[]) => void;
  restoreRows: (ids?: string[]) => void;
};
```

Adapt names to current app conventions.

### Requirements

* Do not migrate every component in this stage.
* Do not implement dynamic counts yet.
* Do not remove the old controller state until consumers are migrated.
* Avoid duplicate behavior changes.
* Keep store actions simple and explicit.

### Deliverables

* Zustand dependency added
* result store created
* initial types created or reused
* no major behavior changes yet
* changelog/version/commit updated per project workflow

### Acceptance Criteria

* App compiles.
* Zustand store exists.
* Store is focused on result/table state only.
* No whole-app store is introduced.
* Existing UI behavior remains unchanged or minimally affected.

---

## Stage 2 — Add Row Selectors and Filtering Pipeline

**Intelligence Level: Extra High**

### Goal

Implement the derived state pipeline for rows, search, filters, counts, and selection.

### Why This Stage Exists

The upcoming filter count feature depends on having a single reliable definition of what counts as:

* active rows
* searched rows
* visible rows
* selected rows
* category counts

This should be centralized and derived from store state.

### Requirements

Create selectors and/or pure helper functions for:

* `selectAllRows`
* `selectActiveRows`
* `selectSearchedRows`
* `selectVisibleRows`
* `selectFilterCounts`
* `selectSelectedRows`
* `selectResultSummary`
* `selectSelectedCapabilities`

Possible files:

```txt
src/renderer/stores/videoResultsSelectors.ts
src/renderer/helpers/videoResultFilters.ts
```

Use pure functions for actual filtering where practical.

Suggested pipeline:

```ts
const activeRows = getActiveRows(rows, {
  removedRowIds,
  hiddenRowIds,
  showHidden,
});

const searchedRows = getSearchedRows(activeRows, searchQuery);

const filterCounts = getFilterCounts(searchedRows);

const visibleRows = getVisibleRows(searchedRows, activeViewFilter);

const selectedRows = getSelectedRows(rows, selectedRowIds);
```

### Requirements

Filter categories should match the app’s existing concepts.

Likely categories:

* all
* flagged
* low-res
* high-res / good-res if applicable
* aspect-ratio issue
* crop-needed / black-border review
* errors
* maybe converted/fixed later if such states exist

Do not invent categories that do not exist in the UI yet unless the current feature requires them.

### Important Rule

Do **not** store dynamic filter counts as mutable store state.

Bad:

```ts
lowResCount: number;
setLowResCount(count: number): void;
```

Good:

```ts
const counts = useVideoResultsStore(selectFilterCounts);
```

### Search Semantics

Search should apply before counts.

Counts should reflect the current searched result set, before applying the selected filter.

### Removed/Hidden Semantics

Counts should reflect the table’s active row universe.

If removed rows are no longer visible in the table, counts should exclude them.

If hidden rows are hidden from the table, counts should exclude them unless the current UI has a “show hidden” mode.

### Deliverables

* selector/helper files
* derived counts implementation
* row classification helper functions
* no UI count labels yet unless trivial

### Acceptance Criteria

* Derived selectors compile.
* Selectors produce consistent outputs from the same source state.
* Counts are derived, not manually synchronized.
* Search/filter/visibility pipeline is documented in code comments or helper names.

---

## Stage 3 — Wire Results Toolbar, Table, and Selection Bar to the Store

**Intelligence Level: Extra High**

### Goal

Move key result/table UI consumers to the Zustand store.

### Why This Stage Exists

The store only helps if the components that display and manipulate table state use it consistently.

This stage should migrate the table/toolbar/action bar integration while preserving existing behavior.

### Requirements

Update components/hooks that currently consume result/table props directly from the large controller.

Likely areas:

* Results toolbar
* filter dropdown/segmented filter controls
* search input
* VideoTable / DataTable wrapper
* selection action bar
* remove/restore buttons
* thumbnail visibility toggle

The table should receive:

* `visibleRows` from the store selector
* selected rows derived from `selectedRowIds`
* selection changes converted back to IDs
* sort state from store if currently controlled
* show thumbnails state from store if relevant

Example PrimeReact DataTable adapter:

```tsx
const visibleRows = useVideoResultsStore(selectVisibleRows);
const selectedRows = useVideoResultsStore(selectSelectedRows);
const setSelectedRowIds = useVideoResultsStore((state) => state.setSelectedRowIds);

<DataTable
  value={visibleRows}
  selection={selectedRows}
  onSelectionChange={(event) => {
    setSelectedRowIds(event.value.map((row) => getVideoRowId(row)));
  }}
/>
```

### Requirements

* Preserve existing table selection behavior.
* Preserve search behavior.
* Preserve remove/restore behavior.
* Preserve thumbnail toggle behavior.
* Preserve action enable/disable behavior.
* Avoid double-state where both local React state and Zustand own the same value.
* Remove old state from the controller only after corresponding UI is fully migrated.

### Deliverables

* Results toolbar reads/writes store state
* DataTable reads visible rows from store
* selection action bar reads selected rows/capabilities from store
* controller reduced where safe

### Acceptance Criteria

* Table displays same rows as before.
* Search still works.
* Filters still work.
* Selection still works.
* Action bar still works.
* Remove/restore still works.
* No stale selected rows after filtering/search/removing.

---

## Stage 4 — Implement Dynamic Filter Counts

**Intelligence Level: High**

### Goal

Add count labels next to filter options using derived store selectors.

### Why This Stage Exists

This is the feature that triggered the store discussion. Counts must update reliably after any event that changes the table’s visible row universe.

### Requirements

Update the filter dropdown/segmented control labels to include counts.

Examples:

```txt
All (482)
Flagged (37)
Low-res (12)
High-res (445)
Aspect issue (18)
Crop needed (7)
Errors (3)
```

Use the `selectFilterCounts` selector from Stage 2.

### Count Update Requirements

Counts must update after:

* new audit results are loaded
* audit history snapshot is restored
* a fresh audit from history completes
* search query changes
* rows are removed
* rows are hidden
* rows are restored
* table is cleared
* media preview row metadata is merged if that affects filters
* any row data changes that affect classification

### Count Semantics

Counts should be derived from:

```txt
activeRows after hidden/removed state
+ current search query
- active view filter
```

In other words:

```txt
filterCounts = counts(searchedRows)
visibleRows = applySelectedFilter(searchedRows)
```

Counts should not collapse to zero for other filters simply because one filter is currently active.

### Requirements

* Avoid expensive recalculation if selectors are already efficient.
* Do not duplicate filter classification logic in UI components.
* Do not manually update counts in event handlers.
* Ensure empty state labels are sensible, e.g. `Low-res (0)`.

### Deliverables

* filter labels with counts
* any helper formatting
* no duplicated count state

### Acceptance Criteria

* Counts appear in the filter UI.
* Counts update consistently.
* Counts agree with table behavior.
* No manual count synchronization exists.

---

## Stage 5 — Audit Result and History Restore Hydration

**Intelligence Level: High**

### Goal

Ensure all entry points that load result rows hydrate the Zustand store consistently.

### Why This Stage Exists

Rows can enter the app through several flows:

* fresh audit complete
* restored latest session
* restored audit history snapshot
* fresh audit rerun from history
* maybe future project open
* clear cache / clear data
* maybe import/open saved scan later

If some flows set old React state and others set Zustand state, bugs will appear.

This stage ensures there is one consistent hydration path.

### Requirements

Create a clear store action:

```ts
hydrateFromAuditResult(...)
```

or:

```ts
loadResultSnapshot(...)
```

It should set:

* rows
* removed/hidden IDs if supplied
* selected IDs if supplied and still valid
* search/filter/table state if supplied
* snapshot metadata

Create a clear action for clearing:

```ts
clearResults()
```

Use this store hydration from all relevant flows.

### Persistence Integration

When saving current table state to audit history or latest session, use a store snapshot selector:

```ts
selectPersistableResultsSnapshot
```

Persistable snapshot should include:

* rows
* hidden/removed row IDs
* table search/filter state
* show thumbnails
* sort/column state if applicable
* snapshot metadata

It should not include transient UI state like:

* open dialogs
* toasts
* running job progress
* temporary hover states

### Requirements

* Do not use Zustand localStorage persist as the primary durable layer.
* Continue using Electron main-process persistence.
* Avoid saving every minor change too aggressively unless debounced.
* Preserve current history-saving behavior implemented by Claude.

### Deliverables

* hydration action(s)
* persistable snapshot selector
* existing restore/history flows updated to hydrate store
* old duplicated state removed where safe

### Acceptance Criteria

* Fresh audit loads rows into store.
* Restored cached audit loads rows into store.
* Clear cache clears store.
* Starting a new scan saves current store snapshot if required by existing behavior.
* Counts and visible rows update after restore/clear/new scan.

---

## Stage 6 — Row Update/Merge Utilities for Thumbnails, Preview Clips, and Future Status

**Intelligence Level: High**

### Goal

Centralize how row metadata updates are merged into the current row list.

### Why This Stage Exists

Rows may get updated after initial audit by features such as:

* thumbnail generation
* preview clip generation
* file validation
* cached snapshot validation
* future file-management operations
* conversion status
* missing/changed file status

If every workflow manually maps over rows in its own way, table state gets fragile.

### Requirements

Add store actions/helpers such as:

```ts
updateRowsById(updates)
mergeRowPatch(rowId, patch)
mergeThumbnailResults(results)
mergePreviewClipResults(results)
markRowsAvailability(statuses)
```

Pick names that match the app’s existing types.

Rules:

* preserve row order
* preserve selected row IDs when rows remain
* remove selected IDs if rows are removed
* do not mutate rows in place
* update derived counts automatically via selectors
* keep row patching type-safe

### Requirements

* Do not migrate every workflow if not necessary.
* Prioritize workflows that already update table rows:

  * thumbnails
  * preview clips
  * restore validation
  * remove/restore
* Leave clean extension points for future file management.

### Deliverables

* row update helpers/actions
* migrated thumbnail/preview row update flow if applicable
* documentation comments or notes for future workflows

### Acceptance Criteria

* Row metadata updates use centralized actions.
* Counts/visible rows update automatically after row metadata changes.
* Future file-management status can be merged into rows without rewriting the table pipeline.

---

## Stage 7 — Controller Cleanup and Prop Simplification

**Intelligence Level: Extra High**

### Goal

Remove obsolete result/table state from the large app controller and simplify prop passing.

### Why This Stage Exists

After the store is wired, the large controller should no longer own table/result state. This reduces complexity and prevents two sources of truth.

### Requirements

Inspect `useVideoAuditAppController.ts` and related parent components.

Remove or simplify state/handlers that Zustand now owns:

* rows
* selected rows
* search
* active filter
* show thumbnails
* removed/hidden rows
* row counts
* selected-row capability flags where now derived by selectors

Keep workflow logic in hooks where appropriate:

* audit execution
* auto-fix/crop execution
* thumbnails/previews execution
* Premiere workflow
* migration workflow

Components should either:

1. read directly from the store, or
2. receive grouped props from parent hooks,

but avoid massive prop lists when possible.

### Requirements

* Do not remove behavior.
* Do not change UI design.
* Avoid a giant store import in every tiny component if prop passing is already clean.
* Prefer direct store use in workspace-level components like toolbar/table/action bar.
* Keep leaf components presentational when practical.

### Deliverables

* smaller `useVideoAuditAppController.ts`
* fewer duplicated props/state
* removed stale imports
* updated component prop contracts if needed

### Acceptance Criteria

* No duplicate source of truth for result/table state remains.
* Main controller is smaller and clearer.
* App behavior remains the same.
* Dynamic counts still work.

---

## Stage 8 — Persistence and Store Boundary Documentation

**Intelligence Level: Medium**

### Goal

Document the store’s scope so future Codex tasks do not dump everything into Zustand.

### Why This Stage Exists

Once Zustand exists, future tasks may be tempted to put everything into it. This documentation prevents the store from becoming the new God hook.

### Requirements

Create or update:

```txt
docs/renderer-state-architecture.md
```

Document:

* what Zustand owns
* what Zustand does not own
* row derivation pipeline
* count semantics
* how table state is persisted
* how audit history hydrates the store
* how future file-management features should interact with the store
* how workflow hooks should write results into the store without moving main-process logic into renderer state

Include a section:

```md
## Future File Management Integration
```

Explain that future file-management workflows should:

* use main-process services for real file operations
* use Zustand only to reflect row status/availability/selection in the renderer
* update rows through centralized row patch actions
* not execute filesystem mutations inside the store

### Deliverables

* renderer state architecture doc
* comments in store/selectors if helpful
* changelog/version/commit

### Acceptance Criteria

* Store boundaries are documented.
* Future work has clear guidance.
* The app has not moved durable persistence into localStorage-only Zustand state.

---

## Stage 9 — Verification and Cleanup

**Intelligence Level: High**

### Goal

Verify the store migration and clean up any leftover duplicated state.

### Requirements

Run available checks:

```bash
npm run typecheck
npm run build
```

Run lint if available:

```bash
npm run lint
```

Manual verification checklist:

* run a fresh audit
* restore an audit history snapshot
* run a fresh audit from history
* search table rows
* switch filter dropdown options
* verify counts update
* remove selected videos
* restore removed videos
* clear cache/data
* generate thumbnails
* generate preview clips if available
* select rows after filtering
* verify selection action bar
* verify counts after row updates
* relaunch app if latest-session persistence exists

Clean up:

* unused imports
* obsolete state variables
* duplicated row filter helpers
* stale comments
* dead props
* old count calculations

### Acceptance Criteria

* Typecheck/build pass or known issues are documented.
* Counts remain correct across major table events.
* Store is focused and not bloated.
* Controller no longer duplicates result/table state.
* No obvious stale-state bugs remain.

---

## Definition of Done

This store migration is complete when:

* result/table state has a focused Zustand store
* dynamic filter counts are derived and reliable
* table visible rows use a single derivation pipeline
* selected rows are tracked by stable IDs
* restore/history/fresh audit flows hydrate the same store
* row updates use centralized actions/helpers
* durable persistence still goes through Electron main-process services
* the main app controller no longer duplicates result/table state
* future file-management workflows have a clean integration point
