# Improved Duplicate Detection Plan

## 1. Overview

The current Duplicate Scan workflow catches exact filename duplicates and keeps review/destructive intent safely separated from normal audit results. That behavior should be preserved. The next feature should extend duplicate detection beyond exact filenames so Collie Video can flag likely duplicate videos and shorter clips contained inside longer videos, even when names and durations differ.

The goal is not perfect AI-grade video understanding. The goal is a local, deterministic, review-first scanner that clears low-hanging fruit:

- exact filename duplicates across folders
- likely visual duplicates with different filenames, encodes, bitrates, and resolutions
- shorter videos that appear to be offset segments inside longer videos
- candidate groups with enough evidence for manual review before any file operation

The recommended direction is a staged scanner that runs in the Electron main process, uses `ffmpeg`/`ffprobe` for media metadata and frame extraction support, uses local Python/OpenCV helpers for vision-specific fingerprinting, stores expensive fingerprints in a main-process local cache, and keeps the renderer behind typed preload APIs.

Settled first-pass decisions:

- Improved visual duplicate scans should use selected project/result rows as sources, not all active rows.
- The first visual implementation should expose at least two scan profiles: a lighter/faster profile and a deeper/more thorough profile.
- Exact filename, visual near-duplicate, and contained-clip results should appear together in one Duplicate Review workspace with mode filters.
- Visual fingerprinting should require the project-local Python `.venv` and OpenCV setup in the first implementation. Exact filename matching can still run without OpenCV.
- Ignore state should remain transient like current duplicate marks.

Duplicate candidates should remain suggestions. The scanner should not delete, archive, replace, or hide files automatically.

## 2. Current-State Findings

This plan was written against the current `collie-video` checkout. The implementation should treat the following files as current source-of-truth anchors.

### Repo Guidance And Plans

- `.codex-instructions.md`
  Defines the Electron architecture direction: main process owns filesystem, ffmpeg/ffprobe, job orchestration, app settings, and OS integrations; preload exposes a small typed API; renderer is UI-only; no renderer Node access; no tests unless explicitly requested.
- `CONTRIBUTING.md`
  Reinforces the same boundaries, long-running job progress/cancellation expectations, non-destructive local media principles, and no automatic overwrite of original videos.
- `docs/dupe-scan-implementation-plan.md`
  Documents the v1 exact filename Duplicate Scan workflow and explicitly defers hash/partial-hash duplicate detection.
- `docs/dupe-scan-verification.md`
  Records implemented v1 behavior: selected rows as sources, exact basename matching, macOS case-insensitive matching, candidate review, protected source rows, and macOS Trash through existing file-operation services.
- `docs/opencv-local-setup.md` and `scripts/opencv/README.md`
  Establish local Python/OpenCV as a future helper layer only. The scripts are not integrated into Electron yet and should only be called from the main process through future typed APIs.
- `docs/renderer-architecture.md`
  Describes the current renderer structure: focused hooks, typed API clients, `useVideoResultsStore` for result/table workspace state, IndexedDB audit-result persistence, and transient Duplicate Scan state.
- `docs/zustand-store-implementation-plan.md` and `src/renderer/stores/README.md`
  Clarify that Zustand is for focused renderer workspace state, not main-process execution, raw IPC, durable settings, or filesystem work.

### Current Duplicate Detection

- `src/shared/types/duplicateScan.ts`
  Defines the v1 duplicate contract. `DuplicateMatchType` is currently only `'exact_filename'`, with explicit constants documenting basename-with-extension matching, case-insensitive macOS filename keys, same-path source exclusion, and that duration/size/resolution/bitrate/modified date are not matching inputs.
- `src/main/services/duplicateScanService.ts`
  Runs Duplicate Scan in the main process. It validates the scan folder, normalizes selected source rows, recursively discovers videos, groups exact filename matches, excludes source same-path candidates, reads metadata only for matched candidates through `runFfprobe`, stores scan results in memory, and validates candidate ids before Trash planning.
- `src/main/ipc/duplicateScanIpc.ts`
  Uses `JobRegistry` for start/cancel/result/progress behavior. It emits progress snapshots, notifies on completion, and delegates marked candidate Trash planning to `createTrashPlan` after resolving ids against the stored scan result.
- `src/preload/videoAuditApi.ts`, `src/shared/constants/ipcChannels.ts`, and `src/renderer/api/duplicateScanClient.ts`
  Expose Duplicate Scan through the typed preload boundary. The renderer does not call Electron or Node APIs directly.
- `src/renderer/hooks/useDuplicateScanWorkflow.ts`
  Owns transient Duplicate Scan state: setup dialog, folder path, job id, progress, result, candidate marks, duplicate-specific Trash plan/result, and reset behavior.
- `src/renderer/components/DuplicateScanDialog.tsx`
  Starts the scan from selected rows and clearly describes the current exact filename-only rule.
- `src/renderer/components/DuplicateReviewWorkspace.tsx`
  Renders candidate groups using PrimeReact `DataTable` row expansion. Source rows are protected summaries; candidate rows are markable.
- `src/renderer/components/DuplicateTrashConfirmDialog.tsx` and `DuplicateTrashResultDialog.tsx`
  Provide duplicate-specific confirmation/result review while reusing the existing file-operation plan/result types.
- `src/renderer/App.tsx`
  Adds `WorkspaceMode = 'results' | 'duplicate-review'`, displays a workspace switcher when duplicate results exist, and keeps duplicate review separate from the main results table.

### Audit Results And Table Data

- `src/shared/types/video.ts`
  Defines `VideoRow`, including `path`, `fileName`, `directory`, `sizeBytes`, `fileSystemSizeBytes`, `modifiedAtMs`, duration, resolution, bitrate, frame rate, thumbnail, preview frames, black-border adjustment, `visible`, and transient `fileAvailability`.
- `src/shared/types/audit.ts`
  Defines `AuditRequest`, `AuditResult`, discovery, ffprobe metadata, and long-running progress shapes.
- `src/main/services/auditService.ts`
  Runs media audit in the main process. It reuses `discoverVideoFiles`, `runFfprobe`, optional black-border analysis, and thumbnail generation for flagged rows.
- `src/renderer/components/VideoResultsTable.tsx`
  Renders the main PrimeReact `DataTable` with selection, global search, row filters, availability tags, preview column, row actions, details dialog, and compact metadata display.
- `src/renderer/components/VideoDetailsDialog.tsx`
  Shows preview frames and preview clips for a single `VideoRow`. This is useful review infrastructure for future candidate comparison, but it currently assumes one row at a time.

### ffmpeg, ffprobe, Media Preview, And OpenCV

- `src/main/services/ffprobeService.ts`
  Wraps `ffprobe` JSON execution through `runChildProcess`, with cancellation support.
