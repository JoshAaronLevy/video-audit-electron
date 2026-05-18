# File Management Implementation Plan

## Project Context

At this point, the app is a standalone private macOS Electron app. It can audit local videos, generate thumbnails/preview clips, run ffprobe/ffmpeg workflows, auto-fix/auto-crop selected videos, and persist local app state.

This plan adds safe file-management workflows focused on post-conversion cleanup, so the user does not have to manually manage the original files after conversion.

The goal is not to build a full Finder replacement. The goal is to let the app safely manage files it already understands: audited source videos, generated ffmpeg outputs, converted videos, thumbnails/previews, and related operation artifacts.

**NOTE:** For this plan, you are allowed to open the app in Electron if it helps you visualize the user workflows better than just the code. But only if it helps. And do so ***briefly*** and ***sparingly***.

**IMPORTANT:** We just finished a major refactor of the UI (`ui-improvement-plan.md`), resolving a lot of visual and usability issues. For any additional features or UI changes related to this file management implementation plan, please integrate into the existing UI patterns and designs, in order to remain consistent and avoid new UI/UX issues.

## Primary User Workflows

The app should support:

1. Revealing source/output files in Finder.
2. Moving selected known video files to macOS Trash.
3. Moving selected files to a chosen folder.
4. Reviewing source/output pairs after conversion.
5. Replacing originals with converted outputs safely.
6. Moving originals to Trash or archive during replacement.
7. Moving converted outputs out of the ffmpeg output folder into original source directories.
8. Manually deciding per video what should happen after conversion.
9. Logging all file operations.
10. Viewing operation history.
11. Recovering from partially failed operations with clear status.

## Non-Goals

- Do not build a general-purpose Finder replacement.
- Do not implement permanent deletion.
- Do not use `rm -rf`.
- Do not delete directories.
- Do not recursively delete folders.
- Do not overwrite existing files by default.
- Do not silently replace originals after conversion without user confirmation.
- Do not expose arbitrary filesystem operations to the renderer.
- Do not allow renderer code to directly use `fs`, `path`, `shell`, or `child_process`.
- Do not add cloud sync, remote storage, or multi-user behavior.
- Do not add tests unless explicitly requested.

## Safety Principles

1. Prefer recoverable operations.
2. Use macOS Trash for destructive cleanup.
3. Build a dry-run plan before executing file operations.
4. Show clear user confirmation before moving/trashing/replacing files.
5. Never overwrite destination files by default.
6. Validate files immediately before execution.
7. Treat source/output file metadata as stale until revalidated.
8. Log every operation.
9. Keep operations itemized so one failed file does not invalidate the whole batch.
10. Support partial success with clear reporting.
11. Keep original videos recoverable unless a future explicitly confirmed destructive workflow is added.

## Target Architecture

Suggested additions:

```txt
src/
├─ main/
│  ├─ ipc/
│  │  ├─ fileOperationIpc.ts
│  │  └─ replacementWorkflowIpc.ts
│  │
│  ├─ services/
│  │  ├─ fileOperationService.ts
│  │  ├─ fileOperationLogService.ts
│  │  ├─ replacementPlanService.ts
│  │  ├─ operationHistoryService.ts
│  │  └─ archiveService.ts
│  │
│  └─ utils/
│     ├─ fileOperationSafety.ts
│     ├─ fileNameConflicts.ts
│     └─ fileIdentity.ts
│
├─ preload/
│  └─ videoAuditApi.ts
│
├─ renderer/
│  ├─ components/
│  │  ├─ FileOperationConfirmDialog.tsx
│  │  ├─ FileOperationResultDialog.tsx
│  │  ├─ OperationHistoryDialog.tsx
│  │  ├─ PostConversionDialog.tsx
│  │  ├─ ReplacementReviewTable.tsx
│  │  └─ ReplacementPlanSummary.tsx
│  │
│  └─ hooks/
│     ├─ useFileOperations.ts
│     └─ useReplacementWorkflow.ts
│
└─ shared/
   ├─ types/
   │  ├─ fileOperations.ts
   │  ├─ replacementWorkflow.ts
   │  └─ operationHistory.ts
   │
   └─ constants/
      └─ fileOperations.ts
```

