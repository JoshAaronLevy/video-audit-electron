# Project File Availability Stage Prompts

These prompts are for implementing `docs/project-file-availability-implementation-plan.md` one stage at a time.

Use the shared setup below for every stage prompt unless a stage says otherwise.

## Shared Context For Every Stage

We are implementing project file availability checks for Collie Video.

The goal is to check whether video files saved in an open named project still exist at their original paths. When saved project videos are missing, the user should be warned, allowed to dismiss the warning, or allowed to remove missing rows from the active project. Missing videos should remain visible after dismissal, but their table checkboxes must be unchecked and disabled so they cannot be selected for processing.

This feature must preserve the current architecture boundaries:

- Filesystem checks belong in the Electron main process.
- Renderer code must stay behind typed preload/API-client boundaries.
- Components and hooks should call renderer API clients, not `window.videoAudit.*` directly.
- Zustand should remain focused live renderer row/table state, not the durable project-file layer.
- Named project JSON remains internal app-managed data under Electron `userData`.
- Existing IndexedDB latest-audit cache should remain.
- Missing-file removal is non-destructive and must not modify source media files.
- Relinking moved/missing files is a future feature and must not be implemented in this plan.

Use:

- `.codex-instructions.md`
- `CONTRIBUTING.md`
- `docs/project-file-availability-implementation-plan.md`
- `docs/renderer-architecture.md`
- `docs/renderer-state-architecture.md`

## Shared Critical Requirements

- Only implement the stage mentioned in the prompt.
- Do not jump ahead into later stages unless the current stage cannot compile without a small supporting change.
- Preserve existing behavior.
- Do not redesign unrelated UI.
- Do not implement relinking, filesystem search, cloud sync, auth, import/export, file associations, or SQLite.
- Do not expose Node APIs to the renderer.
- Do not let renderer code access the filesystem directly.
- Do not persist `fileAvailability` into project JSON unless the plan is explicitly changed.
- Do not permanently delete project rows or media files.
- Do not modify, trash, move, archive, or delete source videos.
- Do not add tests unless explicitly requested.

## Shared Changelog, Versioning, And Commit

After implementation:

- Update `CHANGELOG.md`.
- Bump `package.json` version according to SemVer and the repo's existing release pattern.
- If `package-lock.json` exists and is affected by the version bump, update it too.
- Ensure `package.json` version matches the latest changelog entry.
- Run the relevant verification commands.
- Stage all changes.
- Commit with a clear contextual commit message.

## Shared Verification

At minimum, run:

```txt
npm run typecheck
npm run build
git diff --check
```

If any command fails, investigate and fix issues introduced by the stage. If a failure appears unrelated to the stage, document it clearly in the final summary with evidence.

## Shared Output

After making changes, summarize:

1. Files created/changed
2. Commands run
3. Behavior added or changed
4. Existing behavior preserved
5. Architecture boundaries preserved
6. Any assumptions made
7. Manual verification steps
8. Follow-up notes before the next stage

---

# Stage 1: Formalize Availability Semantics And Row Eligibility

## Context & Problem

We need one canonical definition for file availability and row processing eligibility before expanding the missing-file workflow.

The current app already has `SavedFileAvailability`, `VideoFileAvailability`, and `projectAvailability` helpers. This stage should formalize those semantics without changing durable project storage or adding UI.

## Task

Please implement Stage 1 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Define helper functions in `src/renderer/helpers/projectAvailability.ts`.
- Treat `available`, unchecked, and `changed` rows as selectable.
- Treat `missing`, `unavailable`, and `visible: false` rows as not selectable.
- Keep `fileAvailability` transient. Do not change `projectSnapshot` to persist it.
- Do not bump `PROJECT_SCHEMA_VERSION`.
- Avoid duplicating eligibility logic across components.

## Verification Notes

In addition to the shared commands, review the helper names and call sites to confirm this stage only adds reusable semantics and does not change user-facing behavior yet.

---