- `src/main/services/mediaPreviewService.ts`
  Uses `ffmpeg` to generate thumbnails, fresh preview frames, and preview clips. It already has a user-data media preview cache, path-safe asset URLs, per-video cache hash based on path, modified time, and file size, and cancellation handling.
- `src/main/services/blackBorderAnalysisService.ts`
  Uses ffmpeg `cropdetect` samples at multiple timestamps, demonstrating a practical timestamp sampling model and confidence-from-sample-agreement pattern.
- `src/main/utils/childProcess.ts`
  Provides a reusable child-process wrapper with stdout/stderr capture and `AbortSignal` cancellation. A Python/OpenCV helper should use this boundary.
- `scripts/opencv/fingerprint_video.py`
  Currently only validates OpenCV can open a video and report metadata. It prints JSON and does not generate fingerprints, compare videos, or write cache files.
- `scripts/opencv/verify_opencv.py`, `requirements-opencv.txt`, and `package.json` scripts
  Provide local setup and verification for `opencv-python` and `numpy`.

### Settings, Persistence, And Projects

- `src/main/services/settingsService.ts`
  Stores app settings as JSON under Electron `userData`, including ffmpeg/ffprobe overrides and file-management preferences.
- `src/main/services/appPaths.ts`
  Centralizes user-data paths for settings, projects, media preview cache, and file-operation history. A future fingerprint cache should add a path here.
- `src/renderer/storage/auditResultStorage.ts`
  Persists the latest audit result in renderer IndexedDB database `collie-video`. It explicitly notes that duplicate review sessions are not persisted with audit results.
- `src/renderer/stores/useVideoResultsStore.ts` and `videoResultsSelectors.ts`
  Own canonical result rows, visible/hidden row state, selected row ids, search, result filters, thumbnail metadata merges, preview clip merges, and file-availability merges.
- `src/renderer/helpers/projectSnapshot.ts`
  Explicitly excludes duplicate review results and marks from project snapshots because they represent stale/destructive intent.
- `src/shared/types/project.ts`
  Defines named project JSON shape under app-managed `userData`.

### File Operations, Review, And History

- `src/shared/types/fileOperations.ts`
  Defines known path validation, Trash/Move/Archive/Replacement plans, warnings, errors, execution results, and typed confirmation.
- `src/main/utils/fileOperationSafety.ts`
  Validates known file/folder paths in the main process, blocks symlinks, verifies expected filename, size, modified time, kind, and supported video extension.
- `src/main/services/fileOperationService.ts`
  Creates and executes Move to Trash and Move plans. Trash uses `shell.trashItem`, requires confirmation for large/risky plans, and revalidates immediately before execution.
- `src/main/services/archiveService.ts`
  Moves source files into local `.collie-video-archive/<date>` folders through planned/revalidated archive operations.
- `src/main/services/operationHistoryService.ts` and `fileOperationLogService.ts`
  Persist operation history JSON under userData with plan snapshots and per-item results.
- `src/main/services/migrationService.ts`
  Implements a separate exact-filename migration workflow with copy-temp, archive old matches, manifest, and operation log. This should remain separate from duplicate detection.
- `src/renderer/hooks/useFileOperationsWorkflow.ts`
  Owns selected-row Trash/Move/Archive review and execution dialogs, hiding rows after successful operations.

### Progress And Cancellation

- `src/main/services/jobRegistry.ts`
  Provides the standard in-memory job model with id, request, `AbortController`, snapshot, and result.
- `src/main/ipc/auditIpc.ts`, `mediaPreviewIpc.ts`, `autoCropIpc.ts`, `autoFixIpc.ts`, `migrationIpc.ts`, `replacementWorkflowIpc.ts`, and `duplicateScanIpc.ts`
  Establish the app's long-running job pattern: start endpoint, progress event, cancel endpoint, get-result endpoint where needed, main-process `AbortSignal`, and renderer hook subscription.
- `src/renderer/hooks/useWorkflowBusyState.ts` and `src/renderer/app/useAppCommands.ts`
  Centralize active workflow booleans and Escape/menu cancellation priority.

## 3. Product Goals

- Preserve exact filename duplicate detection.
- Detect exact filename duplicates across folders regardless of duration.
- Detect likely visual duplicates with different filenames.
- Detect shorter clips contained inside longer videos.
- Handle different start points and durations through offset/sequence matching, not timestamp-to-timestamp matching.
- In the first implementation, scan selected project/result rows as the source set so the user controls cost and scope.
- Offer at least two first-pass visual scan profiles: a lighter/faster profile and a deeper/more thorough profile.
- Keep the scanner local/offline and deterministic.
- Keep all filesystem and media processing in the Electron main process.
- Keep renderer access behind typed preload APIs and renderer API clients.
- Require the project-local Python `.venv` for first-pass visual/OpenCV modes instead of adding a TypeScript/ffmpeg-only visual fallback.
- Cache expensive visual fingerprints.
- Avoid recomputing fingerprints when file path, size, modified time, and algorithm version have not changed.
- Avoid background CPU churn; scans should run only when the user starts them.
- Support progress, cancellation, and per-file status.
- Present likely candidate groups for manual review before any action.
- Present exact filename, visual near-duplicate, and contained-clip groups in one review workspace with mode filters.
- Reuse existing safe actions where practical: Move to Trash, Archive Originals, Remove from Table, Reveal, operation history.
- Keep Ignore state transient in the first implementation.
- Keep existing exact filename Duplicate Scan behavior from regressing while adding new modes.

## 4. Non-Goals

- No hosted AI service.
- No automatic deletion.
- No permanent deletion.
- No destructive action without explicit review and confirmation.
- No renderer filesystem access.
- No Node, ffmpeg, ffprobe, Python, or OpenCV exposure to the renderer.
- No scan-on-start behavior.
- No background library watcher.
- No all-active-row or full-library visual source mode in the first implementation.
- No TypeScript/ffmpeg-only visual duplicate fallback for machines without the project-local Python/OpenCV environment in the first implementation.
- No persisted ignore list in the first implementation.
- No guarantee that every duplicate is found.
- No claim that candidate groups are byte-identical duplicates.
- No attempt to solve every cropped, watermarked, heavily edited, rotated, picture-in-picture, or re-recorded edge case in the MVP.
- No full scene understanding or semantic video search.
- No migration workflow replacement.
- No project snapshot persistence of active destructive intent.
- No test files or test setup unless explicitly requested during implementation.

## 5. Architecture Recommendation

### Approach A: ffmpeg Frame Extraction + TypeScript Hashing

This approach would use `ffmpeg` from the Electron main process to extract sampled frames, then compute simple perceptual hashes in TypeScript.

Pros:

- Stays mostly TypeScript.
- Fits the existing Electron main-process architecture.
- Uses the app's existing ffmpeg settings and child-process patterns.
- Packaging is simpler than Python/OpenCV.
- Easy to start with `dhash` or average-hash over extracted images.

Cons:

- TypeScript image-processing support is not currently in the repo.
- Adding an image library or hand-rolling image parsing creates new maintenance surface.
- Intermediate frame files need cleanup and cache discipline.
- Future ORB/feature matching would likely need OpenCV anyway.
- More risk of duplicating image-processing work that OpenCV already provides.

### Approach B: OpenCV Reads Videos Directly And Computes Fingerprints

This approach would call a Python/OpenCV helper from the main process. OpenCV would open the video, sample frames, and compute hashes/features directly.

Pros:

- Simple prototype path for frame sampling and perceptual hashes.
- Can evolve into ORB/keypoint/feature matching later.
- Avoids intermediate frame files for simple fingerprint extraction.
- Existing `scripts/opencv` folder and `requirements-opencv.txt` already prepare this direction.
- JSON stdout can keep the TypeScript/Python boundary explicit.

Cons:

- Requires local Python venv setup and runtime checks.
- Packaging the helper into a macOS app later needs care.
- OpenCV video decode support can vary by file/codec/build.
- Process management, stderr capture, JSON parsing, and cancellation need deliberate wrappers.
- Some media files may decode through ffmpeg more reliably than OpenCV.

### Approach C: Hybrid Main-Process Orchestration With ffmpeg/ffprobe + OpenCV Helpers

This approach keeps TypeScript/Electron main process as the orchestrator, keeps `ffprobe` authoritative for metadata, uses existing ffmpeg utilities where they are strongest, and uses Python/OpenCV only for vision-specific fingerprint generation.

Pros:

- Best match for the current repo boundaries.
- Preserves existing ffmpeg/ffprobe settings and diagnostics.
- Keeps Python/OpenCV behind the main-process boundary.
- Lets TypeScript own jobs, progress, cancellation, cache invalidation, candidate grouping, and UI-facing results.
- Lets OpenCV focus on frame/hash/feature work.
- Allows future mode-specific helpers without changing renderer architecture.
- Avoids renderer IndexedDB becoming a media-processing cache.

Cons:

- More moving pieces than a pure TypeScript implementation.
- Needs explicit helper discovery/diagnostics.
- Needs a robust JSON stdout contract and error handling.
- Needs clear cache ownership and algorithm versioning.

### Recommendation

Use Approach C.

Collie Video already has a clean split: main process owns media work and job orchestration; renderer owns review UI. The improved duplicate scanner should follow that pattern:

- TypeScript main process orchestrates scan modes, file discovery, metadata reads, fingerprint cache lookup/write, matching, candidate grouping, progress, cancellation, and candidate validation.
- `ffprobe` remains the metadata authority for duration, size, dimensions, frame rate, and codec.
- `ffmpeg` remains available for preview frame/clip generation and can be used for frame extraction if the chosen OpenCV helper path consumes image inputs. That is not a no-OpenCV fallback for the first visual implementation.
- Python/OpenCV helper scripts compute visual fingerprints and, later, ORB/feature evidence.
- Renderer shows reviewable candidate groups and invokes existing file-operation APIs only after user confirmation.
- The first visual implementation requires the project-local Python `.venv` and OpenCV dependencies. It should not include a TypeScript/ffmpeg-only visual fallback for machines without OpenCV ready.

### Responsibilities By Layer

Main process:

- Validate scan requests, selected source rows, requested modes, scan profile, and helper availability.
- Discover target video files with `discoverVideoFiles`.
- Read metadata with `runFfprobe`.
- Resolve the project-local Python/OpenCV executable/helper paths.
- Run helper scripts through `runChildProcess` or a small Python-specific wrapper.
- Own fingerprint cache files under Electron `userData`.
- Match visual and contained candidates.
- Emit progress and support cancellation.
- Store current scan result in memory for candidate-id validation.
- Delegate file actions to existing file-operation services only after review.

Python/OpenCV helpers:

- Accept explicit JSON or CLI inputs from main process.
- Open one video at a time.
- Sample frames at requested timestamps or interval.
- Compute normalized perceptual hashes and optional frame-quality metrics.
- Return JSON only.
- Avoid writing app cache directly in the first implementation; let TypeScript own cache writes.

ffmpeg/ffprobe:

- `ffprobe`: authoritative metadata and duration.
- `ffmpeg`: existing preview frame/clip generation; possible frame extraction if the OpenCV helper design prefers image inputs.
- Existing settings overrides should be respected.

Preload/API boundary:

- Add typed duplicate-scan methods only when implementing future stages.
- Keep the renderer client thin, following `duplicateScanClient.ts`, `mediaPreviewClient.ts`, and `auditClient.ts`.
- Do not expose arbitrary filesystem, Python, OpenCV, or child-process APIs.

Renderer:

- Offer scan setup controls for selected project/result rows.
- Offer first-pass Fast and Deep profile choices so the user can trade speed for contained-clip sensitivity.
- Display progress.
- Display exact filename, visual near-duplicate, and contained-clip groups together in one Duplicate Review workspace with mode filters.
- Display candidate groups, evidence, confidence, and matched segment timestamps.
- Let the user mark candidates or choose review actions.
- Invoke existing action clients for Trash/Archive/Remove workflows.
- Keep destructive intent and Ignore state transient unless a future plan deliberately adds persisted decisions.

Persistence/caching:

- Keep candidate scan results transient in renderer workflow state and main-process job memory.
- Store expensive fingerprints as main-process cache files under `userData`.
- Do not store fingerprints in renderer IndexedDB for the first implementation because the main process computes and consumes them.
- Continue using renderer IndexedDB for current audit rows only.

## 6. Data Model

Names should stay close to existing repo conventions: `durationSeconds`, `sizeBytes`, `modifiedAtMs`, `fileName`, `directory`, `jobId`, `scanId`, and `JobStatus`.

The current exact filename type should remain available for compatibility:

```ts
export type DuplicateMatchType =
  | 'exact_filename'
  | 'visual_near_duplicate'
  | 'contained_clip'
  | 'shared_segment';
```

Add a higher-level mode enum for user-selected scan modes:

```ts
export type DuplicateScanMode =
  | 'filename-exact'
  | 'visual-fingerprint'
  | 'contained-clip';

export type DuplicateScanProfile = 'fast' | 'deep';

export type ImprovedDuplicateScanSourceScope = 'selected-result-rows';

export interface ImprovedDuplicateScanOptions {
  sourceScope: ImprovedDuplicateScanSourceScope;
  modes: DuplicateScanMode[];
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  maxSamplesPerVideo: number;
  minSequentialMatches: number;
  hashDistanceThreshold: number;
  includeExistingExactFilenameMatches: boolean;
  useCachedFingerprints: boolean;
}
```

First implementation notes:

- `sourceScope` should only support `'selected-result-rows'`.
- Do not add an all-active-rows or whole-library visual source mode yet.
- Expose `fast` and `deep` profiles in the UI from the first visual implementation.
- A future `balanced` profile can be added after real library calibration if two profiles are too coarse.

