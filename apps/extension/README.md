# Bloxodes Chrome Extension

Chrome MV3 extension for showing a small Bloxodes codes preview on Roblox game pages.

## What It Does

- Runs on `www.roblox.com/games/*` and `web.roblox.com/games/*`.
- Reads the Roblox place ID, visible game name, and current Roblox URL.
- Asks the background service worker to call `https://bloxodes.com/api/extension/roblox-game-codes`.
- Injects a Bloxodes-styled active-codes card into the Roblox page.
- Shows up to 3 active codes and links to the full Bloxodes codes page.

## Commands

Run from the repo root:

```bash
npm run typecheck:extension
npm run build:extension
npm run package:extension
```

The Chrome Web Store upload archive is written to:

```text
apps/extension/bloxodes-extension-v4.0.0.zip
```

## Store Notes

Upload this archive as an update to the existing Chrome Web Store item so the extension ID stays the same.
Keep permissions limited to Roblox game pages and the Bloxodes extension API.
