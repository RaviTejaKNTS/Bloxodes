# Browser Extension Guide

Scope: everything under `apps/extension`.

This app builds the Bloxodes Chromium extension for the Chrome Web Store and Microsoft Edge Add-ons. It is separate from the production web build; root `npm run build` must remain the web-only Dokploy build.

## Shape

- `manifest.json`: Chrome MV3 manifest for the store package.
- `STORE_RELEASES.md`: non-secret browser-store identities and point-in-time submission history.
- `src/background.ts`: background service worker that calls Bloxodes API endpoints and owns extension authentication.
- `src/content.ts`: Roblox game-page injector.
- `src/popup.ts`, `popup.html`, `popup.css`: toolbar popup, account controls, and synced widget toggles.
- `styles.css`: isolated panel styles, scoped under `#bloxodes-codes-extension` and `#bloxodes-stats-extension`.
- `scripts/`: local build and packaging helpers.
- `dist/`: generated unpacked extension output. It is ignored and should be rebuilt, not hand-edited.

## Rules

- Keep permissions minimal. The extension should only match Roblox game pages and call Bloxodes extension API routes.
- Send only the public Roblox place ID and visible game name to the extension API. Never send the full current page URL, query parameters, private-server links, or unrelated page content.
- Do not put Supabase keys or private API keys in the extension.
- Prefer the Bloxodes web app API over direct database or Supabase Edge Function calls.
- Keep the injected UI small, readable, and close to the active-codes card on the site.
- Show only a preview in Roblox; link users to Bloxodes for the complete list.
- Hide the codes widget when Bloxodes has no published matching codes page. Player history remains independent and may appear for any tracked game.
- Place the player-history widget immediately after Roblox's native `.game-stat-container`; do not fall back to unrelated page regions if that target is unavailable.
- Store only the `showCodes` and `showHistory` preferences in `chrome.storage.sync`, with both enabled by default.
- Store bearer sessions and local used-code progress in `chrome.storage.local`; never sync authentication tokens through Chrome Sync.
- Start sign-in only from the toolbar popup through `chrome.identity.launchWebAuthFlow`. Exchange the short-lived handoff with Bloxodes and keep all Supabase access server-side.
- Match the website's code semantics. For example, the `New` badge must come from the same freshness helper used by the website, not from a separate extension-only rule.
- Keep DOM/CSS names defensive. The live Chrome Web Store extension can run at the same time during testing, so avoid generic wrapper classes like `bloxodes-panel`; use the stable root id and scoped selectors.
- Extension-owned logo assets are copied from `apps/web/public` into `dist/brand` and exposed through `web_accessible_resources`.
- Build with `npm run build:extension` from the repo root.
- Create the shared Chrome Web Store and Microsoft Edge Add-ons archive with `npm run package:extension`.

## Current Behavior

- Runs on `https://www.roblox.com/games/*` and `https://web.roblox.com/games/*`.
- Calls the Bloxodes codes and player-history extension API routes from the background service worker.
- Sends the public Roblox place ID and visible game name; the API keeps `robloxUrl` only as a compatibility fallback for older installed clients.
- Shows up to three active codes and links to the full Bloxodes codes page.
- Shows a seven-day player-count graph below Roblox's native game statistics for tracked games.
- Requests verified discovery for unknown place IDs so the normal `NEW` universe stats workflow can begin collecting history.
- Opens a toolbar popup with independent Active codes and Player history toggles.
- Offers optional Roblox sign-in in the toolbar popup and syncs used-code progress with the website through Bloxodes account APIs.
- Copying a code marks it used; used codes can be struck or restored from either the extension or website.
- Uses the Roblox page theme to switch light/dark panel colors and inline Bloxodes logo variant.
- The footer CTA should read `Open full list on` plus the small Bloxodes wordmark.
