# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.0] - 2026-05-17

### Added

- Added an Electron main-process media-preview service for on-demand thumbnail generation with ffmpeg.
- Added a stable media-preview cache under Electron user data with source path, file size, modified time, duration, and manifest metadata for future preview clips.
- Added a controlled `media-preview://` asset protocol so generated thumbnails can render in the UI without exposing arbitrary filesystem reads.
- Added media-preview IPC start, progress, cancel, result retrieval, preview-frame generation, and cache clearing through the typed preload API.
- Added a renderer Generate Thumbnails workflow for selected rows or all visible rows, with progress, cancellation, result summary, per-file failures, table thumbnail display, and persisted thumbnail metadata.

## [0.11.0] - 2026-05-17

### Added

- Added an Electron main-process Auto-Crop service that uses ffmpeg crop/scale output for eligible high-confidence black-border rows.
- Added Auto-Crop IPC start, progress, cancel, and result retrieval through the typed preload API.
- Added safe Auto-Crop output handling with output-folder creation, source overwrite prevention, conflict run folders, in-progress/final manifest writing, per-item statuses, and skipped-row reasons.
- Added a renderer Crop Options workflow with selected-row eligibility summary, progress, cancellation, result summary, manifest path display, and output-folder reveal support.

## [0.10.0] - 2026-05-17

### Added

- Added an Electron main-process Auto-Fix service that normalizes selected videos to 1920x1080 with ffmpeg.
- Added Auto-Fix IPC start, progress, cancel, and result retrieval through the typed preload API.
- Added safe Auto-Fix output handling with output-folder creation, source overwrite prevention, unused filename generation, per-file failure reporting, and optional safe crop-normalize behavior from black-border metadata.
- Added a renderer Auto-Fix dialog with selected-row submission, progress, cancellation, result summary, failure details, output-folder reveal, and successful-row removal from the table.

## [0.9.0] - 2026-05-17

### Added

- Added main-process black-border analysis using ffmpeg cropdetect with legacy-compatible sampling, confidence, classification, visible-area, border-percent, and recommended-fix data.
- Added black-border review candidate handling to the core audit engine so black-border-only scans can flag review-worthy videos.
- Added crop-review result display in the audit table for auto, review, clean, uncertain, errored, and not-scanned states.

## [0.8.0] - 2026-05-17

### Added

- Added an Electron-native renderer controller for source selection, audit options, audit progress, persisted results, and refresh flow.
- Added IndexedDB-backed audit result persistence with clear-data support.
- Added a PrimeReact audit results table with global search, multi-row selection, thumbnail visibility, soft removal, and restore controls.
- Added action placeholders for future auto-fix, crop, thumbnail, and Premiere workflows.
- Added side panels for discovery, metadata, app info, and settings around the migrated audit workspace.

## [0.7.0] - 2026-05-17

### Added

- Added the Electron-native core audit engine for selected folders and selected files.
- Added low-resolution and wrong-aspect-ratio detection using per-file ffprobe metadata.
- Added audit job start, cancel, progress, and result retrieval IPC through the typed preload API.
- Added a renderer audit lifecycle hook with progress, cancellation, flagged rows, and per-file errors.
- Added persistence of the latest completed audit summary in local app settings.

## [0.6.0] - 2026-05-17

### Added

- Added main-process ffprobe metadata extraction for discovered videos.
- Added an abort-aware child process helper for ffprobe and future ffmpeg workflows.
- Added ffprobe progress, result, and cancellation IPC through the typed preload API.
- Added renderer controls for reading and canceling metadata extraction, plus structured metadata result display.
- Added support for the saved ffprobe path override when extracting metadata.

## [0.5.0] - 2026-05-17

### Added

- Added main-process video file discovery for selected folders and selected files.
- Added recursive scanning with an include-subfolders setting and cancellation support.
- Added legacy-inspired skip behavior for symlinks, macOS metadata files, and known system/project folders.
- Added discovery IPC progress events exposed through the typed preload API.
- Added a renderer discovery flow with scan/cancel controls, progress metrics, and discovered video path results.

## [0.4.0] - 2026-05-17

### Added

- Added JSON-backed app settings stored under Electron's user data directory.
- Added settings preload APIs for reading, updating, and resetting local settings.
- Added a renderer settings panel for audit defaults, tool path overrides, auto-fix destination, recent selections, and reset behavior.
- Added persistence for recent selected folders, recent selected files, latest selected folder, and default output folder.

### Changed

- Updated the Stage 2 source-selection flow to save relevant settings through the preload API after native folder, file, and output-folder selections.

## [0.3.0] - 2026-05-16

### Added

- Added shared TypeScript contracts for video metadata, audit requests and results, audit errors, job status, selected video rows, app settings, auto-fix, auto-crop, thumbnail generation, migration, and Premiere bridge workflows.
- Added shared black-border analysis types that preserve legacy classification, confidence, visible-area, border, and recommended-fix shapes.
- Added shared video-extension constants for both dot-prefixed scan usage and Electron dialog filter usage.
- Added shared Premiere bridge constants for plugin identity, bridge directories, request lifecycle states, request types, presets, heartbeat age, and selected-video limits.

### Changed

- Updated native video-file selection to use the no-dot video-extension list required by Electron file dialogs while keeping dot-prefixed extensions available for later discovery logic.

## [0.2.0] - 2026-05-16

### Added

- Added native Electron dialog IPC handlers for choosing folders, choosing video files, and choosing an output folder.
- Added typed preload APIs at `window.videoAudit.dialog` and `window.videoAudit.shell`.
- Added main-process validation for selected folder and file paths before returning them to the renderer.
- Added Finder reveal support for selected paths.
- Added renderer controls for `Choose Folder`, `Choose Files`, and `Choose Output Folder`, plus selected-path display and validation feedback.

### Changed

- Replaced the Stage 1 placeholder home content with a native-selection screen while keeping all filesystem access behind preload IPC.

## [0.1.0] - 2026-05-16

### Added

- Added the initial Electron, Vite, React, and TypeScript scaffold.
- Added PrimeReact, PrimeFlex, and PrimeIcons styling.
- Added Electron main-process window creation with `contextIsolation` enabled and renderer `nodeIntegration` disabled.
- Added a typed preload API at `window.videoAudit`.
- Added IPC-backed app, version, platform, Electron, Chrome, and Node runtime information for the renderer.
- Added local development scripts for `npm run dev`, `npm run build`, and `npm run typecheck`.
- Added README instructions for installing dependencies, running locally, typechecking, and building.
