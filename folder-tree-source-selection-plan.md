# Folder Tree Source Selection Plan

## Project Context

This plan starts after the initial Electron conversion plan and UI improvement plan are complete.

The app is now a standalone private macOS Electron app with a results-first UI. It can audit selected folders/files and has a polished source configuration flow, but source selection should be improved.

The original Vite web version had a better source-selection UX using PrimeReact `TreeTable`: when selecting folders, the app showed an expandable tree of folders/subfolders, with checkbox selection and useful folder metadata such as video count and disk size. The Electron app should recreate and improve that flow.

This feature is important. It should become the primary folder-selection UX.

## Goal

Implement a PrimeReact TreeTable-based folder source selector.

The user should be able to:

1. Choose a root folder.
2. See an eagerly scanned full folder tree for that root.
3. Expand any folder/subfolder without additional API calls.
4. See video count and video size for every folder.
5. Select one or more folders/subfolders using checkbox selection.
6. Confirm selected folders into the app’s source state.
7. Run audits against the selected folders.

## Important Product Requirements

This implementation must use an **eager full tree scan**.

Definition:

- When the user chooses/scans a root folder, the main process recursively scans the full folder tree.
- The returned tree includes every folder and subfolder under the root.
- Every folder node includes its counts/sizes before the tree is displayed.
- Expanding a folder in the TreeTable must not trigger another filesystem/API call.
- There is no lazy loading.
- There is no folder tree caching.
- The user can refresh/rescan manually by choosing the root again or clicking a refresh action.

The user has many files but not many folders, and the prior web implementation performed acceptably. Prioritize UX clarity over premature performance optimization.

## Non-Goals

- Do not implement lazy loading.
- Do not implement folder tree caching.
- Do not use a normal file picker as the primary selection UI after root selection.
- Do not require one native file picker interaction per selected folder.
- Do not scan arbitrary system roots by default.
- Do not audit videos as part of the tree scan.
- Do not run ffprobe during the tree scan.
- Do not calculate non-video file sizes unless explicitly needed.
- Do not expose filesystem APIs directly to the renderer.
- Do not write tests unless explicitly requested.

## Core UX

Main flow:

```txt
Choose Sources
  → Select Root Folder
  → Eagerly scan full folder tree
  → Show TreeTable
  → User checks folders/subfolders
  → Confirm selected folders
  → Main screen source summary updates
  → User runs audit
```

Source selection dialog should look conceptually like:

```txt
Choose Folders

Root: /Volumes/SanDisk SSD/Videos
[Change Root] [Refresh Tree]

┌──────────────────────────────────────────────────────────────┐
│ ☐ Folder                         Videos       Video Size     │
├──────────────────────────────────────────────────────────────┤
│ ☐ Videos                         2,420        812.4 GB       │
│   ☐ Edited                       1,180        392.1 GB       │
│     ☐ Tennis                       340        122.8 GB       │
│     ☐ Family                       210         88.3 GB       │
│   ☐ Raw                          1,240        420.3 GB       │
└──────────────────────────────────────────────────────────────┘

Selected: 3 folders • 812 videos • 204.7 GB

[Cancel] [Use Selected Folders]
```

## Data Semantics

### Video Count

Each folder node should include:

* `directVideoCount`: number of supported video files directly inside that folder.
* `totalVideoCount`: number of supported video files inside that folder and all descendants.

The TreeTable should display `totalVideoCount` by default because it is most useful for selecting folders.

### Video Size

Each folder node should include:

* `directVideoSizeBytes`: total size of supported video files directly inside that folder.
* `totalVideoSizeBytes`: total size of supported video files inside that folder and all descendants.

The TreeTable should display `totalVideoSizeBytes` by default.

Label the column clearly as:

```txt
Video Size
```

Do not label it just `Size` unless the value includes all files. This feature should care about video file size, not junk/system files.

### Supported Video Files

Use the existing supported video extension constants/helpers if they already exist.

The tree scan should count only supported video files.

It should skip:

* `.DS_Store`
* files beginning with `._`
* unsupported files
* symlinks
* known system folders
* app temp/trash/cache folders

Known system/app folders to skip should include the existing app list where available:

```txt
.Spotlight-V100
.Trashes
.fseventsd
.TemporaryItems
System Volume Information
.git
node_modules
.video-audit-temp
.video-audit-trash
.video-audit-cleanup-runs
.collie-video-temp
.collie-video-trash
.collie-video-cleanup-runs
Archive
archived-files
```

