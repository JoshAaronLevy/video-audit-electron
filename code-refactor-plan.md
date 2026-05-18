# Code Refactor Plan

## Project Context

This plan starts after the Electron conversion plan and UI improvement plan are complete.

At this point, the app is a standalone private macOS Electron utility with a results-first UI. The app can audit local videos, detect low-resolution/wrong-aspect-ratio videos, analyze black borders, run auto-fix/auto-crop workflows, generate thumbnails/preview clips, interact with the Premiere bridge, persist settings/state, and present a polished UI.

The current implementation works, but some renderer/controller code has grown too large. In particular, `src/renderer/hooks/useVideoAuditAppController.ts` is approximately 2,500 lines long and likely owns too many responsibilities.

This refactor should improve maintainability before adding file-management workflows.

## Primary Goal

Break oversized renderer/controller code into smaller, focused modules without changing app behavior.

The refactor should make future file-management work safer and easier.

## Non-Goals

- Do not redesign the UI.
- Do not change user-facing behavior unless explicitly needed to preserve behavior during the refactor.
- Do not add file-management workflows yet.
- Do not rewrite the Electron main-process services unless a clear renderer boundary problem requires it.
- Do not introduce Redux, Zustand, MobX, XState, or another state library unless there is a strong, documented reason.
- Do not add tests unless explicitly requested.
- Do not make broad formatting-only changes.
- Do not refactor everything at once.
- Do not create abstractions just to reduce line count.

## Refactor Principles

- Preserve behavior.
- Refactor in small safe stages.
- Prefer extracting cohesive hooks/helpers over introducing a heavy framework.
- Keep naming explicit.
- Make state ownership obvious.
- Keep side effects near the workflow they belong to.
- Keep UI components mostly presentational where practical.
- Keep preload/API calls behind focused client modules or hooks.
- Avoid circular dependencies.
- Avoid “utils dumping ground” files.
- Do not merely split one God file into several smaller God files.

## Target Renderer Architecture

Suggested final shape:

```txt
src/renderer/
├─ app/
│  ├─ VideoAuditApp.tsx
│  ├─ AppProviders.tsx
│  └─ appState.ts
│
├─ api/
│  ├─ videoAuditApiClient.ts
│  ├─ auditClient.ts
│  ├─ discoveryClient.ts
│  ├─ metadataClient.ts
│  ├─ autoFixClient.ts
│  ├─ autoCropClient.ts
│  ├─ mediaPreviewClient.ts
│  ├─ premiereClient.ts
│  ├─ migrationClient.ts
│  └─ settingsClient.ts
│
├─ hooks/
│  ├─ useVideoAuditAppController.ts
│  ├─ useAuditWorkflow.ts
│  ├─ useSourceSelection.ts
│  ├─ useResultRows.ts
│  ├─ useResultFilters.ts
│  ├─ useSelectionActions.ts
│  ├─ useSettingsController.ts
│  ├─ usePremiereBridge.ts
│  ├─ useAutoFixWorkflow.ts
│  ├─ useAutoCropWorkflow.ts
│  ├─ useMediaPreviewWorkflow.ts
│  ├─ useMigrationWorkflow.ts
│  ├─ useJobProgress.ts
│  └─ useToastNotifications.ts
│
├─ state/
│  ├─ auditState.ts
│  ├─ sourceState.ts
│  ├─ resultsState.ts
│  ├─ selectionState.ts
│  ├─ settingsState.ts
│  ├─ workflowState.ts
│  └─ reducers/
│
├─ helpers/
│  ├─ videoRows.ts
│  ├─ resultFilters.ts
│  ├─ formatting.ts
│  ├─ paths.ts
│  ├─ progress.ts
│  ├─ errors.ts
│  └─ guards.ts
│
├─ components/
│  └─ ...
│
└─ types/
   └─ ...
```

This is a suggested destination, not a rigid requirement. Prefer the existing project structure when it already has good boundaries.

## Desired Shape of `useVideoAuditAppController`

