# Collie Video

Private standalone macOS Electron app for auditing local video libraries.

The legacy `video-audit` app may be used as a reference during development, but
it is not required to install, run, build, or package this app. All runtime code
and dependencies live in this repo.

## Development

Use Node 20 or newer. This repo includes an `.nvmrc`, so if you use nvm:

```sh
nvm use
```

Install dependencies:

```sh
npm install
```

Run the Electron app locally:

```sh
npm run dev
```

Check TypeScript:

```sh
npm run typecheck
```

Build the Electron/Vite output:

```sh
npm run build
```

Produce a local macOS `.app` for manual use:

```sh
npm run deploy
```

The local app is written under `release/mac-arm64/Collie Video.app` on Apple Silicon Macs. This build is intentionally unsigned and unnotarized; it is for local private use only.

## App Icon

The source app icon lives at `assets/icon-source.png`.

Generated app icon files live at:

```txt
assets/icon.png
assets/icon.icns
```

Regenerate the icon files from the source image with:

```sh
npm run icons
```

The icon generation command may create a temporary `assets/icon.iconset/` folder. That folder is ignored by git.

macOS may cache Dock icons. If a rebuilt icon does not appear immediately, quit and reopen the app, remove and re-add it to the Dock, rebuild the app, or run:

```sh
killall Dock
```

## Standalone Boundaries

- Filesystem access, ffprobe/ffmpeg execution, job orchestration, settings, and
  OS integrations live in the Electron main process.
- Renderer code uses the typed `window.videoAudit` preload API and does not
  import Node, Electron main-process modules, or sibling workspace files.
- The app does not run an Express server and does not use HTTP/SSE for its
  internal workflows.
- Generated thumbnails and preview clips are loaded through the controlled
  `media-preview://` protocol.
- The renderer uses a results-first desktop layout with compact source/status
  bars, contextual row actions, and modal workflow configuration.

## Current Scope

The current app includes:

- Electron, Vite, React, TypeScript, PrimeReact, PrimeFlex, and PrimeIcons
- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload API at `window.videoAudit`
- local macOS `.app` packaging through `npm run deploy`
- native folder selection through Electron dialogs
- native video-file selection through Electron dialogs
- native output-folder selection through Electron dialogs
- reveal selected paths in Finder
- JSON-backed local app settings stored under Electron's user data directory
- Electron-native core audits for selected folders and selected files
- include/exclude subfolders controls for folder audits
- PrimeReact TreeTable folder source selection with eager main-process scanning,
  selected-folder dedupe, persisted source selections, and no folder-tree cache
- cancellable discovery, ffprobe metadata extraction, and audit progress through IPC
- low-resolution and wrong-aspect-ratio detection using per-file ffprobe results
- optional black-border analysis using ffmpeg cropdetect
- black-border classifications, confidence, visible-area crop data, and recommended-fix eligibility stored on audit rows
- Electron-native Auto-Fix workflow for selected rows using ffmpeg normalization
- cancellable Auto-Fix progress, per-file result reporting, safe output filename generation, and output-folder reveal support
- Electron-native Auto-Crop workflow for selected black-border rows using ffmpeg crop/scale output
- cancellable Auto-Crop progress, ineligible-row skips, per-file result reporting, manifest writing, safe output path handling, and output-folder reveal support
- Electron-native media-preview workflow for selected or visible-row thumbnail generation using ffmpeg
- preview-frame and preview-clip generation that reuses thumbnail timestamps and media-preview cache manifests
- safe `media-preview://` asset URLs for rendering generated thumbnails and preview clips without exposing arbitrary filesystem reads
- cancellable thumbnail generation progress, per-file result reporting, table thumbnail display, and persisted thumbnail metadata
- persisted audit results in renderer IndexedDB with refresh and clear-data controls
- PrimeReact results table with global search, multi-row selection, soft removal/restore, details, thumbnails, and row actions
- migration scan/execute workflow with exact filename matching, copy/archive safety, manifests, and operation logs
- safe file-management workflows for revealing known paths, moving selected videos to Trash, moving selected videos to chosen folders, archiving originals, reviewing post-conversion source/output pairs, and replacing originals with converted outputs after confirmation
- file-management operation history with itemized results, partial-failure diagnostics, and reveal-in-Finder actions
- file-management settings for safe conflict handling, typed confirmation thresholds, post-conversion prompting, and operation-history preview
- Premiere bridge status checks, selected-video import request creation, and Adobe app launch helpers
- native app menu shortcuts, persisted window state, completion notifications, and ffmpeg/ffprobe diagnostics

## File Management Safety

File-management workflows are intentionally limited to files the app already understands. The renderer only calls typed preload APIs, while the Electron main process validates paths, builds dry-run plans, executes file moves, and records operation history.

The app does not permanently delete files, delete directories, use recursive deletion, or overwrite destination files by default. Destructive cleanup uses macOS Trash, and replacement workflows require review and confirmation before originals are moved.

## Folder Tree Source Selection

Folder source selection is documented in `docs/folder-tree-source-selection.md`.
The flow intentionally scans the full folder tree eagerly in the Electron main
process, returns folder-only nodes with supported-video counts and sizes, and
lets the renderer expand/select already-loaded folders without additional
filesystem calls. The scanned tree is not cached; saved source selections can be
restored, and the root can be rescanned manually.

## Premiere Bridge

Premiere bridge setup is documented in `docs/premiere-bridge.md`. The Collie
Video bridge uses the local app data path
`~/Library/Application Support/CollieVideo/premiere-bridge` and the UXP plugin
in `premiere-uxp/`.