The exact file names can vary if the app already has a better structure, but the responsibilities should remain separated:

* `fileOperationService`: low-level safe file actions.
* `replacementPlanService`: source/output relationship planning.
* `fileOperationLogService`: persistent operation logs.
* renderer components: review, confirm, results, and history UI.
* preload API: typed methods only.

## Suggested Preload API Shape

Do not expose raw filesystem power.

Good API shape:

```ts
window.videoAudit.fileOperations.createTrashPlan(items)
window.videoAudit.fileOperations.executeTrashPlan(planId)
window.videoAudit.fileOperations.createMovePlan(items, destinationDirectory)
window.videoAudit.fileOperations.executeMovePlan(planId)
window.videoAudit.fileOperations.revealPath(path)
window.videoAudit.fileOperations.getOperationHistory()
window.videoAudit.fileOperations.getOperationDetails(operationId)

window.videoAudit.replacement.createReplacementPlan(conversionResult)
window.videoAudit.replacement.updateReplacementPlanActions(planId, actions)
window.videoAudit.replacement.executeReplacementPlan(planId)
```

Avoid APIs like:

```ts
window.videoAudit.files.deletePath(path)
window.videoAudit.files.movePath(source, destination)
window.videoAudit.files.writeFile(path, content)
window.videoAudit.files.removeDirectory(path)
```

The renderer should request specific high-level operations, and the main process should validate everything.

---

## Stage 1 — Safe File Operation Types and Foundations

**Intelligence Level: High**

### Goal

Define the shared types, constants, and safety vocabulary for all future file-management workflows.

This stage should not execute real file operations yet.

### Requirements

Create shared types for:

* file operation item
* file operation plan
* file operation result
* trash operation
* move operation
* copy operation if useful
* archive operation
* replacement operation
* operation status
* operation warnings
* operation history record
* file identity metadata

Suggested types:

```ts
export type FileOperationType =
  | 'trash'
  | 'move'
  | 'copy'
  | 'archive'
  | 'replace-original-with-output';

export type FileOperationPlanStatus =
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'missing-source'
  | 'missing-output'
  | 'destination-conflict'
  | 'invalid-path'
  | 'unsupported-file'
  | 'would-overwrite';

export type FileOperationExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed';

export type FileIdentity = {
  path: string;
  fileName: string;
  extension: string;
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  createdAtMs?: number | null;
  isDirectory: boolean;
  isFile: boolean;
};

export type FileOperationPlanItem = {
  id: string;
  operationType: FileOperationType;
  sourcePath: string;
  destinationPath?: string | null;
  fileName: string;
  expectedSizeBytes?: number | null;
  expectedModifiedAtMs?: number | null;
  status: FileOperationPlanStatus;
  warnings: string[];
  errors: string[];
};

export type FileOperationPlan = {
  id: string;
  type: FileOperationType;
  createdAt: string;
  items: FileOperationPlanItem[];
  summary: {
    total: number;
    ready: number;
    warning: number;
    blocked: number;
    totalSizeBytes: number;
  };
};
```

### Deliverables

* `src/shared/types/fileOperations.ts`
* `src/shared/types/operationHistory.ts`
* `src/shared/constants/fileOperations.ts`
* placeholder exports wired into any existing shared type barrel files if applicable

### Acceptance Criteria

* Types compile.
* No file operations execute yet.
* Types are broad enough to support trash, move, archive, and replacement workflows.
* The type model avoids arbitrary unstructured path operations.

---

## Stage 2 — File Operation Log and History Service

**Intelligence Level: High**

### Goal

Create a persistent local operation log before enabling real file actions.

Every move/trash/replacement workflow should eventually write a durable record.

### Requirements

Implement a main-process service for operation history.

Use Electron `userData` or the app’s existing persistence path.

Persist operation history as JSON first. Do not add SQLite unless the existing app already migrated to it.

Support:

* create operation record
* append item result
* mark operation completed
* mark operation failed
* list recent operations
* read operation details
* tolerate missing/corrupt history file
* cap or paginate results if needed

Suggested operation record:

```ts
export type OperationHistoryRecord = {
  id: string;
  type: FileOperationType;
  createdAt: string;
  completedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'failed' | 'canceled';
  summary: {
    requested: number;
    succeeded: number;
    skipped: number;
    failed: number;
    totalSizeBytes: number;
  };
  items: OperationHistoryItem[];
};

export type OperationHistoryItem = {
  id: string;
  sourcePath: string;
  destinationPath?: string | null;
  operationType: FileOperationType;
  status: FileOperationExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  error?: string | null;
};
```

### Deliverables

* `fileOperationLogService.ts`
* `operationHistoryService.ts` if separate
* IPC handlers to list/read operation history
* preload API for operation history
* minimal renderer-accessible history read support

### Acceptance Criteria

* Operation history can be written and read.
* Missing/corrupt log does not crash the app.
* Logs live under app-owned data paths.
* No actual move/trash operations are implemented yet.

---

## Stage 3 — Reveal in Finder and Safe Path Validation

**Intelligence Level: Medium**

### Goal

Add low-risk file-management functionality first: reveal known files/folders in Finder and validate file identities.

### Requirements

Implement:

* reveal file in Finder
* reveal folder in Finder
* validate a list of known file paths
* return current file metadata
* block directory deletion/mutation paths from this API
* handle missing files gracefully

Use Electron `shell.showItemInFolder` or equivalent for reveal behavior.

Validation should confirm:

* path is absolute
* path exists
* path is a file when a file is expected
* path is a directory when a directory is expected
* file name matches expected file name when provided
* size and modified timestamp match expected values when provided
* extension is a supported video extension when video-only validation is requested

### Deliverables

* path/file validation utilities
* reveal IPC handlers
* preload reveal methods
* renderer action to reveal source/output files from table rows or details modal

### Acceptance Criteria

* User can reveal source files in Finder.
* User can reveal output files in Finder.
* Missing paths show a clean error.
* No mutation operations happen in this stage.

---

## Stage 4 — Trash Plan and Move to Trash Execution

**Intelligence Level: Extra High**

### Goal

Implement safe movement of known selected video files to macOS Trash.

This is the first destructive/recoverable operation, so it needs strong validation and confirmation.

### Requirements

Implement a two-step workflow:

1. Create trash plan.
2. Execute trash plan.

Trash plan creation should:

* accept explicit selected known video items
* validate paths
* ensure paths are absolute
* ensure each path points to a file, not a directory
* block unsupported file types unless explicitly allowed
* compute total size
* identify missing files
* identify warnings
* mark invalid items as blocked
* not mutate anything

Execution should:

* revalidate items immediately before execution
* use macOS Trash, not permanent deletion
* never use `rm -rf`
* never delete directories
* continue item-by-item if one file fails
* log every item result
* return partial success if needed

Use Electron `shell.trashItem(path)` or equivalent in the main process.

### Confirmation Rules

Renderer should require user confirmation before execution.

Typed confirmation should be required when:

* more than 10 files are selected
* total selected size exceeds 10GB
* any item has warnings
* any item is on an external volume if detectable
* any item path is outside the latest audited root/output directories if that concept exists

Confirmation text should say **Move to Trash**, not **Delete**.

### Deliverables

* trash plan service method
* execute trash plan service method
* trash IPC handlers
* preload API
* confirmation dialog
* result dialog
* operation log entries

### Acceptance Criteria

* User can select known video rows and move them to macOS Trash.
* Files are recoverable from Trash.
* Directories cannot be trashed through this workflow.
* Invalid/missing files are blocked or reported.
* Operation history records all item outcomes.
* Partial failures are shown clearly.

---

## Stage 5 — Move File Plan and Execution

**Intelligence Level: Extra High**

### Goal

Implement safe movement of selected known files to a chosen destination folder.

This enables workflows like moving converted outputs, moving reviewed videos, or relocating selected files without Finder juggling.

### Requirements

Implement a two-step workflow:

1. Create move plan.
2. Execute move plan.

Move plan creation should:

* accept selected known file items
* accept a destination directory
* validate source files
* validate destination directory
* compute proposed destination paths
* detect destination conflicts
* block overwrites by default
* support conflict strategy:

  * skip
  * rename with suffix
* compute total size
* return itemized status

Execution should:

* revalidate immediately before moving
* avoid overwrites
* move item-by-item
* log every result
* return partial success if needed

### Conflict Strategy

Default:

```txt
destination-conflict → blocked
```

Optional safe strategy:

```txt
rename-with-suffix
```

Example:

```txt
foo.mp4
foo (collie-video 1).mp4
foo (collie-video 2).mp4
```

Do not overwrite unless a future stage explicitly adds confirmed overwrite support.

### Deliverables

* move plan service
* execute move plan service
* destination conflict utility
* move IPC handlers
* preload API
* choose destination folder UI integration
* confirmation dialog
* result dialog
* operation history entries

### Acceptance Criteria

* User can move selected known files to a chosen folder.
* Destination conflicts are detected before execution.
* Files are never overwritten by default.
* Per-file failures are shown.
* Operation history records all outcomes.

---

## Stage 6 — Archive Originals Workflow

**Intelligence Level: High**

### Goal

Add a safer alternative to Trash for original source videos: move originals into a local archive folder.

This supports post-conversion cleanup while keeping originals near the original project context.

### Requirements

Implement archive planning and execution.

Default archive strategy:

```txt
<source directory>/.collie-video-archive/<YYYY-MM-DD>/
```

Example:

```txt
/Videos/Game/foo.mov
/Videos/Game/.collie-video-archive/2026-05-17/foo.mov
```

Support:

* create archive plan
* execute archive plan
* conflict detection
* rename-with-suffix if needed
* operation logging
* archive summary
* reveal archive folder

Do not archive directories.

Do not overwrite existing archived files.

### Deliverables

* `archiveService.ts`
* archive plan/execution methods
* IPC handlers
* preload API
* renderer action for “Archive originals”
* confirmation/result dialogs

### Acceptance Criteria

* User can archive selected originals safely.
* Archive folders are created per source directory/date.
* Existing files are not overwritten.
* Operation history records archive operations.
* User can reveal archive folder.

---

## Stage 7 — Replacement Plan Foundation

**Intelligence Level: Extra High**

### Goal

Create the core planning engine for replacing original files with converted ffmpeg outputs.

This stage should build dry-run replacement plans only. It should not execute replacement yet unless explicitly scoped.

### Workflow Definition

A replacement operation means:

1. Validate original source file.
2. Validate converted output file.
3. Compute final destination path in the original source directory.
4. Preserve the converted file’s real extension.
5. Move original source file to Trash or archive during execution.
6. Move converted output from the ffmpeg output folder into the original source directory.
7. Leave no converted output behind in the ffmpeg output folder for successful replacements.
8. Log every item.

Example:

```txt
Original:  /Volumes/SanDisk SSD/Videos/Game/foo.mov
Output:    /Users/joshlevy/Movies/Edited/ffmpeg/foo.mp4
Final:     /Volumes/SanDisk SSD/Videos/Game/foo.mp4
Trash:     /Volumes/SanDisk SSD/Videos/Game/foo.mov
```

If original and output are both `.mp4`:

```txt
Original:  /Videos/foo.mp4
Output:    /Movies/Edited/ffmpeg/foo.mp4
Final:     /Videos/foo.mp4
```

The execution stage must move the original away first, then move output into place.

### Requirements

Create replacement plan types and planner.

A replacement plan item should include:

* original path
* original file name
* original directory
* original extension
* original size
* original modified timestamp
* output path
* output file name
* output directory
* output extension
* output size
* output modified timestamp
* proposed final path
* selected action
* status
* warnings
* errors

Supported selected actions:

```ts
type ReplacementAction =
  | 'replace-original'
  | 'keep-output'
  | 'move-output'
  | 'trash-original'
  | 'archive-original'
  | 'skip';
```

Plan statuses:

```ts
type ReplacementPlanItemStatus =
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'missing-original'
  | 'missing-output'
  | 'destination-conflict'
  | 'invalid-original'
  | 'invalid-output';
```

### Planning Rules

* If original is missing, item is blocked unless action is `keep-output`.
* If output is missing, item is blocked.
* If proposed final path conflicts with a third file, item is blocked.
* If proposed final path equals original path, the operation is allowed only with safe sequencing.
* Converted extension should be preserved.
* Original base name should be preserved where practical.
* Never overwrite third-party files.
* Never execute anything during planning.

