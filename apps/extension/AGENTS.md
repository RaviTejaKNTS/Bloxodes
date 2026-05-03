# Chrome Extension Guide

Scope: everything under `apps/extension`.

This app builds the Bloxodes Chrome Web Store extension. It is separate from the production web build; root `npm run build` must remain the web-only Dokploy build.

## Shape

- `manifest.json`: Chrome MV3 manifest for the store package.
- `src/background.ts`: background service worker that calls Bloxodes API endpoints.
- `src/content.ts`: Roblox game-page injector.
- `styles.css`: isolated panel styles, all scoped under `#bloxodes-codes-extension`.
- `scripts/`: local build and packaging helpers.

## Rules

- Keep permissions minimal. The extension should only match Roblox game pages and call Bloxodes extension API routes.
- Do not put Supabase keys or private API keys in the extension.
- Prefer the Bloxodes web app API over direct database or Supabase Edge Function calls.
- Keep the injected UI small, readable, and close to the active-codes card on the site.
- Show only a preview in Roblox; link users to Bloxodes for the complete list.
- Build with `npm run build:extension` from the repo root.
- Create the Chrome Web Store archive with `npm run package:extension`.
