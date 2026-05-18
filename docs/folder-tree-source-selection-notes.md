# Folder Tree Source Selection Notes

Stage 1 review for `folder-tree-source-selection-plan.md`.

## Current Source Selection Flow

- The active source setup entry point is `SourceSummaryBar` in `src/renderer/App.tsx`. It opens `SourceConfigDialog`.
- `SourceConfigDialog` is the current source configuration surface. It shows selected folder/file/output counts, recent folders, audit option checkboxes, selected path lists, and the Run Audit action.
- `SourceSelectionPanel` still exists, but `App.tsx` does not render it in the current results-first layout. Future folder-tree work should target `SourceConfigDialog`, not the unused panel.
- Folder selection currently calls `controller.chooseFolders`, which invokes `window.videoAudit.dialog.chooseFolders()`. That preload method calls the main-process `dialog:choose-folders` IPC handler and opens a native multi-directory picker.
- File selection currently calls `controller.chooseFiles`, which invokes `window.videoAudit.dialog.chooseVideoFiles()`. This selected-file audit flow should remain intact and independent of the new folder-tree selector.
- Output folder selection and reveal actions already go through typed preload/main-process APIs. The renderer does not directly access `fs`, `path`, Electron main APIs, or raw filesystem operations.

## Current Selected Source Shape

- Renderer state stores selected folders as `selectedFolders: string[]`.
- Renderer state stores selected files as `selectedFiles: string[]`.
- `AppSettings` stores `recentFolders`, `recentFiles`, and `latestSelectedFolder`. It does not currently store a folder tree, raw TreeTable selection keys, or a selected-folder summary.
- Saved audit results in IndexedDB persist the last `AuditRequest`, including `request.folderPaths`, `request.filePaths`, and `request.options`.
- The current selected folder shape is already compatible with a confirmed TreeTable selection result, as long as the TreeTable flow ultimately emits deduped absolute folder paths as `string[]`.

## How Audit Consumes Selected Folders

- `runAudit` builds an `AuditRequest` with:
  - `folderPaths: selectedFolders`
  - `filePaths: selectedFiles`
  - `options: auditOptions`
- `refreshAudit` replays `lastAuditRequest` and restores `selectedFolders`, `selectedFiles`, and `auditOptions` from that request.
- Main-process audit IPC normalizes folder/file arrays with simple string filtering and `Set` dedupe, but it does not currently path-dedupe parent/descendant folders.
- `auditService.runAudit` passes `folderPaths`, `filePaths`, and `options.includeSubfolders` to `discoverVideoFiles`.
- `fileDiscoveryService.discoverVideoFiles` does the current filesystem walk in the main process and counts supported video files only. It skips symlinks, unsupported files, `.DS_Store`, files beginning with `._`, and a local `SYSTEM_DIRECTORY_NAMES` set.
- Current audit behavior should be preserved: selected folders remain audit inputs, selected files remain audit inputs, audit options keep their current semantics, and ffprobe/black-border work still happens only during audit, not during folder tree scanning.

## TreeTable Plug-In Target

- Add the folder-tree UX inside or alongside `SourceConfigDialog`, replacing the basic native folder picker as the primary folder-selection path.
- Keep the existing selected-file button and selected-file audit state as-is.
- The future dialog flow should be:
  1. User opens `SourceConfigDialog`.
  2. User chooses a root folder through a typed preload/main IPC method.
  3. Main process eagerly scans the full recursive folder tree for that root.
  4. Renderer receives one complete tree result and renders PrimeReact `TreeTable`.
  5. Expanding folders updates only local TreeTable UI state.
  6. Confirming selection writes deduped absolute folder paths to `selectedFolders`.
- `SourceSummaryBar` can continue to summarize `selectedFolders.length`, but later stages may improve it with selected video counts/size after the TreeTable summary type exists.
- `canRunAudit`, `runAudit`, `refreshAudit`, persisted saved audit results, and recent-folder settings can continue to use the same `selectedFolders: string[]` contract.

## Existing Utilities to Reuse or Centralize

- Reuse `SUPPORTED_VIDEO_EXTENSIONS`, `SUPPORTED_VIDEO_EXTENSION_NAMES`, `isSupportedVideoFileName`, and related helpers from `src/shared/constants/videoExtensions.ts`.
- The folder-tree service should centralize skip-folder names instead of copying the current `SYSTEM_DIRECTORY_NAMES` from `fileDiscoveryService`.
- The existing skip list already covers:
  - `.Spotlight-V100`
  - `.Trashes`
  - `.fseventsd`
  - `.TemporaryItems`
  - `System Volume Information`
  - `.git`
  - `node_modules`
  - `.collie-video-temp`
  - `.collie-video-trash`
  - `.collie-video-cleanup-runs`
  - `Archive`
  - `archived-files`
- The folder-tree plan also requires legacy app temp names:
  - `.video-audit-temp`
  - `.video-audit-trash`
  - `.video-audit-cleanup-runs`
- `PathSelectionResult` is useful for native root-folder choice, but folder tree scan/selection needs its own shared types because it includes progress, counts, sizes, skipped/error summaries, and TreeTable-safe node keys.
- The original Vite app has useful reference logic for TreeTable checkbox selection, effective selected path dedupe, and selected summary calculation. Do not copy its IndexedDB folder-tree cache behavior into this app.

## Reference App Findings

- The original web app used `FolderBrowserDialog` with PrimeReact `TreeTable`, checkbox selection, expanded key state, selected summary, and parent/descendant selected-folder dedupe.
- The original web app also cached folder trees in IndexedDB. That behavior conflicts with the Electron plan and must not be migrated.
- The original web app fetched folder trees over `/api/folders/tree`. The Electron implementation should use typed IPC/preload methods instead of Express/HTTP.
- The original web app filtered out zero-video child folders. The Electron plan says every folder/subfolder under the root should be included unless skipped for safety/system-folder reasons, so the new service should include zero-video folders too.
- The original web app displayed a column labeled `Size`; the Electron plan requires the label `Video Size` because only supported video file sizes are summed.

## Risks and Constraints

- Parent/descendant dedupe must be path-aware, not just string-prefix based. It should normalize separators and trailing slashes and avoid treating sibling names as descendants.
- The main process should validate that a scan root exists, is absolute, is a directory, and is not a symlink before scanning.
- The renderer must never perform the recursive scan or directly read filesystem metadata.
- Tree expansion must never call IPC or the filesystem. All child nodes must be present in the initial scan result.
- There should be no folder-tree cache in renderer storage, settings, or main-process services.
- The tree scan should not run ffprobe, black-border analysis, thumbnail generation, audit discovery jobs, or any mutation workflow.
- The future folder tree scan may overlap in responsibility with `fileDiscoveryService`; avoid changing existing discovery/audit behavior while introducing the new service.
- `includeSubfolders` currently controls audit discovery recursion. Once selected folders can already be precise subfolders, future UX should decide whether that option remains visible, is hidden for TreeTable-selected folders, or is interpreted as a downstream audit option only. Do not silently change it in Stage 1.

## Implementation Target for Next Stages

- Stage 2 should add shared folder-tree types and centralized skip-folder constants.
- Stage 3 should add a main-process eager scan service that returns one complete tree with direct and recursive supported-video counts/sizes.
- Stage 4 should add typed IPC/preload methods for choosing a root, scanning a root, progress events, and cancellation.
- Stage 5 should add the PrimeReact TreeTable UI and selection summary using local expansion/selection state only.
- The confirmed selected folder output should remain `string[]` of deduped absolute paths so current audit, refresh, and persistence paths continue to work.
