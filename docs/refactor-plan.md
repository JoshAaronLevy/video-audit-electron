# Collie Video Renderer Refactor Plan

## Context & Problem

This repository is `collie-video`, a private standalone macOS Electron app for auditing and managing local video libraries.

The app uses:

- Electron
- electron-vite
- React
- TypeScript
- PrimeReact
- PrimeFlex
- PrimeIcons
- IndexedDB for persisted audit results
- JSON-backed settings in Electron user data
- a typed preload API exposed to the renderer as `window.videoAudit`
- IPC between renderer and the Electron main process
- local ffmpeg/ffprobe execution in the Electron main process

Important architecture constraints:

- Keep workflows local and desktop-first.
- Renderer code should stay behind the typed preload API.
- Filesystem access, ffmpeg jobs, settings persistence, diagnostics, and OS integrations belong in the Electron main process.
- Do not introduce an internal HTTP server or SSE.
- Do not bypass `window.videoAudit`.
- Do not weaken Electron security settings.
- Do not move filesystem/ffmpeg responsibilities into the renderer.

The app currently works, but `src/renderer/hooks/useVideoAuditAppController.ts` has grown too large and owns too many responsibilities.

It currently appears to coordinate many unrelated workflows, including:

- app bootstrap
- app info loading
- settings loading/saving/reset
- diagnostics
- source selection
- folder tree selection state
- selected files/folders/output folder
- audit options
- audit execution
- audit progress subscription
- discovery workflow
- ffprobe metadata workflow
- IndexedDB audit-result persistence
- result rows
- result filtering
- removed/restored rows
- selected rows
- action capability flags
- path reveal/validation
- Auto-Fix workflow
- Auto-Crop workflow
- thumbnail generation
- fresh preview frames
- preview clip generation
- migration scan/execute workflow
- trash/move/archive file-operation plans and execution
- post-conversion replacement workflow
- operation history
- Premiere bridge status/import workflow
- global active-action state
- app menu commands
- Escape-key cancellation/close behavior
- full cache/data clearing
- many pure helper functions

The purpose of this refactor is to make the renderer code easier to understand, safer to modify, and better prepared for future file-management/file-availability workflows.

The success metric is not merely reducing line count.

The real goal is:

```txt
Can each workflow be understood without loading the entire app into your head?
```

## Clarification Rule

For any stage I ask you to implement:

If anything about that specific stage is confusing, ambiguous, risky, or under-specified, stop before making code changes.

Do not make partial code changes.

Do not guess.

Ask me the specific clarification questions you need answered.

Once I answer and the ambiguity is resolved, then proceed with the code changes for that stage.

This rule applies to every stage in this refactor.

## Global Non-Goals

* Do not redesign the UI.
* Do not change user-facing behavior unless absolutely required to preserve existing behavior.
* Do not introduce Redux, MobX, XState, or Zustand during this refactor.
* Do not rewrite the Electron main process.
* Do not rewrite the preload API unless a clear bug or hard boundary issue requires it.
* Do not move filesystem access into the renderer.
* Do not move ffmpeg/ffprobe work into the renderer.
* Do not add a server, HTTP API, or SSE.
* Do not add tests.
* Do not introduce broad formatting-only changes.
* Do not rename domain concepts just to make them shorter.
* Do not create generic dumping-ground files like `utils.ts`.
* Do not split one God hook into several smaller God hooks.
* Do not refactor every component at once.
* Do not implement new file-availability validation yet.
* Do not implement new missing-file removal/dismissal workflows yet.

## Global Refactor Principles

* Preserve behavior.
* Prefer small safe stages.
* Prefer explicit names over clever abstractions.
* Prefer focused hooks/helpers over a new state-management framework.
* Keep renderer API clients thin.
* Keep side effects near the workflow that owns them.
* Keep result-row mutation centralized.
* Keep selected-row state separate from workflow execution.
* Keep UI components mostly presentational where practical.
* Avoid circular dependencies.
* Avoid premature abstractions.
* Avoid broad component prop reshaping until the controller internals are stable.
* Run `npm run typecheck` after meaningful stages.
* Run `npm run build` after larger stages or before considering the refactor complete.

## Important Implementation Strategy

For most of the refactor, preserve the public return shape of `useVideoAuditAppController`.

`App.tsx` and many components currently consume a large flat controller object. Do not churn all component props at the same time as extracting logic.

The preferred approach is:

1. Extract helpers.
2. Extract API clients.
3. Extract focused hooks.
4. Keep `useVideoAuditAppController` as a compatibility/composition adapter.
5. Only after the internals are stable, optionally group props or simplify `App.tsx`.

The final `useVideoAuditAppController` should mostly compose focused hooks and return the shape expected by existing components.

---

# Target Renderer Structure

This is the intended direction. Do not force this exact structure if the existing repository has a cleaner local convention, but stay close to these boundaries.