If the app already has this list, reuse/centralize it rather than duplicating.

## Selection Semantics

Use PrimeReact TreeTable checkbox row selection.

Rules:

1. A user may select the root folder.
2. A user may select any subfolder.
3. A user may select multiple folders across different branches.
4. If a parent folder is selected, its descendants are implicitly included.
5. If both a parent and descendant are selected, the app must dedupe before auditing.
6. Partially selected parent nodes should appear as partially selected where PrimeReact supports it.
7. The final confirmed selected folder list should contain absolute folder paths.

### Dedupe Rules

Before saving selected folders into source state or before sending an audit request, dedupe overlapping folders.

Example:

```txt
Selected:
/Videos/Edited
/Videos/Edited/Tennis
/Videos/Edited/Family

Dedupe result:
/Videos/Edited
```

Example:

```txt
Selected:
/Videos/Edited/Tennis
/Videos/Edited/Family

Dedupe result:
/Videos/Edited/Tennis
/Videos/Edited/Family
```

Dedupe should be path-aware and handle path separators safely.

The deduped selected list should be used for:

* selected source summary
* audit request
* persisted latest session/project state if applicable

The raw TreeTable checkbox state may remain UI-only.

## Target Architecture

Suggested additions:

```txt
src/
├─ main/
│  ├─ ipc/
│  │  └─ folderTreeIpc.ts
│  │
│  ├─ services/
│  │  └─ folderTreeService.ts
│  │
│  └─ utils/
│     ├─ folderTreePaths.ts
│     └─ fileSizeFormatting.ts
│
├─ preload/
│  └─ videoAuditApi.ts
│
├─ renderer/
│  ├─ components/
│  │  └─ source/
│  │     ├─ FolderTreeSelectorDialog.tsx
│  │     ├─ FolderTreeTable.tsx
│  │     └─ FolderTreeSelectionSummary.tsx
│  │
│  ├─ hooks/
│  │  └─ useFolderTreeSelection.ts
│  │
│  └─ helpers/
│     ├─ folderTreeSelection.ts
│     └─ fileSize.ts
│
└─ shared/
   ├─ types/
   │  └─ folderTree.ts
   └─ constants/
      └─ folderTree.ts
```

Adapt paths to the current app structure if it already has better conventions.

## Shared Types

Create or update:

```txt
src/shared/types/folderTree.ts
```

Suggested types:

```ts
export type FolderTreeScanStatus =
  | 'idle'
  | 'scanning'
  | 'complete'
  | 'canceled'
  | 'error';

export type FolderTreeNode = {
  key: string;
  path: string;
  name: string;
  directVideoCount: number;
  totalVideoCount: number;
  directVideoSizeBytes: number;
  totalVideoSizeBytes: number;
  childFolderCount: number;
  totalFolderCount: number;
  children: FolderTreeNode[];
  error?: string | null;
  skipped?: boolean;
};

export type FolderTreeScanProgress = {
  scanId: string;
  status: FolderTreeScanStatus;
  rootPath: string;
  currentPath: string | null;
  foldersScanned: number;
  videoFilesFound: number;
  videoSizeBytes: number;
  message: string;
};

export type FolderTreeScanResult = {
  scanId: string;
  rootPath: string;
  root: FolderTreeNode;
  summary: {
    foldersScanned: number;
    videoFilesFound: number;
    videoSizeBytes: number;
    skippedFolderCount: number;
    errorCount: number;
  };
};

export type SelectedFolderSummary = {
  selectedFolderPaths: string[];
  dedupedFolderPaths: string[];
  selectedFolderCount: number;
  totalVideoCount: number;
  totalVideoSizeBytes: number;
};
```

Renderer may adapt `FolderTreeNode` into PrimeReact TreeTable nodes if needed.

## Preload API Shape

Add typed preload methods. Exact names can follow existing conventions.

Suggested:

```ts
window.videoAudit.folderTree.chooseRootFolder()
window.videoAudit.folderTree.scanRoot(rootPath)
window.videoAudit.folderTree.cancelScan(scanId)
window.videoAudit.folderTree.onScanProgress(callback)
```

Or, if the app’s existing source API naming is different, use:

```ts
window.videoAudit.sources.chooseFolderTreeRoot()
window.videoAudit.sources.scanFolderTree(rootPath)
window.videoAudit.sources.cancelFolderTreeScan(scanId)
window.videoAudit.sources.onFolderTreeScanProgress(callback)
```

Important:

* Renderer must not use `fs` directly.
* Renderer must not scan folders directly.
* Main process owns filesystem scanning.

