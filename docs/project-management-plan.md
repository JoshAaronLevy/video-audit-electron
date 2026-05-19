Yes — this is the right thing to think about now, because once the app is packaged and launched like a normal Mac app, **“open app → everything is gone” will feel broken**, even if technically the app is working.

My recommendation:

> Use a combination: **Electron main-process file persistence for durable app/project state**, plus **React state/hooks for live UI state**, and maybe **localStorage only for disposable UI preferences**.

I would **not** make Zustand the persistence backbone. Zustand is fine for in-memory renderer state, but the actual durable source of truth should be files managed by Electron main, not browser storage.

---

# The short answer

For your app, I’d use this hierarchy:

```txt
Durable app/project state:
  Main process writes JSON manifest files under app userData

Live UI state:
  React hooks / maybe Zustand later if state gets annoying

Small renderer-only preferences:
  localStorage is okay, but optional

Large/important data:
  JSON files first, SQLite later only if JSON becomes painful
```

For “restore latest state,” implement:

```txt
App startup:
  load last active project/session manifest
  restore video rows, filters, selected project, settings
  quickly validate file existence in background
  show missing/moved file warnings
```

For “projects,” implement project manifests:

```txt
~/Library/Application Support/video-audit-electron/projects/<projectId>/project.json
```

That project manifest contains the audit state, video rows, source folders, output folder, settings snapshot, generated thumbnail/preview references, and UI state needed to reopen the project almost exactly where you left off.

---

# Why not just localStorage?

You *can* use localStorage for small stuff, but I would not trust it as the primary persistence layer for this app.

## localStorage is okay for:

```txt
last selected tab
table density
column visibility
sidebar collapsed
theme preference
last view filter
```

## localStorage is not ideal for:

```txt
thousands of video rows
absolute file paths
project manifests
operation history
ffmpeg results
thumbnail/preview manifests
migration plans
replacement plans
large JSON blobs
anything you’d be upset to lose
```

The app is an Electron desktop utility, not a website. So use the filesystem like a desktop app.

---

# Why not Zustand?

Zustand solves a different problem.

It is good for:

* shared renderer state
* avoiding prop drilling
* keeping UI state organized
* separating state slices

But Zustand persistence usually still persists to localStorage by default, unless you customize storage. That does not magically make it a good project-file system.

I’d only introduce Zustand if, after your refactor, React hooks/context still feel awkward.

Given you’re already planning a refactor, I’d try focused hooks first:

```txt
useProjectState
useResultRows
useSourceSelection
useAuditWorkflow
useSettingsController
```

Then if cross-cutting state remains annoying, maybe use Zustand for renderer state. But durable project data should still live in main-process-managed JSON files.

---

# The model I’d use

Think of the app as having three layers:

```txt
┌────────────────────────────────────────────┐
│ Renderer live state                         │
│ React hooks / components / table state      │
└────────────────────────────────────────────┘
                    ↓ save/load through preload
┌────────────────────────────────────────────┐
│ Main process persistence services           │
│ projectService, sessionService, settings    │
└────────────────────────────────────────────┘
                    ↓ files
┌────────────────────────────────────────────┐
│ Disk                                        │
│ project.json, app-state.json, settings.json │
└────────────────────────────────────────────┘
```

The renderer should not directly read/write these files. It should call typed preload APIs:

```ts
window.videoAudit.projects.createProject(...)
window.videoAudit.projects.openProject(projectId)
window.videoAudit.projects.saveProject(projectId, snapshot)
window.videoAudit.projects.getLastActiveProject()
```

---

# Immediate need: restore latest state on launch

Before full “projects,” you can implement a simpler **session restore** feature.

## Version 1: Last Session Restore

Persist:

```ts
type LastSessionState = {
  schemaVersion: 1;
  savedAt: string;

  activeProjectId: string | null;

  sources: {
    selectedFolders: string[];
    selectedFiles: string[];
    outputFolder: string | null;
    includeSubfolders: boolean;
    includeLowResolutionAnalysis: boolean;
    includeBlackBorderAnalysis: boolean;
  };

  results: {
    auditedRootDirectory: string | null;
    rows: VideoRow[];
    removedRowIds: string[];
    lastAuditSummary: AuditSummary | null;
  };

  table: {
    search: string;
    viewFilter: 'all' | 'flagged' | 'low-res' | 'aspect' | 'crop' | 'errors';
    showThumbnails: boolean;
    columnVisibility?: Record<string, boolean>;
    sortField?: string | null;
    sortOrder?: 1 | -1 | 0 | null;
  };

  ui: {
    activeTab?: string;
    selectedVideoIds?: string[];
  };
};
```

