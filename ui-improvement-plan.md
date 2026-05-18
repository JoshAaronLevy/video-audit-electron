# UI Improvement Plan — Results-First Pro Utility

## Project Context

This plan starts after the initial Electron conversion is complete.

The app is now a standalone private macOS Electron utility that can audit local videos, detect video issues, run ffprobe/ffmpeg workflows, generate thumbnails/preview clips, interact with the Premiere bridge, and persist app state.

The current UI works functionally but is visually crowded, has overlapping elements, exposes too many controls at once, and lacks a clear hierarchy.

This plan redesigns the app into a slick, results-first utility where the table is the primary workspace and setup/actions are contextual.

## Design Direction

Use a **Results-first Pro Tool** design.

The main screen should prioritize:

1. A clean app header.
2. Compact source/audit controls.
3. A small status strip.
4. Search/filter/view controls.
5. A large results table.
6. Contextual selected-row action bar.
7. Details/modals/drawers for secondary workflows.

The app should feel like a serious macOS utility, not a web form.

## Core UX Principles

- The results table is the main surface.
- Setup controls should be compact.
- Settings should not permanently consume screen space.
- Buttons should appear only when relevant.
- Advanced tools should be contextual, not always visible.
- Empty states should be helpful and visually calm.
- Use progressive disclosure.
- Avoid permanent right rails unless they are contextual and non-overlapping.
- Avoid overlapping, floating, or fixed-position UI except for intentional modals/toasts.
- Prefer clean spacing, strong hierarchy, and fewer visible borders.
- Keep the app fast and calm even with many features.

## Non-Goals

- Do not redesign app functionality.
- Do not rewrite the core audit/ffmpeg/Premiere logic.
- Do not add file-management workflows yet.
- Do not change the app architecture unless required for UI cleanup.
- Do not introduce a large new design system dependency.
- Do not write tests unless explicitly requested.
- Do not remove existing features; relocate or progressively disclose them.

## Target Layout

The target main layout should be:

```txt
┌──────────────────────────────────────────────────────────────┐
│ Collie Video                        Status     Settings ⚙    │
├──────────────────────────────────────────────────────────────┤
│ Source summary / quick actions                              │
│ [Choose Sources] [Run Audit]                                │
├──────────────────────────────────────────────────────────────┤
│ Status strip: Premiere ready • ffmpeg ready • No active job  │
├──────────────────────────────────────────────────────────────┤
│ Results toolbar                                             │
│ Search...  View: All | Flagged | Crop | Low-res  Filters    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Huge results DataTable                                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Contextual selection/action bar                             │
│ 3 selected  [Auto-Fix] [Crop] [Thumbnails] [Premiere] [More] │
└──────────────────────────────────────────────────────────────┘
```

## Recommended Visual Style

Use a polished light UI by default, with strong utility-app polish.

Suggested style qualities:

* background: soft cool gray, not pure white
* cards/surfaces: white or very light gray
* borders: subtle
* shadows: very light, used sparingly
* radius: consistent, moderate, around 10–14px
* buttons: fewer colors, clearer hierarchy
* primary color: blue/cyan accent
* destructive color: red only for destructive actions
* success: green only for status/completion
* warning: amber only for warnings
* table header: clean, compact, sticky if practical
* typography: slightly denser than marketing UI, but not cramped

Do not overuse gradients or saturated button colors. A utility app should feel premium because it is calm and well-spaced.

## Suggested Top-Level UI Regions

### 1. App Header

Contains:

* app name: `Collie Video`
* current audit/result summary
* compact status indicators
* settings button
* possibly operation history button later

Example:

```txt
Collie Video     142 videos • 38 flagged • 2 errors      Premiere Ready   Settings
```

### 2. Source Summary Bar

Compact representation of current inputs:

```txt
Sources: 2 folders • 0 files     Output: /Movies/Edited/ffmpeg
[Choose Sources] [Run Audit]
```

Before any source is selected, show an empty state:

```txt
Choose folders or video files to begin.
[Choose Sources]
```

Source selection itself should move into a modal/drawer.

### 3. Status Strip

Small horizontal status bar:

```txt
Premiere: Ready • ffmpeg: Ready • ffprobe: Ready • Last audit: Unsaved • No active jobs
```

Clicking a status item can reveal details.

### 4. Results Toolbar

Above the table:

* search input
* view segmented control:

  * All
  * Flagged
  * Low-res
  * Aspect
  * Crop
  * Errors
* thumbnails toggle
* column/view options if useful
* refresh/clear in overflow menu

Example:

```txt
Search videos...      All | Flagged | Low-res | Crop | Errors       View ▾
```

### 5. Results Table

The results table should dominate the screen.

Goals:

* maximum vertical space
* clean row density
* clear columns
* no surrounding clutter
* contextual actions
* good empty/loading/error states

### 6. Contextual Action Bar

Only appears when:

* results exist, or
* rows are selected, depending on action type

When no rows selected:

```txt
No videos selected
```

or hidden entirely.

When rows selected:

```txt
4 selected   [Auto-Fix] [Crop Options] [Generate Thumbnails] [Edit in Premiere] [More ▾]
```

Less common actions move under `More`.

### 7. Settings

Settings should be a modal or drawer, not a permanent side card.

Settings groups:

* Output paths
* ffmpeg/ffprobe overrides
* audit defaults
* thumbnail/preview defaults
* Premiere bridge
* diagnostics

---

## Stage 1 — Layout Audit and Cleanup Plan

**Intelligence Level: High**

### Goal

Analyze the current renderer layout and identify the exact source of overlapping, cramped, or competing UI.

This stage should mostly document and minimally prepare. Avoid a large redesign in this first stage.

### Requirements

Inspect current renderer files:

* main app component
* layout CSS
* table component
* source/audit controls
* settings UI
* status/Premiere UI
* dialogs/drawers
* any fixed/absolute/sticky positioning
* any container width/height rules
* any right rail/sidebar layout

Identify:

* overlapping elements
* fixed-position elements
* z-index issues
* grid/flex sizing issues
* `min-width` issues affecting tables
* main content extending under sidebar
* buttons visible when irrelevant
* components that should become modal/drawer/overflow-menu

Create a short implementation note if useful:

```txt
docs/ui-layout-audit.md
```

### Deliverables

* UI layout audit notes
* small CSS fixes only if obvious and safe
* no major UI rewrite yet

### Acceptance Criteria

* The causes of current overlap are documented.
* The next stages have clear targets.
* No app behavior is changed substantially.

---

## Stage 2 — App Shell and Results-First Layout Foundation

**Intelligence Level: Extra High**

### Goal

Replace the crowded multi-panel layout with a stable results-first app shell.

This is the most important visual architecture stage.

### Requirements

Create a clean app shell with:

* top app header
* compact source summary area
* status strip
* results toolbar area
* main table area
* contextual action bar area

Remove or relocate permanent right-side Settings/Utilities panels that cause overlap.

The layout should be built with predictable CSS:

* no accidental absolute positioning
* no content extending under sidebars
* no overlapping fixed panels
* `min-width: 0` where grid/flex table containers need it
* table area should be allowed to grow
* main app should handle common MacBook screen sizes

Suggested structure:

```tsx
<AppShell>
  <AppHeader />
  <SourceSummaryBar />
  <StatusStrip />
  <ResultsToolbar />
  <ResultsWorkspace />
  <SelectionActionBar />
</AppShell>
```

or similar.

### Layout Rules

* The table should get the most vertical space.
* The app should not require scrolling past setup cards to reach results.
* Settings should not be permanently visible.
* Utilities should not be permanently visible unless converted into compact status/actions.
* Empty states should be visually centered or integrated into the results area.
* Main content must not overlap the action bar.
* Action bar must not overlap the table.

### Deliverables

* new or refactored app shell components
* updated CSS/layout files
* removal/relocation of overlapping panels
* stable viewport-height layout

### Acceptance Criteria

* No visible overlap at typical laptop widths.
* Table is the primary visual surface.
* Header/source/status/results/action areas are visually distinct.
* Settings no longer appears as a permanent competing right-side card.
* App remains usable with no audit results.

---

## Stage 3 — Source Configuration Modal

**Intelligence Level: High**

### Goal