By the end, `useVideoAuditAppController.ts` should become a composition hook, not a God hook.

Target size guideline:

```txt
useVideoAuditAppController.ts: ideally under 300–500 lines
```

It should mostly compose focused hooks:

```ts
export function useVideoAuditAppController() {
  const sources = useSourceSelection();
  const settings = useSettingsController();
  const audit = useAuditWorkflow({ sources, settings });
  const results = useResultRows({ audit });
  const filters = useResultFilters({ rows: results.rows });
  const selection = useSelectionActions({ rows: filters.visibleRows });
  const autoFix = useAutoFixWorkflow({ selectedRows: selection.selectedRows });
  const autoCrop = useAutoCropWorkflow({ selectedRows: selection.selectedRows });
  const mediaPreview = useMediaPreviewWorkflow({ rows: results.rows });
  const premiere = usePremiereBridge();
  const migration = useMigrationWorkflow({ results });

  return {
    sources,
    settings,
    audit,
    results,
    filters,
    selection,
    autoFix,
    autoCrop,
    mediaPreview,
    premiere,
    migration,
  };
}
```

Do not force this exact object shape if it would create churn. The goal is clearer ownership and fewer unrelated responsibilities in one file.

---

## Stage  1 — Refactor Audit and Responsibility Map

**Intelligence Level: High**

### Goal

Map the current oversized controller and related renderer files before moving code.

This stage should primarily analyze and document. Avoid large code changes.

### Requirements

Inspect:

* `src/renderer/hooks/useVideoAuditAppController.ts`
* app shell/layout components
* source selection components
* results table components
* settings components
* dialogs
* preload API usage
* renderer helper files
* shared types used by renderer workflows

Create:

```txt
docs/refactor-map.md
```

Document:

* current responsibilities in `useVideoAuditAppController`
* state variables grouped by workflow
* event handlers grouped by workflow
* side effects grouped by workflow
* preload/API calls grouped by workflow
* candidate hooks/modules to extract
* risky dependencies between workflows
* recommended extraction order

Suggested responsibility groups:

```txt
source selection
settings
audit/discovery/metadata
result row persistence
result filtering/search/view state
row selection
Premiere bridge
auto-fix
auto-crop
thumbnail generation
preview clip generation
migration
dialogs/modals
toasts/errors
progress streams/subscriptions
```

### Deliverables

* `docs/refactor-map.md`
* minimal code changes only if needed to support future stages

### Acceptance Criteria

* The main controller’s responsibilities are clearly mapped.
* Extraction order is clear.
* No behavior changes are introduced.

---

## Stage  2 — Extract Renderer API Clients

**Intelligence Level: High**

### Goal

Move direct `window.videoAudit.*` preload calls or IPC-facing logic into focused renderer client modules.

This makes workflow hooks easier to extract.

### Requirements

Create renderer API clients under:

```txt
src/renderer/api/
```

Suggested clients:

* `auditClient.ts`
* `discoveryClient.ts`
* `metadataClient.ts`
* `settingsClient.ts`
* `autoFixClient.ts`
* `autoCropClient.ts`
* `mediaPreviewClient.ts`
* `premiereClient.ts`
* `migrationClient.ts`

Each client should:

* expose named functions
* call the typed preload API
* normalize small response details where useful
* avoid owning React state
* avoid UI concerns
* avoid toast/dialog behavior

Example:

```ts
export async function startAudit(request: AuditRequest) {
  return window.videoAudit.audit.start(request);
}
```

### Requirements

* Do not change main/preload APIs unless necessary.
* Do not move business logic into clients.
* Keep clients thin.
* Update existing controller imports/calls to use clients where practical.

### Deliverables

* renderer API client modules
* controller updated to use clients
* no substantial behavior change

### Acceptance Criteria

* Direct preload calls are centralized or significantly reduced.
* API clients are thin and focused.
* App behavior remains the same.

---

## Stage  3 — Extract Source Selection Workflow

**Intelligence Level: High**

### Goal

Move folder/file/output source selection state and handlers out of the main controller.

