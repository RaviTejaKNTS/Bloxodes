# Browser Extension Guide

Scope: everything under `apps/extension`.

This app builds the Bloxodes Chromium extension for the Chrome Web Store and Microsoft Edge Add-ons. It is separate from the production web build; root `npm run build` must remain the web-only Dokploy build.

## Shape

- `manifest.json`: Chrome MV3 manifest for the store package.
- `STORE_RELEASES.md`: non-secret browser-store identities and point-in-time submission history.
- `src/background.ts`: background service worker that calls Bloxodes API endpoints.
- `src/content.ts`: Roblox game-page injector.
- `styles.css`: isolated panel styles, all scoped under `#bloxodes-codes-extension`.
- `scripts/`: local build and packaging helpers.
- `dist/`: generated unpacked extension output. It is ignored and should be rebuilt, not hand-edited.

## Rules

- Keep permissions minimal. The extension should only match Roblox game pages and call Bloxodes extension API routes.
- Send only the public Roblox place ID and visible game name to the extension API. Never send the full current page URL, query parameters, private-server links, or unrelated page content.
- Do not put Supabase keys or private API keys in the extension.
- Prefer the Bloxodes web app API over direct database or Supabase Edge Function calls.
- Keep the injected UI small, readable, and close to the active-codes card on the site.
- Show only a preview in Roblox; link users to Bloxodes for the complete list.
- Hide the extension completely when Bloxodes has no published matching codes page for the Roblox game.
- Match the website's code semantics. For example, the `New` badge must come from the same freshness helper used by the website, not from a separate extension-only rule.
- Keep DOM/CSS names defensive. The live Chrome Web Store extension can run at the same time during testing, so avoid generic wrapper classes like `bloxodes-panel`; use the stable root id and scoped selectors.
- Extension-owned logo assets are copied from `apps/web/public` into `dist/brand` and exposed through `web_accessible_resources`.
- Build with `npm run build:extension` from the repo root.
- Create the shared Chrome Web Store and Microsoft Edge Add-ons archive with `npm run package:extension`.

## Current Behavior

- Runs on `https://www.roblox.com/games/*` and `https://web.roblox.com/games/*`.
- Calls `https://bloxodes.com/api/extension/roblox-game-codes` from the background service worker.
- Sends the public Roblox place ID and visible game name; the API keeps `robloxUrl` only as a compatibility fallback for older installed clients.
- Shows up to three active codes and links to the full Bloxodes codes page.
- Uses the Roblox page theme to switch light/dark panel colors and inline Bloxodes logo variant.
- The footer CTA should read `Open full list on` plus the small Bloxodes wordmark.