On app startup:

1. main process loads `last-session.json`
2. renderer receives it
3. renderer hydrates rows and UI
4. app shows the prior results immediately
5. background validation checks whether files still exist
6. missing files get badges or a banner

This gives you 80% of the value quickly.

## Where to store it

Use Electron’s `app.getPath('userData')`.

On macOS that usually resolves to something like:

```txt
~/Library/Application Support/video-audit-electron/
```

Suggested files:

```txt
~/Library/Application Support/video-audit-electron/
├─ settings.json
├─ last-session.json
├─ projects/
├─ media-preview-cache/
└─ operation-history/
```

---

# Autosave strategy

You don’t want to write to disk on every keystroke or every row selection event.

Use debounced saves.

Example behavior:

```txt
Save immediately:
- audit completes
- project created
- project opened
- user changes source/output folder
- user runs auto-fix/crop
- user manually saves project

Save debounced:
- table search changes
- filter changes
- selected rows change
- column visibility changes
- active tab changes

Do not save:
- every tiny progress update
```

I’d use something like:

```ts
useEffect(() => {
  const timeout = window.setTimeout(() => {
    void saveLastSession(snapshot);
  }, 750);

  return () => window.clearTimeout(timeout);
}, [snapshot]);
```

But be careful: `snapshot` should be memoized or you’ll save constantly.

Better is to save on meaningful state changes via an explicit `scheduleSave()` helper.

---

# What should be restored?

You said:

> videos loaded and everything

For the latest-state feature, restore:

## Must restore

```txt
video rows
audit summary
selected source folders/files
output folder
audit options
table search/filter
show thumbnails setting
removed/restored rows
Premiere bridge status can refresh, not restore
settings
```

## Nice to restore

```txt
selected rows
sort column/order
table column widths/visibility
active details modal? probably no
active tab
last opened project
last migration scan result
last auto-fix/crop result summaries
thumbnail/preview cache references
```

## Probably should not restore as “active”

```txt
running jobs
in-progress ffmpeg operation
open modal states
temporary progress bars
toasts
```

If app closes mid-job, on next startup show:

```txt
Previous job did not complete.
```

But don’t pretend it’s still running unless you implement true resumable jobs.

---

# Project feature: yes, excellent idea

The project idea is very good, and it maps naturally to your workflow.

You could have:

```txt
Project: "Spring 2026 Tennis Highlights"
Sources:
  /Volumes/SanDisk SSD/Videos/Tennis/Raw
Output:
  /Users/joshlevy/Movies/Edited/Tennis
Rows:
  184 videos
Generated:
  thumbnails
  preview clips
  auto-fix outputs
State:
  filters
  selected view
  removed rows
  notes maybe later
```

Then another project:

```txt
Project: "Family Videos Cleanup"
```

Different sources, different output, different table state.

That makes total sense.

---

# Simple project implementation

You do **not** need SQLite to start.

Use project folders with manifest JSON.

```txt
userData/
└─ projects/
   ├─ project-index.json
   ├─ 01JABC123-project/
   │  ├─ project.json
   │  ├─ audit-results.json
   │  ├─ ui-state.json
   │  └─ media-preview-manifest.json
   └─ 01JDEF456-project/
      ├─ project.json
      ├─ audit-results.json
      ├─ ui-state.json
      └─ media-preview-manifest.json
```

Or simpler at first:

```txt
userData/
└─ projects/
   ├─ project-index.json
   ├─ <projectId>.json
   └─ <projectId>.json
```

I’d start with **one JSON file per project** unless the files get huge.

## Project index

```ts
type ProjectIndex = {
  schemaVersion: 1;
  projects: ProjectIndexItem[];
  lastActiveProjectId: string | null;
};

type ProjectIndexItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary: string;
  videoCount: number;
  flaggedCount: number;
  missingCount?: number;
};
```

## Project manifest

```ts
type VideoAuditProject = {
  schemaVersion: 1;

  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  sources: {
    selectedFolders: string[];
    selectedFiles: string[];
    outputFolder: string | null;
    includeSubfolders: boolean;
    includeLowResolutionAnalysis: boolean;
    includeBlackBorderAnalysis: boolean;
  };

  audit: {
    lastRunAt: string | null;
    summary: AuditSummary | null;
    rows: VideoRow[];
    errors: AuditError[];
    removedRowIds: string[];
  };

  mediaPreview: {
    thumbnailManifestIds?: string[];
    previewClipManifestIds?: string[];
  };

  workflows: {
    lastAutoFixResult?: AutoFixResultSummary | null;
    lastAutoCropResult?: AutoCropResultSummary | null;
    lastMigrationResult?: MigrationResultSummary | null;
  };

  ui: {
    search: string;
    viewFilter: string;
    showThumbnails: boolean;
    sortField?: string | null;
    sortOrder?: 1 | -1 | 0 | null;
    columnVisibility?: Record<string, boolean>;
    selectedVideoIds?: string[];
  };
};
```

