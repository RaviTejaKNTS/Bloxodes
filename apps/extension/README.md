# Bloxodes Browser Extension

Chromium MV3 extension for showing Bloxodes codes and seven-day player history on Roblox game pages. The same package supports Google Chrome and Microsoft Edge.

## What It Does

- Runs on `www.roblox.com/games/*` and `web.roblox.com/games/*`.
- Reads the public Roblox place ID and visible game name.
- Asks the background service worker to call Bloxodes extension API routes for codes and player history.
- Injects a Bloxodes-styled active-codes card into the Roblox page.
- Shows up to 3 active codes and links to the full Bloxodes codes page.
- Shows a seven-day player-count graph immediately below Roblox's native game statistics.
- Verifies unknown games through the Bloxodes backend and starts the normal universe tracking workflow.
- Provides toolbar toggles for the Active codes and Player history widgets.
- Hides only the codes widget when Bloxodes has no published matching codes page for that game.
- Follows Roblox light/dark mode and uses packaged Bloxodes logo assets in the footer CTA.

## Source Shape

```txt
apps/extension/
  manifest.json
  popup.html
  popup.css
  src/background.ts
  src/content.ts
  src/popup.ts
  styles.css
  scripts/build.mjs
  scripts/package.mjs
```

Generated files are written to `apps/extension/dist/` and the store archive is written to `apps/extension/bloxodes-extension-v5.0.0.zip`.
Do not edit `dist/` directly.

## Commands

Run from the repo root:

```bash
npm run typecheck:extension
npm run build:extension
npm run package:extension
```

## Local Test In Chrome Or Edge

1. Run `npm run package:extension`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable Developer Mode.
4. Click "Load unpacked".
5. Select `apps/extension/dist`.
6. Click the toolbar icon and verify both widget toggles are enabled.
7. Open a tracked Roblox game and confirm the history card appears directly below the native statistics list.
8. Toggle each widget off and on and confirm the page updates without a reload.
9. Test with only the unpacked extension enabled, then optionally enable the live store extension to check for style isolation.

The store upload archive is:

```text
apps/extension/bloxodes-extension-v5.0.0.zip
```

## Store Notes

Upload this archive as an update to the existing Chrome Web Store item or as a package for the Microsoft Edge Add-ons listing. Each store manages its own extension identity and update history.
Keep permissions limited to Roblox game pages and the Bloxodes extension API.
Before uploading an update, confirm that store's current live version and keep `manifest.json`/`package.json` greater than it.

Store identities and submission history are recorded in [`STORE_RELEASES.md`](./STORE_RELEASES.md).