Move folder/file/output selection and audit options out of the crowded main page and into a focused source configuration modal or drawer.

### Requirements

Create a `SourceConfigDialog` or similar.

It should include:

* Choose folders
* Choose files
* Choose output folder
* selected folders summary
* selected files summary
* selected output summary
* include subfolders toggle
* low-resolution scan toggle
* black-border analysis toggle
* clear selected sources
* confirm/apply button
* cancel button

Main screen should show only a compact source summary:

```txt
Sources: 2 folders • 0 files    Output: /Movies/Edited/ffmpeg    [Change]
```

If no sources are selected:

```txt
No sources selected    [Choose Sources]
```

### Design Requirements

* Keep modal readable and calm.
* Avoid three separate cards for folder/file/output on the main page.
* Use badges/counts for selected items.
* Long paths should truncate in the middle.
* Provide “Reveal” or “Copy path” only if already implemented and useful.
* Avoid showing raw huge path lists unless expanded.

### Deliverables

* `SourceConfigDialog.tsx`
* compact `SourceSummaryBar.tsx`
* renderer state integration
* updated main app layout

### Acceptance Criteria

* Source selection no longer dominates the main screen.
* User can still choose folders/files/output.
* User can clearly see selected source/output summary.
* Audit options are still accessible.
* Existing audit behavior is preserved.

---

## Stage 4 — Status Strip and Diagnostics Drawer

**Intelligence Level: Medium**

### Goal

Replace bulky status cards with a compact status strip and optional diagnostics detail view.

### Requirements

Create a status strip showing compact statuses for:

* active audit/job state
* Premiere bridge
* ffmpeg availability if available
* ffprobe availability if available
* current saved/unsaved state
* selected output folder status

Example:

```txt
Premiere Ready • ffmpeg Ready • ffprobe Ready • No active job • Unsaved
```

Add a diagnostics drawer/modal if useful:

* Premiere bridge details
* ffmpeg path
* ffprobe path
* last error
* output directory
* cache paths

### Design Requirements

* Use subtle status pills or dot indicators.
* Green should mean ready/success.
* Amber should mean warning.
* Red should mean broken/error.
* Avoid large success cards like “Premiere bridge ready” taking table space.

### Deliverables

* `StatusStrip.tsx`
* optional `DiagnosticsDialog.tsx`
* removal/replacement of bulky status cards from main layout

### Acceptance Criteria

* Premiere/diagnostic information remains available.
* Main screen is much less crowded.
* Status does not compete with results.

---

## Stage 5 — Results Toolbar and View Filters

**Intelligence Level: High**

### Goal

Create a clean toolbar for searching, filtering, and controlling the results table view.

### Requirements

The toolbar should support:

* search input
* view filter segmented control or tabs:

  * All
  * Flagged
  * Low-res
  * Aspect
  * Crop
  * Errors
* thumbnails toggle
* refresh action
* clear data action
* column/view options if useful
* overflow menu for less common controls

### Button Hierarchy

Primary action should usually be:

```txt
Run Audit
```

Table utility actions should be secondary or text/outlined.

Destructive actions like Clear Data should be in overflow or require confirmation.

### Suggested Layout

```txt
Search videos...        All | Flagged | Low-res | Aspect | Crop | Errors        View ▾
```

`Refresh`, `Clear Data`, and similar actions can live in `View ▾` or an overflow menu.

### Deliverables

* `ResultsToolbar.tsx`
* view filter state
* table filtering integration
* moved/hidden previous cluttered toolbar buttons

### Acceptance Criteria

* User can search and filter results easily.
* Toolbar is compact and polished.
* Less common actions are not constantly competing for attention.
* Filtering does not break existing table behavior.

---

## Stage 6 — Results Table Visual Redesign

**Intelligence Level: Extra High**

### Goal

Make the results table feel like the polished core of the app.

### Requirements

Improve the table layout and visual density.

Consider:

* sticky header
* cleaner row height
* better preview thumbnail column
* clear file name/path display
* compact metadata columns
* issue badges instead of long text where possible
* sortable columns
* consistent empty/loading/error states
* horizontal overflow handled cleanly
* footer/pagination not overlapping other UI
* selected row state that works with the contextual action bar

