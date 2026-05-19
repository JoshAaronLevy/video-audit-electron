# Renderer Store Conventions

Zustand stores in this folder are for focused renderer workspace state only. Add a store when the state has multiple readers or writers, needs shared derived selectors, or has one canonical mutation path that is hard to preserve through component props and hook adapters.

Keep state in React hooks or components when it is local to one workflow, dialog, progress subscription, or UI surface. Workflow hooks continue to own execution state for audit, discovery, ffprobe, thumbnails, Auto-Fix, Auto-Crop, Premiere, migration, file operations, replacement, and operation history.

Stores may receive final renderer row or workspace updates from workflow hooks, but stores must not own Electron main-process execution. Filesystem access, ffmpeg and ffprobe execution, native dialogs, settings persistence, operation-history persistence, and OS integration stay behind the typed preload API.

Naming conventions:

- Store hooks use `use<WorkspaceName>Store`, for example `useVideoResultsStore`.
- Store files live beside their pure selectors, for example `useVideoResultsStore.ts` and `videoResultsSelectors.ts`.
- Actions use explicit verb phrases such as `applyAuditResult`, `setSearchQuery`, `hideRowsByPath`, and `clearSelection`.
- Selectors are pure functions named for the derived value, such as `getActiveRows`, `getResultsViewCounts`, or `getSelectedRows`.
- Dynamic counts are derived from selectors, not stored as mutable state.

Do not create a generic `useAppStore` without a specific architecture decision. A broad app store would recreate a large controller with a different API.