### Requirements

Create:

```txt
src/renderer/hooks/useSourceSelection.ts
```

or similar.

It should own:

* selected folders
* selected files
* output folder
* source summary
* source configuration dialog state if appropriate
* handlers for choosing folders/files/output
* clearing selected sources
* source validation messages if currently renderer-owned
* include subfolders option if source-related in the current UI

It should not own:

* actual audit execution
* result rows
* auto-fix/crop logic
* Premiere logic
* migration logic

### Deliverables

* `useSourceSelection.ts`
* small helper(s) if needed:

  * `sourceSummary.ts`
  * `sourceValidation.ts`
* main controller updated to consume source workflow hook

### Acceptance Criteria

* Source selection behavior remains unchanged.
* Main controller loses source-specific state/handlers.
* Source selection can be understood independently.

---

## Stage  4 — Extract Audit, Discovery, and Metadata Workflows

**Intelligence Level: Extra High**

### Goal

Extract the core audit/discovery/metadata lifecycle from the main controller.

This is high-risk because it likely touches progress, cancellation, result persistence, table loading states, and error handling.

### Requirements

Create one or more focused hooks:

```txt
src/renderer/hooks/useAuditWorkflow.ts
src/renderer/hooks/useDiscoveryWorkflow.ts
src/renderer/hooks/useMetadataWorkflow.ts
```

If discovery and metadata are not independent user workflows in the final UI, combine carefully.

The audit workflow should own:

* audit active/running state
* audit progress
* start audit
* cancel audit
* audit completion handling
* audit error handling
* interaction with result row loading
* active job identifiers
* cleanup on unmount
* progress subscription lifecycle

It should not own:

* source selection state, except as inputs
* row filtering/search
* selected row action workflows
* settings UI
* Premiere status

### Requirements

* Preserve cancellation behavior.
* Preserve progress behavior.
* Preserve completed result loading/persistence behavior.
* Avoid stale closures.
* Ensure subscriptions/listeners are cleaned up.
* Avoid duplicate progress handlers.

### Deliverables

* `useAuditWorkflow.ts`
* optional `useDiscoveryWorkflow.ts`
* optional `useMetadataWorkflow.ts`
* progress helper extraction if needed
* controller updated to compose these hooks

### Acceptance Criteria

* Audits still start, progress, complete, fail, and cancel correctly.
* Results still populate correctly.
* Existing UI receives equivalent state.
* Main controller is significantly smaller.

---

## Stage  5 — Extract Results, Filtering, and Table State

**Intelligence Level: High**

### Goal

Move result row state, search, filters, view mode, removed/restored rows, and table-derived values into focused modules.

### Requirements

Create hooks/helpers such as:

```txt
src/renderer/hooks/useResultRows.ts
src/renderer/hooks/useResultFilters.ts
src/renderer/helpers/videoRows.ts
src/renderer/helpers/resultFilters.ts
```

This area should own:

* video rows
* persisted result rows
* saved/unsaved state
* result file/source label if renderer-owned
* global search/filter
* view filters:

  * all
  * flagged
  * low-res
  * aspect
  * crop
  * errors
* removed row state
* restore removed behavior
* derived visible rows
* row counts

It should not own:

* active audit execution
* selected row action workflows
* auto-fix/crop execution
* Premiere execution

### Deliverables

* result row hook(s)
* result filter hook(s)
* helper modules
* controller updated to consume result modules

### Acceptance Criteria

* Table rows render as before.
* Search/filter behavior works as before or better.
* Remove/restore behavior works as before.
* Counts remain accurate.

---

## Stage  6 — Extract Selection and Contextual Action State

**Intelligence Level: High**

### Goal

Move selected-row state and selected-row derived capabilities into a focused hook.

### Requirements

Create:

```txt
src/renderer/hooks/useSelectionActions.ts
```

It should own:

* selected rows
* selection update handler
* selected count
* selected crop candidates
* selected auto-fix candidates
* selected thumbnail candidates
* can auto-fix selected
* can crop selected
* can generate thumbnails
* can edit in Premiere
* can migrate if currently selection-dependent
* clearing selection when rows change

