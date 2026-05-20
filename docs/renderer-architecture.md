# Renderer Architecture

This document describes the renderer architecture after the staged controller refactor. The renderer owns UI state, component composition, and calls into typed renderer API clients. Filesystem access, ffmpeg/ffprobe work, app settings storage, native dialogs, job orchestration, and OS integration stay behind the Electron preload/main boundary.

## Boundaries

- `src/renderer/App.tsx` composes the visible application shell and passes typed prop groups into UI components.
- `src/renderer/hooks/useVideoAuditAppController.ts` composes focused renderer hooks and exposes the compatibility controller shape consumed by `App.tsx`.
- `src/renderer/hooks/*` own workflow state, progress state, dialog state, and cross-workflow callbacks.
- `src/renderer/stores/useVideoResultsStore.ts` owns focused video result/table workspace state. See `docs/renderer-state-architecture.md` for the Zustand boundary.
- `src/renderer/api/*Client.ts` files are the only renderer modules that should call `window.videoAudit.*` directly.
- `src/renderer/storage/auditResultStorage.ts` is the renderer IndexedDB boundary for saved audit rows and audit-history metadata.
- `src/shared` defines cross-process types used by renderer, preload, and main.

Renderer code must not import Node or Electron main-process APIs directly. New filesystem, ffmpeg, ffprobe, Finder, Premiere, settings, and job work should be added to main/preload first, then called through a renderer API client.

## Renderer API Clients

The renderer API clients are thin wrappers over the typed preload API:

- `appClient`: app info and app command subscription.
- `auditClient`: audit start/cancel/result and audit progress subscription.
- `autoCropClient`: Auto-Crop start/cancel/result and progress subscription.
- `autoFixClient`: Auto-Fix start/cancel/result and progress subscription.
- `diagnosticsClient`: ffmpeg/ffprobe diagnostics.
- `dialogClient`: native folder, file, output-folder, and move-destination pickers.
- `discoveryClient`: file discovery start/cancel and progress subscription.
- `ffprobeClient`: ffprobe metadata extraction start/cancel and progress subscription.
- `fileOperationsClient`: validated reveal actions and trash/move/archive plans and execution.
- `folderTreeClient`: folder-tree root selection, scan/cancel/result, and scan progress subscription.
- `mediaPreviewClient`: thumbnail generation, preview frames, preview clips, cache clearing, and progress subscriptions.
- `migrationClient`: migration scan/execute/result and progress subscription.
- `operationHistoryClient`: recent operation history and operation details.
- `premiereClient`: Premiere status, bridge app launch, and import request creation.
- `replacementClient`: replacement-plan creation/update/execution/cancel/result and progress subscription.
- `settingsClient`: settings load/update/reset.

These clients should stay small. They should not own workflow decisions, UI messages, or derived state.

## Major Workflow Hooks

- `useAppBootstrap` loads app metadata.
- `useSettingsController` owns settings state, settings messages, update/reset behavior, and silent settings saves.
- `useDiagnosticsWorkflow` owns tool diagnostics loading, result, and error state.
- `useAuditSourceController` owns audit options plus source-selection reset coordination.
- `useSourceSelection` owns selected folders, selected files, output folder, folder-tree source metadata, picker calls, and source messages.
- `useInitialVideoAuditState` restores settings, source state, saved audit rows, saved request options, and folder-tree source metadata during startup.
- `useAuditResults` adapts workflow hooks to the results store, IndexedDB persistence, storage messages, row hiding/restoring, media-preview row merges, and audit-history archiving.
- `useResultFilters` reads top-level result search, view filter, visible counts, and filtered rows from results store selectors.
- `useSelectionState` adapts selected row objects and selected paths from store-owned selected row IDs.
- `useWorkflowBusyState` derives active workflow booleans and blocking-work state from active action and job progress.
- `useAuditWorkflow` owns audit start, refresh, cancel, progress subscription state, result retrieval, and audit-source replay after refresh.
- `useDiscoveryWorkflow` owns discovery start/cancel, progress subscription state, and discovered paths.
- `useFfprobeWorkflow` owns ffprobe metadata extraction start/cancel, progress subscription state, and metadata rows.
- `usePathReveal` validates paths and reveals known files/folders through file-operation APIs.
- `useOperationHistory` owns operation-history dialog state, recent records, selected record loading, refresh, and errors.
- `useFileOperationsWorkflow` owns trash, move, and archive plan/result dialog state, plan creation, execution, row hiding after successful operations, and optional history preview.
- `usePostConversionWorkflow` owns post-conversion replacement choices, plan creation, action updates, execution progress, cancellation, row hiding, result dialog state, and optional history preview.
- `useAutoFixWorkflow` owns Auto-Fix dialog state, start/cancel, progress subscription, result/error state, row hiding, and post-conversion handoff.
- `useAutoCropWorkflow` owns Auto-Crop dialog state, start/cancel, progress subscription, result/error state, and post-conversion handoff.
- `useMediaPreviewWorkflow` owns thumbnail generation, fresh frame generation, preview clip generation, media-preview dialog state, progress subscription state, errors, and row merge handoffs.
- `useMigrationWorkflow` owns migration dialog state, folder selection, scan/execute workflows, progress subscription, results, and errors.
- `usePremiereBridge` owns Premiere status refresh, bridge app launch, selected-video import requests, import result/error state, and row hiding after queued imports.
- `useClearAuditDataWorkflow` owns clear-data/cache orchestration across preview cache, persisted audit rows, source state, settings, filters, workflows, and storage messages.
- `useSelectedVideoActions` owns selected-row table removal.
- `useAppCommands` owns app-menu commands and Escape-key cancel/close priority.