```txt
src/renderer/
├─ app/
│  ├─ useAppCommands.ts
│  └─ useAppChromeState.ts
│
├─ api/
│  ├─ appClient.ts
│  ├─ auditClient.ts
│  ├─ autoCropClient.ts
│  ├─ autoFixClient.ts
│  ├─ diagnosticsClient.ts
│  ├─ dialogClient.ts
│  ├─ discoveryClient.ts
│  ├─ ffprobeClient.ts
│  ├─ fileOperationsClient.ts
│  ├─ folderTreeClient.ts
│  ├─ mediaPreviewClient.ts
│  ├─ migrationClient.ts
│  ├─ operationHistoryClient.ts
│  ├─ premiereClient.ts
│  ├─ replacementClient.ts
│  └─ settingsClient.ts
│
├─ hooks/
│  ├─ useVideoAuditAppController.ts
│  ├─ useAppBootstrap.ts
│  ├─ useSettingsController.ts
│  ├─ useDiagnosticsWorkflow.ts
│  ├─ useSourceSelection.ts
│  ├─ usePathReveal.ts
│  ├─ useAuditResults.ts
│  ├─ useResultFilters.ts
│  ├─ useSelectionState.ts
│  ├─ useWorkflowBusyState.ts
│  ├─ useAuditWorkflow.ts
│  ├─ useDiscoveryWorkflow.ts
│  ├─ useFfprobeWorkflow.ts
│  ├─ useMediaPreviewWorkflow.ts
│  ├─ useAutoFixWorkflow.ts
│  ├─ useAutoCropWorkflow.ts
│  ├─ usePostConversionWorkflow.ts
│  ├─ useFileOperationsWorkflow.ts
│  ├─ useOperationHistory.ts
│  ├─ useMigrationWorkflow.ts
│  ├─ usePremiereBridge.ts
│  └─ useClearAuditDataWorkflow.ts
│
├─ helpers/
│  ├─ auditOptions.ts
│  ├─ errors.ts
│  ├─ fileOperationItems.ts
│  ├─ folderTreeSource.ts
│  ├─ formatting.ts
│  ├─ knownDirectories.ts
│  ├─ mediaPreviewRows.ts
│  ├─ premiereRows.ts
│  ├─ progress.ts
│  ├─ recentPaths.ts
│  ├─ replacementPlan.ts
│  ├─ resultFilters.ts
│  ├─ videoRows.ts
│  └─ workflowCapabilities.ts
│
├─ storage/
│  └─ auditResultStorage.ts
│
└─ components/
   └─ ...
```

---

# Stage 0 — Create Current Renderer Responsibility Map

## Goal

Create a current-state map of the renderer responsibilities before moving code.

This stage is primarily analysis and documentation.

## Files to inspect

Inspect at least:

```txt
src/renderer/hooks/useVideoAuditAppController.ts
src/renderer/App.tsx
src/renderer/storage/auditResultStorage.ts
src/preload/videoAuditApi.ts
src/renderer/components/
src/renderer/components/source/
src/shared/types/
```

## Create

```txt
docs/refactor-map.md
```

## Document

Document the current responsibilities in `useVideoAuditAppController.ts`, grouped by workflow/domain.

Include at least these sections:

```md
# Renderer Refactor Map

## Current Controller Responsibilities

## State Variables by Workflow

## Event Handlers by Workflow

## Effects and Subscriptions

## Direct Preload/API Calls

## Pure Helper Functions Currently Inside the Controller

## Cross-Workflow Dependencies

## Recommended Extraction Order

## Risks and Regression-Prone Areas
```

## Responsibility groups to map

```txt
app bootstrap
app info
settings
diagnostics
source selection
folder tree source state
selected files
selected folders
output folder
audit options
audit execution
audit progress
discovery
ffprobe metadata
result persistence
result rows
result filtering
removed/restored rows
row selection
capability flags
path reveal/validation
Auto-Fix
Auto-Crop
thumbnail generation
fresh preview frames
preview clip generation
migration scan/execute
trash file operation
move file operation
archive file operation
post-conversion replacement
operation history
Premiere bridge
active-action/busy state
app menu commands
Escape-key handling
cache/data clearing
```

## Cross-workflow dependencies to call out explicitly

```txt
applyAuditResult
persistCurrentResult
hideVideoPathsFromTable
remove/restore row behavior
media-preview row merging
preview-clip row merging
post-conversion plan creation after Auto-Fix/Auto-Crop
replacement execution hiding original rows
file operations hiding source rows
Premiere import hiding selected rows
operation history opening after file/replacement operations
activeAction controlling many unrelated busy states
Escape-key behavior spanning many workflows
clearAuditData resetting almost every workflow
```

## Acceptance Criteria

* `docs/refactor-map.md` exists.
* The map reflects the current codebase, not assumptions.
* No behavior changes are introduced.
* No broad code movement is done in this stage.
* Any confusing or ambiguous ownership boundaries are listed as questions instead of guessed.

---

# Stage 1 — Extract Pure Helpers

## Goal

Move pure helper functions out of `useVideoAuditAppController.ts` into focused helper modules.

This stage should not move workflow state or workflow side effects.

## Create helper modules as needed

Suggested files:

```txt
src/renderer/helpers/errors.ts
src/renderer/helpers/progress.ts
src/renderer/helpers/recentPaths.ts
src/renderer/helpers/formatting.ts
src/renderer/helpers/auditOptions.ts
src/renderer/helpers/folderTreeSource.ts
src/renderer/helpers/resultFilters.ts
src/renderer/helpers/mediaPreviewRows.ts
src/renderer/helpers/fileOperationItems.ts
src/renderer/helpers/knownDirectories.ts
src/renderer/helpers/premiereRows.ts
src/renderer/helpers/replacementPlan.ts
```

## Candidate helper moves

Move pure helper functions such as:

