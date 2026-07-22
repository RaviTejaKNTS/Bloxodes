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
| Articles | `/articles`, `/articles/page/[page]`, `/articles/games/[slug]`, `/articles/games/[slug]/page/[page]`, `/articles/[slug]` | `src/app/(site)/articles/*`, shared helpers in `src/app/(site)/articles/page-data.tsx`; game article hubs use `src/app/(site)/articles/games/[slug]/page-data.tsx` and send articles without `universe_id` to `/articles/games/roblox`; detail Markdown supports validated `tier-list` and `article-checklist` fenced blocks |
| Retired lists redirect | `/lists`, `/lists/*` | `src/app/(site)/lists/[[...slug]]/page.tsx`; old list URLs permanently redirect to `/stats` |
| Checklists | `/checklists`, `/checklists/page/[page]`, `/checklists/[slug]` | `src/app/(site)/checklists/*`, shared helpers in `src/app/(site)/checklists/page-data.tsx` |
| Events | `/events`, `/events/[slug]` | `src/app/(site)/events/*`, shared loaders in `src/app/(site)/events/page-data.tsx`, detail composition in `events/[slug]/events-page.tsx` |
| Quizzes | `/quizzes`, `/quizzes/[slug]` | `src/app/(site)/quizzes/*`, scoped guide in `src/app/(site)/quizzes/AGENTS.md`, shared helpers in `src/app/(site)/quizzes/page-data.tsx`. Use `$bloxodes-quiz-writing` for metadata, local question pools, and validation. Detail pages should keep the user in the quiz experience: use the page intro plus the interactive quiz, not a separate "what this quiz covers" about block. |
| Puzzles | `/puzzles`, `/puzzles/[slug]`, `/puzzles/[slug]/[date]` | `src/app/(site)/puzzles/*`, shared helpers in `src/app/(site)/puzzles/page-data.tsx`, read layer in `src/lib/puzzles.ts`, and synced answer rows in `puzzle_answers`. Current puzzle pages are indexable; dated archives are `noindex, follow`. |
| Wiki | `/wiki`, `/wiki/[slug]` | `src/app/(site)/wiki/*`, shared helpers in `page-data.tsx`, Supabase read layer in `src/lib/wiki.ts` |
| Authors | `/authors`, `/authors/[slug]` | `src/app/(site)/authors/*` |
| Stats | `/stats`, `/stats/roblox-platform`, `/stats/games`, `/stats/games/[slug]`, `/stats/creators`, `/stats/items`, `/stats/items/[assetId]` | `src/app/(site)/stats/*`, shared read layer in `src/lib/stats.ts`, chart UI in `stats/components/*`, backed by `roblox_universes`, stats current-index tables, platform aggregate tables, hourly/daily stats tables, rank snapshot tables, `roblox_catalog_items`, and item stats hourly/daily/resale tables. Games-list SEO indexes only the unfiltered CCU/visits/24h/7d pages plus valid genre/subgenre CCU and visits pages; other filter/sort variants are `noindex, follow`, while individual games use the bounded top-1,000 policy. |