### Suggested Columns

Core visible columns:

* Preview
* File
* Type
* Size
* Duration
* Modified
* Resolution
* Aspect
* Crop
* Issues
* Actions

Optional/advanced columns can move to details modal or column chooser.

### File Cell

Show:

```txt
filename.mp4
/path/to/folder
```

with folder path smaller and muted.

### Issues Cell

Use badges:

```txt
Low-res
Not 16:9
Black borders
Error
```

Instead of long unstructured reasons.

### Empty State

When no sources selected:

```txt
Choose a folder or video files to begin.
```

When sources selected but no audit run:

```txt
Run an audit to populate results.
```

When audit finds no issues:

```txt
No flagged videos found.
```

When zero videos found:

```txt
No videos found in selected sources.
```

### Deliverables

* updated `VideoTable` or replacement table component
* issue badge components
* improved empty/loading/error states
* table CSS cleanup

### Acceptance Criteria

* Table has no overlap with action bars or pagination.
* Table is visually clean and useful.
* Important issues are scannable.
* Results remain functional with many rows.
* Empty states are clear.

---

## Stage 7 — Contextual Selection Action Bar

**Intelligence Level: High**

### Goal

Move selected-video actions into a contextual action bar that appears only when useful.

### Requirements

When no rows are selected:

* hide the action buttons, or show a calm “No videos selected” state.

When rows are selected:

Show:

```txt
3 selected  [Auto-Fix] [Crop Options] [Generate Thumbnails] [Edit in Premiere] [More ▾]
```

Move less common or destructive actions into `More`.

Possible `More` menu:

* Remove from table
* Restore removed
* Migrate New Edits
* Clear Data
* Reveal selected if supported

### Design Requirements

* The action bar should not overlap the table.
* It may be sticky at the bottom of the app shell.
* It should be visually distinct but not huge.
* Disabled actions should explain why via tooltip or title if practical.
* Destructive actions should not be primary-colored.

### Deliverables

* `SelectionActionBar.tsx`
* action grouping/overflow
* table selection integration
* removal of always-visible action button row

### Acceptance Criteria

* Action buttons are only visible when relevant.
* The main screen is calmer with zero selected rows.
* Selected-row workflows remain accessible.
* No overlap with pagination or settings.

---

## Stage 8 — Settings Modal/Drawer Redesign

**Intelligence Level: High**

### Goal

Move Settings into a polished modal/drawer and remove it from the permanent main layout.

### Requirements

Settings should include grouped sections:

* General
* Audit defaults
* Output paths
* ffmpeg/ffprobe
* Premiere bridge
* Thumbnail/preview cache
* Diagnostics

Design:

* open from header gear button
* save/cancel or auto-save with clear feedback
* field labels and descriptions
* validation messages
* reset to defaults if useful

### Requirements

Preserve existing settings behavior.

Do not change app defaults unless explicitly useful.

### Deliverables

* `SettingsDialog.tsx` or `SettingsDrawer.tsx`
* grouped settings UI
* header settings button
* removal of visible settings card from main screen

### Acceptance Criteria

* Settings are accessible but not constantly visible.
* Settings UI is polished and grouped.
* Existing save behavior still works.
* Main screen no longer overlaps settings.

---

## Stage 9 — Source/Audit Empty State and First-Run Experience

**Intelligence Level: Medium**

### Goal

Make the app feel intentional before any audit has run.

### Requirements

When there are no results and no selected sources, show a polished empty state in the results area.

Example:

```txt
Start by choosing videos to audit

Select a folder or individual files, then run an audit to find low-resolution,
wrong-aspect-ratio, or black-border videos.

[Choose Sources]
```

When sources are selected but no audit run:

```txt
Ready to audit 2 folders

Audit options: subfolders, low-res, black borders
[Run Audit]
```

When audit is running:

* show progress in the results area or status strip
* avoid giant blocking UI unless necessary

### Deliverables

* `EmptyState.tsx` or equivalent
* improved first-run states
* improved ready-to-run state
* improved running state

### Acceptance Criteria

* Empty app looks deliberate, not broken.
* User knows what to do first.
* Empty states do not waste space after results exist.