```txt
getErrorMessage
getProgressPercent
mergeRecentPaths
formatDateTime
settingsToAuditOptions
getPersistedFolderTreeSourcePaths
createPersistedFolderTreeSource
getResultsViewCounts
matchesResultsViewFilter
isFlaggedRow
hasCropIssue
hasRowError
mergeMediaPreviewItems
mergePreviewClipItems
mergePreviewFrames
getPreviewFrameKey
toKnownFileOperationItem
getKnownDirectories
toPremiereRequestVideo
hasSuccessfulConversionOutputs
getReplacementBulkActionUpdates
getReplacementBulkActionMessage
getExecutableReplacementItemCount
requiresReplacementConfirmation
getReplacementConfirmationThresholds
getExecutableReplacementItems
isExternalVolumePath
```

## Rules

* Keep behavior identical.
* Keep function names explicit.
* Do not create a generic `utils.ts`.
* Do not move stateful logic.
* Do not move effects/subscriptions.
* Do not write tests.

## Acceptance Criteria

* `useVideoAuditAppController.ts` no longer contains large groups of pure helper functions.
* Helper files are cohesive and domain-specific.
* `npm run typecheck` passes.

---

# Stage 2 — Extract Thin Renderer API Clients

## Goal

Move direct `window.videoAudit.*` calls from renderer workflow code into thin renderer API client modules.

The preload API should remain the boundary. These clients are not new business-logic services; they are thin wrappers.

## Create API client modules

Create modules under:

```txt
src/renderer/api/
```

Suggested files:

```txt
appClient.ts
diagnosticsClient.ts
dialogClient.ts
settingsClient.ts
auditClient.ts
discoveryClient.ts
ffprobeClient.ts
autoFixClient.ts
autoCropClient.ts
mediaPreviewClient.ts
migrationClient.ts
fileOperationsClient.ts
operationHistoryClient.ts
replacementClient.ts
premiereClient.ts
folderTreeClient.ts
```

## Client rules

Each client should:

* expose named functions
* call the typed preload API
* avoid owning React state
* avoid UI messages
* avoid dialogs/toasts
* avoid business logic
* avoid broad response transformations

Example pattern:

```ts
import type { AuditRequest } from '../../shared/types/audit';

export function startAudit(request: AuditRequest) {
  return window.videoAudit.audit.start(request);
}

export function cancelAudit(jobId: string) {
  return window.videoAudit.audit.cancel(jobId);
}

export function subscribeToAuditProgress(
  callback: Parameters<typeof window.videoAudit.audit.onProgress>[0]
) {
  return window.videoAudit.audit.onProgress(callback);
}
```

## Acceptance Criteria

* Direct `window.videoAudit.*` usage in `useVideoAuditAppController.ts` is significantly reduced.
* Preload/main APIs are not changed.
* Clients are thin and boring.
* `npm run typecheck` passes.

---

# Stage 3 — Extract Audit Result State and Persistence

## Goal

Extract audit result rows, row persistence, row visibility, and stored audit result behavior into a focused hook.

This stage should happen before extracting workflows that mutate rows.

## Create

```txt
src/renderer/hooks/useAuditResults.ts
```

## Owns

```txt
auditResult
auditSummary
auditErrors
videoRows
visibleVideoRows
removedVideoCount
storageMessage
storageSavedAt
isStorageLoading
lastAuditRequest
showThumbnails
load stored audit result
applyAuditResult
persistCurrentResult
hideVideoPathsFromTable
restoreRemovedVideos
setShowThumbnails
mergeMediaPreviewResult
mergePreviewClipResult
reset result state
```

## Should use

```txt
src/renderer/storage/auditResultStorage.ts
src/renderer/helpers/mediaPreviewRows.ts
```

## Should not own

```txt
selectedVideos
globalFilter
resultsViewFilter
workflow execution
Auto-Fix execution
Auto-Crop execution
file-operation planning
Premiere import
```

## Important behavior to preserve

* Stored audit result restores on app load.
* Rows default to `visible: true` unless explicitly hidden.
* Persisted rows retain thumbnail/preview metadata.
* Hidden rows remain in persisted audit result but are excluded from visible rows.
* Restoring removed rows sets rows visible again.
* Media-preview and preview-clip results merge into rows and persist.
* Selected rows must be cleared or updated through callbacks supplied by the composition layer.

## Acceptance Criteria

* Stored audit restoration still works.
* Row hide/remove behavior still works.
* Restore removed rows still works.
* Thumbnail and preview-clip row merges still persist.
* No workflow execution logic is introduced into this hook.
* `npm run typecheck` passes.

---

# Stage 4 — Extract Result Filtering

## Goal

Extract result filtering/search/view state into a focused hook.

## Create

```txt
src/renderer/hooks/useResultFilters.ts
```

## Owns

```txt
globalFilter
resultsViewFilter
resultsViewCounts
filteredVideoRows
setGlobalFilter
setResultsViewFilter
```

## Should use

```txt
src/renderer/helpers/resultFilters.ts
```

## Important

Do not accidentally duplicate PrimeReact table global filtering if `globalFilter` is only passed down to the table.

Preserve the current behavior.

## Acceptance Criteria

* Results toolbar counts match current behavior.
* View filters still work:

  * all
  * flagged
  * low-res
  * aspect
  * crop
  * errors
* Search/global filter behavior remains unchanged.
* `npm run typecheck` passes.

---

# Stage 5 — Extract Selection State and Busy/Capability Logic

## Goal

Separate row selection from workflow execution and centralize repetitive busy/capability logic.

## Create

