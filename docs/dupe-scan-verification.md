# Duplicate Scan Verification

This document records the implemented v1 Duplicate Scan workflow and the Stage
10 verification surface for future manual checks.

## Implemented V1 Behavior

- Duplicate Scan starts from selected rows in the existing results table.
- The renderer calls typed preload APIs through `src/renderer/api/duplicateScanClient.ts`
  and `src/renderer/api/dialogClient.ts`; it does not access Node or Electron
  APIs directly.
- The Electron main process owns recursive discovery, exact filename matching,
  ffprobe metadata reads, candidate validation, and Trash planning.
- Candidate matching uses exact basename including extension.
- On macOS, matching is case-insensitive while preserving displayed filename casing.
- Duration, file size, resolution, bitrate, codec, and modified date are
  display-only comparison metadata; they are not matching criteria.
- Same-path source files are excluded from candidates.
- Selected project source files are protected and are not markable from Duplicate Review.
- Duplicate candidates are unmarked by default and can be marked individually.
- Final confirmation is grouped by protected source and marked duplicate candidates.
- Marked candidates move to macOS Trash through the existing file-operation
  service after immediate revalidation.
- Duplicate scan result and mark state are transient and are not saved in project
  snapshots or persisted audit results.

## Key Files

- `src/shared/types/duplicateScan.ts`
- `src/main/services/duplicateScanService.ts`
- `src/main/ipc/duplicateScanIpc.ts`
- `src/preload/videoAuditApi.ts`
- `src/renderer/api/duplicateScanClient.ts`
- `src/renderer/hooks/useDuplicateScanWorkflow.ts`
- `src/renderer/components/DuplicateScanDialog.tsx`
- `src/renderer/components/DuplicateReviewWorkspace.tsx`
- `src/renderer/components/DuplicateTrashConfirmDialog.tsx`
- `src/renderer/components/DuplicateTrashResultDialog.tsx`

## Automated Checks

Last run for Stage 10 on 2026-05-20:

```bash
npm run typecheck
npm run build
git diff --check
```

There is no `npm run lint` script currently. Do not add one for Duplicate Scan
verification unless requested.

## Manual Verification Checklist

Use a disposable test folder for Trash checks. Restore any files from macOS
Trash after verification if needed.

- [ ] run duplicate scan with no selected rows blocked
- [ ] run duplicate scan after selecting one row
- [ ] run duplicate scan after selecting multiple rows
- [ ] choose/cancel scan folder picker
- [ ] scan folder with no exact filename matches
- [ ] scan folder with one exact filename match
- [ ] scan folder with multiple exact filename matches for one source
- [ ] scan folder where same candidate filename differs only by case
- [ ] verify `foo.mp4` does not match `foo.mov`
- [ ] verify `foo copy.mp4` does not match `foo.mp4`
- [ ] verify same-path source file is excluded from candidates
- [ ] expand/collapse duplicate groups
- [ ] mark/unmark candidates
- [ ] clear marks
- [ ] review final confirmation grouped by source
- [ ] trigger typed confirmation for high-count or high-size marked candidates
- [ ] move marked candidates to Trash
- [ ] verify moved/skipped/failed result state
- [ ] verify source files remain in place
- [ ] verify changed/missing candidate is skipped/failed after scan but before Trash
- [ ] cancel active duplicate scan
- [ ] clear cache/data and verify duplicate review state clears
- [ ] restore a project and verify stale duplicate review state does not carry over
- [ ] run existing Move to Trash from the main selected-row workflow to confirm no regression

## Static Review Notes

- `SelectionActionBar` receives `canStartDuplicateScan` from the controller, and
  `useDuplicateScanWorkflow.openDuplicateScanDialog` blocks opening when no
  source videos are selected.
- The dedicated folder picker uses Electron's `openDirectory` dialog with title
  `Choose folder for Duplicate Scan`.
- `duplicateScanService.getDuplicateFilenameKey` owns case-insensitive macOS
  exact filename behavior.
- `duplicateScanService.buildDuplicateGroups` excludes candidates whose resolved
  path equals the protected source path.
- `duplicateScanIpc.createDuplicateScanTrashPlan` validates candidate ids against
  the stored scan result, rejects source ids/paths, dedupes candidate paths, and
  delegates to the existing Trash plan service.
- `useDuplicateScanWorkflow.resetDuplicateScanWorkflow` clears result, marks,
  dialogs, progress, Trash plan/result state, and scan folder.
- `useClearAuditDataWorkflow` and project/audit restore paths call the duplicate
  workflow reset before replacing result workspace state.

## Deferred Manual Evidence

This Stage 10 implementation pass documents the manual checklist and runs the
available automated checks. Live Electron verification with disposable media
fixtures is still the recommended final sign-off before relying on the workflow
for real cleanup.
