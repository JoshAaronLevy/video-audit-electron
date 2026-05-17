# video-audit-electron

Private macOS Electron version of the existing `video-audit` app.

The legacy reference app lives in a sibling workspace folder named `video-audit`.

This repo must become standalone. It may copy/adapt logic from the legacy repo, but it must not import from it or depend on it.

## Development

Use Node 20 or newer. This repo includes an `.nvmrc`, so if you use nvm:

```sh
nvm use
```

Install dependencies:

```sh
npm install
```

Run the Electron app locally:

```sh
npm run dev
```

Check TypeScript:

```sh
npm run typecheck
```

Build the Electron/Vite output:

```sh
npm run build
```

## Current Scope

The current app includes:

- Electron main process window creation
- Vite React renderer
- TypeScript configuration
- PrimeReact, PrimeFlex, and PrimeIcons styling
- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload API at `window.videoAudit`
- basic app/version/platform info returned through IPC
- native folder selection through Electron dialogs
- native video-file selection through Electron dialogs
- native output-folder selection through Electron dialogs
- selected path validation in the main process
- reveal selected paths in Finder
- shared TypeScript contracts for audits, videos, jobs, settings, adjustments, thumbnails, migration, and Premiere bridge work
- shared video-extension and Premiere bridge constants
- JSON-backed local app settings stored under Electron's user data directory
- settings preload APIs for reading, updating, and resetting local settings
- discovery-only video scanning for selected folders and files
- cancellable file discovery progress reported through Electron IPC