```txt
src/renderer/hooks/useSelectionState.ts
src/renderer/hooks/useWorkflowBusyState.ts
src/renderer/helpers/workflowCapabilities.ts
```

## `useSelectionState` owns

```txt
selectedVideos
setSelectedVideos
clearSelectedVideos
selectedVideoCount
selectedPaths
```

## `useWorkflowBusyState` derives

```txt
isAuditActive
isDiscoveryActive
isFfprobeActive
isAutoFixActive
isAutoCropActive
isMediaPreviewActive
isPreviewClipActive
isMigrationScanning
isMigrationExecuting
isMigrationActive
isTrashPlanning
isTrashExecuting
isMovePlanning
isMoveExecuting
isArchivePlanning
isArchiveExecuting
isReplacementPlanning
isReplacementActionUpdating
isReplacementExecuting
isOperationHistoryLoading
isPremiereImportActive
isAnyBlockingWorkflowActive
```

## `workflowCapabilities.ts` should centralize

```txt
canRunAudit
canRefreshAudit
canAutoFixSelected
canOpenCropOptions
canGenerateThumbnails
canMoveSelectedToTrash
canMoveSelectedToFolder
canArchiveSelectedOriginals
canStartMigration
canEditSelectedInPremiere
```

## Rules

* Do not execute workflows from selection or capability helpers.
* Do not duplicate the long “not active && not active && not active” checks everywhere.
* Keep these helpers deterministic and easy to read.

## Acceptance Criteria

* Row selection still works.
* Selection clears appropriately when rows are hidden/removed/reset.
* Capability flags match existing behavior.
* Selection action bar buttons remain enabled/disabled exactly as before.
* `npm run typecheck` passes.

---

# Stage 6 — Extract App Bootstrap, Settings, and Diagnostics

## Goal

Move app info loading, settings management, and tool diagnostics out of the main controller.

## Create

```txt
src/renderer/hooks/useAppBootstrap.ts
src/renderer/hooks/useSettingsController.ts
src/renderer/hooks/useDiagnosticsWorkflow.ts
```

## `useAppBootstrap` owns

```txt
appInfo
appInfoMessage
initial app info load
```

## `useSettingsController` owns

```txt
settings
settingsMessage
load settings
persistSettings
updateSettingsField
resetSettings
```

## `useDiagnosticsWorkflow` owns

```txt
toolDiagnostics
toolDiagnosticsError
isToolDiagnosticsLoading
runToolDiagnostics
```

## Important reset rule

Settings reset currently affects more than settings. It also resets source/output/audit-option state.

Do not let `useSettingsController` directly own unrelated source/result workflow state.

Instead, expose callbacks or return the reset settings so the composition layer can reset related hooks intentionally.

## Acceptance Criteria

* Settings load on startup.
* Settings save works.
* Settings reset behaves the same as before.
* Diagnostics still run.
* Settings and diagnostics dialogs receive the same data as before.
* `npm run typecheck` passes.

---

# Stage 7 — Extract Source Selection

## Goal

Move source selection state and handlers into a focused hook.

## Create

```txt
src/renderer/hooks/useSourceSelection.ts
```

## Owns

```txt
selectedFolders
selectedFolderSummary
folderTreeRootPath
folderTreeLastScannedAt
selectedFiles
outputFolder
selectionMessage
folderTreeOpenRequestCount
chooseFolders
chooseFiles
chooseOutputFolder
chooseRecentFolder
clearSelectedSources
applyFolderTreeSelection
```

## Inputs

```txt
settings
auditOptions.includeSubfolders
persistSettings
setWorkflowMessage
setActiveAction
```

## Should use

```txt
dialogClient
settingsClient through persistSettings callback
helpers/recentPaths.ts
helpers/folderTreeSource.ts
dedupeOverlappingFolderPaths
```

## Should not own

```txt
audit execution
discovery execution
ffprobe execution
result rows
selected result rows
file operations
Premiere behavior
```

## Acceptance Criteria

* Choosing folders works.
* Folder tree selector behavior works.
* Multiple folder selection behavior works.
* Choosing files works.
* Choosing output folder works.
* Recent folders/files persist.
* Clearing selected sources behaves as before.
* Source config dialog behavior is unchanged.
* `npm run typecheck` passes.

---

# Stage 8 — Extract Path Reveal Workflow

## Goal

Move path reveal and known-file reveal behavior into a focused hook.

## Create

```txt
src/renderer/hooks/usePathReveal.ts
```

## Owns

```txt
revealPath
revealKnownFile
revealKnownFolder
```

## Inputs

```txt
setSelectionMessage
setActiveAction
```

## Should use

```txt
fileOperationsClient.validateKnownPaths
fileOperationsClient.revealFile
fileOperationsClient.revealFolder
```

## Acceptance Criteria

* Revealing a generic path still validates path kind before opening Finder.
* Revealing known files works.
* Revealing known folders works.
* Error messages are still visible where expected.
* `npm run typecheck` passes.

---

# Stage 9 — Extract Audit, Discovery, and FFprobe Workflows

## Goal

Move audit/discovery/ffprobe lifecycle state, progress subscriptions, start/cancel handlers, and completion handling into focused hooks.

## Create

```txt
src/renderer/hooks/useAuditWorkflow.ts
src/renderer/hooks/useDiscoveryWorkflow.ts
src/renderer/hooks/useFfprobeWorkflow.ts
```

## `useAuditWorkflow` owns

