# Refactor Verification Checklist

Use this checklist after the renderer refactor to manually verify that the app still behaves correctly. This is a manual checklist, not an automated test suite.

## Setup

- [ ] Launch the app.
- [ ] Verify the app opens without renderer errors.
- [ ] Restore a saved audit from IndexedDB.
- [ ] Confirm restored sources, filters, thumbnails setting, saved timestamp, and visible rows look correct.

## Source Selection

- [ ] Choose a folder through the folder tree selector.
- [ ] Scan the selected root in the folder tree selector.
- [ ] Select a folder and confirm it as the audit source.
- [ ] Choose multiple folders.
- [ ] Confirm parent/child selections dedupe correctly in the source summary.
- [ ] Choose files.
- [ ] Choose an output folder.
- [ ] Clear selected sources and confirm the source summary resets.

## Audit Flow

- [ ] Run audit.
- [ ] Confirm audit progress updates while running.
- [ ] Cancel audit.
- [ ] Run audit again after cancellation.
- [ ] Refresh audit.
- [ ] Confirm refresh replays the saved request instead of requiring new source selection.
- [ ] Clear audit data/cache.
- [ ] Confirm saved rows, selected sources, filters, workflow dialogs, and preview cache state reset.

## Results Table

- [ ] Search rows.
- [ ] Filter rows by result view.
- [ ] Use column filters.
- [ ] Select rows.
- [ ] Remove selected rows from the table.
- [ ] Restore removed rows.
- [ ] Open row details.
- [ ] Reveal a known file from a row action or details view.

## Media Preview

- [ ] Generate thumbnails for all rows.
- [ ] Generate thumbnails for selected rows.
- [ ] Cancel thumbnail generation.
- [ ] Generate fresh thumbnails for one video.
- [ ] Generate preview clip.
- [ ] Cancel preview clip generation.
- [ ] Confirm thumbnail and preview clip metadata persists after refresh/reload when expected.

## Discovery and Metadata

- [ ] Run discovery.
- [ ] Cancel discovery.
- [ ] Run ffprobe metadata extraction.
- [ ] Cancel ffprobe metadata extraction.
- [ ] Reveal a discovered path.

## Auto-Fix and Auto-Crop

- [ ] Run Auto-Fix.
- [ ] Cancel Auto-Fix.
- [ ] Confirm successful Auto-Fix rows are hidden from the table.
- [ ] Run Auto-Crop.
- [ ] Cancel Auto-Crop.
- [ ] Confirm Auto-Crop handles ineligible selected rows correctly.
- [ ] Trigger post-conversion choices dialog from Auto-Fix or Auto-Crop output.

## Post-Conversion Replacement

- [ ] Review replacement plan manually.
- [ ] Change an individual replacement action.
- [ ] Bulk update replacement actions.
- [ ] Execute replacement.
- [ ] Cancel replacement.
- [ ] Confirm replacement result dialog shows completed, skipped, failed, or canceled items accurately.
- [ ] Confirm replaced originals are hidden from the table when appropriate.

## File Operations

- [ ] Move selected to Trash.
- [ ] Move selected to folder.
- [ ] Archive selected originals.
- [ ] Confirm operation result dialogs show successes, skips, failures, and reveal actions.
- [ ] Confirm completed file operations hide affected rows when appropriate.

## Operation History

- [ ] Open operation history.
- [ ] Refresh operation history.
- [ ] Select operation history record.
- [ ] Reveal path from history dialog.
- [ ] Reveal path from result dialogs.

## Migration

- [ ] Open migration dialog.
- [ ] Choose or enter a new-edits folder.
- [ ] Run migration scan.
- [ ] Execute migration.
- [ ] Confirm migration result dialog summarizes actions and errors.

## Premiere Bridge

- [ ] Refresh Premiere status.
- [ ] Open Premiere bridge apps.
- [ ] Edit selected in Premiere.
- [ ] Confirm queued Premiere imports hide selected rows when appropriate.
- [ ] Confirm bridge errors display without blocking unrelated workflows.

## Settings and Diagnostics

- [ ] Open settings.
- [ ] Change settings.
- [ ] Confirm changed settings persist after closing and reopening settings.
- [ ] Reset settings.
- [ ] Run diagnostics.
- [ ] Confirm ffmpeg/ffprobe diagnostic status renders correctly.

## App Commands and Keyboard

- [ ] Use Escape key to close active dialogs.
- [ ] Use Escape key to cancel active audit/discovery/ffprobe/media/Auto-Fix/Auto-Crop/replacement work.
- [ ] Use menu command for choose folder.
- [ ] Use menu command for choose files.
- [ ] Use menu command for settings.
- [ ] Use menu command for refresh.
- [ ] Use menu command for cancel.

## Build Verification

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
