# Bloxodes Platform Expansion Plan

Last updated: 2026-05-03

This document is the start-to-finish plan for expanding Bloxodes from the current Next.js web app into a monorepo with:

- Public web app
- Admin app
- Chrome extension
- React Native mobile apps for iOS and Android
- Shared packages for API contracts, types, validation, and utilities
- Dokploy deployment updates for the web and admin apps

The main recommendation is:

1. Recover and rebuild the Chrome extension first.
2. Convert the existing repo into a monorepo gradually.
3. Keep the public web deployment stable while moving it into `apps/web`.
4. Add admin as a separate deployable web app.
5. Add React Native mobile after the shared API and auth model are stable.

## Current Situation

The current repository is a single Next.js App Router application for Bloxodes.

Important existing facts:

- The public site is already live and deployed.
- Dokploy is used for deployment.
- The Chrome extension already has a live Chrome Web Store listing.
- The live Chrome extension ID is `mammkedlehmpechknaicfakljaogcmhc`.
- The old GitHub repo has version 1 source: `https://github.com/RaviTejaKNTS/roblox-codes-extension`.
- The live Chrome Web Store listing appears to be version 3.0.0 in third-party metadata, while the Chrome Web Store page previously exposed version 2.0.0 in search results. Treat the store/dashboard as the source of truth before shipping.
- Source code for extension versions 2 and 3 is missing.

## Decision Summary

Use a monorepo.

Do not create separate repositories for admin, extension, or mobile unless a future team, security, or open-source boundary makes that necessary.

Recommended target layout:

```txt
Bloxodes/
  apps/
    web/
    admin/
    extension/
    mobile/
  packages/
    api-client/
    config/
    database-types/
    shared/
    ui/
  docs/
  scripts/
  supabase/
  data/
```

Recommended deployment ownership:

```txt
apps/web        -> Dokploy app: bloxodes-web
apps/admin      -> Dokploy app: bloxodes-admin
apps/extension  -> Chrome Web Store package, not Dokploy
apps/mobile     -> Expo EAS / App Store / Google Play, not Dokploy
packages/*      -> built into whichever app imports them
```

## Why Monorepo

The Bloxodes apps will share the same product language:

- Roblox games
- Codes
- Catalog pages
- Tools
- Wiki pages
- Checklists
- Quizzes
- Lists
- Events
- Users
- Auth/session state
- Analytics events
- Supabase row types
- API response shapes
- Slug and URL helpers

A monorepo keeps those definitions in one place. That matters because the extension, mobile apps, admin, and public site should not slowly develop four different versions of "game", "code", "quiz", or "catalog".

## Recommended Work Order

### Phase 1: Chrome Extension Recovery

Start here because the extension is already live and has existing users.

Goals:

- Regain source control over the live extension.
- Keep the same Chrome Web Store listing and extension ID.
- Rebuild cleanly instead of trying to perfectly recreate missing v2/v3 source.
- Ship the next version as a controlled update to existing users.

Why this comes first:

- The extension already has distribution.
- Missing source creates operational risk.
- A Chrome Web Store update can reach existing users automatically if the same listing is used.
- Extension APIs and permission choices will influence shared API design.

### Phase 2: Monorepo Foundation

Goals:

- Introduce `apps/` and `packages/`.
- Move the current Next.js site into `apps/web`.
- Keep production deployment working during and after the move.
- Add shared packages only where they solve real duplication.

### Phase 3: Admin App

Goals:

- Build private operational tools for content, verification, imports, review, and publishing.
- Deploy admin as a separate Dokploy app with separate domain and stricter auth.
- Keep admin off the public app's routing surface.

### Phase 4: Mobile App

Goals:

- Build React Native app with Expo.
- Target iOS and Android from one codebase.
- Use safe Bloxodes APIs, not direct broad Supabase access.
- Ship only after the API contract is stable.

## Target Monorepo Layout

```txt
Bloxodes/
  apps/
    web/
      src/
      public/
      next.config.mjs
      package.json
      Dockerfile
    admin/
      src/
      public/
      next.config.mjs
      package.json
      Dockerfile
    extension/
      src/
      public/
      manifest.json
      package.json
      vite.config.ts
      README.md
    mobile/
      app/
      assets/
      src/
      app.json
      eas.json
      package.json
  packages/
    api-client/
      src/
      package.json
    config/
      eslint/
      tsconfig/
      tailwind/
      package.json
    database-types/
      src/
      package.json
    shared/
      src/
      package.json
    ui/
      src/
      package.json
  docs/
  scripts/
  supabase/
  data/
  package.json
  package-lock.json
  tsconfig.base.json
```

