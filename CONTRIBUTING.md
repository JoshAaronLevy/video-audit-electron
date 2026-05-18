# Contributing

This is a private macOS Electron app for personal use. The project is intentionally optimized for maintainability, clear staged development, and safe local filesystem/media operations over public-distribution polish.

The legacy reference app lives in a sibling workspace folder named `video-audit`.

The new Electron app lives in this repo, `collie-video`.

## Project Goals

Build a standalone Electron version of the existing `video-audit` app.

The app should eventually support:

- Auditing local video folders/files
- Detecting low-resolution videos
- Detecting wrong-aspect-ratio videos
- Detecting black borders
- Generating thumbnails
- Auto-fixing/cropping videos through ffmpeg
- Handing selected videos to the Premiere Pro bridge
- Persisting local settings and recent audit state
- Providing a polished private macOS utility experience

## Repository Boundaries

This repo may use the sibling `video-audit` repo as a reference only.

Rules:

- Do not modify the sibling `video-audit` repo.
- Do not import from the sibling `video-audit` repo.
- Do not create cross-repo dependencies.
- This repo must remain standalone.
- Logic may be copied/adapted from the legacy app when useful, but it must be cleaned up and owned by this repo.

## Architecture Principles

Use the Electron architecture intentionally:

- Electron main process owns filesystem access, local app settings, child processes, ffprobe/ffmpeg execution, job orchestration, and OS integrations.
- Electron preload exposes a small, typed API through `contextBridge`.
- Renderer owns UI only.
- Shared types/constants live under `src/shared`.
- Renderer code must not directly import or use Node APIs such as `fs`, `path`, `child_process`, or Electron main-process APIs.
- Keep `contextIsolation` enabled.
- Keep `nodeIntegration` disabled.
- Do not use Express, HTTP, or SSE as the target app architecture unless a specific stage explicitly calls for it.

## Code Style

Prefer boring, readable TypeScript.

Guidelines:

- Use clear names over clever names.
- Avoid premature abstraction.
- Prefer small focused services over giant files.
- Keep IPC channels centralized and typed.
- Keep main/preload/renderer boundaries obvious.
- Avoid “magic” behavior hidden in UI components.
- Prefer explicit error objects/messages over vague thrown strings.
- Long-running jobs must support progress reporting and cancellation where practical.
- Never overwrite original video files unless a future task explicitly implements a user-confirmed overwrite workflow.

## Testing Policy

Do not add tests, test frameworks, test files, or test setup unless explicitly requested.

This project is currently being built stage-by-stage, and early velocity matters more than test infrastructure.

Manual verification steps should be documented in implementation summaries when useful.

## Changelog Policy

Every task that changes code, configuration, or documentation must update `CHANGELOG.md`.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/) and uses semantic versioning.

### Changelog Format

Keep `CHANGELOG.md` organized with versioned sections.

Use this format:

```md
## [x.y.z] - YYYY-MM-DD
```

Group entries under standard Keep a Changelog categories where applicable:

```md
### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security
```

Only include categories that are actually used for that version.

### Entry Style

Changelog entries should be concise and useful to a future maintainer.

Good:

```md
### Added

- Added native Electron folder selection through the preload API.
- Added persistent app settings stored under Electron's user data directory.
```

Too noisy:

```md
### Added

- Added a `chooseFolders` function in `dialogIpc.ts` that calls `dialog.showOpenDialog` with `properties: ['openDirectory', 'multiSelections']`.
```

Implementation details are fine when they are important, but the changelog should primarily describe meaningful changes.

## Semantic Versioning Policy

Use semantic versioning:

```txt
MAJOR.MINOR.PATCH
```

### MAJOR

Increment `MAJOR` for breaking changes after behavior has been established.

Examples:

* Replacing a persisted settings format in a non-compatible way
* Removing an implemented workflow
* Changing the expected structure of saved audit data without migration

Because this is a private early-stage app, major bumps should be rare.

### MINOR

Increment `MINOR` for meaningful new functionality.

Examples:

* Adding the Electron scaffold
* Adding native folder/file selection
* Adding core audit support
* Adding ffprobe metadata extraction
* Adding black-border analysis
* Adding auto-fix
* Adding Premiere bridge support
* Adding thumbnail generation
* Adding migration workflow

Most completed conversion-plan stages should usually be a `MINOR` bump.

### PATCH

Increment `PATCH` for bug fixes, small refinements, documentation-only changes, cleanup, or implementation details that do not add a major new capability.

Examples:

* Fixing a cancellation bug
* Improving an error message
* Cleaning up unused code
* Updating documentation
* Adjusting UI copy
* Fixing package/config issues
* Small polish inside an already-implemented stage

## Version Synchronization

If `package.json` exists, its `version` field must match the latest version in `CHANGELOG.md`.

Example:

If the latest changelog entry is:

```md
## [0.3.0] - 2026-05-16
```

Then `package.json` must contain:

```json
{
  "version": "0.3.0"
}
```

If `package-lock.json` exists, do not manually edit version fields inside it unless necessary. Prefer using npm commands so the lockfile remains consistent.