### Deliverables

* `replacementWorkflow.ts` shared types
* `replacementPlanService.ts`
* replacement plan IPC handler
* preload API
* no execution yet, or execution stub only

### Acceptance Criteria

* App can build a replacement plan from auto-fix/auto-crop results.
* Plan correctly pairs originals and converted outputs.
* Plan computes final destination paths.
* Plan detects conflicts and missing files.
* Plan does not mutate the filesystem.

---

## Stage 8 — Post-Conversion Completion Dialog

**Intelligence Level: Extra High**

### Goal

After auto-fix or auto-crop finishes, present a dialog offering the user next-step cleanup options.

### Dialog Options

After conversion completes, show:

```txt
Conversion complete.

What do you want to do with the converted videos?

[Replace originals]
[Review manually]
[Leave files where they are]
```

Wording should make the behavior clear:

* “Replace originals” means:

  * move originals to Trash or archive
  * move converted outputs into the original source directories
  * remove successfully moved outputs from the ffmpeg output folder

Suggested label:

```txt
Replace originals with converted files
```

Suggested description:

```txt
Moves original files to Trash and moves converted files into the original source folders.
```

### Requirements

Integrate with auto-fix and auto-crop completion flows.

Support:

* create replacement plan from conversion result
* show summary:

  * total converted
  * ready to replace
  * warnings
  * blocked
  * total original size
  * total output size
* user choices:

  * replace all ready items
  * review manually
  * leave outputs where they are
* typed confirmation for high-risk replacements
* no silent execution

### High-Risk Confirmation

Require typed confirmation when:

* more than 10 files will be replaced
* total original size exceeds 10GB
* any warnings exist
* any path is on an external volume if detectable
* any destination conflict exists
* any original/output extension differs

Typed confirmation phrase:

```txt
REPLACE
```

### Deliverables

* `PostConversionDialog.tsx`
* replacement summary component
* integration with auto-fix result flow
* integration with auto-crop result flow
* option to leave files in output folder
* option to open manual review

### Acceptance Criteria

* After conversion completes, user is offered cleanup choices.
* Choosing “Leave files where they are” does nothing.
* Choosing “Review manually” opens the manual review workflow.
* Choosing “Replace originals” requires confirmation and executes only ready items.
* No replacement occurs without user confirmation.

---

## Stage 9 — Replacement Execution Service

**Intelligence Level: Extra High**

### Goal

Execute replacement plans safely.

This is one of the riskiest stages. Prioritize correctness, validation, and recoverability.

### Execution Behavior

For each item with action `replace-original`:

1. Revalidate original file exists and matches expected identity.
2. Revalidate output file exists and matches expected identity.
3. Revalidate destination path.
4. Move original to Trash or archive according to user preference.
5. Verify original path is clear.
6. Move converted output to final destination path.
7. Log success or failure.

If any step fails, stop that item and report the failure.

Do not proceed to moving the output if moving the original fails.

### Original Disposal Options

Support at least:

```txt
move-original-to-trash
```

Optionally support:

```txt
archive-original
```

If archive is implemented in Stage 24, allow it as a setting or per-plan option.

### Partial Failure Behavior

If one item fails:

* continue or stop based on plan setting
* default can continue item-by-item
* log each failure
* show summary at end

### Requirements

Implement:

* execute replacement plan
* progress events
* cancellation before item boundaries
* operation log entries
* result summary
* itemized result
* reveal final destination folder
* reveal failed source/output if useful

### Safety Requirements

* Never permanently delete.
* Never overwrite third-party files.
* Never delete directories.
* Never use `rm -rf`.
* Never move output into place until original has been successfully moved away.
* Never treat renderer-provided plan as trusted; rehydrate/revalidate plan in main process.

### Deliverables

* replacement execution service
* replacement IPC execute handler
* preload API
* progress UI
* result dialog
* operation history integration

### Acceptance Criteria

* Ready replacement items can be executed.
* Originals are moved to Trash/archive.
* Converted outputs are moved into original directories.
* Successful outputs no longer remain in the ffmpeg output folder.
* Partial failures are clearly reported.
* Every item outcome is logged.