That is enough to reopen a project and mostly restore the working state.

---

# Opening a project

When user opens a project:

1. Load project JSON.
2. Render immediately from saved rows.
3. Start background validation:

   * do source folders still exist?
   * do video files still exist?
   * do sizes/modified timestamps match?
   * do thumbnail/preview cache files exist?
4. Update rows with availability state:

   * available
   * missing
   * changed
   * unavailable
5. Show banner:

```txt
Project restored. 184 videos loaded. 3 files missing.
[Review Missing Files]
```

This is exactly the Premiere-like behavior you’re describing.

---

# “Exactly where I left off”

To restore “exactly,” save two categories:

## Durable project state

```txt
sources
output folder
rows
audit results
generated outputs
thumbnail manifests
preview manifests
operation history references
```

## UI workspace state

```txt
search
filters
sort
columns
selected rows
active tab
table page/page size
show thumbnails
maybe selected details video
```

But I would not restore open modals by default. That usually feels weird.

Example:

> If the app closed with Settings open, don’t reopen Settings.
> If it closed with a selected video details modal open, maybe restore selected row but not the modal.

---

# Handling missing files

This is important and easy to do reasonably.

Each saved video row should include identity data:

```ts
type SavedVideoIdentity = {
  path: string;
  fileName: string;
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  durationSeconds: number | null;
};
```

On project open, do a quick file check:

```ts
type FileAvailability =
  | 'available'
  | 'missing'
  | 'changed'
  | 'unavailable';
```

Rules:

```txt
path does not exist:
  missing

path exists but not file:
  unavailable

path exists, size and modified time match:
  available

path exists, size or modified time differs:
  changed
```

Do **not** re-run ffprobe on every project open by default. That can be slow.

Just stat files first. Offer:

```txt
[Refresh metadata]
```

for changed files.

---

# Project saving UX

Add a small project menu:

```txt
File
├─ New Project
├─ Open Project...
├─ Save Project
├─ Save Project As...
├─ Recent Projects
└─ Close Project
```

In UI header:

```txt
Video Audit — Tennis Cleanup
Unsaved changes
```

Or:

```txt
Project: Tennis Cleanup     Saved 2 min ago
```

## Autosave vs explicit save

For a private utility, I’d do both:

```txt
Autosave project state frequently
Manual Save button/menu for confidence
```

Similar to modern apps.

You can show:

```txt
Saved
Saving...
Unsaved changes
Save failed
```

---

# Should project files be user-visible?

Two options.

## Option A: Internal projects only

Projects live in app support folder:

```txt
~/Library/Application Support/video-audit-electron/projects/
```

Pros:

* simple
* controlled
* no weird file picker issues
* easy recent projects
* good for private app

Cons:

* less obvious backup/export

## Option B: User-visible `.videoaudit` project files

Example:

```txt
~/Documents/Video Audit Projects/Tennis.videoaudit
```

This could be a JSON file or package folder.

Pros:

* feels like Premiere projects
* easy backup/move
* user can double-click later if associated
* nice mental model

Cons:

* more complexity
* file association later
* paths inside can break when moved

## My recommendation

Start with **internal projects**, then later add:

```txt
Export Project...
Import Project...
```

No need to build file associations yet.

---

# Best implementation order

Do this in layers:

## Phase 1: Latest state restore

This solves your urgent need.

* save last session
* load it on launch
* restore video rows
* background validate missing files

## Phase 2: Project foundation

* project types
* create/open/save project
* project index
* recent projects

## Phase 3: Project UX

* new/open/save UI
* project menu
* project switcher
* unsaved/saved status
* missing file review

## Phase 4: Exact workspace restore

* table columns
* filters
* selected rows
* active tab
* preview state
* last selected video

---

# Where this fits in your plans

You currently have:

```txt
Electron conversion
UI improvement
Code refactor
File management
```

I’d insert this **after UI improvement and before code refactor**, or **as part of the refactor plan**?

Actually, given your immediate concern, I’d do:

```txt
1. Finish UI improvement
2. Implement latest-state restore
3. Run code refactor
4. Implement full project system
5. Implement file management
```

But if the 2,500-line controller is already painful, you might want:

```txt
1. Finish UI improvement
2. Run code refactor enough to extract persistence/results state
3. Implement latest-state restore + projects
4. File management
```

