# Page Inventory

Authoritative workflow guidance lives in:

- `apps/web/src/app/AGENTS.md`
- `apps/web/src/app/(site)/AGENTS.md`

This file is the route-family inventory for quick scanning.
After the monorepo move, older shorthand paths in this inventory that begin with `src/` refer to `apps/web/src/`.

## Shell And Global UI

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Global shell | all routes | `src/app/layout.tsx`, `src/app/globals.css` |
| Public shell | public pages | `src/app/(site)/layout.tsx` |
| Secure shell | signed-in UI | `src/app/(secure)/layout.tsx` |
| Not found | `404` | `src/app/(site)/not-found.tsx` |
| Home | `/` | `src/app/(site)/page.tsx` |
| Game platforms | `/games` | `src/app/(site)/games/page.tsx`; chooses between the established Roblox content surface and the GTA namespace. |
| Legacy slug redirect | `/{legacy-slug}` | `src/app/(site)/[slug]/page.tsx`, backed by `src/data/slug_oldslugs.json` |

## Secure Account UI

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Login | `/login` | `src/app/(secure)/login/page.tsx`, server actions in `src/app/(secure)/login/actions.ts`; fallback/deep-link surface because the primary shell entry is the account sheet. |
| Account | `/account` | `src/app/(secure)/account/page.tsx`; compact account details and sign-out surface, with the main shell account summary shown in the right sheet. |

## Core Content Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Codes | `/codes`, `/codes/page/[page]`, `/codes/[slug]` | `src/app/(site)/codes/*`, shared helpers in `src/app/(site)/codes/page-data.tsx`. Slugs are game slugs only, not `<game>-codes`; code rows come from `scripts/codes/update-codes.ts` using RobloxDen in `source_url` and Beebom in `source_url_2`. |
| Articles | `/articles`, `/articles/page/[page]`, `/articles/games/[slug]`, `/articles/games/[slug]/page/[page]`, `/articles/[slug]`, `/articles/[slug]/page/[page]` | `src/app/(site)/articles/*`, shared helpers in `src/app/(site)/articles/page-data.tsx`; game article hubs use `src/app/(site)/articles/games/[slug]/page-data.tsx` and send articles without `universe_id` to `/articles/games/roblox`; detail Markdown supports validated `tier-list`, `article-checklist`, reusable `roblox-game-card`, and `article-page-break` fenced blocks. Paginated article bodies keep the same Supabase row and render complete content sections per page. |
| Retired lists redirect | `/lists`, `/lists/*` | `src/app/(site)/lists/[[...slug]]/page.tsx`; old list URLs permanently redirect to `/stats` |
| Checklists | `/checklists`, `/checklists/page/[page]`, `/checklists/[slug]` | `src/app/(site)/checklists/*`, shared helpers in `src/app/(site)/checklists/page-data.tsx` |
| Events | `/events`, `/events/[slug]` | `src/app/(site)/events/*`, shared loaders in `src/app/(site)/events/page-data.tsx`, detail composition in `events/[slug]/events-page.tsx` |
| Quizzes | `/quizzes`, `/quizzes/[slug]` | `src/app/(site)/quizzes/*`, scoped guide in `src/app/(site)/quizzes/AGENTS.md`, shared helpers in `src/app/(site)/quizzes/page-data.tsx`. Use `$bloxodes-quiz-writing` for metadata, local question pools, and validation. Detail pages should keep the user in the quiz experience: use the page intro plus the interactive quiz, not a separate "what this quiz covers" about block. |
| Puzzles | `/puzzles`, `/puzzles/[slug]`, `/puzzles/[slug]/[date]` | `src/app/(site)/puzzles/*`, shared helpers in `src/app/(site)/puzzles/page-data.tsx`, read layer in `src/lib/puzzles.ts`, and synced answer rows in `puzzle_answers`. Current puzzle pages are indexable; dated archives are `noindex, follow`. |
| Wiki | `/wiki`, `/wiki/[slug]` | `src/app/(site)/wiki/*`, shared helpers in `page-data.tsx`, image-role resolver in `src/lib/wiki-images.ts`, and Supabase read layer in `src/lib/wiki.ts`; index cards/social previews use landscape universe thumbnails while detail title artwork uses the newest official square universe icon. |
| GTA | `/gta`, `/gta/wiki`, `/gta/wiki/[slug]`, `/gta/wiki/[slug]/[collection]`, paginated collection routes | `src/app/(site)/gta/*`, server-only read layer in `src/lib/gta.ts`, GTA-specific sidebar/search scope, and platform-owned `gta_*` tables; collection rendering reuses the generic Bloxodes wiki collection surface. GTA tools stay absent until a real tool is ready. |
| Authors | `/authors`, `/authors/[slug]` | `src/app/(site)/authors/*` |
| Stats | `/stats`, `/stats/roblox-platform`, `/stats/games`, `/stats/games/[slug]`, `/stats/creators`, `/stats/items`, `/stats/items/[assetId]` | `src/app/(site)/stats/*`, shared read layer in `src/lib/stats.ts`, chart UI in `stats/components/*`, backed by `roblox_universes`, stats current-index tables, platform aggregate tables, hourly/daily stats tables, rank snapshot tables, `roblox_catalog_items`, and item stats hourly/daily/resale tables. Games-list SEO indexes only the unfiltered CCU/visits/24h/7d pages plus valid genre/subgenre CCU and visits pages; other filter/sort variants are `noindex, follow`, while individual games use the bounded top-1,000 policy. |
| Monthly stats reports | `/stats/reports`, `/stats/reports/roblox-june-2026`, `/stats/reports/roblox-july-2026`, `/stats/reports/roblox-august-2026` | `src/app/(site)/stats/reports/*`, frozen data in the dated `src/data/reports/roblox-*.ts` modules, chart UI in the monthly report components, and static data-backed feature images in `public/images/reports/*`. June and July are published and linked from the Stats home and reports archive, included in the Stats sitemap and RSS feed, supported by stats report revalidation, and carry article, breadcrumb, Open Graph, and Twitter metadata. August 2026 is an internal noindex preview and remains absent from navigation, archive, sitemap, feeds, and revalidation until separately approved. |

