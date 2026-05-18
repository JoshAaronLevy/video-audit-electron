# File Management Safety Review

Date: 2026-05-18

## Scope

This review covers the file-management workflows added for post-conversion cleanup:

- reveal known files and folders in Finder
- move selected known videos to macOS Trash
- move selected known videos to a chosen folder
- archive selected originals into app-created archive folders
- plan and execute replacement of originals with converted outputs
- manual replacement review
- operation history
- file-management settings

## Safety Findings

### Permanent deletion

No file-management workflow permanently deletes user video files. Cleanup uses macOS Trash for destructive disposal. The reviewed code does not use `rm -rf`, recursive directory deletion, or directory removal for file-management operations.

### Directory deletion

File-management execution validates sources as files before moving, archiving, trashing, or replacing. Archive workflows create archive directories when needed, but no workflow deletes directories.

### Overwrite behavior

Move and archive plans default to blocking existing destination files. Rename-with-suffix is available only as an explicit conflict strategy. Replacement execution refuses to write over a final destination unless that path is the original path already accounted for by the plan. Converted outputs are copied into place with exclusive-create behavior.

### Main-process validation

All filesystem mutations remain in the Electron main process. Plans are dry-run artifacts created before execution, and execution revalidates files immediately before each item is processed. Validation rejects relative paths, missing paths, directory/file mismatches, symbolic links, unsupported video extensions where required, stale size metadata, and stale modified timestamps.

### Renderer boundary

The renderer uses typed preload methods for file-management workflows. Stage 13 removed the unused generic `shell.revealPath` preload API so reveal behavior now goes through known-file and known-folder APIs that validate expected path metadata in the main process.

### Operation logging

Trash, move, archive, and replacement execution create operation history records, append itemized results, and mark completed, partial, failed, or canceled states. The history dialog exposes recent records, item diagnostics, reveal actions, and a copyable summary.

### Partial failure behavior

Operations process item-by-item so one failed file does not stop unrelated eligible files from being attempted. Result dialogs and operation history separate succeeded, skipped, and failed counts and retain per-item errors. Replacement cancellation is honored between items.

### External drive behavior

Trash plans warn when a file appears to live under `/Volumes/`. Replacement confirmation also treats external original or output paths as high-risk and requires typed confirmation.

### Missing file behavior

Plan creation and execution both check for missing files. Missing sources or outputs block affected rows, and execution reports clear per-item failures if files disappear after planning.

### Destination conflict behavior

Move and archive planning detect existing destination files and block by default. Rename-with-suffix can be selected explicitly. Execution rechecks destination paths before moving or archiving and fails the item instead of overwriting if the destination appears after planning.

### Post-conversion behavior

Post-conversion cleanup is opt-in. The dialog can leave outputs where they are, open manual review, or execute replacement. Replacement requires user confirmation, and high-risk replacements require typing `REPLACE`.

### Manual review behavior

Manual review now exposes only currently executable choices: Replace Original, Keep Output, and Skip. Unsupported future actions are not offered as active choices. Existing stale plans with unsupported action values are counted as unsupported and skipped by execution.

## Stage 13 Cleanup Fixes

- Removed the unused generic reveal-path preload and IPC path in favor of typed file-operation reveal APIs.
- Tightened manual replacement review action labels so the UI only offers currently executable actions.
- Changed the replacement cleanup edge case where a final file has been safely copied but the converted output cannot be moved to Trash: the item now reports success with a warning, because the replacement outcome succeeded and the remaining output is recoverable.

## Residual Notes

- Archive-original replacement disposition is still a persisted preference for future archive-capable replacement execution. Current replacement execution supports moving originals to macOS Trash only.
- The archive folder pattern setting is persisted and safely normalized, while archive execution still uses the current `.collie-video-archive/YYYY-MM-DD` folder shape.
- Operation history is JSON-backed and capped to recent records. It is suitable for a private desktop workflow, not for multi-user audit trails.