# Stage 2: Extract A Project File Availability Workflow Hook

## Context & Problem

Project restore currently performs availability validation inline inside `useVideoAuditAppController.ts`. The controller should stay a composition adapter, while file-availability workflow state belongs in a focused hook.

## Task

Please implement Stage 2 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Create `src/renderer/hooks/useProjectFileAvailability.ts`.
- Move the current project restore validation behavior into the new hook.
- Reuse `fileOperationsClient.validateKnownPaths`.
- Preserve the existing race guard or add an equivalent validation token so stale checks cannot overwrite newer results.
- Keep dependencies explicit: rows, selected sources, merge callbacks, project metadata, save callbacks, and blocking-workflow state should be passed in rather than reached through hidden globals.
- If chunking is needed, use a simple chunk size around 500 to 1000 validation items.
- Do not build the full missing-files dialog in this stage.
- Do not implement strategic recheck triggers yet beyond preserving the current restore check.

## Verification Notes

Manually review that opening/restoring a project still triggers availability validation and that the controller is smaller rather than gaining more workflow logic.

---

# Stage 3: Missing Files Warning Dialog

## Context & Problem

When an availability check finds missing saved project videos, the user needs a clear warning with two choices: dismiss the warning or remove the missing rows from the project.

This stage owns the warning dialog UI and wiring, not the full durable removal behavior if that belongs more cleanly to Stage 5.

## Task

Please implement Stage 3 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Create `src/renderer/components/ProjectMissingFilesDialog.tsx`.
- Use existing PrimeReact and `DialogChrome` patterns.
- Show project name, checked timestamp, missing count, file names, and original saved paths.
- Use action labels `Dismiss` and `Remove Missing from Project`.
- Make the copy clear that source media files will not be modified.
- Do not use the word `Delete` for missing-row removal.
- Wire dismiss behavior fully.
- If durable remove behavior is not implemented yet, expose the callback shape needed by Stage 5 and keep the button safely disabled or non-destructive.
- Do not implement relinking or path search.

## Verification Notes

Manually inspect the dialog in code for copy, button labels, and non-destructive language. If you briefly open Electron to inspect the modal, keep it focused and note what you checked.

---

# Stage 4: Disable Missing Row Selection In The DataTable

## Context & Problem

If the user dismisses the missing-files warning, missing rows may remain visible in the table. They must be unchecked and disabled so they cannot be selected for processing.

## Task

Please implement Stage 4 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Update store-level selection pruning in `src/renderer/stores/useVideoResultsStore.ts`.
- When availability merges mark a row `missing` or `unavailable`, prune that row from `selectedRowIds`.
- Make `setSelectedRowIds` ignore missing and unavailable rows.
- Keep selection identity as `row.id ?? row.path`.
- Update `VideoResultsTable` to use PrimeReact `isDataSelectable` for missing/unavailable rows.
- Filter `onSelectionChange` through the shared eligibility helper as a defensive guard.
- Keep changed rows selectable.
- Keep the Availability column and existing disabled Reveal behavior.
- Do not implement selected workflow preflight in this stage.

## Verification Notes

Manually verify from code that missing rows cannot be selected through checkbox selection, row clicks, or selection-change payloads.

---

# Stage 5: Remove Missing Rows From The Active Project

## Context & Problem

The warning dialog needs a non-destructive action that removes missing videos from the active project and data table while leaving source media untouched.

## Task

Please implement Stage 5 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Implement `removeMissingFilesFromProject` in the project file availability workflow.
- Use the existing row visibility model: missing row removal should set `visible: false`.
- Use `hideVideoPathsFromTable(missingPaths)` rather than deleting row objects.
- Persist the updated current audit result through the existing `useAuditResults` path.
- Save the active project immediately after rows are hidden so project JSON and project index counts reflect the update.
- Show clear success, no-op, and save-failure messages.
- Do not call trash, move, archive, replacement, or operation-history APIs.
- Do not remove missing source folders from `project.sources.selectedFolders`.

