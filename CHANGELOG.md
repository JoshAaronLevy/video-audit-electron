# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.38.0] - 2026-05-18

### Added

- Added main-process replacement execution for stored replacement plans, including per-item revalidation, macOS Trash disposal for originals, output moves into source folders, and partial-failure results.
- Added replacement execution IPC, preload APIs, progress events, cancellation before item boundaries, and operation-history records.
- Added renderer replacement progress and result UI after post-conversion cleanup confirmation.

## [0.37.0] - 2026-05-18

### Added

- Added a post-conversion cleanup dialog after successful Auto-Fix and Auto-Crop runs with Replace Originals, Review Manually, and Leave Files Where They Are options.
- Added replacement-plan summaries and a manual review view for ready, warning, blocked, original-size, and output-size counts before any replacement action.
- Added high-risk `REPLACE` confirmation gating for replacement intent while leaving actual replacement execution for the next stage.

## [0.36.0] - 2026-05-18

### Added

- Added shared replacement workflow types for dry-run replacement plans, selected actions, item statuses, warnings, errors, and plan summaries.
- Added a main-process replacement planner that builds plans from Auto-Fix, Auto-Crop, or explicit conversion items without mutating the filesystem.
- Added typed replacement IPC and preload APIs for creating replacement plans while preserving the renderer filesystem boundary.

## [0.35.0] - 2026-05-18

### Added

- Added a safe Archive Originals workflow that moves selected source videos into `.video-audit-archive/YYYY-MM-DD` folders beside their source directories.
- Added main-process archive planning and execution with conflict detection, rename-with-suffix handling, per-file partial-failure reporting, and operation history records.
- Added typed preload and IPC methods plus renderer confirmation/result dialogs for archive operations, including a Reveal Archive action.

## [0.34.0] - 2026-05-18

### Added

- Added a two-step Move Files workflow for selected known video rows with destination folder selection, plan review, execution results, and operation history records.
- Added main-process move planning and execution with source/destination revalidation, default overwrite blocking, per-file partial-failure reporting, and optional rename-with-suffix conflict handling.
- Added typed preload and IPC methods for creating and executing move plans without exposing arbitrary filesystem APIs to the renderer.

## [0.33.0] - 2026-05-18

### Added

- Added a two-step Move to Trash workflow for selected known video rows, with a safe trash plan, confirmation dialog, execution result dialog, and partial-failure reporting.
- Added main-process trash execution through macOS Trash with immediate revalidation, itemized outcomes, and operation history records.
- Added typed preload and IPC methods for creating and executing trash plans without exposing arbitrary filesystem APIs to the renderer.

## [0.32.0] - 2026-05-18

### Added

- Added safe known-path validation for file-management workflows, including file identity, type, name, size, modified time, missing-path, and supported-video-extension checks.
- Added typed file-management preload APIs and IPC handlers for revealing known files and folders in Finder.
- Updated source and preview-clip reveal actions to validate known file metadata before opening Finder.

## [0.31.0] - 2026-05-18

### Added

- Added an app-owned JSON operation history log for future file-management workflows.
- Added main-process operation history services for creating records, appending item results, marking completion or failure, and reading recent operation history.
- Added read-only operation history IPC and typed preload APIs for listing recent operations and reading operation details.

## [0.30.0] - 2026-05-18

### Added

- Added shared file-operation safety types, status vocabulary, and constants for future trash, move, archive, and replacement workflows.
- Added operation history record types for future persistent file-management logs.

## [0.29.0] - 2026-05-17

### Added

- Added a final UI polish review document covering completed changes, known rough edges, and future workflow recommendations.

### Changed

- Cleaned up the contextual action bar so it only appears for selected rows or available table-wide actions.
- Updated README scope notes to reflect the results-first desktop layout.

## [0.28.0] - 2026-05-17

### Changed

- Improved responsive behavior for MacBook-sized windows with explicit 1512px, 1440px, 1280px, and short-height layout handling.
- Tightened table, dialog, source summary, status strip, toolbar, and contextual action bar constraints to reduce overlap and avoid page-level horizontal scrolling.

## [0.27.0] - 2026-05-17

### Added

- Added app-level CSS theme tokens for surfaces, borders, typography, status colors, radii, spacing, shadows, and fonts.

### Changed

- Consolidated custom renderer styling around shared theme variables and PrimeReact-compatible button, input, message, and tag conventions.

## [0.26.0] - 2026-05-17

### Added

- Added shared dialog header and footer chrome for major renderer dialogs.

### Changed

- Standardized dialog spacing, scroll behavior, max heights, and primary/secondary action placement across source setup, settings, diagnostics, Auto-Fix, Auto-Crop, thumbnail, migration, utility, and video-details dialogs.

## [0.25.0] - 2026-05-17

### Added

- Added actionable first-run and ready-to-audit empty states in the results workspace.

### Changed

- Improved audit-running empty-state feedback with compact progress and selected audit option context.

## [0.24.0] - 2026-05-17

### Added

- Added a dedicated settings dialog wrapper for the header Settings entry point.

### Changed

- Redesigned settings into grouped General, Audit Defaults, Output Paths, Media Tools, Premiere Bridge, Thumbnail Cache, and Diagnostics sections.