Fingerprint cache identity:

```ts
export type VisualFingerprintAlgorithm = 'dhash-v1' | 'phash-v1' | 'orb-v1';

export interface VisualFingerprintCacheKey {
  filePath: string;
  sizeBytes: number;
  modifiedTimeMs: number;
  durationSeconds: number | null;
  algorithm: VisualFingerprintAlgorithm;
  algorithmVersion: string;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
}
```

Fingerprint result:

```ts
export interface VisualFingerprintSample {
  timeSeconds: number;
  hash: string;
  frameMean?: number | null;
  frameStdDev?: number | null;
  isLowInformation?: boolean;
}

export interface VisualFingerprint {
  cacheKey: string;
  filePath: string;
  fileName: string;
  directory: string;
  sizeBytes: number;
  modifiedTimeMs: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  profile: DuplicateScanProfile;
  sampleIntervalSeconds: number;
  algorithm: VisualFingerprintAlgorithm;
  algorithmVersion: string;
  generatedAt: string;
  samples: VisualFingerprintSample[];
  warnings: string[];
}
```

Candidate groups:

```ts
export type DuplicateCandidateMatchType =
  | 'exact-filename'
  | 'near-duplicate'
  | 'contained-clip'
  | 'shared-segment';

export type DuplicateCandidateReviewStatus =
  | 'unreviewed'
  | 'ignored'
  | 'keep'
  | 'marked-for-trash'
  | 'marked-for-archive'
  | 'moved-to-trash'
  | 'archived'
  | 'removed-from-table'
  | 'failed';

export interface DuplicateCandidateFile {
  id: string;
  role: 'source' | 'candidate';
  filePath: string;
  fileName: string;
  directory: string;
  durationSeconds: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  modifiedAtMs?: number | null;
  matchedStartSeconds?: number;
  matchedEndSeconds?: number;
  reviewStatus?: DuplicateCandidateReviewStatus;
}

export interface DuplicateCandidateEvidence {
  matchedFrameCount?: number;
  sequentialMatchCount?: number;
  matchedDurationSeconds?: number;
  shorterVideoCoverageRatio?: number;
  averageHashDistance?: number;
  medianHashDistance?: number;
  offsetSeconds?: number;
  offsetToleranceSeconds?: number;
  filenameMatchKey?: string;
  sampleIntervalSeconds?: number;
  algorithm?: VisualFingerprintAlgorithm;
  notes?: string[];
}

export interface DuplicateCandidateGroup {
  id: string;
  mode: DuplicateScanMode;
  confidence: number;
  matchType: DuplicateCandidateMatchType;
  files: DuplicateCandidateFile[];
  evidence: DuplicateCandidateEvidence;
}
```

Future scan result shape:

```ts
export interface ImprovedDuplicateScanResult {
  scanId: string;
  status: 'complete';
  startedAt: string;
  completedAt: string;
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  fingerprintedFileCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  groups: DuplicateCandidateGroup[];
  warnings: string[];
  summary: {
    exactFilenameGroupCount: number;
    visualGroupCount: number;
    containedClipGroupCount: number;
    sharedSegmentGroupCount: number;
    candidateFileCount: number;
  };
}
```

Future progress shape:

```ts
export type ImprovedDuplicateScanPhase =
  | 'validating'
  | 'walking'
  | 'metadata'
  | 'fingerprint-cache'
  | 'fingerprinting'
  | 'matching-filename'
  | 'matching-visual'
  | 'matching-contained-clips'
  | 'complete'
  | 'error'
  | 'canceled';

export interface ImprovedDuplicateScanProgress {
  jobId: string | null;
  scanId: string | null;
  status: JobStatus;
  phase: ImprovedDuplicateScanPhase;
  totalFiles: number | null;
  processedFiles: number;
  fingerprintedFiles: number;
  cacheHits: number;
  cacheMisses: number;
  candidateGroupCount: number;
  currentFile: string | null;
  message: string | null;
  error?: string | null;
}
```

Implementation note:

- Do not replace the existing v1 `DuplicateScanResult` in one jump.
- Add new fields/types in a backward-compatible way, or create `ImprovedDuplicateScan*` types first and migrate the UI intentionally.
- Candidate ids should be deterministic and should include mode plus file paths plus matched segment range where relevant.
- Any action endpoint must resolve candidate ids from the stored scan result before file operations, as `duplicateScanCreateTrashPlan` does today.

## 7. Matching Strategy

### Why Timestamp-To-Timestamp Comparison Is Insufficient

Comparing `Video A @ 00:10` to `Video B @ 00:10` only works when two videos start at the same content offset. It fails for contained clips:

```txt
Long Video A at 12:00 ~= Short Video B at 00:00
Long Video A at 12:05 ~= Short Video B at 00:05
Long Video A at 12:10 ~= Short Video B at 00:10
```

The important evidence is not that one timestamp matches another identical timestamp. The important evidence is a run of frame matches where the difference between timestamps stays approximately constant:

```txt
offset = longTime - shortTime
```

For a contained clip, several matched pairs should agree on the same offset bucket. A single matching frame is not enough because black frames, title cards, still shots, intros, and repeated graphics can collide.

### Filename Exact Mode

Preserve the current exact filename behavior:

- Match basename including extension.
- Keep case-insensitive keys on macOS.
- Exclude same absolute source path.
- Do not use duration, size, resolution, bitrate, codec, or modified date as match criteria.
- Keep source rows protected and candidates unmarked by default.

This mode should remain the cheap first pass and should continue to work even if OpenCV is unavailable.

### Visual Fingerprint Generation

Recommended first algorithm: `dhash-v1`.

Reasoning:

- Simple to implement in Python/OpenCV.
- Fast.
- Robust enough for resolution/bitrate/encoding changes.
- Easy to compare using Hamming distance.
- Produces compact cache entries.

Possible later algorithms:

- `phash-v1` for stronger frequency-domain similarity.
- `orb-v1` for cropped/shifted/partially transformed matches.

Sampling:

- Expose two first-pass profiles: Fast and Deep.
- Default the setup dialog to Fast so expensive analysis is opt-in, while keeping Deep available in the first implementation.
- Skip the first and last 1 second for normal videos to avoid blank decoder/transition frames.
- For very short videos, sample at least 3 usable points when possible.
- For long videos, cap sample count by profile and increase the effective interval when needed.
- Store the effective interval and timestamps in the fingerprint.
- Preserve enough timestamps for contained-clip offset matching.

Suggested initial profiles:

```txt
fast  sample every 10s, max 120 samples/video
deep  sample every 2s,  max 600 samples/video
```

Possible later profile:

```txt
balanced  sample every 5s, max 240 samples/video
```

Frame quality filtering:

- Compute grayscale mean and standard deviation per sampled frame.
- Mark frames as low-information when they are near black, near white, or very low variance.
- Ignore or downweight low-information frames during matching.
- Track repeated/common hashes and downweight hashes that appear across many unrelated videos.
- Avoid using isolated title cards, black frames, or static slides as strong evidence.

### Hamming Distance Thresholds

Initial practical thresholds for 64-bit `dhash`:

- `0-4`: very strong frame match
- `5-8`: strong frame match
- `9-12`: possible frame match, useful only inside a longer sequence
- `>12`: usually not a match for MVP purposes

Recommended default:

- Use `hashDistanceThreshold = 8` for high-confidence matches.
- Allow `<= 12` only when a sequence has strong support and the average distance remains low.

These thresholds should be settings/internal constants first, then exposed as advanced settings only after real fixtures show what needs tuning.

### Visual Near-Duplicate Matching

Near-duplicate candidates are videos with broadly similar visual content over much of their duration.

Suggested MVP rule:

- Compare videos that have enough non-low-information samples.
- Use a hash index to find potential pairs instead of brute-forcing every frame against every other frame.
- For similar-duration videos, compare sequence order roughly timestamp-to-timestamp with tolerance.
- Require at least 8 matched frames or at least 30 seconds of matched sampled content, whichever is more appropriate for the duration.
- Require a meaningful match ratio, for example:
  - `>= 0.60` of the shorter video's usable samples for likely duplicate
  - `>= 0.80` for high confidence
- Require average Hamming distance below a threshold, for example `<= 8`.
- Downweight matches composed mostly of low-information frames.

Confidence scoring can start as a simple weighted score:

```txt
confidence =
  0.40 * shorter-video coverage
  + 0.25 * sequential consistency
  + 0.20 * normalized average hash distance
  + 0.10 * duration similarity
  + 0.05 * resolution/metadata compatibility
```

### Contained-Clip Matching

Contained-clip matching should treat one video as potentially shorter and one as potentially longer.

Candidate prefilter:

- Only compare pairs where one duration is meaningfully shorter, for example `short.duration <= long.duration * 0.90`.
- Allow same-duration videos to be handled by visual near-duplicate mode.
- Require both videos to have enough usable samples.

Offset matching:

1. Build frame matches between short samples and long samples where Hamming distance is within threshold.
2. For each matched pair, compute:

   ```txt
   offsetSeconds = longSample.timeSeconds - shortSample.timeSeconds
   ```

3. Bucket offsets using tolerance, initially around one sample interval:

   ```txt
   offsetBucket = round(offsetSeconds / offsetToleranceSeconds)
   ```

4. Find the strongest offset bucket.
5. Within that bucket, sort matched pairs by short-video timestamp.
6. Look for runs where:
   - short timestamps increase in order
   - long timestamps increase in order
   - offset remains within tolerance
   - gaps are not too large relative to sample interval
7. Require a minimum sequence:
   - at least 5 sequential matches, or
   - at least 30 seconds of matched duration, or
   - at least 40-60% coverage of the shorter video's usable samples

Evidence to show:

- matched short segment start/end
- matched long segment start/end
- offset seconds
- sequential match count
- matched duration
- coverage ratio
- average/median hash distance

Contained-clip confidence:

```txt
confidence =
  0.35 * shorter-video coverage
  + 0.30 * offset consistency
  + 0.20 * sequential run length
  + 0.15 * normalized hash distance
```

False-positive reduction:

- Reject groups where matched frames are mostly low-information.
- Reject groups where the best offset bucket has too few unique timestamps.
- Reject groups where matches are scattered with no run.
- Reject groups where common hashes appear across many files.
- Prefer longer sequential evidence over isolated frame-count totals.

### Avoiding O(n^2) Blowups

The naive approach compares every video to every other video and every frame to every other frame. That will become painful quickly.

Use a staged narrowing pipeline:

1. Exact filename mode first; cheap and useful.
2. Metadata prefilter:
   - unsupported/missing duration handling
   - duration ratio buckets
   - minimum sample count
3. Hash blocking:
   - build an inverted index from hash buckets to sample references
   - optionally use near-hash variants or locality-sensitive buckets later
4. Candidate pair accumulation:
   - only compare pairs that share enough plausible frame matches
5. Sequence/offset verification:
   - run the more expensive offset analysis only on candidate pairs
6. Result cap:
   - cap candidate groups per scan/profile and make Deep increase analysis depth without expanding the source scope

For the first implementation, compare selected source rows against scanned-folder candidates. Full-library all-vs-all can be a later mode because it has a much larger performance envelope.

## 8. Caching Strategy

Visual fingerprints are expensive derived media artifacts. They should be cached.

### Recommended Location

Add a main-process cache directory under Electron `userData`, parallel to the media preview cache:

```txt
getDuplicateFingerprintCacheDir(): userData/duplicate-fingerprints
```

Recommended structure:

```txt
duplicate-fingerprints/
  index-v1.json
  fingerprints/
    <cacheKey>.json
```

Why main-process userData instead of renderer IndexedDB:

- Fingerprint generation and matching run in the main process.
- The renderer does not need raw fingerprint arrays.
- Main process already owns filesystem/media analysis.
- It avoids large binary-ish derived data crossing into renderer persistence.
- It matches the media preview cache pattern more closely than audit-result IndexedDB.

Use IndexedDB only for existing audit results and row metadata. Do not store raw fingerprint caches there in the first implementation.

### Cache Key

Use a deterministic hash over:

- resolved file path
- file size
- modified time
- duration if available
- algorithm
- algorithm version
- sample interval/effective profile

Example:

```txt
sha1(filePath + sizeBytes + modifiedTimeMs + durationSeconds + algorithm + algorithmVersion + sampleIntervalSeconds)
```

### Invalidation Rules

A fingerprint is valid only when:

- file exists
- file is still a regular file
- size matches
- modified time matches
- algorithm and algorithm version match
- sample interval/profile matches
- cached JSON validates against the expected schema

If any of those fail, recompute.

Missing/stale files:

- Return a per-file fingerprint status of `missing`, `stale`, or `failed`.
- Do not crash the whole scan when one file cannot fingerprint.
- Include warnings in the scan result.

### Cache Writes

Write cache files atomically:

1. write `<cacheKey>.json.tmp`
2. rename to `<cacheKey>.json`
3. update `index-v1.json` if an index is used

Keep cache writes inside the main process.

### Cache Size And Cleanup

First implementation:

- Provide a manual "clear duplicate fingerprint cache" endpoint only if needed for development/user control.
- Do not automatically delete on every app launch.
- Consider pruning old entries by count or total bytes in a later tuning stage.

Future:

- Add cache statistics to diagnostics.
- Add settings for max fingerprint cache size.
- Consider SQLite only if JSON-per-file cache becomes cumbersome.

## 9. Progress And Cancellation

This scanner may be CPU-heavy and long-running. It should follow existing job conventions.