## Catalog Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Catalog hub | `/catalog` | `src/app/(site)/catalog/page.tsx`; keeps the standard catalog card grid, shows only parent catalog hubs, keeps Roblox item-family children inside `/catalog/roblox-items-and-bundles`, and derives each card count from the same public eligibility rules as its destination page |
| Catalog workflow guide | all catalog routes | `src/app/(site)/catalog/AGENTS.md` |
| Free Roblox items | `/catalog/free-roblox-items`, paginated routes, category routes, and subcategory routes | `src/app/(site)/catalog/free-roblox-items/*`, helpers in `page-data.tsx`, client browser in `FreeItemsBrowser.tsx`; only the main catalog is indexable and present in the catalog sitemap, while filtered category/subcategory routes stay `noindex, follow` |
| Roblox item and bundle catalogs | `/catalog/roblox-items-and-bundles`, nested family routes like `/catalog/roblox-items-and-bundles/roblox-accessories`, `/catalog/roblox-items-and-bundles/roblox-accessories/[slot]`, `/catalog/roblox-items-and-bundles/roblox-clothing`, `/catalog/roblox-items-and-bundles/roblox-clothing/[type]`, `/catalog/roblox-items-and-bundles/roblox-body-parts`, `/catalog/roblox-items-and-bundles/roblox-body-parts/[type]`, `/catalog/roblox-items-and-bundles/roblox-emotes`, `/catalog/roblox-items-and-bundles/roblox-animations`, `/catalog/roblox-items-and-bundles/roblox-makeup`, plus `/page/[page]` under each; the `/catalog` index keeps one Items & Bundles hub card, while destination pages use clean count-free H1s plus bracketed count/ID-type SEO titles, target Roblox item/code/ID searches, and show copy-ready Item IDs or Bundle IDs; old `/catalog/roblox-avatar-items` and flat family routes redirect into the nested hub | `src/app/(site)/catalog/roblox-items-and-bundles/[[...segments]]/page.tsx`, redirect shims in `src/app/(site)/catalog/roblox-*/[[...segments]]/page.tsx`, shared renderer in `src/app/(site)/catalog/avatar-marketplace/page-data.tsx`, data/config in `src/lib/roblox-avatar-catalog.ts`, rows from `roblox_catalog_items` and copy from `catalog_pages` |
| Roblox music IDs | `/catalog/roblox-music-ids`, `/page/[page]`, `/trending`, `/genres`, `/artists`, `/games`, `/games/[game]`, and their paginated/detail routes | `src/app/(site)/catalog/roblox-music-ids/*`, client browser in `MusicIdsBrowser.tsx`, shared helpers in `page-data.tsx`, and game-page config in `src/lib/game-specific-id-pages.ts`; current game-specific Music ID entries include Jujutsu Shenanigans, Murder Mystery 2, The Strongest Battlegrounds, Forsaken, Adopt Me, Brookhaven RP, Fisch, Driving Empire, Evade, 3008, A Dusty Trip, Work at a Pizza Place, Basketball Zero, Grand Piece Online, Da Hood, Retail Tycoon 2, and Nico's Nextbots; the first trending page is indexable while its pagination remains `noindex, follow` |
| Roblox color codes | `/catalog/roblox-color-codes` | `src/app/(site)/catalog/roblox-color-codes/*`, data helper in `page-data.tsx` |
| Roblox decal IDs | `/catalog/roblox-decal-ids`, `/page/[page]`, `/curated`, `/categories`, `/games`, `/games/[game]`, and their paginated/detail routes | `src/app/(site)/catalog/roblox-decal-ids/*`, helpers in `page-data.tsx`, and game-page config in `src/lib/game-specific-id-pages.ts`; the first curated page is indexable while its pagination remains `noindex, follow` |
| Admin commands | `/catalog/admin-commands`, `/catalog/admin-commands/[system]` | `src/app/(site)/catalog/admin-commands/*`, backed by `data/Admin commands/*.md` |
| Roblox errors and fixes | `/catalog/roblox-errors-and-fixes` | `src/app/(site)/catalog/roblox-errors-and-fixes/*`, with the searchable error reference in `data/roblox-errors/roblox-errors.json` and long-form copy in `catalog_pages` |
| Roblox dictionary | `/catalog/roblox-dictionary` | `src/app/(site)/catalog/roblox-dictionary/*`, with 251 source-backed slang, acronym, platform, creator, and legacy entries in `data/roblox-dictionary/roblox-dictionary.json`; search, category, status, and A-Z filters are URL-backed and server-rendered, while all terms stay on the catalog page with no thin term routes |
| Roblox promo codes and reward items | `/catalog/roblox-promo-codes` | `src/app/(site)/catalog/roblox-promo-codes/*`, with server-rendered rows from `roblox_promo_rewards`, client-side search/type filters, explicit source-listed versus verified claimability states, and long-form copy in `catalog_pages` |
| Roblox font IDs | `/catalog/roblox-font-ids` | `src/app/(site)/catalog/roblox-font-ids/*`, with 85 official FontFamily records from `roblox_font_ids`, Roblox-supplied previews, searchable style/designer filtering, copyable IDs and Luau, and long-form copy in `catalog_pages` |
| Roblox mesh IDs | `/catalog/roblox-mesh-ids`, `/catalog/roblox-mesh-ids/page/[page]` | `src/app/(site)/catalog/roblox-mesh-ids/*`, with 1,000 public Creator Store MeshPart records from `roblox_mesh_ids`, official square previews, searchable underlying Mesh IDs, optional Texture IDs, and long-form copy in `catalog_pages` |
| The Forge collections | `/wiki/the-forge/[collection]` | `src/app/(site)/wiki/collections/games/the-forge.tsx` |
| Grow a Garden collections | `/wiki/grow-a-garden/[collection]` | `src/app/(site)/wiki/collections/games/grow-a-garden.tsx` |
| Generic catalog fallback | `/catalog/[...slug]` | `src/app/(site)/catalog/[...slug]/page.tsx`, backed by Supabase catalog copy |

