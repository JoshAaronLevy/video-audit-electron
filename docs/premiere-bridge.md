# Premiere Bridge

Collie Video uses a local filesystem bridge between the Electron app and a Premiere Pro UXP plugin.

## Bridge Directory

The bridge directory is:

```txt
~/Library/Application Support/CollieVideo/premiere-bridge
```

The Electron app creates:

```txt
status.json
requests/
completed/
failed/
imports/
```

## Plugin

The Collie Video UXP plugin lives in `premiere-uxp/`.

It must use:

- Plugin ID: `collie-video-premiere-bridge`
- Bridge folder: `~/Library/Application Support/CollieVideo/premiere-bridge`
- Request type: `import-selected-videos`

The legacy `video-audit` plugin uses a different plugin ID and a different bridge directory. It is reference-only and should not be used as the active Collie Video bridge.

## Setup

1. Click `Open Adobe Apps` in Collie Video.
2. In UXP Developer Tool, add and load `premiere-uxp/`.
3. In the UXP panel, click `Select bridge folder`.
4. Choose `~/Library/Application Support/CollieVideo/premiere-bridge`.
5. Keep the UXP panel open while sending selected videos to Premiere.
