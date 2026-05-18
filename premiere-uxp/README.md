# Collie Video Premiere Bridge

This is the Premiere Pro UXP plugin for the Collie Video filesystem bridge.

## Requirements

- Premiere Pro 26.0 or newer.
- UXP Developer Tool.

## Development Loading

1. Open Collie Video and click `Open Adobe Apps` in the status strip.
2. In UXP Developer Tool, add this `premiere-uxp/` folder as a plugin.
3. Load or Load & Watch the plugin into Premiere Pro.
4. After `manifest.json` changes, fully unload and load the plugin again.

## Bridge Setup

The plugin uses `localFileSystem: "request"`, so it must ask for folder access instead of reading arbitrary paths directly.

1. In Collie Video, click Refresh Premiere status once to create the bridge folders.
2. In the UXP plugin panel, click `Select bridge folder`.
3. Choose:

```txt
~/Library/Application Support/CollieVideo/premiere-bridge/
```

The Electron app writes requests to:

```txt
~/Library/Application Support/CollieVideo/premiere-bridge/requests/
```

The UXP plugin writes heartbeat status to:

```txt
~/Library/Application Support/CollieVideo/premiere-bridge/status.json
```

## Runtime Flow

The plugin validates bridge access, writes heartbeat status, polls `requests/`, imports each selected video into the active Premiere project, and moves request payloads to `completed/` or `failed/`.

Collie Video currently uses import-only Premiere requests. The bridge does not create sequences, queue Adobe Media Encoder jobs, or export files.