## Tool Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Tools hub | `/tools`, `/tools/page/[page]` | `src/app/(site)/tools/*`, shared helpers in `page-data.tsx` |
| Tools workflow guide | all tool routes | `src/app/(site)/tools/AGENTS.md` |
| Roblox ID extractor | `/tools/roblox-id-extractor` | `src/app/(site)/tools/roblox-id-extractor/*`, client in `RobloxIdExtractorClient.tsx` |
| Roblox profile checker | `/tools/roblox-profile-checker` | `src/app/(site)/tools/roblox-profile-checker/*`, client in `RobloxProfileCheckerClient.tsx`, API proxy at `/api/roblox-profile-checker` |
| Roblox username generator | `/tools/roblox-username-generator` | `src/app/(site)/tools/roblox-username-generator/*`, server-rendered client shell in `RobloxUsernameGeneratorClient.tsx`, live validation API at `/api/roblox-username-generator` |
| Roblox account value calculator | `/tools/roblox-account-value-calculator` | `src/app/(site)/tools/roblox-account-value-calculator/*`, SSR-compatible calculator client reusing `/api/roblox-profile-checker` with explicit public inventory coverage and local-only optional Robux inputs |
| Robux to USD | `/tools/robux-to-usd-calculator` | `src/app/(site)/tools/robux-to-usd-calculator/*`, static tables in `robux-bundles.ts` and `robux-plans.ts` |
| DevEx | `/tools/roblox-devex-calculator` | `src/app/(site)/tools/roblox-devex-calculator/*` |
| Roblox gamepass price calculator | `/tools/roblox-gamepass-price-calculator` | `src/app/(site)/tools/roblox-gamepass-price-calculator/*`, exact tenths-based 70/30 formula helper in `src/lib/roblox-platform-tools/gamepass-calculator.ts`, shared dedicated-tool page shell in `src/components/tools/DedicatedToolPage.tsx` |
| Roblox Marketplace and UGC commission calculator | `/tools/roblox-marketplace-fee-calculator` | `src/app/(site)/tools/roblox-marketplace-fee-calculator/*`, progressive checkpoint interpolation, fixed in-experience split, break-even, and hold-date helpers in `src/lib/roblox-platform-tools/marketplace-fee-calculator.ts` |
| Roblox group payout splitter | `/tools/roblox-group-payout-splitter` | `src/app/(site)/tools/roblox-group-payout-splitter/*`, exact-decimal percentage/weight/fixed allocation and CSV planning helper in `src/lib/roblox-platform-tools/group-payout-splitter.ts` |
| Roblox Creator Rewards estimator | `/tools/roblox-creator-rewards-estimator` | `src/app/(site)/tools/roblox-creator-rewards-estimator/*`, Daily Engagement, Audience Expansion, per-user cap, and 60-day date helpers in `src/lib/roblox-platform-tools/creator-rewards-estimator.ts` |
| Roblox badge cost and quota planner | `/tools/roblox-badge-cost-quota-planner` | `src/app/(site)/tools/roblox-badge-cost-quota-planner/*`, per-universe UTC creation scheduling and separate award-call budget helpers in `src/lib/roblox-platform-tools/badge-cost-quota-planner.ts` |
| Roblox icon and thumbnail checker | `/tools/roblox-icon-thumbnail-checker` | `src/app/(site)/tools/roblox-icon-thumbnail-checker/*`, client-only file-header inspection, per-target image checks, and crop math in `src/lib/roblox-platform-tools/icon-thumbnail-checker.ts` |
| Roblox DataStore budget calculator | `/tools/roblox-datastore-budget-calculator` | `src/app/(site)/tools/roblox-datastore-budget-calculator/*`, default per-server and shared experience request formulas plus hot-key throughput helpers in `src/lib/roblox-platform-tools/datastore-budget-calculator.ts` |
| Roblox server memory and capacity planner | `/tools/roblox-server-memory-capacity-planner` | `src/app/(site)/tools/roblox-server-memory-capacity-planner/*`, measured two-sample projections, dynamic Roblox allocation, memory-only capacity, and heartbeat gate in `src/lib/roblox-platform-tools/server-memory-capacity-planner.ts` |
| Roblox experience launch readiness planner | `/tools/roblox-experience-launch-readiness-planner` | `src/app/(site)/tools/roblox-experience-launch-readiness-planner/*`, profile-aware blocker/recommendation checklist, local-only persistence, and exports in `src/lib/roblox-platform-tools/experience-launch-readiness-planner.ts` |
| The Forge crafting | `/tools/the-forge-crafting-calculator` | `src/app/(site)/tools/the-forge-crafting-calculator/*` |
| The Forge inventory optimizer | `/tools/the-forge-inventory-optimizer` | `src/app/(site)/tools/the-forge-inventory-optimizer/*` |
| Grow a Garden | `/tools/grow-a-garden-crop-value-calculator` | `src/app/(site)/tools/grow-a-garden-crop-value-calculator/*` |
| Wizard Alchemy potion planner | `/tools/wizard-alchemy-potion-planner` | `src/app/(site)/tools/wizard-alchemy-potion-planner/*`, local data loader in `src/lib/wizard-alchemy/data.ts` |
| Wizard Alchemy race reroll calculator | `/tools/wizard-alchemy-race-reroll-calculator` | `src/app/(site)/tools/wizard-alchemy-race-reroll-calculator/*`, local data loader in `src/lib/wizard-alchemy/data.ts` |
| Generic tool fallback | `/tools/[...slug]` | `src/app/(site)/tools/[...slug]/page.tsx`, backed by Supabase tools copy |

