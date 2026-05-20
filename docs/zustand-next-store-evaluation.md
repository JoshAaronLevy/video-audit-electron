# Zustand Next Store Evaluation

This note records the Stage 10 decision from `docs/zustand-store-implementation-plan.md`.

## Decision

Do not add a second Zustand store now.

The results workspace store is the only current Zustand store. It owns focused renderer result/table state: audit rows, row visibility, selected row IDs, top-level result search/filter state, table-count selectors, row metadata merges, and result hydration. No other renderer state currently has enough cross-surface pressure to justify a new store.

Adding a second store without a concrete coordination problem would make Zustand feel like the default app architecture. That is not the goal.

## Candidate Review

| Candidate | Current owner | Decision | Rationale | Future trigger |
| --- | --- | --- | --- | --- |
| Source workspace state | `useAuditSourceController` and `useSourceSelection` | Keep in focused hooks | Source state is already coordinated in one hook chain. It depends on settings persistence, native picker calls, folder-tree source metadata, and audit-option updates, but it does not have multiple distant writers. | Reconsider a `useSourceWorkspaceStore` only if source state needs direct access from several non-parent surfaces, source restore/reset logic becomes hard to reason about, or source summaries become heavily derived across workflows. |
| App shell and dialog visibility | `App.tsx`, `useAppCommands`, and workflow hooks | Leave local/component-owned | Dialog visibility is mostly local shell state or workflow-specific state. Moving every open/closed boolean into Zustand would create a broad UI store with little benefit. | Reconsider a focused app UI store only if app-menu requests, Escape handling, and dialog visibility become difficult to coordinate through the current shell and hook ownership. |
| Settings UI state | `useSettingsController` plus main-process settings APIs | Keep in focused hook | Settings persistence belongs behind the preload/main boundary. The renderer hook already owns loading, messages, update/reset calls, and local display state. Zustand should not become settings persistence. | Reconsider only for transient settings-panel draft state that is shared by distant components, not for durable settings themselves. |
| Operation history UI state | `useOperationHistory` | Keep in focused hook | Operation history loading, selected record details, dialog visibility, and errors are a small workflow surface. The durable history source belongs to the main process. | Reconsider only if operation history becomes a cross-app workspace used outside its dialog and needs shared derived selectors. |
| Workflow busy and capability derivation | `useWorkflowBusyState` and `getWorkflowCapabilities` | Keep as derived hook/helper state | Busy and capability values are derived from active actions, progress snapshots, selected counts, source state, and Premiere state. They should not be stored as mutable global state. | Reconsider only if the inputs become store-owned in another focused workspace and selectors can derive capabilities without storing dynamic counts or booleans. |

## Boundary Notes

- Do not create a generic `useAppStore`.
- Do not move workflow execution state, progress subscriptions, IPC calls, native dialogs, file operations, ffmpeg/ffprobe work, Premiere internals, operation-history persistence, or app settings persistence into Zustand.
- Keep counts and capabilities derived from state, not stored as mutable state.
- Future stores should be introduced only after naming the concrete coordination problem, owner boundary, non-goals, and persistence boundary.

## Current Next Step

Stage 11 should document the final renderer state architecture now that the results workspace migration is stable. That documentation should reference this decision: results are store-owned; the next store remains optional and must meet the same decision criteria.