## Stage 1 — Existing Source Selection Review

**Intelligence Level: High**

### Goal

Review the current source selection flow and identify where the TreeTable selector should plug in.

This stage should be mostly analysis and light preparation.

### Requirements

Inspect:

* source configuration dialog/components
* current folder/file selection hooks
* source summary bar
* audit request creation
* selected folders source state
* latest session/project persistence if present
* any old folder tree utilities if already migrated
* supported video extension constants/helpers
* existing skip-folder/system-folder constants

Create or update:

```txt
docs/folder-tree-source-selection-notes.md
```

Document:

* current source selection flow
* current selected folder data shape
* where TreeTable selection should plug in
* how audit currently consumes selected folders
* what existing utilities can be reused
* any risks or constraints

### Acceptance Criteria

* Implementation target is clear.
* No major behavior changes yet.
* Existing source selection still works.

---

## Stage 2 — Folder Tree Shared Types and Constants

**Intelligence Level: Medium**

### Goal

Add shared type definitions and constants for folder tree scanning and selection.

### Requirements

Create/update:

* `src/shared/types/folderTree.ts`
* `src/shared/constants/folderTree.ts` if useful

Include types for:

* folder tree node
* scan progress
* scan result
* selected folder summary
* scan status
* scan errors/warnings if needed

Include constants for:

* skipped system folder names if not already centralized
* default root labels if useful
* max displayed path length if useful

Do not implement scanning yet.

### Acceptance Criteria

* Types compile.
* Types are usable from main, preload, and renderer.
* No behavior changes yet.

---

## Stage 3 — Eager Full Folder Tree Scan Service

**Intelligence Level: Extra High**

### Goal

Implement the main-process service that eagerly scans a full folder tree and computes video counts/sizes for every folder node.

This is the core data feature.

### Requirements

Create:

```txt
src/main/services/folderTreeService.ts
```

The service should:

* accept an absolute root folder path
* validate the root exists
* validate the root is a directory
* recursively scan the full tree
* include every non-skipped folder/subfolder
* count supported video files
* sum supported video file sizes
* compute direct and recursive totals
* skip unsupported files
* skip `.DS_Store`
* skip files starting with `._`
* skip symlinks
* skip known system/app folders
* handle unreadable folders gracefully
* record skipped/error counts
* support cancellation
* emit progress updates
* return a full tree in one result

No caching.

No lazy loading.

No ffprobe.

No audit execution.

### Important Implementation Notes

The recursive scan should likely compute child nodes first, then aggregate totals upward.

For each folder:

```ts
node.directVideoCount = videos directly in folder
node.directVideoSizeBytes = size of videos directly in folder

node.totalVideoCount =
  node.directVideoCount + sum(child.totalVideoCount)

node.totalVideoSizeBytes =
  node.directVideoSizeBytes + sum(child.totalVideoSizeBytes)
```

`key` should be stable and safe for PrimeReact TreeTable selection.

Possible key choices:

* absolute path
* hash of absolute path
* normalized absolute path

If using absolute path as key, ensure it works safely with PrimeReact selection objects.

### Progress

Progress should update periodically, not necessarily for every single file if that is too noisy.

Include:

* current path
* folders scanned
* video files found
* video size found
* message

### Acceptance Criteria

* Main process can scan a root folder and return a complete folder tree.
* Every node includes direct and recursive video counts/sizes.
* Unreadable folders do not crash the scan.
* Scan can be canceled.
* No lazy loading or caching is implemented.
* No renderer filesystem access is introduced.

---

## Stage 4 — Folder Tree IPC and Preload API

**Intelligence Level: High**

### Goal

Expose folder tree scanning to the renderer through typed IPC/preload methods.

### Requirements

Create/update:

* `src/main/ipc/folderTreeIpc.ts`
* IPC registration
* preload API
* renderer global type declarations if applicable

Support:

* choose root folder using native Electron dialog
* start eager folder tree scan
* cancel active scan
* subscribe/unsubscribe to scan progress
* return scan result

Suggested methods:

```ts
chooseRootFolder(): Promise<{ canceled: boolean; path: string | null }>

scanRoot(rootPath: string): Promise<FolderTreeScanResult>

cancelScan(scanId: string): Promise<{ ok: boolean }>
```

If the app’s IPC pattern uses job IDs/events, follow that existing pattern.

### Requirements

* Validate root path in main process.
* Do not expose raw `fs` to renderer.
* Do not allow renderer to scan arbitrary multiple roots without explicit user selection or confirmed path.
* Do not implement caching/lazy loading.