## Package Manager Recommendation

The current repo uses npm and has `package-lock.json`. To reduce migration risk, start with npm workspaces.

Root `package.json` after migration:

```json
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "build:web": "npm run build -w apps/web",
    "start:web": "npm run start -w apps/web",
    "dev:admin": "npm run dev -w apps/admin",
    "build:admin": "npm run build -w apps/admin",
    "dev:extension": "npm run dev -w apps/extension",
    "build:extension": "npm run build -w apps/extension",
    "dev:mobile": "npm run start -w apps/mobile",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

Later, pnpm or Turborepo can be added if builds get slow. Do not add Turborepo on day one unless there is a clear need.

## Shared Package Responsibilities

### `packages/shared`

Use for framework-neutral logic:

- Slug helpers
- Date formatting helpers that do not depend on React
- Constants for routes and content types
- Zod schemas
- API response types
- Analytics event names
- Platform feature flags

Avoid:

- Next.js imports
- React Native imports
- Browser extension APIs
- Supabase admin client

### `packages/api-client`

Use for typed clients called by web, admin, extension, and mobile.

Example responsibilities:

- `getCodesForRobloxPlace(placeId)`
- `searchBloxodes(query)`
- `getGameCodes(slug)`
- `getCatalogPage(code)`
- `getMobileHomeFeed()`
- `getExtensionPanelData({ robloxUrl, placeId, gameName })`

This package should call Bloxodes API routes, not Supabase directly.

### `packages/database-types`

Use for generated Supabase/database types.

Keep this as types only when possible. Runtime database access should stay in app/server code.

### `packages/ui`

Add this only when admin and web actually share enough UI.

Do not rush this package. Shared UI can become heavy if it tries to satisfy web, admin, mobile, and extension at the same time. Web/admin can share React UI; mobile and extension usually need their own UI.

### `packages/config`

Use for shared TypeScript, linting, Prettier, and Tailwind config.

## Monorepo Migration Procedure

### Step 1: Prepare a branch

```bash
git checkout -b codex/monorepo-platform-foundation
```

### Step 2: Create app and package folders

```txt
apps/
packages/
```

### Step 3: Move the current web app into `apps/web`

Move these current root files/folders into `apps/web`:

```txt
src/
public/
types/
assets/
next.config.*
postcss.config.*
tailwind.config.*
tsconfig.json
middleware.ts, if present
```

Keep these at repo root:

```txt
docs/
scripts/
supabase/
data/
agents/
AGENTS.md
DESIGN.md
package.json
package-lock.json
```

Important: scripts that read `src/`, `data/`, or `public/` may need path updates after the move.

### Step 4: Update TypeScript aliases

In `apps/web/tsconfig.json`, `@/*` should resolve to the web app source:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@bloxodes/shared": ["../../packages/shared/src"],
      "@bloxodes/api-client": ["../../packages/api-client/src"]
    }
  }
}
```

### Step 5: Update Next config for standalone Docker builds

In `apps/web/next.config.mjs`, use standalone output:

```js
const nextConfig = {
  output: "standalone"
};

export default nextConfig;
```

If the app imports local packages outside `apps/web`, configure Next to transpile them:

```js
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@bloxodes/shared", "@bloxodes/api-client"]
};

export default nextConfig;
```

### Step 6: Update scripts

Root package scripts should call workspaces.

`apps/web/package.json` should contain app-specific scripts:

```json
{
  "name": "@bloxodes/web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

### Step 7: Run verification locally

```bash
npm install
npm run typecheck
npm run build:web
npm run dev:web
```

### Step 8: Deploy web from monorepo

Use the Dokploy procedure below.

## Dokploy Deployment Plan

Dokploy can work with a monorepo. The important choice is how the build sees shared packages.

There are two realistic options:

1. Dockerfile build from repo root context
2. Nixpacks/Railpack build with app path and custom commands

Recommended production option: Dockerfile build from repo root context.

## Dokploy Option A: Dockerfile From Repo Root

Use this for production.

Recommended Dokploy settings for public web:

```txt
Application name: bloxodes-web
Source: Git repository
Branch: main
Build type: Dockerfile
Docker Context Path: .
Dockerfile Path: apps/web/Dockerfile
Port: 3000
```

Recommended watch paths:

```txt
apps/web/**
packages/shared/**
packages/api-client/**
packages/database-types/**
package.json
package-lock.json
```

Do not redeploy web when only these change:

```txt
apps/mobile/**
apps/extension/**
apps/admin/**
docs/**
```

### Example `apps/web/Dockerfile`

This assumes npm workspaces and Next standalone output.

```Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/database-types/package.json packages/database-types/package.json

RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build -w apps/web

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
```

This Dockerfile may need adjustment based on the actual `.next/standalone` output after migration. Verify locally before changing production.

## Dokploy Option B: Nixpacks or Railpack

Use this only if you want simpler setup and do not need full Docker control.

Possible Dokploy settings:

```txt
Build path: apps/web
Build type: Nixpacks or Railpack
```

Potential environment overrides:

```txt
NIXPACKS_INSTALL_CMD=npm ci
NIXPACKS_BUILD_CMD=npm run build -w apps/web
NIXPACKS_START_CMD=npm run start -w apps/web
```

Risk: if the build path is only `apps/web`, the build may not see `packages/*`. If web imports shared packages, prefer Dockerfile with root context.

## Dokploy Admin Deployment

Admin should be a separate Dokploy application.

Recommended settings:

```txt
Application name: bloxodes-admin
Build type: Dockerfile
Docker Context Path: .
Dockerfile Path: apps/admin/Dockerfile
Port: 3000
Domain: admin.bloxodes.com or internal/admin-only domain
```

Recommended watch paths:

```txt
apps/admin/**
packages/shared/**
packages/api-client/**
packages/database-types/**
packages/ui/**
package.json
package-lock.json
```

Admin should have separate environment variables from public web.

Admin-specific env examples:

```txt
NEXT_PUBLIC_SITE_URL=https://admin.bloxodes.com
NEXT_PUBLIC_PUBLIC_SITE_URL=https://bloxodes.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_ALLOWED_EMAILS=...
ROBLOX_OAUTH_CLIENT_ID=...
ROBLOX_OAUTH_CLIENT_SECRET=...
```

Security notes:

- Do not expose service role keys to client components.
- Keep admin operations server-side.
- Require strong auth for all admin routes.
- Add role checks, not just login checks.
- Rate-limit mutation APIs.
- Log important content changes.
- Keep public `/api/revalidate` flows explicit.

## Environment Variable Strategy

Use separate env groups:

```txt
web production
web staging
admin production
admin staging
extension build
mobile development
mobile production
supabase functions
scripts/local
```

Never share admin env values with public web, extension, or mobile.

Public app may use:

```txt
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
REVALIDATE_SECRET
```

Extension should not contain privileged secrets.

Mobile should not contain privileged secrets.

Admin can use privileged secrets, but only on server-side routes/actions.

## Chrome Extension Plan

### Current Extension Assets

Known URLs:

- Old v1 GitHub repo: `https://github.com/RaviTejaKNTS/roblox-codes-extension`
- Live Chrome listing: `https://chromewebstore.google.com/detail/bloxodes-%E2%80%93-roblox-game-co/mammkedlehmpechknaicfakljaogcmhc`
- Live extension ID: `mammkedlehmpechknaicfakljaogcmhc`

Recommendation:

- Keep the same Chrome Web Store listing.
- Do not create a new listing.
- Rebuild source cleanly in `apps/extension`.
- Upload the next version to the existing listing so existing users receive an automatic update.

### Extension Recovery Procedure

1. Download the live extension CRX or installed extension files.
2. Extract the current live manifest, icons, bundled scripts, and CSS.
3. Save the extracted bundle as a reference artifact, not as primary source.
4. Compare extracted manifest with the v1 GitHub repo.
5. Rebuild clean source with the current product behavior.
6. Ship as the next version.

Possible local Chrome installed extension path on macOS:

```txt
~/Library/Application Support/Google/Chrome/Default/Extensions/mammkedlehmpechknaicfakljaogcmhc/
```

There may be profile-specific folders, for example:

```txt
~/Library/Application Support/Google/Chrome/Profile 1/Extensions/mammkedlehmpechknaicfakljaogcmhc/
```

If installed locally, copy the extension version folder into a private archive:

```txt
archives/extension-live-3.0.0/
```

Do not publish extracted/minified code as the long-term source. Use it only to understand behavior.

### Extension Target Features

Minimum rebuild scope:

- Detect Roblox game detail pages.
- Support both `www.roblox.com` and `web.roblox.com`.
- Extract Roblox place ID from URL/page.
- Send page context to a Bloxodes API endpoint.
- Show an injected Bloxodes panel on Roblox game pages.
- Display active codes.
- Copy code button.
- Link to full Bloxodes code page.
- Loading, empty, error, and retry states.
- Minimal permissions.
- No personal data collection.

Nice-to-have after recovery:

- Popup UI showing current page status.
- Options page for toggles.
- "Open Bloxodes page" action.
- Lightweight caching to reduce API calls.
- Event tracking that avoids collecting personal data.
- Support for game pages whose Roblox DOM changes.

### Extension Architecture

```txt
apps/extension/
  src/
    background/
      service-worker.ts
    content/
      inject-panel.ts
      roblox-page.ts
      styles.css
    popup/
      Popup.tsx
      popup.html
    options/
      Options.tsx
      options.html
    shared/
      extension-api.ts
      messaging.ts
  public/
    icons/
  manifest.json
  package.json
  vite.config.ts
```

### Extension API Design

Create a public API route in Bloxodes specifically for the extension.

Suggested endpoint:

```txt
POST /api/extension/roblox-game-codes
```

Request:

```json
{
  "robloxUrl": "https://www.roblox.com/games/123456/Game-Name",
  "placeId": "123456",
  "gameName": "Game Name",
  "extensionVersion": "4.0.0"
}
```

Response:

```json
{
  "matched": true,
  "game": {
    "name": "Game Name",
    "slug": "game-name",
    "url": "https://bloxodes.com/codes/game-name"
  },
  "codes": [
    {
      "code": "REWARD123",
      "reward": "Coins",
      "isNew": true
    }
  ],
  "activeCount": 1,
  "updatedAt": "2026-05-03T00:00:00.000Z"
}
```

Security rules:

- Do not expose Supabase service role keys.
- Validate request origin where practical.
- Rate-limit by IP/user agent.
- Return only data needed by the extension.
- Do not require user login for basic code lookup.
- Do not collect Roblox usernames unless a future feature explicitly needs it and privacy policy is updated.

### Manifest Permissions

Keep permissions minimal.

Likely manifest v3 permissions:

```json
{
  "manifest_version": 3,
  "name": "Bloxodes - Roblox Game Codes",
  "version": "4.0.0",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.roblox.com/*",
    "https://web.roblox.com/*",
    "https://bloxodes.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.roblox.com/games/*",
        "https://web.roblox.com/games/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ]
}
```

Use real Chrome Web Store requirements at submission time.

### Extension Versioning

Because the live version is ahead of the repo, do not upload `1.x`.

Recommended next version:

- If live dashboard says `3.0.0`, ship `3.1.0` for a small rebuild/update.
- Ship `4.0.0` if the implementation is a full rewrite with meaningful behavior changes.

Before upload:

- Confirm current version in Chrome Web Store dashboard.
- Set `manifest.json` version greater than current live version.
- Set `package.json` version to match.
- Build extension.
- Load unpacked in Chrome.
- Test on multiple Roblox game pages.
- Upload ZIP to the same Chrome Web Store listing.

### Extension Build Procedure

```bash
npm install
npm run build -w apps/extension
```

Expected output:

```txt
apps/extension/dist/
```

Manual test:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select `apps/extension/dist`.
5. Open a Roblox game page.
6. Confirm the Bloxodes panel appears.
7. Copy a code.
8. Click through to Bloxodes.
9. Test a game with no match.
10. Test network failure behavior.

Package:

```bash
cd apps/extension/dist
zip -r ../bloxodes-extension-4.0.0.zip .
```

Chrome Web Store:

1. Open developer dashboard.
2. Select existing Bloxodes extension listing.
3. Upload the new ZIP.
4. Confirm permissions and privacy disclosure.
5. Update screenshots if UI changed.
6. Submit for review.

## Admin App Plan

Admin should be a private Next.js app in `apps/admin`.

### Admin MVP Scope

Start with operational workflows that save the most time:

- Login and role gate.
- Content dashboard.
- Games table.
- Codes table.
- Code verification status.
- Recent updates.
- Revalidation controls.
- Import job status.
- Article/checklist/wiki/quiz publish status.

### Admin Later Scope

- Bulk code updates.
- Code expiration workflow.
- Source URL review.
- Editorial assignments.
- Data quality warnings.
- Roblox universe enrichment status.
- Extension API monitoring.
- Mobile feed management.
- Manual cache purge.
- Audit log.

### Admin Security

Admin must not be public-by-accident.

Rules:

- Require authenticated user.
- Require admin role.
- Server-side role checks for every mutation.
- Validate origin for mutation routes.
- Rate-limit mutation routes.
- Keep service role key server-only.
- Log high-impact actions.
- Avoid exposing raw database errors.

## Mobile App Plan

Build with React Native using Expo.

Recommended location:

```txt
apps/mobile/
```

Recommended stack:

- Expo
- TypeScript
- Expo Router
- React Query or TanStack Query
- `@bloxodes/api-client`
- NativeWind only if it proves useful
- EAS Build
- EAS Submit

Do not start mobile before extension recovery and basic shared API work are done.

### Mobile App MVP

Start simple:

- Home feed
- Search
- Codes index
- Code detail page
- Catalog index
- Tools index
- Wiki index
- Quizzes index
- Saved/favorite games locally
- Push notification foundation, optional

### Mobile API Rule

Mobile should call Bloxodes APIs.

Mobile should not use broad Supabase keys or privileged database access.

Possible endpoint families:

```txt
GET /api/mobile/home
GET /api/mobile/search?q=
GET /api/mobile/codes
GET /api/mobile/codes/:slug
GET /api/mobile/catalog
GET /api/mobile/wiki
GET /api/mobile/quizzes
POST /api/mobile/session
```

### Mobile Auth

Options:

1. No login for MVP
2. Roblox login later
3. Bloxodes account/session later

Recommendation:

- MVP should work without login.
- Add login only when there is a clear user benefit:
  - favorites sync
  - checklist progress sync
  - quiz history
  - code progress
  - notifications

### iOS Procedure

1. Create Apple Developer account if not already done.
2. Create bundle identifier, for example `com.bloxodes.app`.
3. Configure app icon and splash screen.
4. Configure privacy nutrition labels.
5. Configure EAS project.
6. Build:

```bash
npm run build:ios -w apps/mobile
```

or:

```bash
cd apps/mobile
eas build --platform ios
```

7. Submit to TestFlight.
8. Test on real devices.
9. Submit to App Store review.

### Android Procedure

1. Create Google Play Console app.
2. Use package name, for example `com.bloxodes.app`.
3. Configure app signing.
4. Configure data safety form.
5. Build:

```bash
cd apps/mobile
eas build --platform android
```

6. Submit internal testing build.
7. Test on real devices.
8. Submit production release.

### Mobile Release Channels

Use:

```txt
development
preview
production
```

Keep API base URLs explicit per channel:

```txt
development -> http://localhost:3000 or staging URL
preview     -> https://staging.bloxodes.com
production  -> https://bloxodes.com
```

## API Strategy For All Clients

The web app can keep server-side direct Supabase reads.

Admin can use server-side privileged access.

Extension and mobile should call public or authenticated Bloxodes APIs.

Shared API layers:

```txt
src/app/api/extension/*
src/app/api/mobile/*
src/app/api/admin/*
packages/api-client
packages/shared
```

Rules:

- Validate all inputs.
- Return stable typed JSON.
- Version critical APIs if extension/mobile depend on them.
- Avoid breaking extension APIs without backward compatibility.
- Rate-limit extension and mobile APIs.
- Use cache headers where safe.
- Keep response payloads small.

## Deployment Matrix

| App | Location | Deploy Target | Deployment Tool |
| --- | --- | --- | --- |
| Public web | `apps/web` | `https://bloxodes.com` | Dokploy |
| Admin | `apps/admin` | `https://admin.bloxodes.com` | Dokploy |
| Chrome extension | `apps/extension` | Chrome Web Store | Chrome Developer Dashboard |
| iOS app | `apps/mobile` | App Store | Expo EAS + App Store Connect |
| Android app | `apps/mobile` | Google Play | Expo EAS + Play Console |
| Supabase functions | `supabase/functions` | Supabase | Supabase CLI |

## Branching and Release Strategy

Recommended branches:

```txt
main
codex/extension-recovery
codex/monorepo-foundation
codex/admin-app
codex/mobile-app
```

Release order:

1. Extension recovery branch
2. Monorepo foundation branch
3. Admin MVP branch
4. Mobile MVP branch

Do not combine extension recovery and full monorepo migration in one massive release unless necessary. The extension needs speed and control.

## Testing Plan

### Web

```bash
npm run typecheck -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

Browser checks:

- Homepage
- Codes index
- Codes detail
- Catalog
- Tools
- Wiki
- Quizzes
- Checklists
- Lists
- Events
- Search

### Admin

Test:

- Auth required.
- Non-admin blocked.
- Mutations validate origin.
- Mutations revalidate tags/paths.
- Audit log created where needed.

### Extension

Test:

- Chrome loaded unpacked.
- `www.roblox.com/games/*`
- `web.roblox.com/games/*`
- Matching game with active codes.
- Matching game with no active codes.
- No matching game.
- API failure.
- Copy button.
- Bloxodes link.
- No console errors.

### Mobile

Test:

- iOS simulator
- Android emulator
- Real iPhone
- Real Android
- Slow network
- Offline/empty states
- Deep links
- App store privacy requirements

## Migration Risks

### Risk: Dokploy build breaks after moving to `apps/web`

Mitigation:

- Add Dockerfile with repo root context.
- Test Docker build locally.
- Keep current deployment unchanged until monorepo branch builds successfully.
- Use staging Dokploy app before production cutover.

### Risk: shared package imports fail in Next build

Mitigation:

- Add `transpilePackages` in Next config.
- Keep package outputs simple.
- Avoid complex build steps in shared packages at first.

### Risk: extension update breaks existing users

Mitigation:

- Rebuild against current behavior.
- Test locally on multiple Roblox pages.
- Use minimal permissions.
- Keep API backward compatible.
- Ship a small version first if possible.

### Risk: mobile app duplicates too much web logic

Mitigation:

- Use `packages/api-client`.
- Use API endpoints designed for mobile payloads.
- Avoid sharing web React UI with mobile.

### Risk: admin exposes privileged operations

Mitigation:

- Separate Dokploy app.
- Separate env.
- Server-only service role key.
- Explicit role checks.
- Audit logs.

## Suggested Timeline

### Week 1: Extension Recovery

- Extract live extension if possible.
- Compare with v1 GitHub repo.
- Create `apps/extension`.
- Build clean MV3 extension.
- Create extension API endpoint.
- Manual test.
- Submit update to existing listing.

### Week 2: Monorepo Foundation

- Create workspace structure.
- Move web into `apps/web`.
- Add initial shared packages.
- Update scripts.
- Add Dockerfile.
- Deploy staging on Dokploy.
- Cut production Dokploy over after staging passes.

### Week 3: Admin MVP

- Create `apps/admin`.
- Add auth/role gate.
- Add first operational dashboards.
- Deploy admin in Dokploy.
- Restrict domain/access.

### Week 4+: Mobile MVP

- Create Expo app.
- Add API client.
- Build basic browse/search/codes flows.
- Test on devices.
- Prepare store metadata.

## Open Questions To Confirm Later

These do not block starting the extension recovery.

1. What is the exact current version in the Chrome Web Store developer dashboard?
2. Is the live extension installed on any local Chrome profile so we can extract its current files?
3. Do you want the next extension version to be `3.1.0` or `4.0.0`?
4. Should admin auth use Roblox login, email allowlist, or both?
5. Do you want mobile MVP to include login, or should it be browse-only first?
6. Should Android be released alongside iOS or after iOS is stable?

## Immediate Next Actions

Recommended next action:

1. Create a branch for extension recovery.
2. Add `apps/extension`.
3. Archive the v1 GitHub repo contents into the new monorepo as the starting reference.
4. Try to extract the live extension from Chrome or download the CRX.
5. Design the extension API endpoint.
6. Rebuild and test the extension locally.
7. Submit the next version to the same Chrome Web Store listing.

After the extension is safe, start the monorepo migration and Dokploy staging deployment.