Main-process progress phases:

- `validating`: validate scan request, selected source rows, modes, Fast/Deep profile, and project-local OpenCV helper availability when visual modes are selected
- `walking`: discover target videos
- `metadata`: run `ffprobe` for candidate/source metadata
- `fingerprint-cache`: check cache keys and load cached fingerprints
- `fingerprinting`: run Python/OpenCV helper for uncached files
- `matching-filename`: preserve exact filename matching
- `matching-visual`: build near-duplicate groups
- `matching-contained-clips`: build offset/sequence groups
- `complete`, `error`, `canceled`

Progress should include:

- total files when known
- processed files
- current file
- cache hits/misses
- fingerprinted count
- candidate groups found
- current phase message
- warnings/errors per file where possible

Cancellation:

- Use `AbortController` in `JobRegistry`.
- Pass `AbortSignal` to file discovery, ffprobe, ffmpeg, and child-process helpers.
- Kill Python helper processes on abort through the existing `runChildProcess` pattern or a Python-specific wrapper.
- Do not leave partial cache files behind after cancellation.
- Return canceled progress snapshots and keep the UI responsive.

Long-running job safety:

- Only one improved duplicate scan should run at a time.
- It should be considered a blocking workflow by `useWorkflowBusyState`.
- The Escape/app-menu cancel priority should cancel an active improved scan before closing dialogs.
- The app should never start this scanner automatically on launch/project restore.

## 10. Review UI Plan

The existing Duplicate Review workspace is the right foundation. Extend it rather than mixing candidate groups into `VideoResultsTable`.

### Workspace Structure

Use a dedicated Duplicate Review workspace with PrimeReact `DataTable` patterns:

- top summary band
- Fast/Deep profile and scan summary metadata
- mode filters, not separate tabs
- candidate group table
- row expansion for evidence and files
- sticky footer for marked/review actions

Recommended grouping columns:

- confidence
- match type
- source/candidate count
- source filename
- candidate filename or group label
- matched segment summary
- evidence summary
- status/review state

Mode filters:

- Exact Filename
- Visual Match
- Contained Clip
- Shared Segment

### Evidence Display

For visual/contained results, show:

- confidence as a tag/severity
- matched frame count
- sequential match count
- average hash distance
- offset seconds for contained clips
- matched segment timestamps
- algorithm/profile used
- warnings such as "mostly static frames ignored"

Timestamps should be review-friendly:

```txt
Long Video A: 12:00 - 12:35
Short Video B: 00:00 - 00:35
Offset: +12:00
```

### Preview/Scrub Support

Use existing preview infrastructure where possible:

- `VideoDetailsDialog` already shows preview frames and preview clips for one video.
- `mediaPreviewService` can generate preview frames/clips and cache them.
- A first improved review UI can provide "Open Details" or "Generate Preview Clips" per file.
- A later enhancement can add a side-by-side segment review dialog with two preview clips aligned by offset.

Do not make preview generation required for scan completion. Fingerprint matching should be separate from human preview generation.

### Manual Actions

Candidate actions should remain explicit:

- Mark for Trash
- Archive
- Remove from Table
- Ignore
- Reveal in Finder
- Open Details

Recommended MVP action policy:

- Keep existing Move to Trash integration first.
- Add Archive only after candidate review can build candidate-scoped archive plans safely.
- Keep Ignore transient in the first implementation.
- Never preselect destructive actions based on confidence.

Copy should say "candidate", "likely match", "contained clip", and "Move to Trash". Avoid "delete duplicate" and avoid implying certainty.

## 11. Safety And File Operations

The scanner identifies candidates. It does not perform cleanup.

Safety rules:

- Source/project rows stay protected unless the user explicitly chooses a normal selected-row workflow outside duplicate review.
- Candidate rows are unmarked by default.
- Any file operation must go through existing plan/confirm/execute flows.
- Candidate ids must be resolved against the stored scan result in the main process before creating a file-operation plan.
- File-operation plans must revalidate expected filename, size, modified time, kind, and supported video extension.
- Trash means macOS Trash through `shell.trashItem`, not permanent deletion.
- Archive means existing archive plan semantics, not ad hoc moves.
- Remove from Table means row visibility/project state, not filesystem mutation.
- Partial failures should remain visible in the review result.
- Operation history should record executed file operations through existing services.

For contained clips, be especially careful with copy:

- A contained clip candidate is not necessarily redundant.
- It may be an intentional edited excerpt.
- The UI should present evidence and let the user decide.

## 12. Staged Implementation Plan

### Stage 0 — Codebase Mapping And Current Duplicate Scanner Preservation

Goal:

Document and preserve the current exact filename scanner flow before any visual work.

Files/modules likely affected:

- `docs/improved-dupe-detection-plan.md`
- `docs/dupe-scan-verification.md` if a future implementation stage updates verification docs
- no production code in this stage unless a later prompt explicitly asks for a small documentation-only anchor

Implementation notes:

- Treat `src/shared/types/duplicateScan.ts`, `duplicateScanService.ts`, `duplicateScanIpc.ts`, `useDuplicateScanWorkflow.ts`, and `DuplicateReviewWorkspace.tsx` as the baseline.
- Confirm current exact filename semantics remain a first-class mode.
- Identify extension points for additional modes without replacing current behavior.

Acceptance criteria:

- The current exact filename flow is documented as behavior to preserve.
- Future stages have clear extension points.
- No duplicate detection behavior changes.

Risks:

- Accidentally reframing v1 exact filename matching as obsolete.
- Planning a replacement instead of an additive mode structure.

Suggested verification steps:

- Review `docs/dupe-scan-verification.md`.
- Review current exact filename types and matching code.
- No runtime verification required for this docs-only stage.

### Stage 1 — Types, Boundaries, And Plan-Only Scaffolding

Goal:

Add shared type contracts and boundary placeholders for improved duplicate modes without changing app behavior.

Files/modules likely affected:

- `src/shared/types/duplicateScan.ts`
- `src/shared/constants/ipcChannels.ts` only if adding future channels in a disabled/no-op way is explicitly approved
- `docs/dupe-scan-verification.md` or a new verification doc if needed

Implementation notes:

- Add `DuplicateScanMode`, selected-row source-scope, Fast/Deep profile, algorithm types, fingerprint cache types, improved progress/result types.
- Keep current `DuplicateScanResult` compatible.
- Do not add new renderer UI yet.
- Do not call Python/OpenCV yet.
- Do not alter current exact filename matching.

Acceptance criteria:

- Types compile.
- Existing duplicate scan behavior and UI are unchanged.
- The new contract clearly distinguishes scan mode from match type.
- The new contract reflects selected result rows as the only first-pass improved scan source scope.
- The new contract reflects Fast and Deep as the first-pass visual profiles.
- Renderer still has no Node/OpenCV access.

Risks:

- Type churn that forces unrelated UI refactors too early.
- Naming conflict with existing `DuplicateMatchType = 'exact_filename'`.

Suggested verification steps:

- `npm run typecheck`
- `git diff --check`
- Static review that current v1 constants remain intact.

### Stage 2 — Fingerprint Prototype Behind Main-Process Boundary

Goal:

Generate a visual fingerprint for one file or selected files through a main-process-owned helper path.

Files/modules likely affected:

- `scripts/opencv/fingerprint_video.py`
- `src/main/services/opencvFingerprintService.ts` or `duplicateFingerprintService.ts`
- `src/main/utils/childProcess.ts` only if a Python-specific wrapper is needed
- `src/main/services/toolDiagnosticsService.ts` if OpenCV diagnostics are added
- `src/shared/types/duplicateScan.ts`

Implementation notes:

- Extend the Python helper from metadata-only to JSON fingerprint output.
- Keep Python input/output explicit and schema-validated.
- Start with `dhash-v1` and frame quality metrics.
- Require the project-local Python `.venv` for visual fingerprint generation in the first implementation.
- Do not add a TypeScript/ffmpeg-only visual fallback path for machines without OpenCV ready.
- Run only from the main process.
- Support cancellation.
- Return warnings for decode/sample failures.
- Do not do duplicate grouping yet.

Acceptance criteria:

- Main process can request a fingerprint for a known file.
- Helper returns JSON with timestamps, hashes, dimensions, duration, and warnings.
- Failed helper execution returns a typed error.
- Missing `.venv`/OpenCV setup blocks visual fingerprinting with a clear diagnostic error while exact filename scan mode remains available.
- Renderer does not execute Python or access helper paths.
- Current duplicate scan behavior remains unchanged.

Risks:

- OpenCV decode support differs from ffmpeg.
- Python venv may not exist or may not include dependencies.
- Large stdout payloads may need size awareness.

Suggested verification steps:

- `npm run opencv:verify`
- `npm run opencv:metadata -- "/path/to/sample.mp4" 5`
- `npm run typecheck`
- Manual helper JSON review with one short sample video.

### Stage 3 — Cached Fingerprint Generation

Goal:

Add a durable main-process fingerprint cache with invalidation and progress.

Files/modules likely affected:

- `src/main/services/appPaths.ts`
- `src/main/services/duplicateFingerprintCacheService.ts`
- `src/main/services/duplicateFingerprintService.ts`
- `src/shared/types/duplicateScan.ts`
- future IPC/service methods if a scan endpoint starts fingerprint jobs

Implementation notes:

- Add `getDuplicateFingerprintCacheDir()`.
- Cache per-file JSON under userData.
- Key by path, size, modified time, duration, algorithm, algorithm version, sample interval, and Fast/Deep profile.
- Validate cache entries before use.
- Write atomically.
- Track cache hit/miss/stale/error counts.
- Do not store fingerprints in renderer IndexedDB.

Acceptance criteria:

- Re-running fingerprint generation for an unchanged file uses cache.
- Changing file size or modified time invalidates the cache.
- Missing/stale cache entries recompute.
- Partial cache write cleanup is safe on cancellation/error.

Risks:

- Cache files can grow large on big libraries.
- Cache key decisions may be too strict or too loose.
- JSON schema drift without versioning can create stale reads.

Suggested verification steps:

- Generate a fingerprint twice and confirm second run is a cache hit.
- Touch or replace the file and confirm recompute.
- Cancel during fingerprinting and confirm no broken final cache file.
- `npm run typecheck`
- `git diff --check`

### Stage 4 — Visual Candidate Matching

Goal:

Use cached visual fingerprints to identify likely near-duplicate videos with different filenames.

Files/modules likely affected:

- `src/main/services/duplicateScanService.ts` or new `improvedDuplicateScanService.ts`
- `src/main/services/duplicateVisualMatcher.ts`
- `src/shared/types/duplicateScan.ts`
- `src/main/ipc/duplicateScanIpc.ts`
- `src/renderer/hooks/useDuplicateScanWorkflow.ts` only if exposing the mode to existing workflow

Implementation notes:

- Preserve exact filename mode as a separate first pass.
- Keep improved visual scans scoped to selected project/result rows as sources.
- Build hash index from usable fingerprint samples.
- Generate candidate pairs from shared/near hashes.
- Score visual near-duplicates with match ratio, sequence order, average distance, and duration similarity.
- Deduplicate groups that are already exact filename matches, or merge evidence into one group with multiple modes.
- Put all candidates through review; do not mark anything automatically.

Acceptance criteria:

- Different filenames with visually similar content can produce candidate groups.
- Exact filename groups still appear as before.
- Fast and Deep profiles are both available for visual matching.
- Candidate groups include evidence and confidence.
- Low-information frame matches alone do not create high-confidence groups.
- Scan can be canceled during fingerprinting or matching.

Risks:

- False positives from intros, title cards, black frames, or static scenes.
- Hash thresholds may be too aggressive without real fixtures.
- Pair generation can become expensive if common hashes are not downweighted.

Suggested verification steps:

- Run with a small fixture folder containing:
  - same content different filename
  - same filename different content
  - unrelated videos with title cards
  - black/static clips
- Confirm exact filename behavior is unchanged.
- Confirm progress phases and cancellation.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

### Stage 5 — Contained-Clip Matching

Goal:

Detect shorter videos that appear as offset segments inside longer videos.

Files/modules likely affected:

- `src/main/services/duplicateContainedClipMatcher.ts`
- `src/main/services/duplicateVisualMatcher.ts` if shared matching helpers are extracted
- `src/main/services/duplicateScanService.ts` or improved scan orchestrator
- `src/shared/types/duplicateScan.ts`
- renderer evidence display in a later stage

Implementation notes:

- Use duration prefilter to identify short/long pairs.
- Match samples by hash distance.
- Compute offset buckets from `longTime - shortTime`.
- Require sequential runs at a consistent offset.
- Use Deep profile as the recommended first-pass option for contained-clip scans where offset sensitivity matters more than speed.
- Store matched start/end timestamps for both files.
- Show lower confidence for short matches with sparse evidence.
- Reject single-frame or scattered matches.

Acceptance criteria:

- A clip starting at an offset inside a longer video is flagged.
- A single shared intro/title card is not enough.
- Evidence includes offset, matched ranges, sequential match count, coverage, and average distance.
- Same-duration near duplicates continue to be handled by visual mode.

Risks:

- Sample interval too coarse can miss short clips.
- Repeated scenes can create false offset buckets.
- Long videos can create many candidate pairs without strong prefilters.

Suggested verification steps:

- Create or use a fixture where a short clip is cut from a longer video at a non-zero offset.
- Verify detected offset is close to expected.
- Verify a clip shorter than the sample interval is either not supported or clearly reported as low-confidence/unsupported.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

### Stage 6 — Review UI