Useful commands:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

Do not create git tags unless explicitly asked.

## Suggested Versioning During Conversion

For the initial Electron conversion, use practical pre-1.0 versioning.

Suggested mapping:

```txt
0.1.0  Electron/Vite/React scaffold
0.2.0  Native folder/file selection
0.3.0  Shared types/constants
0.4.0  Settings and local persistence
0.5.0  File discovery
0.6.0  ffprobe service
0.7.0  Core audit engine
0.8.0  Renderer UI migration
0.9.0  Black-border analysis
0.10.0 Auto-fix
0.11.0 Auto-crop
0.12.0 Thumbnail generation
0.13.0 Premiere bridge
0.14.0 Migration workflow
0.15.0 macOS utility polish
0.16.0 local build script
```

This mapping is a guide, not a hard rule. If a stage is split across multiple commits, use patch releases for follow-up refinements.

## Commit Policy

After completing a task that changes files:

1. Review changed files.
2. Update `CHANGELOG.md`.
3. Update `package.json` version if `package.json` exists.
4. Update `package-lock.json` if needed.
5. Stage all changes in this repo.
6. Commit with a clear contextual message.

Do not commit changes outside this repo.

Do not amend, rebase, force-push, tag releases, or push to remote unless explicitly asked.

If a task fails partway through, do not commit unless the completed changes are coherent, working, versioned, and documented.

If there are no file changes, do not update the changelog, bump the version, stage files, or commit.

## Commit Message Style

Use a short imperative subject line.

Good examples:

```txt
Scaffold Electron app
Add native folder selection
Define shared audit types
Persist app settings
Implement file discovery service
Add ffprobe metadata extraction
Migrate core audit engine
Add black-border analysis
Implement auto-fix service
Implement auto-crop service
Add Premiere bridge service
Add thumbnail generation
Add migration workflow
Polish macOS utility shell
Add local macOS build
Clean up migration scaffolding
```

Avoid vague messages:

```txt
Update files
Fix stuff
Changes
Stage work
Codex changes
```

## Branching

For now, work directly on the main development branch unless explicitly asked to create a feature branch.

This is a private personal app, so lightweight workflow is preferred.

If branches are introduced later, use names like:

```txt
stage-01-scaffold
stage-02-native-selection
stage-07-core-audit
```

## Implementation Workflow

Each conversion-plan task should follow this pattern:

1. Read `.codex-instructions.md`.
2. Read `CONTRIBUTING.md`.
3. Read the relevant stage in `electron-conversion-plan.md`.
4. Inspect the legacy `video-audit` repo only as needed.
5. Implement changes only in `collie-video`.
6. Keep the new app standalone.
7. Run reasonable verification commands if available.
8. Update `CHANGELOG.md`.
9. Update `package.json` version if applicable.
10. Stage and commit changes.

## Safety Rules for Video/File Operations

Video processing code must be conservative.

Rules:

* Never overwrite source videos by default.
* Prefer writing outputs to an explicit output directory.
* Validate that source files exist before processing.
* Validate that output directories are writable.
* Handle unreadable files as per-file errors where possible.
* Cancellation should stop queued work and attempt to terminate active child processes.
* Failed ffmpeg/ffprobe operations should not crash the whole app when they can be reported per-file.
* Destructive operations must require explicit confirmation.
* Migration workflows must present a clear plan before execution.

## Electron Security Rules

Electron security defaults matter even for a private app.

Rules:

* Keep `contextIsolation: true`.
* Keep `nodeIntegration: false`.
* Use a preload bridge.
* Expose a small typed API.
* Do not expose raw `ipcRenderer`.
* Do not expose arbitrary file read/write methods to the renderer.
* Validate inputs in the main process.
* Treat renderer requests as untrusted even though this is a private app.

## Dependency Policy

Keep dependencies minimal.

Acceptable dependency additions:

* Electron/Vite tooling required for the app
* PrimeReact/PrimeFlex UI dependencies
* Small well-maintained utilities when they meaningfully reduce complexity
* Electron build tooling when build stages require it

Avoid adding:

* Large frameworks that duplicate existing responsibilities
* ORMs before persistence needs justify them
* Runtime validation libraries unless they clearly improve safety
* State-management libraries unless React state/hooks become clearly insufficient
* Test frameworks unless explicitly requested

## Documentation Policy

Keep documentation practical.

Update README when:

* setup steps change
* commands change
* app capabilities change materially
* build steps are added
* ffmpeg/ffprobe requirements change

Update `electron-conversion-plan.md` only when the plan itself changes.

Update `CHANGELOG.md` for every task that changes files.

## Definition of Done

A task is done when:

* The requested stage or change is implemented.
* The app still has a coherent architecture.
* The implementation does not depend on the sibling legacy repo.
* Main/preload/renderer boundaries are preserved.
* Relevant docs are updated.
* `CHANGELOG.md` is updated.
* `package.json` version matches the latest changelog version, if present.
* Changes are staged and committed with a contextual commit message.
