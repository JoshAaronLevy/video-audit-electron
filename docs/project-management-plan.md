# Project Management And Save Cache Plan

## Goal

Add project saving and project restore to Collie Video so a user can save the current workspace at any time, reopen saved projects from a prominent sidebar, delete projects with confirmation, and choose whether to restore the saved workspace or scan the saved sources again.

The user is the only intended user for now, so there is no auth layer and no multi-user sync layer.

The key product behavior:

- A prominent Save control is available in the main workspace.
- First save prompts for a project name.
- Later saves update the current project.
- Named projects are internal app-managed projects under Electron `userData`. Export/import can be added later.
- A project sidebar shows saved projects with source, output, scan, row, and saved-state details.
- A project can be opened in either `Restore` or `Scan Again` mode.
- `Restore` loads the saved state, including hidden/removed rows.
- `Restore` brings back search/filter/show-thumbnails state, but clears active table selection.
- `Scan Again` shows a confirmation summary and then reruns the saved `AuditRequest` exactly.
- Deleting a project prompts before removing it.
- Explicit Save remains prominent, and already-named projects can conservatively autosave after important mutations.

Example restore rule:

If a scan found 100 flagged rows and the user removed 20 from the DataTable before saving, restoring the project should load the saved workspace with 80 visible rows. The saved project may still retain the hidden rows internally through `visible: false`, but the table should show the same active workspace the user saved.

## Current Architecture Snapshot

This plan replaces the earlier pre-refactor guidance. The current app already has a much cleaner separation:

- `src/renderer/App.tsx` composes the app shell and local dialog/sidebar visibility.
- `src/renderer/hooks/useVideoAuditAppController.ts` composes focused workflow hooks.
- `src/renderer/stores/useVideoResultsStore.ts` owns the focused Zustand result workspace.
- `src/renderer/hooks/useAuditResults.ts` bridges workflows, the results store, storage messages, row hiding/restoring, and audit-result persistence.
- `src/renderer/storage/auditResultStorage.ts` currently persists the latest audit result and audit-history metadata in IndexedDB database `collie-video`.
- `src/renderer/hooks/useInitialVideoAuditState.ts` restores settings, source selection, audit options, and the current stored audit at startup.
- `src/main/services/settingsService.ts` already persists app settings through the main process using atomic JSON writes.
- `src/main/services/appPaths.ts` centralizes app support paths from `app.getPath('userData')`.
- `src/shared/constants/ipcChannels.ts`, `src/preload/videoAuditApi.ts`, and `src/renderer/api/*Client.ts` are the typed cross-process boundary.

Zustand is now part of the architecture, but it should not become the durable project-file layer. Zustand should hold focused live renderer state. Durable named projects should be persisted through Electron main-process services and exposed to the renderer through typed preload APIs.

## Storage Strategy

Use two related storage layers:

1. Current working cache

   Keep the existing IndexedDB latest-audit cache in `src/renderer/storage/auditResultStorage.ts` for fast startup restore and compatibility with the current app behavior.

2. Named project persistence

   Add main-process JSON project files under Electron `userData`. This should become the durable source of truth for named projects.

   Keep named projects internal to the app for the first implementation. Do not add user-visible project files or file associations yet. Later, add `Export Project` / `Import Project` if backup or portability becomes important.

Recommended app support layout:

```txt
~/Library/Application Support/Collie Video/
├─ settings.json
├─ projects/
│  ├─ project-index.json
│  ├─ <projectId>.json
│  └─ <projectId>.json
├─ media-preview/
└─ file-operations/
```

Use atomic writes for project JSON, matching the settings service pattern:

```txt
write <file>.tmp
rename <file>.tmp -> <file>
```

Do not store named projects only in renderer `localStorage`, and do not make Zustand persist middleware the primary storage mechanism.

## Project Data Model

Add shared project types in:

```txt
src/shared/types/project.ts
```

Suggested types:

```ts
import type { AuditRequest, AuditResult } from './audit';
import type { SelectedFolderSummary } from './folderTree';
import type { AppSettings } from './settings';

export type ProjectOpenMode = 'restore' | 'scan-again';

export interface ProjectIndex {
  schemaVersion: 1;
  lastActiveProjectId: string | null;
  projects: ProjectIndexItem[];
}

export interface ProjectIndexItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary: string;
  outputFolder: string | null;
  rowCount: number;
  visibleRowCount: number;
  removedRowCount: number;
  flaggedCount: number;
  errorCount: number;
  lastRunAt: string | null;
}

export interface VideoProject {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  sources: {
    selectedFolders: string[];
    selectedFolderSummary: SelectedFolderSummary | null;
    folderTreeRootPath: string | null;
    folderTreeLastScannedAt: string | null;
    selectedFiles: string[];
    outputFolder: string | null;
  };

  audit: {
    request: AuditRequest | null;
    result: AuditResult | null;
    savedAt: string | null;
  };

  workspace: {
    searchQuery: string;
    activeViewFilter: string;
    showThumbnails: boolean;
  };

  settingsSnapshot: Pick<
    AppSettings,
    | 'defaultAutoFixDestinationRoot'
    | 'previewClipDurationSecondsDefault'
    | 'previewClipWidthDefault'
    | 'defaultOriginalDisposition'
    | 'fileManagementConflictStrategy'
    | 'showPostConversionDialogAutomatically'
    | 'defaultPostConversionAction'
  > | null;

  metadata: {
    appVersion: string | null;
    savedBy: 'collie-video';
  };
}
```

Important row behavior:

- Persist the normalized `AuditResult` from `useVideoResultsStore`.
- Preserve `VideoRow.visible`.
- Do not create a separate `removedRowIds` list unless it becomes necessary for migration. The current row model already represents hidden rows with `visible: false`.
- Use selectors such as `getActiveRows` to derive `visibleRowCount`.
- Do not persist active table selection in the project snapshot.
- Clear table selection on restore so destructive actions never begin from stale selected rows.

## Main Process Project Service

Add:

```txt
src/main/services/projectService.ts
```

Responsibilities:

- Resolve `projects/` and `project-index.json` paths from `getAppDataDir()`.
- Create project IDs.
- Load and normalize `project-index.json`.
- List project index items.
- Create a project from a renderer snapshot.
- Save an existing project from a renderer snapshot.
- Load a full project by ID.
- Delete a project by ID.
- Mark `lastActiveProjectId`.
- Recover safely from missing/corrupt project files.
- Keep project files private to the app support folder.

Also update:

```txt
src/main/services/appPaths.ts
```

Add helpers:

```ts
export function getProjectsDir(): string;
export function getProjectIndexFilePath(): string;
export function getProjectFilePath(projectId: string): string;
```

Use conservative filename handling. Project IDs should be generated by the app, not derived from raw names.

## IPC And Preload Boundary

Add project IPC channels in:

```txt
src/shared/constants/ipcChannels.ts
```

Suggested channels:

```ts
projectList: 'project:list'
projectCreate: 'project:create'
projectSave: 'project:save'
projectLoad: 'project:load'
projectDelete: 'project:delete'
projectSetLastActive: 'project:set-last-active'
```

Add:

```txt
src/main/ipc/projectIpc.ts
```

Register it from:

```txt
src/main/ipc/registerIpcHandlers.ts
```

Extend:

```txt
src/preload/videoAuditApi.ts
src/renderer/global.d.ts
```

Add renderer client:

```txt
src/renderer/api/projectClient.ts
```

The renderer should call `projectClient`, not `window.videoAudit.projects` directly.

## Renderer Project State

Add a focused project workflow hook first:

```txt
src/renderer/hooks/useProjectWorkspace.ts
```

This hook should own:

- `projectIndexItems`
- `activeProjectId`
- `activeProjectName`
- `projectSavedAt`
- `projectMessage`
- `projectError`
- `isProjectSidebarVisible` if kept controller-owned, or expose open/close handlers if `App.tsx` owns sidebar visibility
- save/create/open/delete actions

