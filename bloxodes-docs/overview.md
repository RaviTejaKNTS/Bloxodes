# Overview

Last verified: 2026-10-19

Bloxodes is a gaming guide site at https://bloxodes.com. It started with Roblox (codes, wikis, catalog, stats, tools) and now also covers non-Roblox games like GTA, Red Dead, Minecraft, ARC Raiders and Mario Kart.

## Products

| Product | Where | Notes |
| --- | --- | --- |
| Website | `apps/web` | Next.js App Router. Public pages in `src/app/(site)`, account pages in `src/app/(secure)` and `src/app/auth`. |
| Chrome extension | `apps/extension` | MV3. Calls `/api/extension/*`, never Supabase directly. |
| Admin extension | `apps/admin-extension` | Personal, unpacked only. Calls `/api/admin/*` with `ADMIN_API_TOKEN`. Never published. |
| Mobile app | `apps/mobile` | Expo Router. Calls `/api/mobile/*` with optional bearer login. |
| Jobs and pipelines | `scripts/` | Grouped by pipeline, run through `npm run` aliases in `package.json`. |
| Database | `supabase/` | Migrations and the `revalidate` and `cache-warm` Edge Functions. |
| Wiki media | R2 bucket `bloxodes-wiki` | Served directly by the R2 custom domain `wiki-media.bloxodes.com`. URL helpers in `apps/web/src/lib/wiki-media.ts`. |

## How a page request flows

1. `bloxodes.com` goes through Cloudflare, which caches public HTML.
2. Cloudflare reaches Traefik on the Hostinger VPS.
3. Traefik routes to the Dokploy service `bloxodes-web-ujegas`, the Next.js app on port 3000.
4. The app reads self-hosted Supabase at `https://database.bloxodes.com`.
5. Media comes from `https://media.bloxodes.com` (Supabase Storage) and `https://wiki-media.bloxodes.com` (R2, wiki hub and collection images).

## Machines

| Machine | Role |
| --- | --- |
| Hostinger VPS | Production: website, self-hosted Supabase, stats worker and most data refresh cron jobs. |
| Homelab (Linux) | Article topic discovery and site-health monitor (systemd timers). Sole source of env files. Main checkout. |
| MacBook Pro | T3 Code. Runs the Roblox wiki and other-games schedules. |
| MacBook Air | Owner's laptop. Has the only Cockpit checkout (device administration). |
| GitHub Actions | PR checks, web deploys, schema releases, content publication, new codes pages. |
| Northflank | One job: hourly HOT universe stats. |

See [machines](infrastructure/machines.md) for access and [schedules](automation/schedules.md) for every recurring job.

## Who runs what

| Work | Runs on | Trigger |
| --- | --- | --- |
| Articles | MacBook Pro (Content Factory); topics from homelab | T3 schedule every 6 hours; homelab discovery 4 times a day |
| New codes pages | MacBook Pro (Content Factory); games found on homelab | T3 schedule every 12 hours; homelab finder 4 times a day |
| Codes updates | VPS | cron, 4 times a day |
| Roblox wiki and collections | MacBook Pro | Content Factory T3 schedule, every 2 days |
| Franchise wiki and collections | MacBook Pro | Content Factory T3 schedule, every 6 hours, from the Other Games Queue |
| Universe and item stats, catalog items, music, decals, puzzles, promo rewards, free items | VPS | cron |
| HOT universe stats | Northflank | hourly cron job |
| Catalog, quizzes, checklists, tools | Any machine, by hand | owner request |
| Monthly Roblox stats reports | Homelab (Content Factory) | T3 schedule, daily check; builds on the 1st once the month's data is in |
| Revalidation and cache warming | VPS | cron every minute |
| Web deploys, schema, content publication | GitHub Actions | merge to `production` or dispatch |

## Where content lives

All public content is in production Supabase. Roblox content and non-Roblox content use separate tables:

- **Roblox:** `code_pages`, `codes`, `articles`, `wiki_pages`, `wiki_collection_pages`, `catalog_pages`, `quiz_pages`, `checklist_pages`, `events_pages`, `tools`, plus the `roblox_*` data tables.
- **Non-Roblox:** the shared `games` registry and `game_*` tables, keyed by namespace (for example `gta`, `red-dead`, `mario-kart`).

Collection data is stored as immutable revisions. Pages point at a published revision. See [database](data/supabase.md).

Content Factory content (wikis, articles, codes pages, stats reports) is authored in local files and publishes straight to production with `content:publish` or `codes:publish` once its production dry run passes. Its queues are in Notion. Managed development isn't in that path, so it can't block content. Other content and all code reach production through GitHub. See [release](operations/release.md).
