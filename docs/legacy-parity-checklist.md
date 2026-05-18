# Legacy Parity Checklist

Last reviewed: 2026-05-17

This checklist compares the legacy `video-audit` app against the standalone
Electron app in this repo. The legacy app is reference-only; Electron behavior
should be owned locally and should not rely on Express, HTTP/SSE, browser path
workarounds, or cross-repo imports.

## Summary

The Electron app now covers the main legacy workflow areas: folder and selected
file audits, recursive discovery controls, ffprobe-based metadata, low-resolution
and wrong-aspect-ratio detection, black-border analysis, auto-fix, auto-crop,
media previews, migration, Premiere bridge import requests, persistence, table
selection, progress, cancellation, and user-facing errors.

Remaining parity decisions are concentrated in a few areas:

- Premiere export presets were not carried forward in Electron; selected-video
  import requests are the current bridge workflow. Revisit only if direct
  export-request parity is still needed.
- Migration execute has progress and result handling, but no visible cancel
  command is currently exposed to the renderer.
- The Electron table has global filtering and row selection; legacy had some
  more browser-app-specific filter affordances that may be worth reviewing
  during cleanup.
- Browser-specific folder upload fallbacks, Express routes, and HTTP static media
  serving were intentionally replaced by native Electron dialogs, IPC, and a
  controlled media-preview protocol.

## Implemented

| Area | Electron status | Notes |
| --- | --- | --- |
| Folder audit | Implemented | Native folder selection starts audit jobs through typed preload and main-process IPC. |
| Selected-file audit | Implemented | Native file selection sends absolute paths directly to the main-process audit flow. |
| Include subfolders | Implemented | Discovery and audit options support recursive and direct-child scans. |
| Low-resolution detection | Implemented | ffprobe metadata is normalized into audit rows and low-resolution flags. |
| Wrong-aspect-ratio detection | Implemented | Audit rows include aspect-ratio metadata and wrong-aspect flags. |
| Black-border analysis | Implemented | Main-process ffmpeg cropdetect analysis feeds row adjustments and review reasons. |
| Auto-fix | Implemented | Selected rows can be normalized through ffmpeg with progress, cancellation, output reveal, and safe output naming. |
| Auto-crop | Implemented | Eligible black-border rows can be cropped through ffmpeg with manifests, progress, cancellation, output reveal, and skipped-row reasons. |
| Thumbnails | Implemented | `mediaPreviewService` generates cached thumbnails and exposes safe `media-preview://` URLs. |
| Preview clips | Implemented | Preview clips reuse thumbnail timestamps, cache records, manifests, and safe asset URLs. |
| Migration | Implemented | Folder-based scan, review, and execute workflows copy new edits, archive matched destination files, and write manifest/log artifacts. |
| Premiere bridge | Implemented | Collie-specific UXP plugin, Application Support bridge path, bridge status, Adobe app launch, and selected-video import request creation are available. |
| Local persistence | Implemented | App settings are persisted under Electron user data, and latest audit results are persisted in renderer IndexedDB. |
| Table filtering | Implemented | Results table supports global filtering/search and soft removal/restore. |
| Row selection | Implemented | Multi-row selection drives selected-video workflows for auto-fix, auto-crop, thumbnails, preview clips, migration context, and Premiere import. |
| Error handling | Implemented | Dialogs, banners, workflow messages, and IPC result objects surface actionable errors. |
| Cancellation | Implemented for most long-running jobs | Audit, discovery, ffprobe, auto-fix, auto-crop, thumbnail generation, and preview clip generation expose cancellation. |
| Progress | Implemented | Main-process job registries send progress snapshots through IPC for active long-running workflows. |
| macOS utility polish | Implemented | Native menu commands, persisted window state, notifications, diagnostics, and local `.app` build support are available. |

## Partially Implemented

| Area | Current behavior | Gap or decision |
| --- | --- | --- |
| Premiere bridge export parity | Electron queues `import-selected-videos` requests and reports bridge readiness. | Legacy still contains an export dialog/preset history. Electron intentionally omits that dead export scaffolding for now, so direct export-request parity is not complete. |
| Migration cancellation | Migration execute uses an abort-aware service path and reports canceled states internally. | No renderer/preload cancel command is exposed for an in-progress migration execute job. |
| Recent folders | Electron shows recent-folder UI and menu support for choosing sources. | The app menu currently opens the folder chooser rather than selecting a specific recent-folder item directly. |
| Table filters | Electron supports global search, selection, thumbnails, details, and row actions. | Legacy table behavior included additional faceted/filter affordances that can be compared during final cleanup if desired. |
| Tool diagnostics | Electron checks ffmpeg/ffprobe availability and configured overrides. | Diagnostics do not install tools or repair missing binaries automatically. |

## Intentionally Changed

- Express, REST routes, and SSE streams were replaced with Electron IPC and
  main-process job registries.
- Browser folder/file upload workarounds were replaced with native macOS dialogs
  that return absolute paths.
- Thumbnail and preview assets are served through a controlled
  `media-preview://` protocol instead of HTTP static routes.
- Media-preview data is grouped under a broader preview cache so thumbnails and
  preview clips share source metadata, timestamps, manifests, and safe URLs.
- Settings live under Electron user data rather than the legacy local backend
  process.
- Latest audit results are loaded from Electron renderer IndexedDB at startup
  rather than from legacy browser/local backend state.
- Long-running completion notifications and native app-menu commands are
  Electron-only improvements.
- Premiere export presets are omitted; the current primary workflow is importing
  selected videos into the active Premiere project.

## Intentionally Dropped

- Public distribution polish, signing, notarization, auto-updates, and App Store
  packaging are out of scope for this private macOS utility.
- Browser-only selected-folder path reconstruction and `webkitdirectory`
  fallbacks are not carried forward.
- The legacy Express server is not part of the target architecture.
- Legacy HTTP thumbnail URLs are not preserved.
- Startup demo/sample data is not preserved; Electron should use real selected
  sources and persisted local state.
- Automated tests remain intentionally absent unless explicitly requested.

## Still Missing Or Worth Revisiting

- Decide whether to port the legacy Premiere export-request dialog and preset
  workflow, or keep Electron import-only as the intentional direction.
- Add a renderer/preload cancel command for migration execute if user testing
  shows the operation needs explicit cancellation.
- Compare the legacy table's faceted filters/counts against the Electron table
  during final cleanup and add only the filters that still improve large-list
  review.
- Consider making recent-folder menu items open their exact folder directly
  rather than delegating to the native folder chooser.
- Add app icon, signing, notarization, or installer polish only if the project
  scope expands beyond a private local build.

## Regression Guard Notes

- Keep migration non-destructive: copy new edits, archive replaced destination
  files, write run manifests/logs, and never mutate source files in place.
- Keep auto-fix and auto-crop output safe: avoid source overwrites and preserve
  manifest/result visibility.
- Keep thumbnails and preview clips separate from the audit pipeline; previews
  should remain on-demand workflows.
- Keep filesystem and ffmpeg/ffprobe access in the main process. Renderer code
  should continue using typed preload APIs only.
- Keep cancellation and progress visible for long-running jobs where practical.
