# Codes

Last verified: 2026-11-06

Roblox codes pages at `/codes/<game-slug>`. Two separate jobs: the Content Factory creates new pages, and the VPS keeps codes on existing pages fresh.

## New pages (homelab finder and Content Factory)

1. **Find:** `bloxodes-codes-discovery.timer` on the homelab runs `codes:discover` (`scripts/codes/discover-code-pages.ts`) every 6 hours. It adds one row per Roblox universe to the [Codes Queue](../automation/notion-queues.md#codes-queue) for each game that has a codes page on Beebom or RobloxDen and no `code_pages` row (published or not) and no queue row. It reads production and writes only Notion and its state file.
2. **Write and publish:** the Content Factory's codes run, twice a day on the MacBook Pro, works through every `New` row: Luna researches, Haiku writes `final.json` through `bin/haiku-write`, and the main agent checks it and runs `codes:publish`.

### Sources

| Source | How new games are found |
| --- | --- |
| RobloxDen | `robloxden.com/sitemap.xml` lists every game codes page (5,168 on 2026-11-06). Pages have no publish date, and `lastmod` is only when RobloxDen last checked codes, so the finder compares the sitemap's `/game-codes/<slug>` list with the slugs it has seen. The first run only saved a baseline: older RobloxDen games are not queued. Each game page links `roblox.com/games/<placeId>`. |
| Beebom | The first page of `beebom.com/tag/roblox-codes/`, newest first. Most articles no longer link the Roblox game, so a game without a link is matched by exact name only when the match is unambiguous; otherwise it's reported as unresolved and skipped. |

Every candidate is saved as pending before the run works on it, so a crash or the per-run cap never loses one, and the two sources take turns. A game that can't be matched (no Roblox link and no unambiguous name match) is retried up to a cap, then reported as given up. A network error, server error or timeout keeps the candidate pending without using that cap; if those use up the run's retries or the run's time limit, the run exits non-zero and the dashboard shows it failed. State is in `/srv/data/bloxodes-automation-runtime/state/codes-discovery/state.json`. `npm run codes:discover -- --dry-run` prints what a run would add without writing.

### Factory commands

The factory calls these from the MacBook Pro's Bloxodes main checkout through its `bin/publisher`. Neither calls an LLM.

| Command | Does |
| --- | --- |
| `codes:context --universe <id>` | Read-only JSON: game identity, root place, playing count, existing `code_pages` overlaps, up to 4 related codes pages for interlinks, slug rules and the `final.json` JSON Schema. |
| `codes:publish --bundle <folder> --target production` | Validates `final.json` (`scripts/codes/final-contract.ts`), ensures the universe, creates or updates the `code_pages` row unpublished, syncs codes from the sources, adds social links, interlinks and the cover, runs the public copy check, and publishes only when the universe resolves and the source refresh has no errors. Exit 0 only after the row reads back as published; the last line is the page URL. Default target is development. A rerun on a live page whose fields already match `final.json` succeeds without changing it. A changed `final.json` updates a live page without taking it offline: the new content and link credits are applied together by the `publish_factory_code_page` RPC only after every step succeeds. |

`final.json` holds the slug, name, `universe_id`, `roblox_link`, `source_url` (RobloxDen), `source_url_2` (Beebom, at least one source), the five copy sections (`intro_md`, `redeem_md`, `troubleshoot_md`, `rewards_md`, `find_codes_md`), a 150 to 160 character `meta_description`, `game_display_name` and `interlinking_copy_md`. `codes:context` suggests up to 4 related pages; publishing accepts a link to any published codes page with the same developer or genre. Each linked page's `internal_links` count goes up once per page that links it (the credited IDs are stored in `interlinking_ai.credited_page_ids`), so `codes:context` spreads links across pages. The shared steps live in `scripts/shared/code-page-pipeline.ts`.

### Old GitHub workflows

`discover-beebom-codes.yml` and `generate-queue.yml` (Draft Code Page Generation) still run until the factory has published its first pages, then they're switched off. They found nothing after 2026-10-29 because most Beebom articles stopped linking the Roblox game. `npm run generate` still uses the shared pipeline with its own Claude Code CLI call.

## Code updates (VPS)

VPS cron runs `refresh:codes` (`scripts/codes/update-codes.ts`) at 00:00, 06:00, 12:00 and 18:00 UTC, with concurrency 6 and a 750 ms batch delay. It scrapes each published page's sources and upserts `codes` through the `upsert_code` RPC (case-insensitive, provider precedence, reactivation). If a source partly fails, it keeps what it saw rather than expiring everything missing.

## Manual page setup

Use `bloxodes-code-workflow-runner` and `bloxodes-code-writing`, then publish with `bloxodes-release-e2e` (the `roblox-codes-page` publisher). It sets page copy and source fields only. The refresh worker owns the code rows. To retire a page, publish a payload with `"publish": false` and the page's current copy unchanged (the publisher overwrites every field); the page then returns 404 and leaves the sitemap. Example: `content/releases/retire-dead-codes-pages-20261024`.

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

- The old `game_generation_queue` table (107 stale rows) has no code left. Drop it in a later migration.