Whether to add a second Zustand store is optional. Based on the current architecture docs, add a `useProjectStore` only if the state quickly has several distant readers/writers. A focused project store would be acceptable because project identity, dirty state, index items, and save status cross the header, sidebar, controller, and save actions. Do not create a generic `useAppStore`.

Suggested store if needed:

```txt
src/renderer/stores/useProjectStore.ts
src/renderer/stores/projectSelectors.ts
```

It should own project workspace metadata only, not filesystem persistence or scan execution.

## Snapshot Creation

Create a pure helper that builds a `VideoProject` snapshot from current renderer state:

```txt
src/renderer/helpers/projectSnapshot.ts
```

Inputs should come from:

- source selection state from `useAuditSourceController`
- `auditOptions`
- `lastAuditRequest`
- `auditResult`, `rows`, `searchQuery`, `activeViewFilter`, and `showThumbnails` from `useVideoResultsStore`
- useful settings fields from `useSettingsController`
- app version from `appInfo`

The helper should not call IPC and should not mutate state.

## Save UX

Update:

```txt
src/renderer/components/AppHeader.tsx
```

Add prominent project controls:

- `Projects` button with `pi pi-folder-open`
- `Save` button with `pi pi-save`
- project name/status text near the app title or header center

Suggested header status:

```txt
Untitled Project
Saved 2 min ago
Unsaved changes
Saving...
Save failed
```

First save:

- If no `activeProjectId`, open a project-name dialog.
- Save current snapshot through `projectClient.create`.
- Set the returned project as active.
- Refresh the project index.
- Show a concise success message.

Subsequent save:

- Build a fresh snapshot.
- Save through `projectClient.save`.
- Refresh active metadata/index.
- Show saved status.

Do not block saving just because no audit has been run. A project with only selected sources/options/output folder is still useful.

Already-named projects should also support conservative autosave after important mutations, but the explicit Save button remains the primary confidence affordance.

## Project Sidebar UX

Use PrimeReact `Sidebar` in headless mode. PrimeReact 10 documents headless mode through the `content` prop, which receives helpers such as `hide` and `closeIconRef`; use that so the sidebar can have custom Collie Video styling while still using the PrimeReact overlay behavior.

Add:

```txt
src/renderer/components/ProjectSidebar.tsx
```

Recommended structure:

- Header: `Projects`, close icon button.
- Save current project CTA when there is unsaved or unnamed work.
- List of saved project cards/rows.
- Each project shows:
  - name
  - updated date
  - source summary
  - output folder
  - total row count
  - visible row count
  - removed row count
  - flagged count
  - error count
  - last run date
- Actions:
  - `Open`
  - `Delete`

Use PrimeReact components where they fit:

- `Sidebar`
- `Button`
- `Tag`
- `Divider`
- `ScrollPanel` if the list needs its own scrolling
- `ConfirmDialog` or existing dialog styling for delete confirmation

Keep the sidebar width stable:

```txt
desktop: 420-480px right sidebar
small screens: full width
```

## Open Project Flow

Clicking `Open` should present two choices:

```txt
Restore
Scan Again
```

Add:

```txt
src/renderer/components/ProjectOpenDialog.tsx
```

Restore:

1. Load the full project through `projectClient.load(projectId)`.
2. Apply saved source selection state.
3. Apply saved audit options from the saved request.
4. Hydrate the saved `AuditResult` into `useVideoResultsStore`.
5. Restore search/filter/show-thumbnails state.
6. Clear selected rows.
7. Set active project metadata.
8. Close the sidebar/dialog.

Scan Again:

1. Load the full project.
2. Apply saved source selection state.
3. Apply the saved audit options/request.
4. Show a confirmation summary of the saved request, including sources, output folder, and audit options.
5. Start a new audit using the saved `AuditRequest` exactly after confirmation.
6. Do not reuse old rows once the scan starts.
7. Save the new audit result back into the active project after the scan completes through conservative autosave, or immediately if the user presses Save.