---

## Stage 10 — Dialog and Modal Polish Pass

**Intelligence Level: High**

### Goal

Make all major dialogs visually consistent and less crowded.

### Dialogs to Review

* Source configuration dialog
* Auto-Fix dialog
* Crop Options dialog
* Thumbnail generation dialog
* Preview clip generation dialog if present
* Migration dialogs
* Premiere status/details
* Settings
* Any result dialogs

### Requirements

Standardize:

* dialog header
* footer buttons
* primary/secondary/destructive button hierarchy
* spacing
* loading/progress display
* error messages
* result summaries
* long path display
* scroll behavior
* max width/height

### Deliverables

* shared dialog layout components if useful
* updated dialog CSS
* polished existing dialogs

### Acceptance Criteria

* Dialogs feel like one app.
* No dialog is visually overwhelming.
* Long content scrolls inside dialog instead of breaking layout.
* Primary actions are obvious.

---

## Stage 11 — Visual Theme and Component System Cleanup

**Intelligence Level: High**

### Goal

Create a more cohesive visual system without over-engineering a full design system.

### Requirements

Define or clean up:

* CSS variables for colors
* spacing scale
* border radius
* shadow scale
* typography sizes
* status colors
* table colors
* button style conventions
* badge/chip styles

Suggested theme tokens:

```css
:root {
  --app-bg: #f5f7fb;
  --surface: #ffffff;
  --surface-muted: #f8fafc;
  --border: #d8e0ec;
  --text: #172033;
  --text-muted: #64748b;
  --accent: #3b82f6;
  --success: #16a34a;
  --warning: #f59e0b;
  --danger: #ef4444;
  --radius-md: 10px;
  --radius-lg: 14px;
}
```

Do not blindly replace PrimeReact theming if PrimeReact already handles most component styling well.

### Deliverables

* app theme CSS cleanup
* shared utility classes/components
* consistent cards/badges/buttons
* removal of conflicting old styles

### Acceptance Criteria

* UI looks cohesive.
* Styles are not scattered randomly.
* PrimeReact and custom CSS do not fight each other.
* App feels like a polished desktop utility.

---

## Stage 12 — Responsive and Window-Size Polish

**Intelligence Level: Medium**

### Goal

Ensure the app works well at realistic MacBook window sizes.

### Requirements

Test and polish layout at:

* 1280px wide
* 1440px wide
* 1512px wide
* full-screen desktop
* shorter window heights

Requirements:

* no overlap
* table remains usable
* action bar does not cover pagination
* dialogs fit viewport
* long paths truncate
* controls wrap gracefully where needed
* source summary stays readable

### Deliverables

* responsive CSS fixes
* min/max width handling
* table container fixes
* dialog viewport constraints

### Acceptance Criteria

* App works well on a MacBook screen.
* No visible overlap.
* No important controls disappear.
* No unnecessary horizontal page scrolling outside the table.

---

## Stage 13 — Final UX Review and Cleanup

**Intelligence Level: High**

### Goal

Review the redesigned UI as a complete utility and remove leftover clutter.

### Requirements

Audit the app for:

* too many visible buttons
* unclear disabled actions
* inconsistent colors
* inconsistent spacing
* duplicate controls
* dead UI
* hidden but important workflows
* confusing empty states
* excessive borders/cards
* awkward modal flows
* table usability
* source selection clarity
* action discoverability

Create or update:

```txt
docs/ui-polish-review.md
```

Include:

* what changed
* any known remaining rough edges
* future recommendations

### Deliverables

* final cleanup fixes
* UI review doc
* README screenshot/usage update if appropriate

### Acceptance Criteria

* App feels coherent and slick.
* Results table is clearly the main workspace.
* Core workflows are discoverable.
* UI no longer appears crowded or overlapping.
* App is ready for file-management workflows later.

## Definition of Done

The UI improvement work is complete when:

* no major layout overlap exists
* settings are not permanently occupying the main layout
* source selection is compact and clear
* results table is the primary workspace
* actions appear contextually
* status/diagnostics are compact
* dialogs are visually consistent
* app works well on MacBook-sized windows
* app feels like a polished private macOS utility