### Acceptance Criteria

* Renderer can choose a root folder.
* Renderer can request a full eager scan.
* Renderer can receive progress.
* Renderer can cancel scan.
* Renderer receives a full tree result.

---

## Stage 5 — PrimeReact TreeTable Component

**Intelligence Level: Extra High**

### Goal

Build the reusable TreeTable UI for displaying and selecting folders.

### Requirements

Create:

```txt
src/renderer/components/source/FolderTreeTable.tsx
```

or equivalent.

Use PrimeReact TreeTable with checkbox row selection.

Display columns:

* Folder
* Videos
* Video Size

Optional columns if easy:

* Direct Videos
* Direct Size

But default visible columns should stay simple.

### Folder Column

Display:

* folder icon or expand/collapse affordance through TreeTable
* folder name
* maybe muted path segment or relative path if useful

### Videos Column

Display recursive total video count:

```txt
1,240
```

If direct/total both shown:

```txt
12 direct / 1,240 total
```

But keep initial UI clean.

### Video Size Column

Display recursive total video size:

```txt
82.4 GB
```

Use consistent bytes formatting.

### Selection

Support checkbox selection.

Requirements:

* selecting parent folder works
* selecting child folder works
* partial selection UI works where PrimeReact supports it
* selected state is controlled by renderer state
* selected nodes can be converted into absolute selected folder paths

### No Lazy Loading

The TreeTable receives the full tree as props. Expanding nodes should only expand already-loaded child nodes.

### Acceptance Criteria

* TreeTable renders full folder tree.
* Folders can be expanded without new API calls.
* Checkbox selection works.
* Counts/sizes are displayed clearly.
* Large enough trees remain usable.

---

## Stage 6 — Folder Tree Selection Helpers and Dedupe

**Intelligence Level: High**

### Goal

Implement reliable selection summary and overlapping-folder dedupe logic.

### Requirements

Create:

```txt
src/renderer/helpers/folderTreeSelection.ts
```

or shared helper if useful.

Support:

* extract selected folder paths from TreeTable selection state
* map TreeTable node keys back to folder paths
* dedupe overlapping selected folders
* calculate selected summary:

  * selected folder count
  * deduped folder count
  * total video count
  * total video size
* avoid double-counting when parent and child are both selected

### Dedupe Logic

Given selected folder paths, sort shallowest to deepest.

Keep a folder only if no already-kept parent contains it.

Pseudo:

```ts
const sorted = selectedPaths.sort(byDepthThenName);
const kept = [];

for (const folder of sorted) {
  if (!kept.some(parent => isPathAtOrInside(parent, folder))) {
    kept.push(folder);
  }
}
```

### Summary Logic

For summary, use the deduped selected nodes to avoid double counting.

If selected parent includes child, count parent once.

### Acceptance Criteria

* Parent/child overlap is deduped.
* Selected summary does not double-count videos or size.
* Audit receives deduped selected folder paths.
* Helper behavior is path-safe.

---

## Stage 7 — Folder Tree Selector Dialog

**Intelligence Level: Extra High**

### Goal

Create the full source-selection dialog that uses the folder TreeTable.

### Requirements

Create/update:

```txt
src/renderer/components/source/FolderTreeSelectorDialog.tsx
```

or integrate into existing `SourceConfigDialog`.

Dialog should support:

* choose/change root folder
* refresh/rescan root folder
* show eager scan progress
* cancel active scan
* show scan errors if any
* show TreeTable after scan completes
* checkbox-select folders
* show selected summary
* confirm selected folders
* cancel/close without applying changes
* restore prior selected folders when reopened if root matches

### UI

Suggested layout:

```txt
Choose Folders

Root: /Volumes/SanDisk SSD/Videos
[Change Root] [Refresh Tree]

Scanning... Found 482 folders • 12,408 videos • 2.1 TB

TreeTable...

Selected: 3 folders • 812 videos • 204.7 GB

[Cancel] [Use Selected Folders]
```

### Requirements

* The dialog should not audit files.
* The dialog should only select folders.
* Confirming should update source state.
* Canceling should not mutate selected source state.
* Existing selected folders should be shown when reopening if possible.
* If selected folders are missing in the new scan, show a warning and omit them or mark them unavailable.

### Acceptance Criteria

* User can choose a root and scan full tree.
* User can select folders/subfolders.
* Selected summary is accurate.
* Confirming updates app source state.
* Canceling leaves previous source state unchanged.
* No lazy loading/caching exists.