## Catalog Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Catalog hub | `/catalog` | `src/app/(site)/catalog/page.tsx`; keeps the standard catalog card grid, shows only parent catalog hubs, and keeps Roblox item-family children inside `/catalog/roblox-items-and-bundles` |
| Catalog workflow guide | all catalog routes | `src/app/(site)/catalog/AGENTS.md` |
| Free Roblox items | `/catalog/free-roblox-items`, paginated routes, category routes, and subcategory routes | `src/app/(site)/catalog/free-roblox-items/*`, helpers in `page-data.tsx`, client browser in `FreeItemsBrowser.tsx`; only the main catalog is indexable and present in the catalog sitemap, while filtered category/subcategory routes stay `noindex, follow` |
| Roblox item and bundle catalogs | `/catalog/roblox-items-and-bundles`, nested family routes like `/catalog/roblox-items-and-bundles/roblox-accessories`, `/catalog/roblox-items-and-bundles/roblox-accessories/[slot]`, `/catalog/roblox-items-and-bundles/roblox-clothing`, `/catalog/roblox-items-and-bundles/roblox-clothing/[type]`, `/catalog/roblox-items-and-bundles/roblox-body-parts`, `/catalog/roblox-items-and-bundles/roblox-body-parts/[type]`, `/catalog/roblox-items-and-bundles/roblox-emotes`, `/catalog/roblox-items-and-bundles/roblox-animations`, `/catalog/roblox-items-and-bundles/roblox-makeup`, plus `/page/[page]` under each; old `/catalog/roblox-avatar-items` and flat family routes redirect into the nested hub | `src/app/(site)/catalog/roblox-items-and-bundles/[[...segments]]/page.tsx`, redirect shims in `src/app/(site)/catalog/roblox-*/[[...segments]]/page.tsx`, shared renderer in `src/app/(site)/catalog/avatar-marketplace/page-data.tsx`, data/config in `src/lib/roblox-avatar-catalog.ts`, rows from `roblox_catalog_items` and copy from `catalog_pages` |
| Roblox music IDs | `/catalog/roblox-music-ids`, `/page/[page]`, `/trending`, `/genres`, `/artists`, and their paginated/detail routes | `src/app/(site)/catalog/roblox-music-ids/*`, client browser in `MusicIdsBrowser.tsx`, shared helpers in `page-data.tsx` |
| Roblox color codes | `/catalog/roblox-color-codes` | `src/app/(site)/catalog/roblox-color-codes/*`, data helper in `page-data.tsx` |
| Roblox decal IDs | `/catalog/roblox-decal-ids`, `/catalog/roblox-decal-ids/page/[page]` | `src/app/(site)/catalog/roblox-decal-ids/*`, helpers in `page-data.tsx` |
| Admin commands | `/catalog/admin-commands`, `/catalog/admin-commands/[system]` | `src/app/(site)/catalog/admin-commands/*`, backed by `data/Admin commands/*.md` |
| Roblox errors and fixes | `/catalog/roblox-errors-and-fixes` | `src/app/(site)/catalog/roblox-errors-and-fixes/*`, with the searchable error reference in `data/roblox-errors/roblox-errors.json` and long-form copy in `catalog_pages` |
| The Forge collections | `/wiki/the-forge/[collection]` | `src/app/(site)/wiki/collections/games/the-forge.tsx` |
| Grow a Garden collections | `/wiki/grow-a-garden/[collection]` | `src/app/(site)/wiki/collections/games/grow-a-garden.tsx` |
| Generic catalog fallback | `/catalog/[...slug]` | `src/app/(site)/catalog/[...slug]/page.tsx`, backed by Supabase catalog copy |

## Tool Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Tools hub | `/tools`, `/tools/page/[page]` | `src/app/(site)/tools/*`, shared helpers in `page-data.tsx` |
| Tools workflow guide | all tool routes | `src/app/(site)/tools/AGENTS.md` |
| Roblox ID extractor | `/tools/roblox-id-extractor` | `src/app/(site)/tools/roblox-id-extractor/*`, client in `RobloxIdExtractorClient.tsx` |
| Robux to USD | `/tools/robux-to-usd-calculator` | `src/app/(site)/tools/robux-to-usd-calculator/*`, static tables in `robux-bundles.ts` and `robux-plans.ts` |
| DevEx | `/tools/roblox-devex-calculator` | `src/app/(site)/tools/roblox-devex-calculator/*` |
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
| Contact | `/contact` | `src/app/(site)/contact/page.tsx` |
| Privacy policy | `/privacy-policy` | `src/app/(site)/privacy-policy/page.tsx` |
| Terms of service | `/terms-of-service` | `src/app/(site)/terms-of-service/page.tsx` |
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
- `src/app/(site)/wiki/collections/games/grow-a-garden.tsx`
- `src/app/(site)/wiki/collections/games/the-forge.tsx`
- `src/app/(site)/checklists/page-data.tsx`
- `src/app/(site)/codes/page-data.tsx`
- `src/app/(site)/events/page-data.tsx`
- `src/app/(site)/quizzes/page-data.tsx`
- `src/app/(site)/tools/page-data.tsx`
- `src/app/(site)/wiki/page-data.tsx`