It should not execute the workflows directly. It should expose selected rows/capability flags to workflow hooks/components.

### Deliverables

* `useSelectionActions.ts`
* selection helper functions if needed
* controller updated to consume selection state

### Acceptance Criteria

* Row selection works.
* Contextual action bar receives correct enabled/disabled state.
* Selection clears appropriately after result changes or clear data.
* Main controller loses selection-specific logic.

---

## Stage  7 — Extract Premiere Bridge Workflow

**Intelligence Level: High**

### Goal

Move Premiere bridge status and import-request behavior into a focused hook.

### Requirements

Create:

```txt
src/renderer/hooks/usePremiereBridge.ts
```

It should own:

* Premiere status
* status loading state
* check/retry status
* import selected videos
* import submitting state
* Premiere-specific errors
* Premiere status toast messages if still workflow-owned

It should consume selected rows or exportable selected rows as inputs.

### Requirements

* Preserve current Premiere status banner/strip behavior.
* Preserve “Edit in Premiere” behavior.
* Preserve useful error messages.
* Avoid checking status excessively.

### Deliverables

* `usePremiereBridge.ts`
* `premiereClient.ts` if not already created
* controller updated to consume Premiere hook

### Acceptance Criteria

* Premiere status still loads.
* Retry still works.
* Edit in Premiere still works.
* Main controller loses Premiere-specific state/handlers.

---

## Stage  8 — Extract Auto-Fix and Auto-Crop Workflows

**Intelligence Level: Extra High**

### Goal

Move auto-fix and auto-crop dialog/progress/result/execution logic into focused hooks.

This is high-risk because these workflows involve long-running jobs, selected rows, output directories, progress, cancellation, result dialogs, and future post-conversion workflows.

### Requirements

Create:

```txt
src/renderer/hooks/useAutoFixWorkflow.ts
src/renderer/hooks/useAutoCropWorkflow.ts
```

Each should own its own:

* dialog visibility
* selected/target videos for that workflow
* destination/output settings used by that workflow
* submitting/running state
* progress state
* result state
* error state
* start handler
* cancel handler if available
* close/reset handlers
* completion handling

### Requirements

* Preserve current auto-fix behavior.
* Preserve current auto-crop behavior.
* Preserve output destination behavior.
* Preserve progress/result display behavior.
* Do not implement file-management replacement workflow yet.
* Leave clear extension point for post-conversion workflow later.

### Deliverables

* `useAutoFixWorkflow.ts`
* `useAutoCropWorkflow.ts`
* clients/helpers as needed
* controller updated to consume these hooks

### Acceptance Criteria

* Auto-fix still works.
* Auto-crop still works.
* Dialogs still open/close correctly.
* Progress and results still display.
* Errors still display.
* Main controller loses auto-fix/auto-crop-specific state/handlers.

---

## Stage  9 — Extract Thumbnail and Preview Clip Workflows

**Intelligence Level: Extra High**

### Goal

Move thumbnail generation and preview clip generation state/execution into focused media-preview hooks.

### Requirements

Create:

```txt
src/renderer/hooks/useMediaPreviewWorkflow.ts
```

or split into:

```txt
src/renderer/hooks/useThumbnailWorkflow.ts
src/renderer/hooks/usePreviewClipWorkflow.ts
```

Choose the split that best matches the current code.

This workflow should own:

* thumbnail dialog visibility
* thumbnail scope
* thumbnail candidate rows
* thumbnail progress
* thumbnail result
* thumbnail errors
* preview clip generation state
* preview clip progress
* preview clip errors
* selected thumbnail/preview state if currently controller-owned
* merge generated thumbnails/previews into rows if appropriate

### Requirements

* Preserve current thumbnail generation behavior.
* Preserve preview clip behavior if implemented.
* Preserve cache/status display behavior.
* Avoid mixing table filtering with media generation logic.

