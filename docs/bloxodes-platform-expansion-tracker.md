# Bloxodes Platform Expansion Tracker

Progress: **0/346 tasks complete**

Last updated: 2026-04-30

Goal: add the Bloxodes Chrome extension and a React Native Android/iOS app to this repository without changing production website behavior, SEO, Dokploy deployment, Cloudflare behavior, scheduled GitHub automations, or Supabase production data flows until each change is explicitly approved and verified.

## Tracker Rules

- [ ] Update the progress number at the top whenever tasks are checked off.
- [ ] Keep this file as the source of truth for the platform-expansion project.
- [ ] Add new tasks here before doing work that is not already represented.
- [ ] Do not delete completed tasks; mark them with `[x]` and add short notes if useful.
- [ ] Treat website behavior, SEO output, deployment config, and automation jobs as production-sensitive surfaces.
- [ ] Keep unrelated local changes out of platform-expansion pull requests.

## Current Facts To Preserve

- Current website repo deploys from the root through Dokploy/GitHub.
- Root [Dockerfile](../Dockerfile) runs `npm ci` and `npm run build` from the repo root.
- Root [compose.yml](../compose.yml) builds with context `.` and expects `.env.production`.
- GitHub production deploy is triggered from `.github/workflows/dokploy-production-deploy.yml` on the `production` branch.
- Existing GitHub automation workflows assume root `npm ci` and root `npm run ...` scripts.
- Root `tsconfig.json` currently includes `**/*.ts` and `**/*.tsx`, so new TypeScript files outside `src/` can accidentally affect the Next.js production build.
- The public Chrome extension repo is [RaviTejaKNTS/roblox-codes-extension](https://github.com/RaviTejaKNTS/roblox-codes-extension).
- The Chrome Web Store listing is [Bloxodes - Roblox Game Codes](https://chromewebstore.google.com/detail/bloxodes-%E2%80%93-roblox-game-co/mammkedlehmpechknaicfakljaogcmhc).
- Store listing observed on 2026-04-30: name `Bloxodes - Roblox Game Codes`, version `2.0.0`, updated `December 2, 2025`, size `29.27KiB`, category `Tools`, users `29`, privacy disclosure says no data collection.
- Public GitHub repo observed on 2026-04-30: 3 commits, MV3 extension files at root, README generated on `2025-10-29T21:16:09.483552`.
- Public GitHub repo version mismatch observed on 2026-04-30: `manifest.json` says `2.0.0`, while `package.json` says `2.1.0`.

## Recommended End State

```txt
Bloxodes/
  src/                         # existing production Next.js website stays in place
  scripts/                     # existing automations stay in place
  supabase/                    # existing DB and edge functions stay in place
  Dockerfile                   # website deploy remains root-compatible
  compose.yml                  # website deploy remains root-compatible
  package.json                 # root scripts remain compatible
  package-lock.json

  apps/
    extension/                 # Chrome extension source, build, package artifact scripts
    mobile/                    # React Native Android/iOS app

  packages/
    contracts/                 # shared schemas/types, browser-safe only
    api-client/                # shared public API client, browser-safe only
    config/                    # shared tsconfig/eslint/prettier config if added later
```

Important boundary: shared packages may contain API contracts, validation schemas, constants, browser-safe utility functions, and fetch clients. They must not import website server internals, Supabase service-role clients, Next-only APIs, or Node-only modules unless the package is explicitly server-only and never bundled into extension/mobile.

## Phase 1 - Production Safety Baseline

- [ ] Record the current production branch name and Dokploy app/service name.
- [ ] Record the current Dokploy build type, Dockerfile path, Docker context path, compose file path, and configured branch.
- [ ] Export or screenshot current Dokploy environment variables without committing secrets.
- [ ] Record current GitHub repository secrets and variables names used by deployment and automations without exposing values.
- [ ] Confirm the website currently deploys from root `Dockerfile`.
- [ ] Confirm the website currently runs with root `compose.yml`.
- [ ] Confirm `/api/health` returns 200 in production before changes.
- [ ] Capture production response headers for `/`, `/codes`, `/articles`, `/robots.txt`, `/sitemap.xml`, and `/feed.xml`.
- [ ] Save a baseline copy of production `/robots.txt`.
- [ ] Save a baseline copy of production `/sitemap.xml`.
- [ ] Save a baseline copy of production `/feed.xml`.
- [ ] Save baseline HTML metadata for `/`, `/codes`, `/articles`, `/tools`, `/catalog`, and one representative detail page.
- [ ] Save baseline JSON-LD snippets for representative public pages.
- [ ] Save baseline canonical URLs for representative public pages.
- [ ] Save baseline `X-Robots-Tag` behavior for production host and non-production host.
- [ ] Save baseline Cloudflare cache behavior for public pages if Cloudflare is active.
- [ ] Run current root `npm ci` on a clean checkout.
- [ ] Run current root `npm run build` before adding platform folders.
- [ ] Run current root `npm test`.
- [ ] Document any existing failures before starting platform changes.
- [ ] Confirm current dirty worktree changes are unrelated or handled separately before starting.

## Phase 2 - Branching And Release Controls

- [ ] Create a dedicated branch such as `codex/platform-expansion`.
- [ ] Keep the platform branch away from the `production` branch until all validation tasks pass.
- [ ] Add a pull request checklist that links to this tracker.
- [ ] Require review before merging anything that touches root deploy files.
- [ ] Require review before merging anything that touches SEO routes, metadata helpers, sitemap routes, feed routes, proxy, middleware, or robots config.
- [ ] Require review before merging anything that touches Supabase production migrations or edge functions.
- [ ] Define rollback procedure for website deployment.
- [ ] Define rollback procedure for Chrome Web Store submission.
- [ ] Define rollback procedure for mobile beta releases.
- [ ] Decide whether platform work lands as one PR or staged PRs.
- [ ] Prefer staged PRs: repository scaffolding first, extension import second, mobile app third, shared packages fourth.

## Phase 3 - Monorepo Scaffolding Without Website Behavior Changes

- [ ] Decide whether to keep npm workspaces or move to another package manager.
- [ ] Prefer npm workspaces initially because the repo already uses `package-lock.json` and GitHub workflows cache npm.
- [ ] Add `apps/` directory.
- [ ] Add `packages/` directory.
- [ ] Add root workspace configuration only after confirming it does not change root website install/build behavior.
- [ ] Keep existing root `npm run build` behavior for the website.
- [ ] Keep existing root `npm run dev` behavior for the website.
- [ ] Keep existing root automation script names stable.
- [ ] Keep existing root `prebuild` behavior unless explicitly changed and validated.
- [ ] Prevent `apps/mobile` TypeScript files from being included in the Next.js website type check.
- [ ] Prevent `apps/extension` TypeScript or JavaScript config files from being included in the Next.js website type check if they cause build scope expansion.
- [ ] Update root `tsconfig.json` include/exclude or create app-specific tsconfigs without changing website compiler semantics.
- [ ] Add `apps/extension/AGENTS.md` with extension-specific build/release rules.
- [ ] Add `apps/mobile/AGENTS.md` with mobile-specific build/release rules.
- [ ] Add `packages/AGENTS.md` with shared package safety rules.
- [ ] Update root `AGENTS.md` to point to the new app/package guides.
- [ ] Ensure root `.dockerignore` keeps mobile native build outputs out of website Docker context.
- [ ] Ensure root `.dockerignore` keeps extension `dist/`, store zips, and temporary artifacts out of website Docker context unless intentionally needed.
- [ ] Ensure root `.gitignore` covers mobile build outputs, extension build outputs, and local platform caches.
- [ ] Run a clean root install after workspace scaffolding.
- [ ] Run root website build after workspace scaffolding.
- [ ] Compare website build output and public SEO output against baseline after scaffolding.

## Phase 4 - Chrome Extension Source Recovery

- [ ] Log in to the Chrome Web Store Developer Dashboard for extension `mammkedlehmpechknaicfakljaogcmhc`.
- [ ] Download the latest uploaded package for the currently live version if the dashboard provides it.
- [ ] Record the live store version, currently observed as `2.0.0`.
- [ ] Record the live store update date, currently observed as `December 2, 2025`.
- [ ] Record the live store item size, currently observed as `29.27KiB`.
- [ ] Export current store listing text, screenshots, privacy disclosures, support URL, and category settings.
- [ ] Export current store permissions and host permissions shown by the dashboard.
- [ ] Export current store package review status and rollout status.
- [ ] Verify whether the dashboard package matches the installed live extension files.
- [ ] If the dashboard package is unavailable, retrieve the installed extension files from a Chrome profile controlled by the owner.
- [ ] If installed files are retrieved, mark them as recovery artifacts and do not treat them as clean source until reviewed.
- [ ] Compare recovered live files against the public GitHub repo.
- [ ] Identify all differences between recovered live version and public GitHub source.
- [ ] Identify whether source maps or original unbundled source exist for the live package.
- [ ] Identify whether the live extension is minified/bundled and requires source reconstruction.
- [ ] Verify ownership and rights to move all recovered extension code/assets into this repo.
- [ ] Save a private archive of the recovered live package outside git.
- [ ] Save checksums for recovered live package files.
- [ ] Decide whether to import recovered source directly or reconstruct clean source from behavior.
- [ ] Do not publish a new extension until live behavior has been reproduced from repo source.

## Phase 5 - Chrome Extension GitHub Repo Audit

- [ ] Clone or inspect `RaviTejaKNTS/roblox-codes-extension`.
- [ ] Record latest commit SHA from the extension repo.
- [ ] Record all files and directories from the extension repo.
- [ ] Record extension repo `manifest.json` version.
- [ ] Record extension repo `package.json` version.
- [ ] Resolve the observed `manifest.json` `2.0.0` versus `package.json` `2.1.0` mismatch.
- [ ] Inspect `background.js` behavior.
- [ ] Inspect `content.js` behavior.
- [ ] Inspect `styles.css` behavior.
- [ ] Inspect `vite.config.mjs` build behavior.
- [ ] Inspect icon assets and dimensions.
- [ ] Inspect README setup and packaging instructions.
- [ ] Identify hard-coded Supabase URLs or Bloxodes URLs.
- [ ] Identify all permissions and host permissions.
- [ ] Identify all Roblox page selectors used for injection.
- [ ] Identify fallback selectors and failure states.
- [ ] Identify copy-to-clipboard behavior.
- [ ] Identify loading, no-code, and error UI states.
- [ ] Identify analytics, tracking, or data collection behavior if any.
- [ ] Confirm whether the public repo truly represents the live store behavior.
- [ ] Mark the public extension repo as deprecated after migration plan is approved.

## Phase 6 - Chrome Extension Import Into This Repo

- [ ] Create `apps/extension`.
- [ ] Import the best available source version into `apps/extension`.
- [ ] Preserve original commit history if practical using subtree, filter-repo, or a migration note.
- [ ] If preserving history is not practical, document source provenance in `apps/extension/README.md`.
- [ ] Add `apps/extension/package.json`.
- [ ] Add `apps/extension/package-lock.json` only if using independent lockfiles is chosen.
- [ ] If using one root lockfile, update root `package-lock.json` through npm workspace install.
- [ ] Add `apps/extension/manifest.json`.
- [ ] Add `apps/extension/src` or equivalent source directory if reconstructing from bundled files.
- [ ] Add `apps/extension/public` or `apps/extension/icons` for extension assets.
- [ ] Add extension build output directory to `.gitignore`.
- [ ] Add extension store package output directory to `.gitignore`.
- [ ] Add a build command for the extension.
- [ ] Add a package/zip command for Chrome Web Store upload.
- [ ] Add a clean command for extension build artifacts.
- [ ] Add extension README with local setup, build, load-unpacked, and release instructions.
- [ ] Add extension changelog.
- [ ] Add extension versioning rules.
- [ ] Ensure extension build is reproducible from a clean checkout.
- [ ] Ensure extension package artifact contains only store-allowed files.
- [ ] Ensure extension artifact excludes source maps unless intentionally approved.

## Phase 7 - Extension Runtime And API Contract

- [ ] Decide whether the extension continues using the existing Supabase Edge Function.
- [ ] Decide whether the extension should instead call a Bloxodes website API endpoint.
- [ ] If using Supabase Edge Function, document function URL and expected response contract.
- [ ] If using website API, design a public read-only endpoint with explicit rate limiting and cache headers.
- [ ] Ensure no Supabase service-role key or private key is bundled into the extension.
- [ ] Ensure extension host permissions are minimal.
- [ ] Ensure extension works on `https://www.roblox.com/games/*`.
- [ ] Ensure extension works on `https://web.roblox.com/games/*`.
- [ ] Ensure extension does not run on unrelated Roblox pages.
- [ ] Ensure extension does not inject duplicate panels during client-side Roblox navigation.
- [ ] Ensure extension handles Roblox DOM changes gracefully.
- [ ] Ensure extension handles no matching Bloxodes game.
- [ ] Ensure extension handles active codes.
- [ ] Ensure extension handles expired or likely expired codes according to product decision.
- [ ] Ensure extension handles network failure.
- [ ] Ensure extension handles API timeout.
- [ ] Ensure extension has a retry path.
- [ ] Ensure extension has accessible copy buttons.
- [ ] Ensure extension links back to the correct Bloxodes canonical code page.
- [ ] Ensure extension respects Chrome extension CSP.
- [ ] Ensure extension does not collect personal data unless privacy disclosure is updated and approved.
- [ ] Ensure extension privacy behavior matches Chrome Web Store disclosure.

## Phase 8 - Extension QA And Store Release

- [ ] Load unpacked extension in Chrome from the new repo build.
- [ ] Test on at least five Roblox game pages with known active codes.
- [ ] Test on at least five Roblox game pages with no Bloxodes match.
- [ ] Test on at least one `www.roblox.com` page.
- [ ] Test on at least one `web.roblox.com` page.
- [ ] Test dark and light Roblox UI if applicable.
- [ ] Test logged-in Roblox session.
- [ ] Test logged-out Roblox session.
- [ ] Test slow network.
- [ ] Test blocked API endpoint.
- [ ] Test copy-to-clipboard.
- [ ] Test Bloxodes link click.
- [ ] Test extension after Roblox client-side navigation.
- [ ] Verify extension console has no unexpected errors.
- [ ] Verify extension service worker has no unexpected errors.
- [ ] Compare new extension UI against live extension screenshots.
- [ ] Compare new extension behavior against currently installed live extension.
- [ ] Run extension build in CI.
- [ ] Produce Chrome Web Store zip artifact.
- [ ] Inspect zip artifact manually.
- [ ] Update Chrome Web Store listing only if release is approved.
- [ ] Upload a draft/new package in Chrome Web Store Developer Dashboard.
- [ ] Complete Chrome Web Store privacy questionnaire.
- [ ] Verify support URL and privacy policy URL still work.
- [ ] Submit for review only after owner approval.
- [ ] Archive submitted zip and checksum outside git.
- [ ] Tag the repo with the submitted extension version after approval.

## Phase 9 - Shared Contracts And Public API Layer

- [ ] Inventory all data the extension needs.
- [ ] Inventory all data the mobile app needs for version 1.
- [ ] Identify overlaps between web, extension, and mobile data needs.
- [ ] Create `packages/contracts` only after concrete shared contracts are known.
- [ ] Add browser-safe Zod schemas for shared API responses.
- [ ] Add TypeScript types derived from shared schemas.
- [ ] Add `packages/api-client` only if extension/mobile both need shared fetch logic.
- [ ] Ensure shared packages do not import `@/lib/db`, `@/lib/supabase`, or Next server modules.
- [ ] Ensure shared packages do not depend on Node-only APIs by default.
- [ ] Add tests for shared schema parsing.
- [ ] Add compatibility tests for extension API responses.
- [ ] Add compatibility tests for mobile API responses.
- [ ] Document semantic versioning expectations for shared contracts.
- [ ] Document how breaking API changes are rolled out across web, extension, and mobile.

## Phase 10 - React Native App Product Scope

- [ ] Decide whether mobile v1 is Expo or bare React Native.
- [ ] Prefer Expo unless a required native capability blocks it.
- [ ] Define mobile v1 target platforms: Android and iOS.
- [ ] Define mobile v1 user flows.
- [ ] Define whether mobile v1 includes login.
- [ ] Define whether mobile v1 includes saved games, progress, comments, or account features.
- [ ] Define whether mobile v1 is read-only for codes/catalog/articles.
- [ ] Define mobile navigation structure.
- [ ] Define mobile offline behavior.
- [ ] Define mobile push notification requirements.
- [ ] Define mobile analytics requirements.
- [ ] Define mobile privacy requirements.
- [ ] Define mobile ad/monetization requirements.
- [ ] Define mobile content policy requirements for App Store and Play Store.
- [ ] Define mobile minimum OS versions.
- [ ] Define mobile brand assets and app icon requirements.

## Phase 11 - React Native App Scaffolding

- [ ] Create `apps/mobile`.
- [ ] Initialize the mobile app with the approved framework.
- [ ] Add mobile TypeScript config isolated from website TypeScript config.
- [ ] Add mobile lint/typecheck command.
- [ ] Add mobile test command.
- [ ] Add mobile start command.
- [ ] Add Android build command.
- [ ] Add iOS build command.
- [ ] Add mobile environment variable convention.
- [ ] Add mobile README with setup instructions.
- [ ] Add mobile app configuration for Android package name.
- [ ] Add mobile app configuration for iOS bundle identifier.
- [ ] Add mobile app icons.
- [ ] Add mobile splash screen.
- [ ] Add mobile navigation shell.
- [ ] Add mobile API client wiring.
- [ ] Add mobile error boundary.
- [ ] Add mobile loading states.
- [ ] Add mobile empty states.
- [ ] Add mobile accessibility baseline.
- [ ] Ensure mobile app does not import website server-only code.
- [ ] Ensure mobile app can run independently of the website dev server when pointed at production/staging APIs.

## Phase 12 - Mobile Feature Implementation

- [ ] Implement home/discovery screen.
- [ ] Implement codes index screen.
- [ ] Implement game code detail screen.
- [ ] Implement search flow.
- [ ] Implement article/list/wiki/catalog entry points according to v1 scope.
- [ ] Implement code copy/share actions.
- [ ] Implement outbound links to Bloxodes web pages.
- [ ] Implement refresh/pull-to-refresh behavior.
- [ ] Implement API error states.
- [ ] Implement no-result states.
- [ ] Implement app update/version display.
- [ ] Implement settings/privacy screen.
- [ ] Implement support/contact link.
- [ ] Implement optional auth flow only if approved.
- [ ] Implement optional saved/favorite games only if approved.
- [ ] Implement optional notifications only if approved.

## Phase 13 - Mobile QA And Store Preparation

- [ ] Run mobile app on Android emulator.
- [ ] Run mobile app on a physical Android device.
- [ ] Run mobile app on iOS simulator.
- [ ] Run mobile app on a physical iOS device if available.
- [ ] Test cold start.
- [ ] Test navigation.
- [ ] Test search.
- [ ] Test code detail.
- [ ] Test copy/share behavior.
- [ ] Test network offline behavior.
- [ ] Test slow network behavior.
- [ ] Test app background/foreground behavior.
- [ ] Test small screen layout.
- [ ] Test large screen layout.
- [ ] Test dark/light mode if supported.
- [ ] Run mobile typecheck.
- [ ] Run mobile tests.
- [ ] Produce Android internal test build.
- [ ] Produce iOS TestFlight build.
- [ ] Prepare Play Store listing copy.
- [ ] Prepare App Store listing copy.
- [ ] Prepare screenshots for both stores.
- [ ] Prepare privacy nutrition/app data disclosures.
- [ ] Prepare support and privacy URLs.
- [ ] Submit only after owner approval.

## Phase 14 - Website API And Security Work

- [ ] Identify whether new public API endpoints are needed for extension/mobile.
- [ ] For each new endpoint, document method, path, request schema, response schema, cache policy, and rate limit.
- [ ] Validate all inputs with shared schemas or route-local schemas.
- [ ] Keep mutation endpoints out of v1 unless explicitly approved.
- [ ] Add origin validation for any mutation endpoint.
- [ ] Add rate limiting for public read endpoints if they can be abused.
- [ ] Add cache tags and revalidation behavior for content endpoints.
- [ ] Ensure new endpoints do not change existing page SEO.
- [ ] Ensure new endpoints do not change sitemap output unless intentionally approved.
- [ ] Ensure new endpoints do not change feed output unless intentionally approved.
- [ ] Ensure new endpoints do not expose private Supabase data.
- [ ] Ensure new endpoints do not require service-role credentials in clients.
- [ ] Add tests for endpoint validation.
- [ ] Add tests for endpoint response shape.
- [ ] Add smoke checks for endpoint cache headers.

## Phase 15 - CI, Build, And Dokploy Compatibility

- [ ] Keep existing Dokploy production deploy workflow unchanged until a separate deploy validation PR.
- [ ] Keep root `Dockerfile` compatible with current website deploy.
- [ ] Keep root `compose.yml` compatible with current website deploy.
- [ ] Keep root `npm run build` as the website production build.
- [ ] Add separate CI job for extension build.
- [ ] Add separate CI job for mobile typecheck/tests.
- [ ] Add separate CI job for shared package tests.
- [ ] Ensure scheduled GitHub automation workflows continue to use root scripts successfully.
- [ ] Ensure npm workspace caching works in GitHub Actions.
- [ ] Ensure root Docker image does not copy unnecessary mobile/extension build artifacts.
- [ ] Confirm root Docker build still succeeds from a clean checkout.
- [ ] Confirm root Docker container still serves `/api/health`.
- [ ] Confirm Cloudflare purge/warm workflow still runs after deploy.
- [ ] Add optional path filters so extension/mobile-only changes do not deploy website unless desired.
- [ ] If path filters are added, test that website changes still trigger deploy.
- [ ] If path filters are added, test that extension/mobile-only changes skip Dokploy deploy.
- [ ] Document Dokploy behavior after monorepo scaffold.

## Phase 16 - SEO And Production Regression Gates

- [ ] Compare `/robots.txt` before and after scaffold.
- [ ] Compare `/sitemap.xml` before and after scaffold.
- [ ] Compare all `/sitemaps/*.xml` before and after scaffold.
- [ ] Compare `/feed.xml` before and after scaffold.
- [ ] Compare homepage metadata before and after scaffold.
- [ ] Compare representative detail page metadata before and after scaffold.
- [ ] Compare canonical URLs before and after scaffold.
- [ ] Compare Open Graph metadata before and after scaffold.
- [ ] Compare Twitter metadata before and after scaffold.
- [ ] Compare JSON-LD before and after scaffold.
- [ ] Compare production cache headers before and after scaffold.
- [ ] Compare production redirects before and after scaffold.
- [ ] Confirm no new public website routes were added unless explicitly intended.
- [ ] Confirm no public website route changed status code unexpectedly.
- [ ] Confirm no website robots/indexing behavior changed unexpectedly.
- [ ] Get explicit approval before merging any SEO-affecting diff.

## Phase 17 - Documentation And Ownership

- [ ] Document extension ownership and release account access.
- [ ] Document mobile app store ownership and release account access.
- [ ] Document who can approve Chrome Web Store submissions.
- [ ] Document who can approve Play Store submissions.
- [ ] Document who can approve App Store submissions.
- [ ] Document production deploy owner.
- [ ] Document emergency rollback contacts.
- [ ] Document where release artifacts are archived.
- [ ] Document where screenshots and store assets are archived.
- [ ] Document support email and support URL for all platforms.
- [ ] Document privacy policy coverage for web, extension, Android, and iOS.
- [ ] Update `agents/agents.md` with new app/package inventory.
- [ ] Update `agents/routes/agents.md` if new API endpoints are added.
- [ ] Update `agents/data/agents.md` if new data contracts or tables are added.
- [ ] Update `agents/scripts/agents.md` if new scripts are added.

## Phase 18 - Final Launch Checklist

- [ ] Website root build passes.
- [ ] Website Docker build passes.
- [ ] Website production SEO diff is approved.
- [ ] Extension build passes.
- [ ] Extension live behavior is matched or intentionally changed.
- [ ] Extension Web Store package is approved by owner.
- [ ] Mobile Android build passes.
- [ ] Mobile iOS build passes.
- [ ] Mobile app beta behavior is approved by owner.
- [ ] Shared package tests pass.
- [ ] CI passes for all affected workspaces.
- [ ] Release artifacts are archived.
- [ ] Rollback procedures are documented and tested where practical.
- [ ] Production branch merge is approved.
- [ ] Post-merge Dokploy deployment health check passes.
- [ ] Post-merge Cloudflare cache behavior is verified.
- [ ] Post-launch extension monitoring is scheduled.
- [ ] Post-launch mobile beta monitoring is scheduled.
- [ ] This tracker is updated with final completed count.
