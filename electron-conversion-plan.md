# Electron Conversion Plan

## Project

Build a private macOS Electron version of the existing `video-audit` app.

The legacy app lives in a sibling workspace folder named `video-audit`.

The new app lives in this repo, `collie-video`.

The legacy app may be inspected for behavior, schemas, UI patterns, ffprobe parsing, ffmpeg commands, black-border analysis, thumbnails, migration behavior, and Premiere bridge behavior.

The new app must be standalone.

## Non-Goals

- Do not package for public distribution.
- Do not add auth.
- Do not add cloud storage.
- Do not support Windows or Linux initially.
- Do not build a mobile app.
- Do not use Expo.
- Do not preserve Express as the target architecture.
- Do not expose Node APIs directly to the renderer.
- Do not create cross-repo imports from the legacy `video-audit` repo.
- Do not write tests unless explicitly requested.

## Target Stack

- Electron
- Vite
- React
- TypeScript
- PrimeReact
- PrimeFlex
- Node child_process for ffprobe/ffmpeg
- Electron IPC for renderer/main communication
- Electron dialog APIs for native file/folder selection
- Local JSON persistence first
- SQLite only if later stages demonstrate a real need

## Target Architecture

```txt
collie-video/
├─ src/
│  ├─ main/
│  │  ├─ main.ts
│  │  ├─ ipc/
│  │  │  ├─ registerIpcHandlers.ts
│  │  │  ├─ auditIpc.ts
│  │  │  ├─ dialogIpc.ts
│  │  │  ├─ settingsIpc.ts
│  │  │  ├─ ffmpegIpc.ts
│  │  │  ├─ thumbnailIpc.ts
│  │  │  ├─ mediaPreviewIpc.ts
│  │  │  ├─ migrationIpc.ts
│  │  │  └─ premiereIpc.ts
│  │  ├─ services/
│  │  │  ├─ auditService.ts
│  │  │  ├─ fileDiscoveryService.ts
│  │  │  ├─ ffprobeService.ts
│  │  │  ├─ blackBorderAnalysisService.ts
│  │  │  ├─ autoFixService.ts
│  │  │  ├─ autoCropService.ts
│  │  │  ├─ thumbnailService.ts
│  │  │  ├─ mediaPreviewService.ts
│  │  │  ├─ migrationService.ts
│  │  │  ├─ premiereBridgeService.ts
│  │  │  ├─ settingsService.ts
│  │  │  ├─ jobRegistry.ts
│  │  │  └─ appPaths.ts
│  │  └─ utils/
│  │     ├─ childProcess.ts
│  │     ├─ filesystem.ts
│  │     ├─ paths.ts
│  │     └─ numbers.ts
│  │
│  ├─ preload/
│  │  ├─ index.ts
│  │  └─ videoAuditApi.ts
│  │
│  ├─ renderer/
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ helpers/
│  │  ├─ pages/
│  │  └─ styles/
│  │
│  └─ shared/
│     ├─ constants/
│     │  ├─ ipcChannels.ts
│     │  ├─ videoExtensions.ts
│     │  └─ premiereBridge.ts
│     ├─ types/
│     │  ├─ audit.ts
│     │  ├─ video.ts
│     │  ├─ jobs.ts
│     │  ├─ settings.ts
│     │  ├─ autoFix.ts
│     │  ├─ thumbnails.ts
│     │  ├─ mediaPreview.ts
│     │  ├─ migration.ts
│     │  └─ premiere.ts
│     └─ schemas/
│        └─ README.md
│
├─ electron-conversion-plan.md
├─ .codex-instructions.md
├─ CONTRIBUTING.md
├─ CHANGELOG.md
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
└─ README.md
```

This structure may be adjusted slightly if the chosen Electron/Vite scaffold requires it, but the responsibilities must remain the same.

Thumbnail generation may remain in `thumbnailService.ts`, but the implementation should be structured so it can evolve into or delegate to `mediaPreviewService.ts`. Preview clip generation in Stage 12.5 should reuse the same cache, manifest, timestamp, and safe asset URL strategy where practical.

## Global Rules for Every Stage

