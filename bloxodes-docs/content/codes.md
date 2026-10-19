# Codes

Last verified: 2026-10-19

Roblox codes pages at `/codes/<game-slug>`. Two separate jobs: GitHub creates new pages, and the VPS keeps codes on existing pages fresh.

## New pages (GitHub Actions)

1. **Discover:** `discover-beebom-codes.yml` runs at :17 every 6 hours UTC. `discover:beebom-codes` (`scripts/codes/discover-beebom-code-pages.ts`) reads Beebom's Roblox codes tag, checks for overlaps and inserts unpublished `code_pages` rows.
2. **Write and publish:** `generate-queue.yml` (Draft Code Page Generation) runs 10 times a day. `npm run generate` (`scripts/codes/generate-code-page-copy.ts`) picks up draft `code_pages`, fetches sources, writes copy with GPT-4.1-mini, links the Roblox universe, refreshes codes, adds media and interlinks. It publishes a page only after the universe resolves and the source refresh is clean. Otherwise the page stays a draft.

Both write production directly. Database triggers handle cache refresh.

## Code updates (VPS)

VPS cron runs `refresh:codes` (`scripts/codes/update-codes.ts`) at 00:00, 06:00, 12:00 and 18:00 UTC, with concurrency 6 and a 750 ms batch delay. It scrapes each published page's sources and upserts `codes` through the `upsert_code` RPC (case-insensitive, provider precedence, reactivation). If a source partly fails, it keeps what it saw rather than expiring everything missing.

## Manual page setup

Use `bloxodes-code-workflow-runner` and `bloxodes-code-writing`, then publish with `bloxodes-release-e2e` (the `roblox-codes-page` publisher). It sets page copy and source fields only. The refresh worker owns the code rows.

## Rules

- `code_pages.slug` is the editorial game slug. Never add `-codes` and never copy the stats slug from `roblox_universes.slug`.
- `roblox_link` is the Roblox experience URL. `source_url` is RobloxDen. `source_url_2` is Beebom.
- Leave `seo_title` empty unless the owner asks for a custom title.
- Page copy stays evergreen: no code names, counts, dates, month or year labels, or words like "latest", "current" or "updated daily".
- Never seed active or expired codes by hand.
- `/codes` (the index) has hand-written guide copy in `apps/web/src/app/(site)/codes/index-content.tsx`. It ships with web deploys.

## Data

`code_pages` (4,062 rows, 2,310 published) and `codes` (69,035 rows) on 2026-10-19. Website, extension and mobile all read through shared web helpers.

## Known issues

- **New page writing is down.** The OpenAI key used by `generate-code-page-copy.ts` has no credits left (HTTP 429). The workflow still shows green because per-page errors don't fail the run. The last new page was published on 2026-10-07.
- The old `game_generation_queue` table (107 stale rows) has no code left. Drop it in a later migration.