### Deliverables

* media preview hook(s)
* media preview client module if needed
* helper for merging media preview results into rows
* controller updated to consume media preview workflow

### Acceptance Criteria

* Thumbnail generation still works.
* Preview clip generation still works if present.
* Generated thumbnails/previews still display.
* Main controller loses media-preview-specific state/handlers.

---

## Stage  10 — Extract Migration Workflow

**Intelligence Level: Extra High**

### Goal

Move migration scan/execute state and dialogs out of the main controller.

### Requirements

Create:

```txt
src/renderer/hooks/useMigrationWorkflow.ts
```

It should own:

* migration dialog visibility
* new edited folder value
* migration scan state
* migration scan progress
* migration scan result
* migration scan error
* migration execute state
* migration execute progress
* migration result
* migration result error
* start scan handler
* execute migration handler
* close/reset handlers

### Requirements

* Preserve current migration behavior.
* Preserve current migration dialogs.
* Preserve progress/result behavior.
* Keep destructive/safe-operation assumptions unchanged.

### Deliverables

* `useMigrationWorkflow.ts`
* `migrationClient.ts` if not already created
* controller updated to consume migration hook

### Acceptance Criteria

* Migration scan still works.
* Migration execute still works.
* Dialogs still behave correctly.
* Main controller loses migration-specific state/handlers.

---

## Stage  11 — Extract Settings and Dialog State

**Intelligence Level: High**

### Goal

Move settings UI state and general dialog visibility state into focused hooks or local component state.

### Requirements

Create:

```txt
src/renderer/hooks/useSettingsController.ts
```

or similar.

It should own:

* settings dialog/drawer visibility
* editable settings state
* save/reset handlers
* validation messages
* settings loading/saving state

Review any remaining general dialog state in the main controller.

Move dialog state closer to the component/workflow that owns it.

### Requirements

* Preserve settings behavior.
* Avoid one giant `useDialogState` dumping ground unless it is very small and clear.
* Prefer local state inside dialogs for purely local UI state.

### Deliverables

* settings controller hook
* dialog-state cleanup
* controller updated to consume settings hook

### Acceptance Criteria

* Settings still open/save/reset correctly.
* Dialog visibility remains correct.
* Main controller no longer owns unrelated modal flags.

---

## Stage  12 — Normalize Progress, Error, and Toast Handling

**Intelligence Level: High**

### Goal

Reduce duplicated progress merging, error handling, and toast notification code.

### Requirements

Inspect repeated patterns across workflow hooks.

Extract helpers only where they reduce real duplication.

Possible helpers:

```txt
src/renderer/helpers/progress.ts
src/renderer/helpers/errors.ts
src/renderer/hooks/useToastNotifications.ts
src/renderer/hooks/useJobProgress.ts
```

Examples:

* normalize caught error to message
* show success/error/warn toast
* reset progress state
* merge progress payloads
* subscribe/unsubscribe to progress events if there is a repeated preload event pattern

### Warning

Do not over-abstract. If workflows have meaningfully different progress semantics, keep them separate.

### Deliverables

* focused helper(s)
* reduced duplication
* no change in displayed messages unless intentionally improved

### Acceptance Criteria

* Error messages remain useful.
* Toasts still appear where expected.
* Progress still updates correctly.
* Workflow hooks are easier to read.

---

## Stage  13 — Slim Controller Composition Pass

**Intelligence Level: Extra High**

### Goal

Turn `useVideoAuditAppController.ts` into a clean composition hook.

At this stage, most workflow-specific state should already be extracted.

### Requirements

Refactor `useVideoAuditAppController.ts` so it primarily:

* composes focused hooks
* wires cross-workflow dependencies
* exposes the object shape expected by app components
* contains minimal business logic

Remove leftover unrelated state/handlers.

Revisit component props:

* if components receive too many individual props, consider grouping props by workflow object
* avoid massive prop drilling if easy to improve
* do not introduce context unless it clearly reduces complexity

### Requirements