1. Only modify files inside `collie-video`.
2. You may inspect sibling `video-audit` for reference.
3. Do not modify sibling `video-audit`.
4. Do not import from sibling `video-audit`.
5. Do not create cross-repo dependencies.
6. Do not write tests.
7. Keep the app standalone.
8. Prefer clear, boring, maintainable TypeScript.
9. Do not over-engineer abstractions.
10. Renderer code must not use Node APIs directly.
11. Main process owns filesystem access and process execution.
12. Preload exposes a small typed API using `contextBridge`.
13. Keep `contextIsolation: true`.
14. Do not enable `nodeIntegration` in the renderer.
15. Preserve the useful behavior of the legacy app, but do not preserve browser/backend workaround architecture unless explicitly needed.
16. Follow `CONTRIBUTING.md` for changelog, versioning, commit, safety, dependency, and documentation rules.
17. Every implementation stage that changes files must update `CHANGELOG.md`, keep `package.json` version aligned with the latest changelog version when `package.json` exists, and commit the completed changes.

## Legacy App Summary

The legacy app is a Vite + React + PrimeReact frontend with a local Node/Express backend.

Important legacy behaviors to preserve or adapt:

* Audit selected folders.
* Audit selected files.
* Include/exclude subfolders.
* Optional low-resolution analysis.
* Optional black-border analysis.
* Detect video files by extension.
* Skip macOS/system folders like `.Spotlight-V100`, `.Trashes`, `.fseventsd`, `.TemporaryItems`, `.git`, `node_modules`, `.collie-video-temp`, `.collie-video-trash`, `.collie-video-cleanup-runs`, `Archive`, and `archived-files`.
* Use `ffprobe` to inspect video metadata.
* Flag low-resolution videos.
* Flag videos that are not 16:9.
* Include detailed video metadata in rows.
* Show audit progress.
* Allow canceling active jobs.
* Persist latest audit results locally.
* Support selected-video actions.
* Support auto-fix via ffmpeg.
* Support auto-crop via ffmpeg when black-border data has usable crop information.
* Support thumbnail generation.
* Support short preview clip generation from thumbnail timestamps.
* Support migration scan/execute workflows.
* Support Premiere Pro bridge status and selected-video import request flow.

Important legacy files to inspect when implementing relevant stages:

* `video-audit/package.json`
* `video-audit/backend/package.json`
* `video-audit/backend/index.js`
* `video-audit/backend/utils/fileAudit.js`
* `video-audit/backend/utils/blackBorderAnalysis.js`
* `video-audit/backend/utils/autoFix.js`
* `video-audit/backend/utils/autoCrop.js`
* `video-audit/backend/utils/thumbnails.js`
* `video-audit/backend/utils/folderTree.js`
* `video-audit/backend/utils/videoExtensions.js`
* `video-audit/backend/utils/videoMigration.js`
* `video-audit/backend/utils/premiereBridge.js`
* `video-audit/shared/premiereBridge.cjs`
* `video-audit/src/App.tsx`
* `video-audit/src/hooks/useVideoAuditController.ts`
* `video-audit/src/helpers/utils.ts`
* `video-audit/src/types/video.ts`
* `video-audit/src/types/premiere.ts`
* `video-audit/src/types/migration.ts`
* `video-audit/src/components/VideoTable.tsx`
* `video-audit/src/components/UploadPanel.tsx`
* `video-audit/src/components/FolderBrowserDialog.tsx`
* `video-audit/src/components/AutoFixDialog.tsx`
* `video-audit/src/components/ThumbnailGenerationDialog.tsx`
* `video-audit/src/components/MigrationScanDialog.tsx`
* `video-audit/src/components/PremiereStatusBanner.tsx`

## Stage 1 — Electron/Vite/React Scaffold

**Intelligence Level: Medium**

### Goal

Create a working Electron + Vite + React + TypeScript app with PrimeReact configured.

This stage should not implement real video auditing yet.

### Requirements

