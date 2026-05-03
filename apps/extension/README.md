# Bloxodes Chrome Extension

Chrome MV3 extension for showing a small Bloxodes codes preview on Roblox game pages.

## What It Does

- Runs on `www.roblox.com/games/*` and `web.roblox.com/games/*`.
- Reads the Roblox place ID, visible game name, and current Roblox URL.
- Asks the background service worker to call `https://bloxodes.com/api/extension/roblox-game-codes`.
- Injects a Bloxodes-styled active-codes card into the Roblox page.
- Shows up to 3 active codes and links to the full Bloxodes codes page.
- Does not show anything when Bloxodes has no published matching codes page for that game.
- Follows Roblox light/dark mode and uses packaged Bloxodes logo assets in the footer CTA.

## Source Shape

```txt
apps/extension/
  manifest.json
  src/background.ts
  src/content.ts
  styles.css
  scripts/build.mjs
  scripts/package.mjs
```

Generated files are written to `apps/extension/dist/` and the Chrome Web Store archive is written to `apps/extension/bloxodes-extension-v4.0.0.zip`.
Do not edit `dist/` directly.

## Commands

Run from the repo root:

```bash
npm run typecheck:extension
npm run build:extension
npm run package:extension
```

## Local Test In Chrome

1. Run `npm run package:extension`.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Click "Load unpacked".
5. Select `apps/extension/dist`.
6. Open a Roblox game page such as Blox Fruits.
7. Test with only the unpacked extension enabled, then optionally enable the live store extension to check for style isolation.

The Chrome Web Store upload archive is:

```text
apps/extension/bloxodes-extension-v4.0.0.zip
```

## Store Notes

Upload this archive as an update to the existing Chrome Web Store item so the extension ID stays the same.
Keep permissions limited to Roblox game pages and the Bloxodes extension API.
Before upload, confirm the Chrome Web Store dashboard's current live version and keep `manifest.json`/`package.json` greater than that version.