```txt
auditJobId
auditProgress
auditPercent
pendingAuditRequestRef
runAudit
refreshAudit
cancelAudit
audit progress subscription
```

## `useAuditWorkflow` inputs

```txt
selectedFolders
selectedFiles
auditOptions
lastAuditRequest
applyAuditResult
setSelectedFolders or source callback for refresh
setSelectedFiles or source callback for refresh
setAuditOptions
setWorkflowMessage
setActiveAction
```

## `useDiscoveryWorkflow` owns

```txt
discoveryJobId
discoveryProgress
discoveryPercent
discoveredPaths
startDiscovery
cancelDiscovery
discovery progress subscription
```

## `useFfprobeWorkflow` owns

```txt
ffprobeJobId
ffprobeProgress
ffprobePercent
metadataItems
startFfprobe
cancelFfprobe
ffprobe progress subscription
```

## Important behavior to preserve

* Audit start validation.
* Audit option validation.
* Audit progress messages.
* Audit completion applies and persists result.
* Audit cancel behavior.
* Refresh audit uses the previous request.
* Discovery utility workflow still works.
* FFprobe utility workflow still works.
* Progress subscriptions clean up on unmount.
* No duplicate progress listeners.

## Acceptance Criteria

* Audit starts/progresses/completes/fails/cancels as before.
* Results populate and persist after audit completion.
* Refresh audit works.
* Discovery starts/cancels as before.
* FFprobe starts/cancels as before.
* Utility panel still receives the same data.
* `npm run typecheck` passes.

---

# Stage 10 — Extract Operation History

## Goal

Move operation history state and handlers into a focused hook.

## Create

```txt
src/renderer/hooks/useOperationHistory.ts
```

## Owns

```txt
operationHistoryRecords
selectedOperationHistoryRecord
operationHistoryError
isOperationHistoryVisible
isOperationHistoryLoading
openOperationHistory
closeOperationHistory
refreshOperationHistory
selectOperationHistoryRecord
```

## Inputs

```txt
setActiveAction
```

## Should use

```txt
operationHistoryClient
```

## Acceptance Criteria

* Operation history dialog opens.
* Recent records load.
* Refresh works.
* Selecting a record loads details.
* Errors display as before.
* `npm run typecheck` passes.

---

# Stage 11 — Extract Trash/Move/Archive File Operations

## Goal

Move trash, move, and archive workflow state and handlers into a focused hook.

## Create

```txt
src/renderer/hooks/useFileOperationsWorkflow.ts
```

## Owns

```txt
trashPlan
trashPlanError
trashResult
trashResultError
isTrashConfirmDialogVisible
isTrashResultDialogVisible
openTrashDialog
closeTrashDialog
executeTrashPlan
closeTrashResultDialog

movePlan
movePlanError
moveResult
moveResultError
isMoveConfirmDialogVisible
isMoveResultDialogVisible
openMoveDialog
closeMoveDialog
executeMovePlan
closeMoveResultDialog

archivePlan
archivePlanError
archiveResult
archiveResultError
isArchiveConfirmDialogVisible
isArchiveResultDialogVisible
openArchiveDialog
closeArchiveDialog
executeArchivePlan
closeArchiveResultDialog
```

## Inputs

```txt
selectedVideos
selectedFolders
auditedRootDirectory
outputFolder
settings.fileManagementConflictStrategy
settings.previewOperationHistoryAfterExecution
hideVideoPathsFromTable
openOperationHistory
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
fileOperationsClient
dialogClient
helpers/fileOperationItems.ts
helpers/knownDirectories.ts
```

## Should not own

```txt
post-conversion replacement
Auto-Fix
Auto-Crop
operation history state itself
```

## Important behavior to preserve

* Trash creates a plan before execution.
* Move asks for a destination folder before plan creation.
* Archive creates a plan before execution.
* Successful operations hide affected source rows from the table.
* Hidden rows are persisted.
* Result dialogs open after execution.
* Operation history opens after closing result dialog when the setting enables it.

## Acceptance Criteria

* Move to Trash works.
* Move to folder works.
* Archive originals works.
* Confirm/result dialogs behave as before.
* Successful source rows are hidden and persisted.
* Operation history preview behavior remains unchanged.
* `npm run typecheck` passes.

---

# Stage 12 — Extract Post-Conversion Replacement Workflow

## Goal

Move post-conversion replacement planning, review, execution, progress, and result behavior into a focused hook.

This workflow is distinct from generic file operations and should not be merged into the trash/move/archive hook.

## Create

```txt
src/renderer/hooks/usePostConversionWorkflow.ts
```

## Owns

```txt
postConversionPlan
postConversionSourceLabel
postConversionMode
postConversionError
postConversionMessage
isPostConversionDialogVisible
replacementJobId
replacementProgress
replacementPercent
replacementResult
replacementResultError
isReplacementResultDialogVisible

createPostConversionPlan
changePostConversionPlanAction
applyPostConversionPlanBulkAction
replacePostConversionOriginals
reviewPostConversionPlan
leavePostConversionOutputs
backToPostConversionChoices
closePostConversionDialog
cancelReplacementExecution
closeReplacementResultDialog
replacement progress subscription
```

## Inputs

```txt
settings
hideVideoPathsFromTable
openOperationHistory
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
replacementClient
helpers/replacementPlan.ts
helpers/progress.ts
```

## Important behavior to preserve