## What `useVideoAuditAppController` Still Does

`useVideoAuditAppController` is a composition adapter. It still owns:

- the global `workflowMessage`
- the global `activeAction`
- the shared active-action setter passed into workflows
- cross-workflow wiring that would be awkward or circular inside a single workflow hook
- derived `auditedRootDirectory`
- top-level workflow capability calculation
- the compatibility `VideoAuditAppController` return shape used by `App.tsx`

It should not regain large helper blocks, direct preload calls, workflow execution logic, or broad UI rendering responsibilities.

## Preload and API Calls

Direct preload calls belong in `src/renderer/api/*Client.ts`. Workflow hooks import those clients and translate results into renderer state and UI messages. Components and `App.tsx` should not call `window.videoAudit.*`.

Long-running operations follow a common shape:

1. A workflow hook calls a client `start*` method and stores the returned job id when needed.
2. The hook subscribes to the matching progress channel through a client `subscribeTo*Progress` wrapper.
3. Progress snapshots update local hook state and the shared `activeAction`.
4. Completion snapshots or result fetches update workflow result state and downstream row state.
5. Cancel handlers call the matching client `cancel*` method for the current job id.
6. The subscription cleanup returned by preload is returned from the hook effect.

## Result Row State

The focused Zustand results workspace store owns the canonical audit result and row list:

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

`useAuditResults` is the adapter around that store. It exposes compatibility callbacks to workflow hooks, handles IndexedDB persistence and storage messages, and archives audit-history metadata. Other workflows do not mutate row arrays directly. They call callbacks supplied by the controller, such as `applyAuditResult`, `hideVideoPathsFromTable`, `mergeMediaPreviewResult`, `mergeMediaPreviewItemsIntoRows`, and `mergePreviewClipResult`.

Derived rows and counts come from `src/renderer/stores/videoResultsSelectors.ts`; dynamic counts are not stored as mutable state.

## Selected Row State

The results store stores selected row IDs, not selected row objects. Selection identity uses `row.id ?? row.path`.

`useSelectionState` derives:

- `selectedVideos`
- `setSelectedVideos`
- `selectedVideoCount`
- `selectedPaths`

The store clears selection when new audit results are applied and prunes selected IDs when rows are hidden or no longer active. `SelectionActionBar` and row workflows consume selected row objects through the controller adapter.

## Settings State

`useSettingsController` owns the loaded `AppSettings`, settings messages, and settings persistence. `useAuditSourceController` coordinates settings reset with audit option/source state so reset behavior updates the renderer state intentionally. `useInitialVideoAuditState` uses loaded settings and any saved audit request to restore startup state.

Settings live in the Electron main process. Renderer settings changes must go through `settingsClient`.

## Result Search, Filters, And Counts

Top-level result search and view filtering are store-owned:

```txt
rows
-> active rows where visible !== false
-> searched rows
-> search-aware top-level counts
-> visible rows for the active result filter
-> table rows
```

Count labels describe the searched active-row universe before the selected top-level filter is applied. PrimeReact column filters remain local to `VideoResultsTable` and are not included in top-level count labels.

## Audit Result Persistence

Audit result persistence lives in `src/renderer/storage/auditResultStorage.ts` using IndexedDB database `collie-video`.