My practical recommendation:

> Add a small **state persistence/project plan** before file management. Do latest session restore first. Full projects second.

Do not wait until after file management. File management operations should belong to a project/session history.

---

# What I’d ask Codex for now

For the immediate “restore latest state” need, use this prompt.

````md
# Context & Problem

This is the standalone `video-audit-electron` app.

I want the app to restore the latest working state when opened, so I do not lose loaded video rows/results every time I quit and relaunch the packaged app.

This is not the full project system yet. This is latest-session persistence.

Use:

- `.codex-instructions.md`
- `CONTRIBUTING.md`
- `electron-conversion-plan.md`
- `ui-improvement-plan.md` if present

# Task

Implement latest-session persistence and restore.

# Requirements

1. Persist the latest app/session state to disk using the Electron main process.
2. Do not use renderer localStorage as the primary persistence mechanism.
3. Store the session file under Electron `app.getPath('userData')`.
4. Add typed preload APIs for loading/saving/clearing latest session state.
5. Restore video rows/results on app startup.
6. Restore selected sources and output folder where practical.
7. Restore audit options.
8. Restore table UI state where practical:
   - search
   - active view filter
   - show thumbnails
   - sort/page/column visibility if currently tracked
9. Do not restore active running jobs.
10. Do not restore transient toasts.
11. Do not reopen modals by default.
12. After restoring rows, validate file availability in the background:
   - available
   - missing
   - changed
   - unavailable
13. Show a clear banner or status if restored rows include missing/changed files.
14. Avoid expensive ffprobe re-analysis on startup.
15. Use cheap filesystem stat validation first.
16. Ensure corrupt/missing session files do not crash the app.
17. Do not write tests unless explicitly requested.

# Suggested Files

Main process:

```txt
src/main/services/sessionService.ts
src/main/ipc/sessionIpc.ts
````

Shared types:

```txt
src/shared/types/session.ts
```

Renderer:

```txt
src/renderer/hooks/useSessionRestore.ts
```

or integrate into the existing app controller if cleaner for the current architecture.

# Suggested Session Shape

```ts
type LastSessionState = {
  schemaVersion: 1;
  savedAt: string;
  sources: {
    selectedFolders: string[];
    selectedFiles: string[];
    outputFolder: string | null;
    includeSubfolders: boolean;
    includeLowResolutionAnalysis: boolean;
    includeBlackBorderAnalysis: boolean;
  };
  results: {
    auditedRootDirectory: string | null;
    rows: VideoRow[];
    removedRowIds: string[];
    lastAuditSummary: AuditSummary | null;
  };
  table: {
    search: string;
    viewFilter: string;
    showThumbnails: boolean;
    sortField?: string | null;
    sortOrder?: 1 | -1 | 0 | null;
    columnVisibility?: Record<string, boolean>;
  };
};
```

Adjust this shape to match existing project types and state.

# Changelog, Versioning, and Commit

After implementation:

* Update `CHANGELOG.md`.
* Bump `package.json` version according to SemVer.
* Ensure `package.json` version matches the latest changelog entry.
* Stage all changes.
* Commit with a clear contextual commit message.

# Output

After making changes, summarize:

1. Files created/changed
2. Where session state is stored
3. What state is restored
4. What is intentionally not restored
5. How missing/changed files are detected
6. Commands run
7. Manual verification steps

````

---

# Then a later project plan

Once latest state works, create a separate:

```txt
project-system-implementation-plan.md
````

With stages like:

```txt
Stage PR-1  Project types and manifest format
Stage PR-2  Project service and project index
Stage PR-3  New/Open/Save project APIs
Stage PR-4  Project UI and recent projects
Stage PR-5  Project restore and missing file validation
Stage PR-6  Project autosave and dirty state
Stage PR-7  Project export/import
Stage PR-8  Project polish and docs
```

I can generate that full plan for you too, but I’d keep your immediate Codex ask smaller: **latest session restore first**.

---

# My bottom-line recommendation

For right now:

## Do not use only localStorage

It’s too flimsy for your main app state.

## Do not jump straight to Zustand

It may help later, but it is not the persistence solution.

## Do use Electron main-process JSON persistence

This is the simplest robust solution.

## Implement latest-session restore first

That solves the actual pain today.

## Then implement projects

Projects are a great idea and not too complex if you start with JSON manifests.

## Then file management

Because file management should be aware of project/session context.

The simplest good version is:

```txt
last-session.json now
project.json manifests later
background file availability scan on open
```

That will get you very close to the “Premiere project” feeling without making the app insanely complex.