* Auto-Fix and Auto-Crop can call `createPostConversionPlan`.
* Settings determine whether the post-conversion dialog appears automatically.
* Manual review mode still works.
* Bulk replacement actions still work.
* Typed `REPLACE` confirmation still works.
* Replacement execution progress still works.
* Replacement completion hides replaced original rows.
* Replacement result dialog opens.
* Operation history preview works when enabled.

## Acceptance Criteria

* Post-conversion dialog behavior is unchanged.
* Replacement plan action updates work.
* Bulk action updates work.
* Replacement execution works.
* Replacement cancellation works.
* Replacement results display correctly.
* Replaced originals are hidden from the table and persisted.
* `npm run typecheck` passes.

---

# Stage 13 — Extract Auto-Fix and Auto-Crop Workflows

## Goal

Move Auto-Fix and Auto-Crop dialog/progress/result/execution logic into focused hooks.

## Create

```txt
src/renderer/hooks/useAutoFixWorkflow.ts
src/renderer/hooks/useAutoCropWorkflow.ts
```

## `useAutoFixWorkflow` owns

```txt
autoFixJobId
autoFixProgress
autoFixPercent
autoFixResult
autoFixError
isAutoFixDialogVisible
openAutoFixDialog
closeAutoFixDialog
startAutoFix
cancelAutoFix
auto-fix progress subscription
```

## `useAutoCropWorkflow` owns

```txt
autoCropJobId
autoCropProgress
autoCropPercent
autoCropResult
autoCropError
isAutoCropDialogVisible
openAutoCropDialog
closeAutoCropDialog
startAutoCrop
cancelAutoCrop
auto-crop progress subscription
```

## Inputs

```txt
selectedVideos
autoFixOutputDirectory
autoCropOutputRootDir
hideVideoPathsFromTable
createPostConversionPlan
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
autoFixClient
autoCropClient
helpers/progress.ts
```

## Important behavior to preserve

* Auto-Fix requires selected videos.
* Auto-Fix requires output directory.
* Auto-Crop requires selected videos.
* Auto-Crop requires output root directory.
* Auto-Fix successful source rows are hidden from the table.
* Auto-Fix and Auto-Crop completion can trigger post-conversion replacement flow.
* Progress/cancel/error behavior remains unchanged.
* Dialogs cannot close while active.

## Acceptance Criteria

* Auto-Fix works.
* Auto-Fix cancel works.
* Auto-Fix errors display.
* Auto-Crop works.
* Auto-Crop cancel works.
* Auto-Crop errors display.
* Post-conversion behavior still triggers correctly.
* `npm run typecheck` passes.

---

# Stage 14 — Extract Media Preview Workflow

## Goal

Move thumbnail generation, fresh preview frame generation, and preview clip generation into a focused hook.

## Create

```txt
src/renderer/hooks/useMediaPreviewWorkflow.ts
```

## Owns

```txt
mediaPreviewJobId
mediaPreviewProgress
mediaPreviewPercent
mediaPreviewResult
mediaPreviewError
mediaPreviewScope
isThumbnailDialogVisible

previewClipJobId
previewClipProgress
previewClipPercent
previewClipResult
previewClipError

previewFrameFetchPath
previewFrameError

openThumbnailDialog
closeThumbnailDialog
setMediaPreviewScope
startThumbnailGeneration
cancelThumbnailGeneration
clearPreviewFrameError
getFreshThumbnailsForVideo
startPreviewClipGeneration
cancelPreviewClipGeneration

mediaPreview progress subscription
previewClip progress subscription
```

## Inputs

```txt
visibleVideoRows
selectedVideos
settings.previewClipDurationSecondsDefault
settings.previewClipWidthDefault
mergeMediaPreviewResult
mergePreviewClipResult
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
mediaPreviewClient
helpers/progress.ts
```

## Important behavior to preserve

* Thumbnail dialog defaults to selected scope when rows are selected.
* Thumbnail generation can run for selected or all visible rows.
* Thumbnail progress/result/error behavior remains unchanged.
* Fresh preview frames merge into the correct video row.
* Preview clip generation uses settings defaults for duration and width.
* Preview clip results merge into rows and persist.

## Acceptance Criteria

* Thumbnail generation works.
* Thumbnail cancellation works.
* Fresh thumbnail/frame generation works.
* Preview clip generation works.
* Preview clip cancellation works.
* Generated thumbnails/previews still display.
* Generated thumbnails/previews still persist.
* `npm run typecheck` passes.

---

# Stage 15 — Extract Migration Workflow

## Goal

Move migration scan/execute state and handlers into a focused hook.

## Create

```txt
src/renderer/hooks/useMigrationWorkflow.ts
```

## Owns

```txt
migrationNewEditedDir
migrationScan
migrationScanError
migrationJobId
migrationProgress
migrationPercent
migrationResult
migrationResultError
isMigrationScanDialogVisible
isMigrationResultDialogVisible
setMigrationNewEditedDir
openMigrationDialog
closeMigrationDialog
selectMigrationFolder
startMigrationScan
executeMigration
closeMigrationResultDialog
migration progress subscription
```

## Inputs

```txt
auditedRootDirectory
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
migrationClient
dialogClient
helpers/progress.ts
```

## Important behavior to preserve

* Migration requires a single audited root directory.
* Migration requires a new edited folder.
* Folder selection works.
* Scan result displays before execution.
* Execute progress/result behavior remains unchanged.
* Result dialog behavior remains unchanged.

## Acceptance Criteria