## Verification Notes

Manually verify that row counts update, the project can be saved after removal, and the action does not touch media files or operation history.

---

# Stage 6: Strategic Recheck Triggers

## Context & Problem

Availability checks should happen more often than project restore, but not as noisy polling. The app needs intentional recheck points that protect processing workflows.

## Task

Please implement Stage 6 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Add a manual `Check Files` action.
- Add a throttled full-project recheck on window focus or document visibility return.
- Use a 10 to 15 minute automatic throttle.
- Do not use `setInterval` for full-project checks.
- Do not re-open repeated warnings while a missing-files dialog is already waiting for user action.
- Add selected-row preflight validation before processing workflows.
- Start with the highest-risk selected-row workflows if the full list cannot be completed cleanly in one pass.
- Preflight should validate selected rows only, merge availability results, clear newly missing/unavailable rows from selection, show the warning, and stop the workflow before it starts.

## Verification Notes

Manually verify project restore, manual check, focus-return throttling, and at least one selected workflow preflight path. Document any workflow preflight call sites left for follow-up.

---

# Stage 7: UI Status, Counts, And Notification Polish

## Context & Problem

Availability state should be visible and actionable without turning the app into a warning-heavy experience.

## Task

Please implement Stage 7 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Refine the existing Availability column, table header counts, and `fileAvailabilityMessage` surfaces.
- Add or polish the manual `Check Files` button with loading and disabled states.
- Prefer placing `Check Files` in `ResultsToolbar` unless the current UI makes `SourceSummaryBar` clearly cleaner.
- Keep copy compact and calm for clean checks.
- Use clear warning copy when missing files are found.
- Show success copy after missing rows are removed.
- Add row disabled styling only if needed for legibility.
- Do not redesign unrelated table, source, or project UI.

## Verification Notes

Manually inspect the affected UI states if practical: clean check, missing warning, dismissed warning, and after remove-missing.

---

# Stage 8: Persistence, Project Index, And Dirty-State Behavior

## Context & Problem

The active project and project index must reflect missing-row removal predictably, while dismissed warnings and transient availability metadata should not dirty or persist project files.

## Task

Please implement Stage 8 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Confirm dismissed warnings do not change project JSON.
- Confirm merged `fileAvailability` does not persist into project JSON.
- Confirm remove-missing changes row visibility and saves the active project.
- Ensure project index counts update after save.
- Preserve dirty state and show a clear project error if save fails after in-memory row hiding.
- Use the current snapshot/save path: `buildVideoProjectSnapshot`, `useProjectWorkspace.saveProject`, `projectClient.save`, and `projectService.saveProject`.
- If needed, add a narrowly scoped helper that builds from the latest `useVideoResultsStore.getState()` after row hiding.
- Do not bump `PROJECT_SCHEMA_VERSION` unless persisted project shape changes.

## Verification Notes

Manually inspect saved project JSON behavior where practical: availability should not persist, removed rows should restore as hidden, and project sidebar counts should reflect the saved update.

---

# Stage 9: Verification And Cleanup

## Context & Problem

The missing-file workflow now needs a final verification and cleanup pass across project restore, dismissal, disabled selection, remove-missing, strategic checks, and workflow preflight.

## Task

Please implement Stage 9 of `docs/project-file-availability-implementation-plan.md`.

## Stage-Specific Guidance

- Start with the manual verification checklist in Stage 9 of the implementation plan.
- Remove or shrink stale inline availability logic in `useVideoAuditAppController.ts`.
- Remove duplicated selectability checks.
- Update stale copy that implies file availability only checks on project restore.
- Keep the main/preload filesystem boundary intact.
- Keep `projectSnapshot` stripping transient `fileAvailability`.
- Keep Zustand focused on row/selection state, not filesystem execution.
- Do not add tests unless explicitly requested.

## Verification Notes

Run the shared verification commands and complete as much of the manual checklist as practical. Clearly distinguish manual checks actually performed from checks documented for later.