- Store `audit-results` contains the current saved audit under key `current`.
- Store `audit-history` contains archived metadata when clear-data/cache runs.
- `saveStoredAuditResult` stores the exact `AuditRequest`, the normalized `AuditResult`, and `showThumbnails`.
- `loadStoredAuditResult` is used during startup by `useInitialVideoAuditState`.
- `clearStoredAuditResult` removes the current saved audit during cache clearing.

The saved request is important because refresh replays the last request rather than reconstructing it from visible UI state. Zustand reflects hydrated state; it is not the primary durable persistence layer.

## Row Hiding and Removal

Rows are not removed from the underlying audit result when users remove selected rows from the table or when workflows hide completed rows. The results store marks matching rows with `visible: false`, updates the current audit result rows, prunes selected IDs, and returns the hidden count. `useAuditResults.hideVideoPathsFromTable` persists the updated result when existing behavior requires it.

Selectors filter out rows where `visible === false`. `restoreRemovedVideos` marks all rows visible again and persists the result.

## Media Preview Row Merging

Media preview data is merged into existing rows through store actions called by `useAuditResults`:

- `mergeMediaPreviewResult` applies generated thumbnail metadata from a completed thumbnail job.
- `mergeMediaPreviewItemsIntoRows` applies fresh thumbnail frame metadata for one or more rows.
- `mergePreviewClipResult` applies preview clip metadata.

The merge helpers live in `src/renderer/helpers/mediaPreviewRows.ts`; workflow hooks pass result data to `useAuditResults` instead of replacing the full audit result shape themselves.

## Zustand Store Boundary

Use Zustand for focused renderer workspace state only when there are multiple readers/writers, important derived selectors, stale object-reference risks, or several workflows needing one canonical mutation path.

Do not put these in Zustand:

- main-process filesystem logic
- ffmpeg/ffprobe execution
- native dialogs
- raw IPC subscriptions
- app settings persistence
- workflow progress snapshots
- operation-history persistence
- one-off dialog visibility

`docs/zustand-next-store-evaluation.md` records why no second store is currently warranted. `docs/renderer-state-architecture.md` is the detailed state-boundary reference for future work.

## Auto-Fix, Auto-Crop, and Post-Conversion Replacement

Auto-Fix and Auto-Crop are separate workflows, but both can hand successful outputs to `usePostConversionWorkflow`.

- `useAutoFixWorkflow` starts/cancels Auto-Fix, tracks progress, hides successfully processed source rows, then calls `createPostConversionPlan` with the Auto-Fix result.
- `useAutoCropWorkflow` starts/cancels Auto-Crop and calls `createPostConversionPlan` with the Auto-Crop result when appropriate.
- `usePostConversionWorkflow` creates the replacement plan, opens the choices/review UI, updates per-item or bulk actions, executes replacements, supports cancellation, hides replaced source rows, and optionally opens operation history.

This keeps ffmpeg output generation separate from the later user-confirmed source/output replacement workflow.

## Operation History

Operation history is read through `operationHistoryClient` and owned by `useOperationHistory`. File operations and replacement execution can call `openOperationHistory` after completion when settings request a history preview.

History is not owned by individual result dialogs. Result dialogs receive reveal callbacks and result data from the controller, while `OperationHistoryDialog` handles recent-record loading and record selection.

## App Commands and Escape-Key Behavior

`useAppCommands` subscribes to app commands through `appClient.subscribeToAppCommands`.

Supported command behavior includes:

- open folder-tree source selection
- choose files
- open settings
- refresh audit
- cancel active work

Escape-key handling follows the same cancel/close priority as the app-level cancel command. It cancels active long-running work first, then closes active dialogs/results in a defined order.

## Future File Availability Validation Integration

A future missing-file or file-availability check should be added without changing the renderer/main boundary.

Likely integration points:

- main process validates files and returns typed availability/status results through preload and renderer API clients.
- results store merges availability/status into row metadata if the field belongs to the results workspace.
- selectors derive capabilities, disabled reasons, and row eligibility from row data.
- `usePathReveal` or `fileOperationsClient.validateKnownPaths`: reuse the existing validated-path boundary instead of adding renderer filesystem access.
- `VideoResultsTable`: renders missing-file status, warnings, filters, or action disabled reasons from row state.

Do not implement file-availability validation as renderer filesystem checks. The renderer should call typed preload APIs, and the main process should own any real filesystem validation.