* Migration dialog opens only when valid.
* Migration scan works.
* Migration execute works.
* Migration progress/result displays.
* Migration errors display.
* `npm run typecheck` passes.

---

# Stage 16 — Extract Premiere Bridge Workflow

## Goal

Move Premiere bridge status, launch, and import-request behavior into a focused hook.

## Create

```txt
src/renderer/hooks/usePremiereBridge.ts
```

## Owns

```txt
premiereStatus
premiereStatusError
premiereLaunchMessage
isPremiereStatusLoading
isPremiereImportSubmitting
premiereImportResult
premiereImportError
refreshPremiereStatus
openPremiereBridgeApps
editSelectedInPremiere
initial Premiere status check
```

## Inputs

```txt
selectedVideos
hideVideoPathsFromTable
setWorkflowMessage
setActiveAction
busy state
```

## Should use

```txt
premiereClient
helpers/premiereRows.ts
```

## Important behavior to preserve

* Premiere status loads on app startup.
* Status refresh works.
* Opening bridge apps works.
* Import requires selected videos.
* Import requires bridge ready status.
* Successful import hides imported rows from the table.
* Status is refreshed after launch/import.

## Acceptance Criteria

* Premiere status strip behavior remains unchanged.
* Retry/status refresh works.
* Open bridge apps works.
* Edit selected in Premiere works.
* Import result/error behavior remains unchanged.
* `npm run typecheck` passes.

---

# Stage 17 — Extract App Commands and Escape Handling

## Goal

Move app menu command handling and Escape-key close/cancel behavior into a focused orchestration hook.

## Create

```txt
src/renderer/app/useAppCommands.ts
```

## Owns

```txt
window.videoAudit.app.onCommand subscription
Escape key listener
cancelActiveWork orchestration
settingsOpenRequestCount if command-driven settings opening stays controller-owned
folderTreeOpenRequestCount if command-driven folder opening stays controller-owned
```

## Inputs

This hook may need callbacks from many workflows, including:

```txt
chooseFiles
refreshAudit
cancelAudit
cancelAutoFix
cancelAutoCrop
cancelThumbnailGeneration
cancelPreviewClipGeneration
cancelReplacementExecution
closeMigrationDialog
closeMigrationResultDialog
closeReplacementResultDialog
closeOperationHistory
closeTrashDialog
closeTrashResultDialog
closeMoveDialog
closeMoveResultDialog
closeArchiveDialog
closeArchiveResultDialog
closePostConversionDialog
closeThumbnailDialog
closeAutoCropDialog
closeAutoFixDialog
```

## Important

This is intentionally an orchestration hook. It is allowed to know about many workflows because app-level commands and Escape-key behavior cross workflow boundaries.

Preserve the current priority order for closing/canceling active work.

## Acceptance Criteria

* Menu command for choose folder still opens the folder tree/source flow.
* Menu command for choose files still works.
* Menu command for refresh audit still works.
* Menu command for open settings still works.
* Menu command for cancel active still works.
* Escape key behavior remains unchanged.
* No duplicate keyboard listeners.
* `npm run typecheck` passes.

---

# Stage 18 — Extract Clear Audit Data Workflow

## Goal

Move full data/cache clearing behavior into a focused orchestration hook.

## Create

```txt
src/renderer/hooks/useClearAuditDataWorkflow.ts
```

## Owns

```txt
clearAuditData
clear-cache active action coordination
cache-clearing storage messages
```

## Inputs

This hook should coordinate reset callbacks from extracted hooks, including:

```txt
results
sources
audit
discovery
ffprobe
autoFix
autoCrop
mediaPreview
migration
fileOperations
postConversion
premiere
settings
selection
filters
```

## Important behavior to preserve

* Existing scan metadata is saved to history before clearing when possible.
* Media preview cache is cleared.
* Stored audit result is cleared from IndexedDB.
* Relevant settings fields are reset.
* Source selections reset.
* Result rows reset.
* Selected rows reset.
* Filters reset.
* Workflow progress/results/errors reset.
* Dialogs close.
* Post-conversion/replacement state resets.
* Premiere import result/error resets.
* Storage message reports success/failure the same way as before.

## Acceptance Criteria

* Clear data/cache behavior remains unchanged.
* Stored audit result is removed.
* Preview cache is cleared.
* Scan history metadata is saved when possible.
* All workflow state resets.
* `npm run typecheck` passes.

---

# Stage 19 — Slim `useVideoAuditAppController`

## Goal

Turn `useVideoAuditAppController.ts` into a composition adapter.

By this stage, most state and workflow-specific behavior should live in focused hooks.

## Requirements

The controller should primarily:

* compose focused hooks
* wire cross-workflow dependencies
* expose the same public controller shape expected by `App.tsx`
* contain minimal business logic
* contain minimal direct React state
* contain no large pure helper blocks
* contain no direct preload calls except where intentionally left as a documented exception

## Rules

* Preserve the exported `VideoAuditAppController` shape initially.
* Do not group all component props in the same stage unless the diff is small and obvious.
* Do not introduce context unless there is a clear reason.
* Do not introduce Zustand.
* Avoid circular hook dependencies.

## Target

The file should become substantially smaller and easier to scan.

A rough target is under 500–700 lines, but clarity matters more than hitting a specific line count.

## Acceptance Criteria

* `useVideoAuditAppController.ts` is mostly composition/wiring.
* Major workflows live in focused hooks.
* API calls live behind renderer API clients.
* Result/filter/selection state is separated from execution workflows.
* Long-running job subscriptions are easier to reason about.
* `npm run typecheck` passes.
* `npm run build` passes.

