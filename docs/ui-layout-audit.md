# UI Layout Audit - Stage 1

Date: 2026-05-17

## Scope

This audit covers the current renderer layout after the initial Electron conversion and before the larger results-first shell redesign. It focuses on the sources of overlap, cramped spacing, and competing UI described in `ui-improvement-plan.md`.

## Current Structure

- `src/renderer/App.tsx` renders a two-column workspace: the main audit/results column and a permanent right rail.
- `SourceSelectionPanel` owns folder/file/output selection, audit options, recent folders, run/cancel controls, and selected-path summaries.
- `VideoResultsTable` owns result summary, search, thumbnail toggle, refresh/clear controls, selected-row workflow buttons, Premiere status, import feedback, the table, audit errors, and the details dialog.
- `UtilityPanel` and `SettingsPanel` are always visible inside the right rail.
- `AuditProgressPanel` sits between source setup and results.
- Dialogs for auto-fix, crop, thumbnails, migration, migration results, and details are already modal surfaces and are not the primary cause of the main-screen overlap.

## Primary Layout Problems

1. The main overlap comes from a width mismatch between the permanent side rail and the results table.
   - `.workspace-layout` reserves `360px` for `.workspace-side`.
   - `VideoResultsTable` sets `tableStyle={{ minWidth: showThumbnails ? '1380px' : '1280px' }}`.
   - On a typical laptop-width window, the main column is narrower than the table minimum, so the table and its header/paginator compete with the side rail.

2. The right rail is permanently visible even when it is not contextual.
   - `UtilityPanel` and `SettingsPanel` consume prime horizontal space at all desktop widths above the previous `1120px` breakpoint.
   - This makes secondary workflows compete with the results table, which conflicts with the results-first direction.

3. The source setup panel dominates the first viewport.
   - Folder, file, output, audit options, run/cancel, messages, recent folders, and path lists all render at once.
   - This pushes results down and makes the table feel secondary even though it is the core workspace.

4. Table controls are always visible even when irrelevant.
   - Refresh, clear data, remove, restore, auto-fix, crop, thumbnails, migration, and Premiere actions all appear in the table header.
   - Disabled buttons preserve behavior but add visual weight and horizontal pressure.

5. Status information is too bulky.
   - `PremiereStatusBanner` renders inside the results panel as a full-width message.
   - Tool diagnostics and settings details live in a permanent side panel rather than a compact status strip or diagnostics dialog.

6. Scroll and containment rules are incomplete for the current hybrid layout.
   - The table wrapper is scrollable, but the surrounding results panel/header/paginator still need explicit containment to prevent wide controls from visually spilling into neighboring regions.
   - Flex rows generally wrap, but PrimeReact buttons and paginator internals can still create awkward wide rows without stronger local constraints.

## Positioning and Z-Index Notes

- No renderer-level `position: fixed` or global `z-index` rules were found in the main layout CSS.
- `position: absolute` is currently limited to the video details preview status badge.
- `position: relative` is used inside preview/detail components and is not the source of the observed main-screen overlap.
- The visible overlap is primarily grid sizing and overflow pressure, not a stacking-context issue.

## Safe Stage 1 Cleanup Applied

- Increased the workspace collapse breakpoint so the permanent right rail drops below the main workspace before it can squeeze the table on laptop-width screens.
- Added results/table containment rules so the DataTable header, scroll wrapper, and paginator stay inside the results panel.
- Added wrapping/shrinking guardrails for table toolbar/action buttons and paginator controls.

These changes do not remove features or alter workflow state. They only make the current layout safer until the Stage 2 app shell replaces the permanent side rail.

## Recommended Stage 2 Targets

- Replace the two-column page with a results-first app shell: header, compact source summary, compact status strip, results toolbar, table workspace, contextual action bar.
- Move `SettingsPanel` to a settings dialog or drawer.
- Convert `UtilityPanel` functions into contextual actions or a diagnostics/tools dialog.
- Move source selection and audit options into a source configuration dialog.
- Split `VideoResultsTable` controls so global search/view controls live in a compact toolbar and selected-row workflows live in a contextual action bar.
- Keep the table as the largest and most stable viewport region.

## Manual Verification Checklist

- Launch the app and confirm the right-side panels no longer sit beside the table on laptop-width windows.
- Confirm table horizontal scrolling remains available for all columns.
- Confirm the paginator stays inside the results panel.
- Confirm source selection, settings, discovery, metadata, and workflow buttons remain available.
- Confirm dialogs still open above the current page layout.