## Static And Policy Pages

| Area | Routes | Files / Notes |
| --- | --- | --- |
| About | `/about` | `src/app/(site)/about/page.tsx` |
| Browser extension | `/browser-extension` | `src/app/(site)/browser-extension/page.tsx`; minimal public landing page with Chrome Web Store link and current product screenshots. |
| Contact | `/contact` | `src/app/(site)/contact/page.tsx` |
| Privacy policy | `/privacy-policy` | `src/app/(site)/privacy-policy/page.tsx` |
| Terms of service | `/terms-of-service` | `src/app/(site)/terms-of-service/page.tsx` |
| Account deletion | `/account-deletion` | `src/app/(site)/account-deletion/page.tsx`; public account and data deletion request instructions with signed-in Roblox identity prefill. |
| Editorial guidelines | `/editorial-guidelines` | `src/app/(site)/editorial-guidelines/page.tsx` |
| Disclaimer | `/disclaimer` | `src/app/(site)/disclaimer/page.tsx` |
| Verification policy | `/how-we-gather-and-verify-codes` | `src/app/(site)/how-we-gather-and-verify-codes/page.tsx` |
| Cookie settings | `/cookie-settings` | `src/app/(site)/cookie-settings/page.tsx`, client content in `Content.tsx` |

## Route-Family Sidecars Worth Checking First

- `src/app/(site)/articles/page-data.tsx`
- `src/app/(site)/articles/games/[slug]/page-data.tsx`
- `src/app/(site)/catalog/free-roblox-items/page-data.tsx`
- `src/app/(site)/catalog/roblox-color-codes/page-data.tsx`
- `src/app/(site)/catalog/roblox-decal-ids/page-data.tsx`
- `src/app/(site)/catalog/roblox-music-ids/page-data.tsx`
- `src/app/(site)/catalog/roblox-promo-codes/page-data.tsx`
- `src/app/(site)/wiki/collections/games/grow-a-garden.tsx`
- `src/app/(site)/wiki/collections/games/the-forge.tsx`
- `src/app/(site)/checklists/page-data.tsx`
- `src/app/(site)/codes/page-data.tsx`
- `src/app/(site)/events/page-data.tsx`
- `src/app/(site)/quizzes/page-data.tsx`
- `src/app/(site)/tools/page-data.tsx`
- `src/app/(site)/wiki/page-data.tsx`
