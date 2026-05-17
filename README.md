# video-audit-electron

Private macOS Electron version of the existing `video-audit` app.

The legacy reference app lives in a sibling workspace folder named `video-audit`.

This repo must become standalone. It may copy/adapt logic from the legacy repo, but it must not import from it or depend on it.

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

## Current Scope

The current app includes:

- Electron main process window creation
- Vite React renderer
- TypeScript configuration
- PrimeReact, PrimeFlex, and PrimeIcons styling
- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload API at `window.videoAudit`
- basic app/version/platform info returned through IPC
- native folder selection through Electron dialogs
- native video-file selection through Electron dialogs
- native output-folder selection through Electron dialogs
- selected path validation in the main process
- reveal selected paths in Finder
- shared TypeScript contracts for audits, videos, jobs, settings, adjustments, thumbnails, migration, and Premiere bridge work
- shared video-extension and Premiere bridge constants
- JSON-backed local app settings stored under Electron's user data directory
- settings preload APIs for reading, updating, and resetting local settings
- discovery-only video scanning for selected folders and files
- cancellable file discovery progress reported through Electron IPC
- ffprobe metadata extraction for discovered videos
- cancellable child-process metadata progress reported through Electron IPC
- Electron-native core audits for selected folders and selected files
- low-resolution and wrong-aspect-ratio detection using per-file ffprobe results
- optional black-border analysis using ffmpeg cropdetect
- black-border classifications, confidence, visible-area crop data, and recommended-fix eligibility stored on audit rows
- crop-review result display in the audit table for auto, review, clean, uncertain, errored, and not-scanned black-border states
- Electron-native Auto-Fix workflow for selected rows using ffmpeg normalization
- cancellable Auto-Fix progress, per-file result reporting, safe output filename generation, and output-folder reveal support
- Electron-native Auto-Crop workflow for selected black-border rows using ffmpeg crop/scale output
- cancellable Auto-Crop progress, ineligible-row skips, per-file result reporting, manifest writing, safe output path handling, and output-folder reveal support
- Electron-native media-preview workflow for selected or visible-row thumbnail generation using ffmpeg
- persistent media-preview cache manifests keyed by source path, file size, and modified time for future preview-clip support
- safe `media-preview://` asset URLs for rendering generated thumbnails without exposing arbitrary filesystem reads
- cancellable thumbnail generation progress, per-file result reporting, table thumbnail display, and persisted thumbnail metadata
- cancellable audit progress, result retrieval, flagged rows, and per-file errors through IPC
- Electron-native renderer controller for source selection, audit lifecycle, and result-state management
- persisted audit results in renderer IndexedDB with refresh and clear-data controls
- PrimeReact results table with global search, multi-row selection, soft removal/restore, and action placeholders for later stages