---

## Stage 10 — Manual Replacement Review Workspace

**Intelligence Level: Extra High**

### Goal

Create a manual review UI for deciding what to do with each converted video.

This should use a PrimeReact DataTable or similarly rich table component rather than a PickList.

### UX Rationale

A PickList is good for moving items between two buckets. This workflow needs per-row source/output metadata, warnings, conflicts, thumbnails, and action choices. A table is a better fit.

### Requirements

Implement a manual review dialog/workspace with:

* original file column
* converted output column
* original metadata
* output metadata
* thumbnail/preview if available
* proposed final path
* status
* warnings
* per-row action dropdown
* bulk action controls
* filter/search
* summary counts
* execute selected actions button

Per-row actions:

* replace original
* keep output
* trash original
* archive original
* move output to chosen folder
* skip

Bulk actions:

* set all ready items to replace original
* set all warning items to skip
* set all items to keep output
* clear selected actions

### Suggested Table Columns

* Preview
* Original
* Converted
* Original Info
* Converted Info
* Proposed Final Location
* Action
* Status / Warning

### Deliverables

* `ReplacementReviewTable.tsx`
* `ReplacementPlanSummary.tsx`
* manual review dialog/workspace
* integration with post-conversion dialog
* update replacement plan actions
* execute plan from manual review

### Acceptance Criteria

* User can manually choose actions per converted video.
* User can bulk-apply actions.
* Warnings/conflicts are visible.
* Blocked items cannot be executed accidentally.
* Manual review can execute a safe replacement plan.
* Operation results are shown clearly.

---

## Stage 11 — Operation History UI

**Intelligence Level: Medium**

### Goal

Expose operation history in the renderer so the user can inspect what happened after move/trash/archive/replacement operations.

### Requirements

Add UI for:

* recent file operations
* operation details
* status summary
* per-item results
* reveal source/destination/final paths where available
* copy operation summary if useful

History should include:

* trash operations
* move operations
* archive operations
* replacement operations

### Deliverables

* `OperationHistoryDialog.tsx`
* operation history menu/action
* operation detail view
* reveal path actions

### Acceptance Criteria

* User can view recent operations.
* User can inspect itemized results.
* User can reveal relevant folders/files.
* Failed operations are easy to diagnose.

---

## Stage 12 — File Management Settings

**Intelligence Level: Medium**

### Goal

Add settings for file-management behavior.

### Suggested Settings

* default original disposal strategy:

  * Trash
  * Archive
* require typed confirmation above file count threshold
* typed confirmation file count threshold
* typed confirmation size threshold
* default archive folder pattern
* conflict strategy:

  * block
  * rename with suffix
* show post-conversion dialog automatically
* default post-conversion action:

  * ask every time
  * leave outputs
  * review manually
* preview operation history after execution

### Deliverables

* settings type updates
* settings persistence updates
* settings UI updates
* default values
* migration/default handling for missing settings

### Acceptance Criteria

* File-management settings persist.
* Safe defaults are used.
* Settings do not allow unsafe behavior like permanent delete or overwrite by default.

---

## Stage 13 — File Management Polish and Safety Review

**Intelligence Level: High**

### Goal

Review the full file-management workflow for safety, clarity, and usability.

### Requirements

Audit:

* no permanent deletion
* no directory deletion
* no `rm -rf`
* no overwrite-by-default
* main-process validation
* no raw filesystem APIs exposed to renderer
* operation logging coverage
* partial failure behavior
* confirmation flows
* external drive behavior
* missing file behavior
* destination conflict behavior
* post-conversion behavior
* manual review behavior

Polish:

* clearer labels
* clearer warnings
* better result summaries
* better disabled states
* better empty states
* better error messages
* reveal-in-Finder shortcuts
* operation history accessibility

### Deliverables

* safety review notes in `docs/file-management-safety-review.md`
* any cleanup fixes discovered during review
* README update if file-management workflows are user-visible

### Acceptance Criteria

* File-management workflows feel safe and predictable.
* User always understands what will happen before files move.
* Failed operations are recoverable or at least clearly explainable.
* The app is safer than juggling Finder manually.
