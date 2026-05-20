# Renderer State Architecture

This document defines where Zustand belongs in the renderer after the results workspace migration.

## Core Rule

Use Zustand for focused renderer workspace state when it has multiple readers or writers, important derived selectors, stale object-reference risk, or several workflows that need one canonical mutation path.

Do not use Zustand as the default app architecture. Do not create a generic `useAppStore`.

## Current Zustand Store

The only current Zustand store is `src/renderer/stores/useVideoResultsStore.ts`.

It owns focused video result/table state:

- `auditResult`
- `rows`
- `summary`
- `errors`
- `lastAuditRequest`
- `selectedRowIds`
- `searchQuery`
- `activeViewFilter`
- `showThumbnails`
- `storageSavedAt`
- `workspaceMeta`

It also owns result/table mutations that need to stay consistent:

- applying fresh or stored audit results
- clearing result/table state
- resetting rows for a new audit start
- setting top-level search and result-view filters
- setting selected row IDs
- hiding rows by path
- restoring hidden rows
- merging thumbnail and preview-frame metadata
- merging preview-clip metadata
- patching future row metadata by path

## What Zustand Does Not Own

Zustand must not own:

- Electron main-process filesystem logic
- native dialog execution
- ffmpeg or ffprobe execution
- job orchestration
- raw IPC or preload subscriptions
- app settings persistence
- file-operation execution or operation-history persistence
- Premiere bridge internals
- workflow progress snapshots
- one-off dialog open/closed state unless a future focused UI store is justified
- dynamic counts as mutable state

Workflow hooks should continue owning execution. Stores should receive final typed state updates from workflow hooks.

## State That Should Stay In Hooks Or Components

Keep state local or hook-owned when it is tied to one workflow, one dialog, or one execution lifecycle:

- audit, discovery, ffprobe, thumbnail, preview-clip, Auto-Fix, Auto-Crop, migration, file-operation, replacement, and Premiere progress state
- dialog visibility for workflow-specific dialogs
- app-shell visibility flags in `App.tsx`
- settings loading/messages/update calls in `useSettingsController`
- source selection state in `useAuditSourceController` and `useSourceSelection`
- operation-history dialog/loading/detail state in `useOperationHistory`
- busy and capability derivation in `useWorkflowBusyState` and `getWorkflowCapabilities`

The Stage 10 review in `docs/zustand-next-store-evaluation.md` records why no second store is currently warranted.

## Result Row Pipeline

The result pipeline is selector-derived. Do not store these counts or filtered arrays as mutable state.

```txt
rows
-> active rows: row.visible !== false
-> searched rows: searchQuery against result-search fields
-> top-level result counts from searched rows
-> visible rows for activeViewFilter
-> table rows
```

The selector entrypoints live in `src/renderer/stores/videoResultsSelectors.ts` and the pure helpers live in `src/renderer/helpers/resultFilters.ts`.

`VideoResultsTable` receives rows that have already passed the top-level search and result-view filter. PrimeReact column filters remain table-local and are not part of the top-level count pipeline.

## Count Semantics

Top-level result counts are derived from active, searched rows before applying the selected top-level result filter.

Example:

```txt
searchQuery = "tennis"
searched rows = 50

All (50)
Flagged (8)
Low-res (3)
Aspect (4)
Crop (2)
Errors (0)
```

Selecting `Crop` changes the displayed table rows, but the count labels still describe the searched row universe. Column filters do not change those labels unless a future task deliberately moves column filters into the shared pipeline.

## Selected Row Semantics

The store stores selected row IDs, not selected row objects.

The row ID helper is:

```txt
row.id ?? row.path
```

Selectors derive selected rows and selected paths from active rows and `selectedRowIds`. This avoids stale selected row objects when rows are replaced, hidden, restored, or patched with thumbnail/preview metadata.

Store actions prune selected IDs when rows are no longer active. Applying a new audit result or clearing results resets selection.

## Persistence And Hydration

Zustand is not the durable persistence layer.

Audit result persistence stays in `src/renderer/storage/auditResultStorage.ts` using IndexedDB database `collie-video`:

- store `audit-results` keeps the latest saved audit under key `current`
- store `audit-history` keeps archived metadata when cache/data is cleared
- schema version 1 remains readable
- `saveStoredAuditResult` stores the exact `AuditRequest`, normalized `AuditResult`, and `showThumbnails`
- `loadStoredAuditResult` is used by startup restore
- `clearStoredAuditResult` removes the current saved audit during clear-data/cache

Hydration into Zustand happens through `useVideoResultsStore.applyAuditResult`, wrapped by `useAuditResults` so persistence and storage messages remain outside the store.

Current loading paths are:

- fresh audit completion from `useAuditWorkflow`
- refresh completion using `lastAuditRequest`
- startup latest-audit restore from `useInitialVideoAuditState`
- clear data/cache through `useClearAuditDataWorkflow`, which calls the results clear action

Do not persist transient state such as open dialogs, progress snapshots, temporary errors, hover state, or the active action.

## Workflow Updates To Store-Owned State

Workflow hooks should not mutate row arrays directly.

Use the `useAuditResults` adapter callbacks:

- `applyAuditResult`
- `hideVideoPathsFromTable`
- `restoreRemovedVideos`
- `mergeMediaPreviewResult`
- `mergeMediaPreviewItemsIntoRows`
- `mergePreviewClipResult`

`useAuditResults` remains the bridge between workflow hooks, result store actions, IndexedDB persistence, storage messages, and audit-history metadata.

## File-Management Row Reflection

File-management workflows should execute through main/preload APIs and reflect successful operations in the result store only after the main process reports typed results.

Current flows use `hideVideoPathsFromTable` after successful operations:

- move to trash
- move to folder
- archive originals
- Premiere handoff
- Auto-Fix handoff
- post-conversion replacement

The store marks matching rows with `visible: false`, updates the current audit result, prunes selected IDs, and lets `useAuditResults` persist the updated result when existing behavior requires it.

Do not move filesystem execution into the renderer store.

## Future Store Evaluation

Future stores are allowed only when they solve a real coordination problem and have a focused owner boundary.

Before adding one, document:

- the state it owns
- the distant readers/writers that justify it
- the derived selectors it needs
- what it explicitly does not own
- the persistence boundary
- how workflow hooks will interact with it

Potential candidates remain optional:

- source workspace store
- app UI store

Do not add them just because Zustand exists.

## Future File Availability Validation

File availability validation should keep the Electron boundary intact:

1. Main process validates files.
2. Renderer receives typed availability/status results through preload and renderer API clients.
3. The results store merges row status if that field belongs to the results workspace.
4. Selectors derive capabilities, disabled states, and counts from row data.
5. `VideoResultsTable` renders status from row data.

The renderer must not check the filesystem directly.