---

# Stage 20 — Optional App Prop Grouping

## Goal

Reduce `App.tsx` prop noise after controller internals are stable.

## Important

This stage is optional and should only be done after the controller refactor is working.

Do not combine this with risky workflow extraction.

## Possible direction

Instead of passing many individual props from a flat controller, components may receive grouped workflow objects where practical.

Example:

```tsx
<AutoFixDialog
  visible={autoFix.isDialogVisible}
  selectedCount={selection.selectedVideos.length}
  outputDirectory={autoFix.outputDirectory}
  progress={autoFix.progress}
  percent={autoFix.percent}
  result={autoFix.result}
  error={autoFix.error}
  isSubmitting={autoFix.isActive}
  onSubmit={autoFix.start}
  onCancel={autoFix.cancel}
  onHide={autoFix.close}
/>
```

## Rules

* Do this gradually.
* Do not redesign components.
* Do not change behavior.
* Do not create deeply nested prop structures just for aesthetics.
* Do not make broad component rewrites.

## Acceptance Criteria

* `App.tsx` is easier to scan.
* Component behavior is unchanged.
* `npm run typecheck` passes.
* `npm run build` passes.

---

# Stage 21 — Documentation and Verification

## Goal

Document the new renderer architecture and provide a manual verification checklist.

## Create/update

```txt
docs/renderer-architecture.md
docs/refactor-verification-checklist.md
```

## `docs/renderer-architecture.md` should document

```txt
renderer API clients
major workflow hooks
what each hook owns
what useVideoAuditAppController still does
where preload/API calls live
where result row state lives
where selected row state lives
where settings state lives
how long-running progress subscriptions are modeled
how audit result persistence works
how row hiding/removal works
how media-preview data merges into rows
how post-conversion replacement integrates with Auto-Fix/Auto-Crop
how operation history is triggered after file/replacement operations
how app commands and Escape-key behavior are orchestrated
where future file-availability validation should plug in
```

## Include section

```md
## Future File Availability Validation Integration
```

Explain that a future missing-file check should likely plug into:

```txt
useAuditResults
useSelectionState
usePathReveal or fileOperationsClient.validateKnownPaths
workflow capability helpers
VideoResultsTable row rendering
```

Do not implement that feature in this refactor.

## Manual verification checklist

Create a checklist covering:

```txt
launch app
restore saved audit from IndexedDB
choose folder through folder tree selector
choose multiple folders
choose files
choose output folder
run audit
cancel audit
refresh audit
clear audit data/cache
search/filter rows
select rows
remove selected rows from table
restore removed rows
generate thumbnails for all rows
generate thumbnails for selected rows
generate fresh thumbnails for one video
generate preview clip
run discovery
cancel discovery
run ffprobe metadata extraction
cancel ffprobe
run Auto-Fix
cancel Auto-Fix
run Auto-Crop
cancel Auto-Crop
trigger post-conversion choices dialog
review replacement plan manually
bulk update replacement actions
execute replacement
cancel replacement
move selected to Trash
move selected to folder
archive selected originals
open operation history
refresh operation history
select operation history record
reveal path from history/result dialogs
open migration dialog
run migration scan
execute migration
refresh Premiere status
open Premiere bridge apps
edit selected in Premiere
open settings
change settings
reset settings
run diagnostics
use Escape key to close/cancel active UI
use menu commands for choose folder/files/settings/refresh/cancel
run npm run typecheck
run npm run build
```

## Acceptance Criteria

* New renderer architecture is documented.
* Manual verification checklist exists.
* Future file-availability integration point is documented.
* `npm run typecheck` passes.
* `npm run build` passes.

---

# Recommended Implementation Sequence

Implement in this order:

```txt
Stage 0   Responsibility map
Stage 1   Pure helper extraction
Stage 2   Thin API clients
Stage 3   Audit result state and persistence
Stage 4   Result filtering
Stage 5   Selection and busy/capability logic
Stage 6   App bootstrap, settings, diagnostics
Stage 7   Source selection
Stage 8   Path reveal
Stage 9   Audit/discovery/ffprobe workflows
Stage 10  Operation history
Stage 11  Trash/move/archive file operations
Stage 12  Post-conversion replacement
Stage 13  Auto-Fix and Auto-Crop
Stage 14  Media preview
Stage 15  Migration
Stage 16  Premiere bridge
Stage 17  App commands and Escape handling
Stage 18  Clear audit data workflow
Stage 19  Slim controller
Stage 20  Optional App prop grouping
Stage 21  Documentation and verification
```

---

# Definition of Done

The refactor is complete when:

* `useVideoAuditAppController.ts` is a composition adapter, not a God hook.
* Major workflows live in focused hooks.
* Direct preload calls are behind thin renderer API clients.
* Result row state and persistence are centralized.
* Filtering is separate from result persistence.
* Selection is separate from workflow execution.
* Busy/capability logic is centralized and readable.
* Auto-Fix, Auto-Crop, media preview, migration, Premiere, file operations, replacement, and operation history each have clear ownership.
* Long-running progress subscriptions are isolated and cleaned up correctly.
* Existing user-facing behavior is preserved.
* Future file-availability validation has an obvious integration path.
* Renderer architecture is documented.
* Manual verification checklist exists.
* `npm run typecheck` passes.
* `npm run build` passes.