* Use Electron.
* Use Vite.
* Use React.
* Use TypeScript.
* Use PrimeReact and PrimeFlex.
* App launches with `npm run dev`.
* Renderer displays a simple Collie Video home screen.
* Main process creates the browser window.
* Preload exposes a small typed API.
* Renderer can call the preload API to get app/version/platform info.
* Use `contextIsolation: true`.
* Use `nodeIntegration: false`.
* Do not use Express.
* Do not write tests.

### Suggested Scripts

The exact scripts may vary depending on the scaffold, but the repo should support:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "typecheck": "tsc --noEmit"
  }
}
```

### Deliverables

* `package.json`
* Electron main process
* Electron preload script
* Vite React renderer
* PrimeReact theme imports
* Clean folder structure under `src/main`, `src/preload`, `src/renderer`, and `src/shared`
* Placeholder home UI
* Typed global `window.videoAudit` API
* README instructions for running locally

### Acceptance Criteria

* `npm install` succeeds.
* `npm run dev` launches a macOS Electron window.
* The renderer shows a Collie Video landing screen.
* The renderer displays basic app/platform info returned through preload.
* No renderer file directly imports `fs`, `path`, `child_process`, or Electron main-process APIs.

## Stage 2 — Native Folder and File Selection

**Intelligence Level: Medium**

### Goal

Replace browser folder-selection workarounds with native Electron dialogs.

### Legacy Context

The legacy app has browser file/folder selection logic and works around limited path access by using manifests, `webkitRelativePath`, sample files, and backend path resolution.

The Electron app should not preserve that workaround as the primary flow.

### Requirements

Implement native selection through the Electron main process:

* Choose one or more folders.
* Choose one or more video files.
* Choose an output folder.
* Reveal a selected path in Finder.
* Validate that selected folder/file paths exist.
* Return absolute paths to the renderer.
* Keep the API typed.

### Suggested Preload API

```ts
window.videoAudit.dialog.chooseFolders()
window.videoAudit.dialog.chooseVideoFiles()
window.videoAudit.dialog.chooseOutputFolder()
window.videoAudit.shell.revealPath(path)
```

### Deliverables

* `dialogIpc.ts`
* typed preload methods
* renderer UI buttons:
  * Choose Folder
  * Choose Files
  * Choose Output Folder
* selected paths displayed in UI
* minimal validation feedback

### Acceptance Criteria

* User can select absolute local folders.
* User can select absolute local video files.
* No browser `webkitdirectory` flow is used in the Electron-native path.
* Renderer receives paths only through preload API.

## Stage 3 — Shared Types and Constants

**Intelligence Level: High**

### Goal

Define the core TypeScript contracts before migrating behavior.

### Requirements

Inspect the legacy app types and backend result shapes.

Create shared types for:

* video metadata
* audit options
* audit request
* audit progress
* audit result
* audit error
* job status
* selected video row
* black-border analysis summary
* auto-fix request/progress/result
* auto-crop request/progress/result
* thumbnail request/progress/result
* media preview request/progress/result
* preview clip request/progress/result
* migration request/progress/result
* Premiere bridge status/request/result
* app settings

### Important Data Model Notes

The legacy audit rows include many useful fields:

* path
* directory
* fileName
* displayFile
* displayDirectory
* extension
* fileExtension
* fileType
* sizeBytes
* sizeMB
* sizeGB
* fileSystemSizeBytes
* ffprobeFormatSizeBytes
* createdAt
* modifiedAt
* createdAtMs
* modifiedAtMs
* durationSeconds
* durationFormatted
* width
* height
* resolution
* displayAspectRatio
* sampleAspectRatio
* calculatedAspectRatio
* targetAspectRatio
* codecName
* codecLongName
* profile
* pixFmt
* level
* bitRate
* bitRateMbps
* streamBitRate
* formatBitRate
* avgFrameRate
* rawFrameRate
* frameRate
* nbFrames
* formatName
* formatLongName
* isLowResolution
* isWrongAspectRatio
* reasons
* adjustments.blackBorder

Preserve these fields where practical.

### Deliverables

* `src/shared/types/video.ts`
* `src/shared/types/audit.ts`
* `src/shared/types/jobs.ts`
* `src/shared/types/settings.ts`
* `src/shared/types/autoFix.ts`
* `src/shared/types/thumbnails.ts`
* `src/shared/types/mediaPreview.ts`
* `src/shared/types/migration.ts`
* `src/shared/types/premiere.ts`
* `src/shared/constants/videoExtensions.ts`
* `src/shared/constants/ipcChannels.ts`
* `src/shared/constants/premiereBridge.ts`

### Acceptance Criteria

* Types compile.
* Main, preload, and renderer can import shared types.
* No logic migration yet beyond constants and type definitions.
* Do not introduce runtime validation libraries unless clearly useful.

## Stage 4 — Settings and Local Persistence

**Intelligence Level: Medium**

### Goal

Add local settings and lightweight persisted app state.

### Requirements

Use Electron app userData path for persistence.

Persist:

* recent folders
* recent files if useful
* default output directory
* include subfolders default
* low-resolution analysis enabled default
* black-border analysis enabled default
* default auto-fix destination root
* ffmpeg path override, optional
* ffprobe path override, optional
* preview clip duration default, optional
* preview clip width default, optional
* last audit result summary, optional
* latest selected folder, optional

Use JSON files first. Do not add SQLite yet.

### Suggested Files

* `src/main/services/settingsService.ts`
* `src/main/services/appPaths.ts`
* `src/main/ipc/settingsIpc.ts`
* `src/shared/types/settings.ts`

### Suggested Preload API

```ts
window.videoAudit.settings.get()
window.videoAudit.settings.update(partialSettings)
window.videoAudit.settings.reset()
```

### Acceptance Criteria

* Settings survive app restart.
* Invalid/missing settings file does not crash the app.
* Settings have safe defaults.
* Renderer can view and update settings through preload only.

## Stage 5 — File Discovery Service

**Intelligence Level: High**

### Goal

Implement recursive local video discovery in the Electron main process.

### Legacy Context

The legacy `fileAudit.js` scans directories, skips known system folders, skips symlinks, skips macOS metadata files, and filters by supported video extensions.

### Requirements

Implement a standalone TypeScript file discovery service.

Must support:

* selected folders
* selected files
* include/exclude subfolders
* supported video extension detection
* skipping symlinks
* skipping system folders
* skipping `.DS_Store`
* skipping files beginning with `._`
* deduplicating paths
* progress events
* cancellation

### Deliverables

* `fileDiscoveryService.ts`
* `videoExtensions.ts`
* `auditIpc.ts` initial discovery handlers
* renderer flow to start a discovery-only scan
* visible progress

### Acceptance Criteria

* User selects folders.
* App discovers video files.
* UI shows count of found videos.
* User can cancel discovery.
* No ffprobe integration yet.

## Stage 6 — ffprobe Service

**Intelligence Level: High**

### Goal

Implement video metadata extraction using `ffprobe`.

### Legacy Context

The legacy audit uses `ffprobe` with JSON output and extracts:

* stream width/height
* stream duration
* format duration
* display aspect ratio
* sample aspect ratio
* codec info
* profile
* pix_fmt
* level
* bit_rate
* frame rates
* nb_frames
* format name
* format long name
* format size

### Requirements

Implement `ffprobeService.ts`.

Must support:

* configurable ffprobe binary path, default `ffprobe`
* per-file metadata extraction
* structured result
* concise error reporting
* cancellation
* no UI freeze
* no renderer access to child_process

### Deliverables

* `ffprobeService.ts`
* reusable child process helper
* typed `FfprobeResult`
* minimal UI showing ffprobe metadata for selected files or folders

### Acceptance Criteria

* App can run ffprobe on discovered videos.
* Errors are captured per file.
* Cancellation kills active child process.
* Renderer receives structured progress and results.

## Stage 7 — Core Audit Engine

**Intelligence Level: Extra High**

### Goal

Recreate the core audit behavior from the legacy app.

### Requirements

Implement `auditService.ts`.

Support:

* selected folders
* selected files
* include subfolders
* include low-resolution analysis
* include black-border analysis flag, but black-border analysis itself can remain unimplemented until Stage 9
* min height default 720
* target aspect ratio default 16:9
* aspect ratio tolerance default 0.01
* per-file ffprobe
* flagged videos list
* errors list
* summary
* progress events
* cancellation

### Audit Rules

Flag a video if:

* low-resolution analysis is enabled and height is missing/null
* low-resolution analysis is enabled and height is below 720
* low-resolution analysis is enabled and effective aspect ratio is not approximately 16:9
* black-border analysis is enabled and black-border analysis later determines it needs review

### Effective Aspect Ratio

Use:

1. `display_aspect_ratio`, if available and valid.
2. Otherwise `width / height * sample_aspect_ratio`.
3. Otherwise null.

### Deliverables

* `auditService.ts`
* `jobRegistry.ts`
* audit IPC handlers:
  * start audit
  * cancel audit
  * get result
* renderer hook for audit lifecycle
* basic audit result table

### Acceptance Criteria

* User can select folders/files and run a real audit.
* UI shows progress.
* UI shows flagged rows.
* UI shows errors.
* User can cancel active audit.
* Results match legacy behavior for low-resolution/wrong-aspect-ratio detection as closely as possible.

## Stage 8 — Renderer UI Migration

**Intelligence Level: Extra High**

### Goal

Bring over the useful UI from the legacy app, but adapt it to Electron-native workflows.

### Legacy Context

The legacy `App.tsx` uses:

* `UploadPanel`
* `VideoTable`
* `FolderBrowserDialog`
* `AutoFixDialog`
* `ThumbnailGenerationDialog`
* `MigrationScanDialog`
* `MigrationResultDialog`
* `PremiereStatusBanner`
* `useVideoAuditController`

The legacy controller is heavily tied to HTTP fetch and EventSource. Do not port it blindly.

### Requirements

Implement a new Electron-native controller/hook.

Suggested name:

```ts
useVideoAuditAppController
```

Use IPC/preload methods instead of fetch/EventSource.

Bring over or recreate:

* upload/selection panel
* audit options
* progress display
* results table
* global filter
* selected rows
* action buttons
* persisted/refresh indicator
* clear data action
* restore removed videos if practical
* show/hide thumbnails if practical
* video details modal if practical

### PrimeReact

Use PrimeReact components where appropriate.

### Deliverables

* renderer components
* renderer hook
* result table
* selected-video state
* action button placeholders for later stages

### Acceptance Criteria

* UI feels comparable to the legacy app.
* No HTTP calls.
* No EventSource.
* No direct Node APIs.
* App remains responsive during audits.

## Stage 9 — Black-Border Analysis

**Intelligence Level: Extra High**

### Goal

Migrate black-border analysis from the legacy backend.

### Legacy Context

The legacy audit optionally calls `analyzeBlackBorders` and uses `isBlackBorderReviewCandidate`. The result is stored under `adjustments.blackBorder`.

### Requirements

Inspect and adapt:

* `video-audit/backend/utils/blackBorderAnalysis.js`

Implement:

* `blackBorderAnalysisService.ts`
* integration with `auditService.ts`
* black-border progress messages if needed
* review classification
* visible result columns or details in the table

### Preserve

* classifications
* visible area data
* confidence
* recommended fix eligibility
* review candidate rules
* errors/uncertain states

### Acceptance Criteria

* User can enable black-border analysis.
* Audit includes black-border results.
* Videos needing review are flagged.
* Existing auto-crop/auto-fix future stages can consume `adjustments.blackBorder`.

## Stage 10 — Auto-Fix Service

**Intelligence Level: Extra High**

### Goal

Implement ffmpeg normalization/auto-fix in Electron main.

### Legacy Context

The legacy `autoFix.js` normalizes output to 1920x1080 using:

```txt
scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,setdar=16/9
```

It chooses a standard or high-quality profile based on height, width, and bitrate. It uses libx264, CRF, preset, yuv420p, AAC audio, and writes to a destination output directory.

### Requirements

Implement:

* `autoFixService.ts`
* request validation
* output directory creation
* safe output path generation
* source overwrite prevention
* profile selection
* optional crop-normalize behavior when black-border data is safe
* ffmpeg child process execution
* progress events
* cancellation
* result summary

### Important Safety Rule

Never overwrite source videos unless a future stage explicitly implements a user-confirmed overwrite workflow.

### Deliverables

* auto-fix IPC handlers
* renderer dialog/action for selected videos
* progress UI
* result UI
* reveal output folder action

### Acceptance Criteria

* User can select audited rows and run auto-fix.
* Output files are written to a configured output directory.
* Progress is visible.
* Cancellation works.
* Failed files are reported individually.
* Source files are never overwritten.

## Stage 11 — Auto-Crop Service

**Intelligence Level: Extra High**

### Goal

Implement ffmpeg auto-crop for eligible black-border videos.

### Legacy Context

The legacy `autoCrop.js` supports videos with nested-border black-border data and usable visible-area crop information. It crops and scales to 1920x1080.

### Requirements

Implement:

* `autoCropService.ts`
* eligibility detection
* crop validation
* output directory creation
* unique run folder or safe output path
* manifest writing
* ffmpeg crop/scale command
* progress events
* cancellation
* result summary

### Preserve Legacy Behavior Where Practical

* target width 1920
* target height 1080
* minimum visible width 640
* minimum visible height 360
* output manifest
* in-progress manifest
* final manifest
* per-item status

### Deliverables

* auto-crop IPC handlers
* renderer auto-crop dialog/action
* progress UI
* result UI
* reveal output folder action

### Acceptance Criteria

* User can auto-crop eligible selected rows.
* Ineligible rows are skipped with clear reasons.
* Output files are written safely.
* Manifest is written.
* Cancellation works.

## Stage 12 — Thumbnail Generation

**Intelligence Level: High**

### Goal

Migrate thumbnail generation and structure it as the first part of a broader media-preview system.

The next stage, Stage 12.5, will add short preview clips generated from the same thumbnail timestamps, so this stage should avoid a dead-end thumbnail-only architecture.

### Legacy Context

The legacy backend has thumbnail utilities and a thumbnail-generation dialog in the UI.

### Requirements

Inspect and adapt:

* `video-audit/backend/utils/thumbnails.js`
* `video-audit/src/components/ThumbnailGenerationDialog.tsx`
* thumbnail-related helpers/types

Implement either:

* `thumbnailService.ts`

or, preferably:

* `mediaPreviewService.ts`

The service should support thumbnail generation now and be structured so preview clip generation can be added cleanly in Stage 12.5.

Implement:

* thumbnail output/cache directory under Electron `userData` or another configured cache directory
* generate preview frame thumbnails
* store thumbnail metadata in a manifest
* include source file identity metadata for cache invalidation:
  * source path
  * source size
  * source modified timestamp
  * duration if available
* associate thumbnails with video rows
* dedupe thumbnail work
* progress events
* cancellation
* clear thumbnail cache if useful
* a safe way for the renderer to display generated thumbnail assets without exposing arbitrary filesystem access

### Important Architecture Note

Do not design thumbnails as a one-off feature. Design the generated thumbnail metadata so a later preview-clip stage can attach short video clips to the same timestamps.

A generated preview item should be able to evolve toward this shape:

```ts
type MediaPreviewItem = {
  id: string;
  timestampSeconds: number;
  thumbnailPath: string;
  thumbnailUrl?: string;
  previewClipPath?: string;
  previewClipUrl?: string;
  previewClipStatus?: 'not-generated' | 'generating' | 'ready' | 'failed';
};
```

### Deliverables

* thumbnail/media preview IPC handlers
* thumbnail renderer flow
* result row thumbnail display
* video details modal thumbnail carousel if practical
* preview manifest structure that can support future preview clips

### Acceptance Criteria

* User can generate thumbnails for selected or all eligible rows.
* Thumbnails display in the table or details modal.
* Progress is visible.
* Errors are per-file, not fatal to the whole batch.
* Thumbnail cache is stable across app restarts.
* Cache invalidates when source file size or modified timestamp changes.
* The implementation is ready for preview clip generation in Stage 12.5.

## Stage 12.5 — Preview Clip Generation

**Intelligence Level: Extra High**

### Goal

Generate short 5- or 10-second preview clips from the same timestamps used for generated thumbnails, then allow the renderer to play those clips from the video details modal.

### Context

The app already supports or will support thumbnail generation from selected timestamps in each video.

This stage extends the media-preview system so each thumbnail can optionally have a short muted preview clip associated with it.

### Requirements

Implement preview clip generation in Electron main.

Support:

* generating preview clips for a selected video
* generating preview clips for selected thumbnail timestamps
* default clip duration of 5 seconds
* optional setting for 5 or 10 seconds
* low-resolution preview output, preferably 480px or 640px wide
* muted clips by default
* MP4/H.264 output suitable for playback in the Electron renderer
* cache preview clips under the same media-preview cache structure as thumbnails
* update preview manifests with clip metadata
* avoid regenerating clips when valid cached clips already exist
* invalidate clips when source file size or modified timestamp changes
* progress events
* cancellation
* per-clip errors

### Suggested ffmpeg Behavior

Use ffmpeg to create short muted MP4 clips.

Suggested defaults:

```txt
duration: 5 seconds
width: 640px
audio: disabled
video codec: libx264
preset: veryfast
crf: 24
pix_fmt: yuv420p
```

Suggested command shape:

```bash
ffmpeg \
  -ss <timestamp> \
  -i <inputPath> \
  -t <durationSeconds> \
  -vf "scale=640:-2" \
  -an \
  -c:v libx264 \
  -preset veryfast \
  -crf 24 \
  -pix_fmt yuv420p \
  <outputPath>
