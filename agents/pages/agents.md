# Page Inventory

Authoritative workflow guidance lives in:

- `src/app/AGENTS.md`
- `src/app/(site)/AGENTS.md`

This file is the route-family inventory for quick scanning.

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
| Login | `/login` | `src/app/(secure)/login/page.tsx`, server actions in `src/app/(secure)/login/actions.ts` |
| Account | `/account` | `src/app/(secure)/account/page.tsx` |

## Core Content Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Codes | `/codes`, `/codes/page/[page]`, `/codes/[slug]` | `src/app/(site)/codes/*`, shared helpers in `src/app/(site)/codes/page-data.tsx` |
| Articles | `/articles`, `/articles/page/[page]`, `/articles/[slug]` | `src/app/(site)/articles/*`, shared helpers in `src/app/(site)/articles/page-data.tsx` |
| Lists | `/lists`, `/lists/page/[page]`, `/lists/[slug]`, `/lists/[slug]/page/[page]` | `src/app/(site)/lists/*`, shared helpers in `src/app/(site)/lists/page-data.tsx` and `src/app/(site)/lists/[slug]/page-data.tsx` |
| Checklists | `/checklists`, `/checklists/page/[page]`, `/checklists/[slug]` | `src/app/(site)/checklists/*`, shared helpers in `src/app/(site)/checklists/page-data.tsx` |
| Events | `/events`, `/events/[slug]` | `src/app/(site)/events/*`, shared loaders in `src/app/(site)/events/page-data.tsx`, detail composition in `events/[slug]/events-page.tsx` |
| Quizzes | `/quizzes`, `/quizzes/[slug]` | `src/app/(site)/quizzes/*`, shared helpers in `src/app/(site)/quizzes/page-data.tsx` |
| Wiki | `/wiki`, `/wiki/[slug]` | `src/app/(site)/wiki/*`, shared helpers in `page-data.tsx`, Supabase read layer in `src/lib/wiki.ts` |
| Authors | `/authors`, `/authors/[slug]` | `src/app/(site)/authors/*` |

## Catalog Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Catalog hub | `/catalog` | `src/app/(site)/catalog/page.tsx` |
| Free Roblox items | `/catalog/free-roblox-items`, paginated routes, category routes, subcategory routes, and mirrored `categories/*` routes | `src/app/(site)/catalog/free-roblox-items/*`, helpers in `page-data.tsx`, client browser in `FreeItemsBrowser.tsx` |
| Roblox music IDs | `/catalog/roblox-music-ids`, `/page/[page]`, `/trending`, `/genres`, `/artists`, and their paginated/detail routes | `src/app/(site)/catalog/roblox-music-ids/*`, client browser in `MusicIdsBrowser.tsx`, shared helpers in `page-data.tsx` |
| Roblox color codes | `/catalog/roblox-color-codes` | `src/app/(site)/catalog/roblox-color-codes/*`, data helper in `page-data.tsx` |
| Roblox decal IDs | `/catalog/roblox-decal-ids`, `/catalog/roblox-decal-ids/page/[page]` | `src/app/(site)/catalog/roblox-decal-ids/*`, helpers in `page-data.tsx` |
| Admin commands | `/catalog/admin-commands`, `/catalog/admin-commands/[system]` | `src/app/(site)/catalog/admin-commands/*`, backed by `data/Admin commands/*.md` |
| The Forge catalog | `/catalog/the-forge`, `/catalog/the-forge/[collection]` | `src/app/(site)/catalog/the-forge/*`, view helper in `ForgeCatalogView.tsx`, data helper in `page-data.tsx` |
| Generic catalog fallback | `/catalog/[...slug]` | `src/app/(site)/catalog/[...slug]/page.tsx`, backed by Supabase catalog copy |

## Tool Families

| Area | Routes | Files / Notes |
| --- | --- | --- |
| Tools hub | `/tools`, `/tools/page/[page]` | `src/app/(site)/tools/*`, shared helpers in `page-data.tsx` |
| Roblox ID extractor | `/tools/roblox-id-extractor` | `src/app/(site)/tools/roblox-id-extractor/*`, client in `RobloxIdExtractorClient.tsx` |
| Robux to USD | `/tools/robux-to-usd-calculator` | `src/app/(site)/tools/robux-to-usd-calculator/*`, static tables in `robux-bundles.ts` and `robux-plans.ts` |
| DevEx | `/tools/roblox-devex-calculator` | `src/app/(site)/tools/roblox-devex-calculator/*` |
| The Forge crafting | `/tools/the-forge-crafting-calculator` | `src/app/(site)/tools/the-forge-crafting-calculator/*` |
| The Forge inventory optimizer | `/tools/the-forge-inventory-optimizer` | `src/app/(site)/tools/the-forge-inventory-optimizer/*` |
| Grow a Garden | `/tools/grow-a-garden-crop-value-calculator` | `src/app/(site)/tools/grow-a-garden-crop-value-calculator/*` |
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
- `src/app/(site)/catalog/free-roblox-items/page-data.tsx`
- `src/app/(site)/catalog/roblox-color-codes/page-data.tsx`
- `src/app/(site)/catalog/roblox-decal-ids/page-data.tsx`
- `src/app/(site)/catalog/roblox-music-ids/page-data.tsx`
- `src/app/(site)/catalog/the-forge/page-data.tsx`
- `src/app/(site)/checklists/page-data.tsx`
- `src/app/(site)/codes/page-data.tsx`
- `src/app/(site)/events/page-data.tsx`
- `src/app/(site)/lists/page-data.tsx`
- `src/app/(site)/lists/[slug]/page-data.tsx`
- `src/app/(site)/quizzes/page-data.tsx`
- `src/app/(site)/tools/page-data.tsx`
- `src/app/(site)/wiki/page-data.tsx`