---

## Stage 8 — Integrate TreeTable Sources with Audit Flow

**Intelligence Level: Extra High**

### Goal

Make selected TreeTable folders the primary folder source for audit execution.

### Requirements

Update source state and audit request creation so:

* selected folders from TreeTable are stored as absolute paths
* selected folders are deduped before audit
* selected folder summary appears in main source summary bar
* audit uses selected folder paths
* include subfolders behavior is respected

### Include Subfolders Semantics

If user selects a folder in the TreeTable:

* and include subfolders is enabled, audit includes videos recursively under that folder
* and include subfolders is disabled, audit includes only videos directly inside that selected folder

Even though the TreeTable scan has full recursive counts, audit behavior should still respect the current audit options.

The selected summary should clearly indicate whether counts are recursive totals or direct-only if include-subfolders is off. If this is too much for initial implementation, default to existing include-subfolders behavior and document the summary semantics.

### Existing Choose Files Flow

Preserve selected individual files flow if it exists.

The source configuration should support both:

* folder tree selected folders
* selected individual files

Do not remove selected-file auditing unless explicitly requested.

### Acceptance Criteria

* Auditing selected TreeTable folders works.
* Multiple selected subfolders work.
* Parent/child dedupe prevents duplicate auditing.
* Selected file auditing still works.
* Main screen source summary is accurate.

---

## Stage 9 — Latest Session / Project Persistence Integration

**Intelligence Level: High**

### Goal

Persist and restore folder tree source selections as part of latest session/project state if that persistence already exists.

### Requirements

Persist:

* last folder tree root path
* selected folder paths
* deduped selected folder paths
* selected folder summary
* include subfolders option
* last scan timestamp if useful

Do not persist the full scanned tree unless there is already a clear reason.

No caching means:

* do not reload the saved tree from disk as if it is current
* on app reopen, restore selected folder paths and summary if useful
* allow user to refresh/rescan root manually
* validate selected folder paths before audit

If project support exists, save these fields inside the project manifest.

### Acceptance Criteria

* App can reopen with selected folder sources restored.
* Audit can run against restored selected folder paths.
* User can rescan root to refresh the TreeTable.
* No folder tree cache is added.

---

## Stage 10 — Polish, Empty States, and Error Handling

**Intelligence Level: High**

### Goal

Make the TreeTable source-selection flow feel polished and robust.

### Requirements

Polish:

* loading state
* empty folder state
* no videos found state
* unreadable folder warning
* canceled scan state
* root unavailable state
* long path truncation
* selected summary formatting
* bytes formatting
* disabled confirm button when no folders selected
* confirmation button label
* scan duration or last scanned display if useful

Suggested messages:

```txt
No videos found under this folder.
```

```txt
Some folders could not be read and were skipped.
```

```txt
The selected root is no longer available.
```

```txt
Select at least one folder to continue.
```

### Acceptance Criteria

* Dialog handles empty/error/canceled states gracefully.
* UI feels intentional and useful.
* Long paths do not break layout.
* TreeTable source selection feels better than native file picker.

---

## Stage 11 — Documentation and Verification

**Intelligence Level: Medium**

### Goal

Document the folder tree source-selection flow and verify behavior.

### Requirements

Update README or internal docs with:

* how folder source selection works
* what counts/sizes mean
* how selected folders are deduped
* how include-subfolders affects audits
* why the tree is eagerly scanned
* no caching/lazy loading by design

Create or update:

```txt
docs/folder-tree-source-selection.md
```

Manual verification checklist:

* choose root folder
* scan root
* expand nested folders
* select root
* select subfolders
* select sibling subfolders
* select parent + child and verify dedupe
* confirm selected folders
* run audit
* cancel scan
* scan root with no videos
* scan root with unreadable/skipped folders if practical
* relaunch app and verify selected folder state if persistence exists

### Acceptance Criteria

* Feature is documented.
* Manual verification steps are clear.
* Behavior matches the original web version’s UX or improves it.

---

## Definition of Done

This feature is complete when:

* user can choose a root folder
* app eagerly scans the full folder tree
* TreeTable shows all folders/subfolders from the scan
* each folder shows video count and video size
* user can checkbox-select folders/subfolders
* selected folders are deduped
* selected summary is accurate
* selected folders become the app’s audit source
* audit works using selected TreeTable folders
* selected-file audit still works
* no lazy loading/caching was introduced
* renderer does not directly scan the filesystem