## [0.23.0] - 2026-05-17

### Changed

- Reworked the selected-row action bar so primary row workflows appear only when rows are selected.
- Moved lower-frequency and destructive row actions into a `More` menu while preserving thumbnail generation, migration, remove, and restore workflows.

## [0.22.0] - 2026-05-17

### Changed

- Redesigned the results table with denser rows, sticky headers, compact metadata cells, clearer thumbnail placeholders, issue badges, and improved empty states.
- Constrained table scrolling and pagination behavior so the results surface stays stable beside the contextual action bar.

## [0.21.0] - 2026-05-17

### Added

- Added results view filters for All, Flagged, Low-res, Aspect, Crop, and Errors.

### Changed

- Reworked the results toolbar into a compact search/filter/view-control surface with refresh and clear-data controls moved into an overflow menu.

## [0.20.0] - 2026-05-17

### Added

- Added a diagnostics dialog from the compact status strip with Premiere bridge, media tool, output, cache, and app default details.

### Changed

- Made status strip pills open diagnostics directly so runtime health details are available without restoring an always-visible side panel.

## [0.19.0] - 2026-05-17

### Added

- Added a focused source configuration dialog with source pickers, output selection, audit option toggles, recent-folder shortcuts, selected-path summaries, and clear-source controls.

### Changed

- Simplified the main source bar so source selection is summarized on the results-first workspace and detailed setup lives in the source configuration dialog.

## [0.18.0] - 2026-05-17

### Added

- Added a results-first app shell with a compact source bar, status strip, dedicated results toolbar, and contextual selected-row action bar.
- Added modal entry points for source setup, utilities, and settings so secondary controls no longer occupy a permanent right-side rail.

### Changed

- Moved table search, thumbnail visibility, refresh, and clear-data controls into a dedicated results toolbar.
- Moved selected-row workflow actions out of the table header and into the contextual action bar.

## [0.17.4] - 2026-05-17

### Changed

- Documented the current renderer layout constraints and Stage 2 targets for the results-first UI redesign.
- Added safer table and workspace containment so the current results table does not compete with the side rail on laptop-width windows.

## [0.17.3] - 2026-05-17

### Changed

- Integrated the root app icon assets into development windows, packaged resources, and macOS Dock icon handling.
- Documented icon asset locations, regeneration, and macOS Dock icon cache behavior.

## [0.17.2] - 2026-05-17

### Changed

- Tightened cleanup-stage documentation so the app is described as standalone and current workflows are accurately documented.
- Removed unused Premiere export-preset scaffolding from the Electron bridge types and constants.
- Removed unused thumbnail alias types after the media-preview type consolidation.

## [0.17.1] - 2026-05-17

### Added

- Added a legacy parity checklist documenting implemented, partially implemented, intentionally changed, intentionally dropped, and still-missing legacy app parity areas.

## [0.17.0] - 2026-05-17

### Added

- Added a local macOS app packaging script through `npm run build:mac`.
- Added Electron Builder configuration for producing an unsigned local `Video Audit.app` directory build.
- Added README instructions for creating and finding the local macOS app output.

## [0.16.0] - 2026-05-17

### Added

- Added a native macOS app menu with keyboard shortcuts for choosing folders/files, refreshing the latest audit, and opening settings.
- Added persisted window size and position so the app reopens where the user left it.
- Added native completion notifications for long-running audit, media-preview, auto-fix, auto-crop, migration, and preview-clip jobs.
- Added ffmpeg/ffprobe availability diagnostics to the settings panel.
- Added recent-folder selection UI, explicit output-folder reveal, and clearer empty/loading guidance.

## [0.15.0] - 2026-05-17

### Added

- Added the Electron migration workflow for scanning a new edited folder against the audited root, reviewing exact filename matches, and executing the migration.
- Added main-process migration file operations that copy new edits, archive old destination matches, refuse unsafe overwrites, and write manifest and operation log artifacts.
- Added migration IPC and preload APIs for scan, execute, progress, and result retrieval.
- Added renderer migration scan and result dialogs with proposed-change summaries, execution progress, failure details, and archive reveal actions.

## [0.14.0] - 2026-05-17

### Added

- Added an Electron main-process Premiere bridge service for status checks, bridge directory setup, heartbeat validation, and import request creation.
- Added Premiere IPC and preload APIs for bridge status and selected-video import requests.
- Added a renderer Premiere status banner with retry support and clear readiness messages.
- Added the selected-row Edit in Premiere action, including request feedback and successful-row removal from the results table.

## [0.13.0] - 2026-05-17

### Added

- Added preview clip generation through the Electron media-preview service, using ffmpeg to create cached muted MP4 clips from thumbnail timestamps.
- Added preview clip IPC start, progress, cancel, and result retrieval through the typed preload API.
- Added manifest metadata for preview clip path, URL, status, start time, duration, width, and per-clip errors under the existing media-preview cache.
- Added preview clip duration and width defaults to app settings.
- Added a video details modal with a thumbnail carousel, safe preview clip playback, preview clip generation status, cancellation, and persisted clip metadata.

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