If a project has no saved `AuditRequest`, disable `Scan Again` and explain that the project can be restored but not rescanned yet.

## Delete Project Flow

Delete must be explicit:

1. User clicks `Delete`.
2. Show confirmation with project name.
3. If confirmed, call `projectClient.delete(projectId)`.
4. Refresh the project index.
5. If the deleted project is currently active:
   - Clear active project metadata.
   - Do not automatically clear the current workspace unless the user explicitly chose to delete and close the active project.

Recommended wording:

```txt
Delete "Tennis Cleanup"?
This removes the saved project from Collie Video. It does not delete source videos or output files.
```

## Dirty State And Autosave

Track dirty state after a project is active.

Meaningful changes:

- source folders/files changed
- output folder changed
- audit options changed
- audit completed
- rows hidden/restored
- thumbnail/preview metadata merged
- search/filter/show-thumbnails changed

Do not mark dirty for:

- progress updates
- transient workflow messages
- toasts
- open/closed dialog state
- active hover/preview frame fetch state
- Premiere status refresh

Implementation rule:

Use explicit Save for user confidence, plus conservative autosave for already-named active projects. Debounce autosaves after durable state changes and avoid saving during every progress tick.

Autosave should run after important mutations such as hiding/restoring rows, generating thumbnails or preview clips, changing source/output settings, changing audit options, or receiving a completed audit result. First save for an unnamed project must still prompt for a project name.

## File Availability Validation

Do not make the renderer check the filesystem directly.

Use the existing boundary direction documented in `docs/renderer-state-architecture.md`:

1. Main process validates files with `fs.stat`.
2. Renderer receives typed validation results through preload and a renderer API client.
3. Results store merges availability fields into rows if needed.
4. Table and action capabilities render from row data.

This can be a follow-up stage, but the project model should leave room for it.

Suggested shared row status:

```ts
export type SavedFileAvailability = 'available' | 'missing' | 'changed' | 'unavailable';
```

Rules:

- Missing path: `missing`
- Path exists but is not a file: `unavailable`
- Size and modified time match: `available`
- Size or modified time differs: `changed`

Do not rerun ffprobe automatically on project restore. Keep restore fast and offer a later refresh/scan action.

## Staged Implementation Plan

### Stage 1: Shared Types And Storage Paths

- Add `src/shared/types/project.ts`.
- Add project IPC channel constants.
- Add project path helpers in `src/main/services/appPaths.ts`.
- Define normalizers for project index/project manifests.

Acceptance criteria:

- TypeScript can import project types from shared code.
- Project storage paths resolve from `app.getPath('userData')`.
- No renderer filesystem access is introduced.

### Stage 2: Main Project Service

- Add `src/main/services/projectService.ts`.
- Implement list/create/save/load/delete.
- Implement project index maintenance.
- Use atomic JSON writes.
- Handle missing/corrupt files without crashing the app.

Acceptance criteria:

- Main service can create, update, read, list, and delete projects.
- Project index summaries update after create/save/delete.
- Deleting a project never touches source videos, output videos, media cache, or operation history.

### Stage 3: IPC, Preload, And Renderer Client

- Add `src/main/ipc/projectIpc.ts`.
- Register project IPC handlers.
- Extend `VideoAuditApi`.
- Update `src/renderer/global.d.ts`.
- Add `src/renderer/api/projectClient.ts`.

Acceptance criteria:

- Renderer can list/create/save/load/delete through typed APIs.
- Components and hooks do not call `window.videoAudit.*` directly.

### Stage 4: Snapshot Builder And Project Workspace Hook

- Add `src/renderer/helpers/projectSnapshot.ts`.
- Add `src/renderer/hooks/useProjectWorkspace.ts`.
- Wire it into `useVideoAuditAppController`.
- Expose project metadata and actions through `VideoAuditAppController`.
- Decide whether a focused `useProjectStore` is justified.

Acceptance criteria:

- Current workspace can be converted into a project snapshot.
- Active project ID/name/save status are available to the header/sidebar.
- No workflow execution logic moves into the project hook/store.

### Stage 5: Header Save Controls

- Update `AppHeader`.
- Add first-save name dialog.
- Add save status.
- Save unnamed and named projects.

Acceptance criteria:

- User can save before or after running a scan.
- First save prompts for a name.
- Later saves update the same project.
- Save failure is visible and does not clear current work.

### Stage 6: Project Sidebar

- Add `ProjectSidebar` using PrimeReact `Sidebar` headless `content`.
- Add project list loading.
- Add project details and open/delete actions.
- Add responsive sidebar styling in `src/renderer/styles/app.css`.

Acceptance criteria:

- Sidebar opens from a prominent header button.
- Saved projects show useful details.
- The list handles empty/loading/error states.
- The sidebar uses PrimeReact overlay behavior with custom content.

### Stage 7: Restore And Scan Again

- Add `ProjectOpenDialog`.
- Implement `Restore`.
- Implement `Scan Again`.
- Ensure restore preserves hidden rows and shows only active rows in the DataTable.
- Ensure `Scan Again` uses the saved request rather than reconstructing it from current UI state.

Acceptance criteria:

- Restored project rows match the saved visible/hidden state.
- Source selection, output folder, audit options, and useful UI state restore.
- `Scan Again` starts from the saved project request.
- Running jobs and transient modals are not restored.

### Stage 8: Delete Confirmation

- Add delete confirmation.
- Wire delete through project client.
- Refresh index after delete.
- Handle active-project deletion intentionally.

Acceptance criteria:

- Delete requires confirmation.
- Deleted projects disappear from the sidebar.
- Source/output media files are not deleted.

### Stage 9: Autosave And Dirty State

- Add dirty tracking.
- Add conservative autosave for already-named projects.
- Debounce saves and skip progress-only updates.

Acceptance criteria:

- Header status accurately reflects saved/unsaved/saving/failed state.
- Autosave never writes on every progress tick.
- Explicit Save remains available.

### Stage 10: Optional File Availability Validation

- Add main-process validation service or reuse existing file-operation validation where appropriate.
- Add typed API for validating project rows/sources.
- Merge status into rows after restore.
- Show missing/changed summary in the workspace.

Acceptance criteria:

- Restore remains fast.
- Missing/changed files are detected by main-process stat checks.
- No expensive ffprobe rerun happens automatically.

## Implementation Notes

- Keep named project persistence in main-process JSON, not IndexedDB.
- Keep the existing IndexedDB current audit cache until project restore fully supersedes it.
- Do not move settings persistence into projects. Store a useful project snapshot, but app-wide settings remain app-wide.
- Keep media preview files in the existing media cache. Store row metadata/references in the project; do not duplicate generated media files into the project file for the first version.
- Do not restore in-progress jobs. On restore, all progress state should be idle.
- Do not restore open modals by default.
- Do not add auth.
- Do not introduce SQLite unless JSON project files become painful.

## Verification Plan

Run:

```txt
npm run typecheck
npm run build
```

Manual checks:

1. Save a project with sources/options but no scan.
2. Save a project after a scan.
3. Hide/remove rows, save, quit/relaunch, restore, and confirm only active rows show.
4. Generate thumbnails/previews, save, restore, and confirm existing row metadata still renders where cache files exist.
5. Open project sidebar with no projects, one project, and multiple projects.
6. Delete a project and confirm source/output files remain untouched.
7. Use `Scan Again` and confirm it runs the saved request.
8. Confirm clear-cache/data behavior still does what it says and does not accidentally delete named projects unless explicitly designed to do so.

## Documentation Updates

After implementation, update:

```txt
README.md
docs/renderer-architecture.md
docs/renderer-state-architecture.md
CHANGELOG.md
```

Versioning:

- Bump `package.json` and `package-lock.json` according to the repo's existing release pattern.
- Ensure the changelog version matches `package.json`.