```

Use fast seek for responsiveness. Frame-accurate seeking is not required for hover previews.

### Timestamp Rules

If a preview timestamp is near the end of the source video, adjust the start time so the clip does not exceed the video duration.

Use logic like:

```ts
const start = Math.max(
  0,
  Math.min(timestampSeconds, durationSeconds - clipDurationSeconds)
);
```

If duration is unknown, use the requested timestamp and allow ffmpeg to fail gracefully if needed.

### Renderer Requirements

In the video details modal:

* show thumbnail carousel
* show selected thumbnail in a main preview area
* if a preview clip exists for the selected thumbnail:
  * hover over the main preview to play the muted preview
  * mouse leave should stop/reset preview
  * click may toggle pinned playback if practical
* if no preview clip exists:
  * show a "Generate preview clip" or "Generate preview clips" action
* show clip generation status clearly

### Asset Safety

Do not expose arbitrary local file reads to the renderer.

Use the existing safe thumbnail/preview asset strategy from Stage 12. If needed, add or extend a controlled custom protocol or safe asset URL resolver for preview media.

### Deliverables

* preview clip generation service methods
* preview clip IPC handlers
* shared preview clip/media preview types
* preview manifest updates
* video details modal preview player behavior
* cache validation
* progress/cancellation handling

### Acceptance Criteria

* User can generate short preview clips from thumbnail timestamps.
* Preview clips are cached and reused.
* Preview clips are invalidated when the source file changes.
* The selected thumbnail in the details modal can play its associated preview clip.
* Preview playback does not require opening the full source video.
* Clip generation does not block the UI.
* Cancellation works.
* Errors are shown per clip or per video without crashing the app.

## Stage 13 — Premiere Bridge

**Intelligence Level: High**

### Goal

Migrate the Premiere Pro bridge behavior into Electron main.

### Legacy Context

The legacy `premiereBridge.js`:

* detects Premiere Pro using `pgrep`
* uses a bridge directory under `~/VideoAudit/premiere-bridge`
* reads `status.json`
* checks heartbeat freshness
* writes request JSON files
* supports import-selected-videos
* has deprecated export presets
* validates selected videos
* hard-links or copies files when extension/filename handling requires it

The shared constants live in `shared/premiereBridge.cjs`.

### Requirements

Implement:

* `premiereBridgeService.ts`
* shared Premiere constants in TypeScript
* status check
* bridge readiness detection
* request directory creation
* selected-video import request creation
* validation of selected video files
* renderer status banner
* renderer selected-video “Edit in Premiere” action

### Preserve

* plugin ID
* default bridge directory
* heartbeat max age
* request lifecycle states
* max selected videos
* request JSON format
* import-selected-videos request behavior

### Deliverables

* Premiere IPC handlers
* Premiere status banner
* “Edit in Premiere” selected action
* useful error messages

### Acceptance Criteria

* App can report whether Premiere is running.
* App can report whether the bridge is connected/ready.
* App can queue an import-selected-videos request.
* User gets clear feedback if Premiere or the bridge is not ready.

## Stage 14 — Migration Workflow

**Intelligence Level: Extra High**

### Goal

Migrate the “new edited videos” migration workflow.

### Legacy Context

The legacy backend has `videoMigration.js`, migration plans, migration jobs, scan/execute endpoints, and dialogs for migration scan/result.

### Requirements

Inspect and adapt:

* `video-audit/backend/utils/videoMigration.js`
* `video-audit/src/components/MigrationScanDialog.tsx`
* `video-audit/src/components/MigrationResultDialog.tsx`
* migration types and helpers

Implement:

* `migrationService.ts`
* migration scan IPC
* migration execute IPC
* progress events
* result dialog
* safe file operations
* clear summary of proposed changes before execution

### Acceptance Criteria

* User can scan a new edited folder against the audited root.
* UI shows proposed migration plan.
* User can execute migration.
* Progress is visible.
* Results are summarized clearly.
* Destructive operations must be avoided or require explicit confirmation.

## Stage 15 — App Polish and macOS Utility Features

**Intelligence Level: Medium**

### Goal

Make the app feel like a proper private macOS utility.

### Requirements

Add:

* app menu
* keyboard shortcuts
* open/reveal output folder
* native notifications for completed long jobs
* recent folders menu or UI
* window state persistence
* better empty states
* better error states
* better loading states
* “Check ffmpeg/ffprobe availability” diagnostic
* clear app settings screen/panel

### Suggested Shortcuts

* `Cmd+O`: choose folder
* `Cmd+Shift+O`: choose files
* `Cmd+R`: refresh/re-run latest audit
* `Esc`: cancel active dialog or active job if safe
* `Cmd+,`: settings

### Acceptance Criteria

* App is comfortable to use repeatedly.
* Long-running jobs communicate status clearly.
* User can recover from missing ffmpeg/ffprobe.
* User can find output files easily.

## Stage 16 — Build Script

**Intelligence Level: Medium**

### Goal

Add a simple local macOS build.

### Requirements

Add a build flow that can produce a local `.app`.

Do not spend time on:

* notarization
* App Store distribution
* auto-updates
* public installer polish

### Deliverables

* build script
* local app output
* README instructions

### Acceptance Criteria

* `npm run build` succeeds.
* A local macOS app can be produced.
* The dev workflow still works.

## Stage 17 — Legacy Parity Review

**Intelligence Level: High**

### Goal

Compare the Electron app against the legacy app and close gaps.

### Requirements

Inspect the legacy app and compare feature parity:

* folder audit
* selected-file audit
* include subfolders
* low-resolution detection
* wrong-aspect-ratio detection
* black-border analysis
* auto-fix
* auto-crop
* thumbnails
* preview clips
* migration
* Premiere bridge
* local persistence
* table filtering
* row selection
* error handling
* cancellation
* progress

### Deliverables

Create or update:

```txt
docs/legacy-parity-checklist.md
```

Document:

* implemented
* partially implemented
* intentionally changed
* intentionally dropped
* still missing

### Acceptance Criteria

* Clear list of remaining gaps.
* No accidental regressions from the legacy workflow.
* Explicit notes where Electron behavior is intentionally better/different.

## Stage 18 — Cleanup

**Intelligence Level: High**

### Goal

Remove migration scaffolding and tighten the implementation.

### Requirements

* remove dead placeholder code
* remove unused dependencies
* consolidate duplicated types
* simplify overly-clever abstractions
* improve naming
* improve README
* ensure no references imply the legacy repo is required
* ensure no imports from the legacy repo exist
* ensure no Express/HTTP/SSE code remains unless explicitly justified

### Acceptance Criteria

* New repo is standalone.
* Codebase is understandable.
* README explains how to run the private app.
* No hidden dependency on sibling `video-audit`.