* Preserve app behavior.
* Avoid changing component APIs too broadly unless needed.
* Keep names understandable.
* Avoid circular hook dependencies.

### Target

`useVideoAuditAppController.ts` should ideally be under 300–500 lines.

If it cannot get that small without risky churn, document why.

### Deliverables

* slimmed `useVideoAuditAppController.ts`
* updated component prop wiring if needed
* removed obsolete imports/state/handlers

### Acceptance Criteria

* Main controller is much smaller and easier to understand.
* Workflows live in focused hooks.
* App behavior remains intact.
* Future file-management hooks can be added without growing the main controller massively.

---

## Stage  14 — Dead Code and Dependency Cleanup

**Intelligence Level: Medium**

### Goal

Remove code made obsolete by the refactor.

### Requirements

Look for:

* unused imports
* unused helper functions
* duplicate type definitions
* dead state variables
* obsolete comments
* old controller fragments
* unused components
* unused CSS classes
* redundant client wrappers
* files no longer imported

Run available checks:

```bash
npm run typecheck
npm run build
```

Also run lint if available:

```bash
npm run lint
```

Do not make broad formatting-only changes.

### Deliverables

* removed dead code
* cleaned imports
* updated docs if needed

### Acceptance Criteria

* Typecheck/build pass or known issues are documented.
* No obvious unused code remains from the refactor.
* No behavior changes intended.

---

## Stage  15 — Refactor Verification and Documentation

**Intelligence Level: High**

### Goal

Verify the refactor and document the new renderer architecture.

### Requirements

Create or update:

```txt
docs/renderer-architecture.md
```

Document:

* main renderer workflow hooks
* what each hook owns
* where preload/API calls live
* where result row state lives
* where selected row state lives
* how long-running workflows are modeled
* where to add future file-management workflows

Add a section:

```md
## Future File Management Integration
```

Explain where future hooks/services should plug in:

* `useFileOperations`
* `useReplacementWorkflow`
* operation history clients
* post-conversion workflow integration points

Manual verification checklist:

* choose folders/files
* run audit
* cancel audit
* filter/search rows
* select rows
* auto-fix
* auto-crop
* generate thumbnails
* generate preview clips
* Premiere status
* edit in Premiere
* migration scan/execute
* settings save/reset
* clear/refresh data

### Deliverables

* renderer architecture documentation
* manual verification checklist
* any final small fixes discovered during verification

### Acceptance Criteria

* New renderer structure is documented.
* Future file-management implementation path is clear.
* Existing workflows are manually verifiable.
* Refactor is ready to precede file-management implementation.

---

## Recommended Implementation Sequence

Run stages in order:

```txt
Stage  1   Refactor audit and responsibility map
Stage  2   Extract renderer API clients
Stage  3   Extract source selection workflow
Stage  4   Extract audit/discovery/metadata workflows
Stage  5   Extract results/table/filter state
Stage  6   Extract selection/action state
Stage  7   Extract Premiere bridge workflow
Stage  8   Extract auto-fix and auto-crop workflows
Stage  9   Extract thumbnail/preview workflows
Stage  10  Extract migration workflow
Stage  11  Extract settings/dialog state
Stage  12  Normalize progress/error/toast handling
Stage  13  Slim controller composition pass
Stage  14  Dead code and dependency cleanup
Stage  15  Refactor verification and documentation
```

## Definition of Done

The refactor is complete when:

* `useVideoAuditAppController.ts` is a composition hook, not a God hook.
* Major workflows live in focused hooks/modules.
* Renderer API calls are centralized in focused clients.
* Result/filter/selection state is separated from execution workflows.
* Long-running workflows are easier to reason about.
* Existing behavior is preserved.
* Future file-management workflows have obvious integration points.
* Renderer architecture is documented.

### IMPORTANT: The success metric is not just line count

A 2,500-line hook is bad, but a bunch of 400-line hooks with unclear responsibilities is not much better. The real goal is:

```txt
Can I understand each workflow without loading the entire app into my head?
```

That’s what this plan is designed to achieve.