Goal:

Extend Duplicate Review to show exact filename, visual near-duplicate, and contained-clip candidates with evidence.

Files/modules likely affected:

- `src/renderer/components/DuplicateReviewWorkspace.tsx`
- `src/renderer/components/DuplicateScanDialog.tsx`
- optional new `DuplicateEvidencePanel.tsx`
- optional new `DuplicateSegmentReviewDialog.tsx`
- `src/renderer/hooks/useDuplicateScanWorkflow.ts`
- `src/renderer/App.tsx`
- `src/renderer/styles/app.css`

Implementation notes:

- Add scan mode selection and Fast/Deep profile selection in setup dialog.
- Start improved scans from selected project/result rows only.
- Add confidence/mode filters in one unified review workspace; do not split exact filename, visual, and contained-clip groups into separate tabs.
- Add evidence panel in row expansion.
- Show matched segment timestamps for contained clips.
- Use existing preview/detail actions before building a full side-by-side player.
- Keep exact filename review understandable and unchanged for existing users.
- Avoid making the main `VideoResultsTable` carry duplicate-specific state.

Acceptance criteria:

- User can tell why each group was flagged.
- Exact filename, visual, and contained candidates are distinguishable.
- Contained-clip evidence includes offset and matched ranges.
- Candidate marks remain stable across filtering/pagination/expansion.
- Ignore state remains transient and can be reset by leaving/resetting review.
- No automatic destructive action is introduced.

Risks:

- Evidence UI can get too dense.
- Multiple mode filters may confuse the current simple workflow.
- Reusing single-video details may be insufficient for contained clip review.

Suggested verification steps:

- Manual UI review at desktop and narrower widths.
- Confirm long paths/timestamps fit.
- Confirm mark state survives filters/pagination.
- Confirm no candidate starts pre-marked.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

### Stage 7 — Safe Actions Integration

Goal:

Connect improved candidate groups to existing non-destructive review/action flows.

Files/modules likely affected:

- `src/main/ipc/duplicateScanIpc.ts`
- `src/main/services/duplicateScanService.ts`
- `src/renderer/hooks/useDuplicateScanWorkflow.ts`
- `src/renderer/components/DuplicateTrashConfirmDialog.tsx`
- `src/renderer/components/DuplicateTrashResultDialog.tsx`
- optional archive/remove/ignore UI components

Implementation notes:

- Keep current Trash plan endpoint candidate-id based.
- Extend candidate validation for new candidate group ids.
- Reuse `createTrashPlan` and `executeTrashPlan`.
- Add Archive only by delegating to `createArchivePlan` and existing archive execution.
- Remove from Table should only apply to rows that exist in the current results store.
- Ignore should remain transient in the first implementation.
- Operation history should remain the record of executed file operations.

Acceptance criteria:

- Source/project files remain protected by default.
- Candidate Trash still uses macOS Trash and immediate revalidation.
- Archive, if added, uses existing archive semantics.
- Remove from Table does not mutate files.
- Ignore does not persist to project JSON, IndexedDB, or fingerprint cache.
- Partial success/failure is displayed clearly.

Risks:

- Candidate groups may include files that are not current audit rows.
- Archive semantics for external candidate files need clear known-root handling.
- Persisted ignore decisions can become stale, so they should remain out of scope for the first implementation.

Suggested verification steps:

- Use a disposable fixture folder.
- Verify Trash execution, skipped changed candidates, and source protection.
- Verify operation history records executed actions.
- Verify current selected-row Trash/Archive workflows still behave normally.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

### Stage 8 — Tuning, Diagnostics, And Hardening

Goal:

Make the scanner practical on larger local libraries and easier to troubleshoot.

Files/modules likely affected:

- `src/main/services/toolDiagnosticsService.ts`
- `src/renderer/components/DiagnosticsDialog.tsx`
- `src/renderer/components/SettingsPanel.tsx`
- `src/main/services/settingsService.ts`
- `src/shared/types/settings.ts`
- duplicate fingerprint/matcher services
- docs verification files

Implementation notes:

- Add OpenCV/Python diagnostics.
- Add cache stats and optional cache clear.
- Add Fast/Deep scan profiles rather than many advanced knobs.
- Record per-scan warnings: helper unavailable, decode failures, low sample counts, cache errors.
- Add result caps and performance safeguards.
- Tune thresholds with real-world fixtures.
- Document known limitations honestly.

Acceptance criteria:

- User can see when OpenCV is unavailable; visual modes are blocked until the project-local `.venv` is ready, while exact filename mode remains available.
- User can clear fingerprint cache if needed.
- Large scans show useful progress and do not freeze UI.
- Low-confidence/unsupported cases are reported as warnings, not crashes.
- Threshold constants are centralized.

Risks:

- Settings surface can become too technical.
- Diagnostics can drift from actual helper behavior.
- Cache pruning can accidentally remove useful data if too aggressive.

Suggested verification steps:

- Run diagnostics with OpenCV available and unavailable.
- Run scans on increasing folder sizes.
- Confirm cancellation remains responsive.
- Confirm cache clear only clears fingerprint cache, not audit rows or media previews.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

## 13. Intelligence Level Recommendations

# Suggested Intelligence Levels

Stage 0 — Codebase Mapping and Current Duplicate Scanner Preservation (**High**)
Stage 1 — Types, Boundaries, and Plan-Only Scaffolding (**Medium**)
Stage 2 — Fingerprint Prototype Behind Main-Process Boundary (**High**)
Stage 3 — Cached Fingerprint Generation (**High**)
Stage 4 — Visual Candidate Matching (**Extra High**)
Stage 5 — Contained-Clip Matching (**Extra High**)
Stage 6 — Review UI (**High**)
Stage 7 — Safe Actions Integration (**High**)
Stage 8 — Tuning, Diagnostics, and Hardening (**Extra High**)

## 14. Open Questions / Decisions Needed

- Exact Fast and Deep sample intervals and max samples per video after testing against real libraries.
- Whether to keep `dhash-v1` for the MVP after prototype evidence, or switch to `phash-v1` if it is similarly cheap and materially better.
- Whether OpenCV reads video directly first, or consumes ffmpeg-extracted frames for decode consistency.
- Exact helper invocation shape: CLI args versus JSON stdin.
- Fingerprint cache retention and pruning policy.
- Confidence thresholds for "likely duplicate" and "likely contained clip".
- Whether low-confidence candidates should be hidden by default or shown with a warning.
- Whether Archive should be part of the first safe-actions pass or deferred after Trash review is stable.
- Whether side-by-side segment preview is required before contained-clip actions are enabled.
- How to handle files OpenCV cannot decode but ffmpeg can decode.
- Whether OpenCV diagnostics should live in existing Diagnostics or only in Duplicate Scan setup.
- Whether the feature should expose advanced tuning settings or keep thresholds internal until real-world calibration.
