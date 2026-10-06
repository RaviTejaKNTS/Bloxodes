---
name: bloxodes-games-code-pages
description: Prepare and verify shared non-Roblox codes pages and verified code rows.
---

# Shared game codes pages

Use this for verified non-Roblox redeem codes. GTA cheats use collections. Roblox keeps its existing codes skills and refresh script.

1. Read `dev-docs/pipelines/wiki-collections.md` and the approved registry identity. Resolve namespace, game ID and route.
2. Research official redemption steps and code announcements. Record sources and dates in an ignored workspace. Keep long-lived copy separate from code rows.
3. Write the page fields in `game_code_pages`: `game_id`, `slug`, `title`, SEO fields, `intro_md`, `redeem_md`, `rewards_md`, `troubleshoot_md`, `find_codes_md`, `sources_json`, `faq_json` and publication state. The database derives the route unless preserving an approved existing URL.
4. Prepare separate `game_codes` rows with `code_page_id`, `code`, `rewards_text`, `status`, `verified_at` and HTTPS `source_url`. Status is `active`, `expired` or `check`. Public pages show active and expired rows. Missing from a source does not mean expired. Preserve previous rows and first-seen dates.
5. Validate with `npm run publish:game-pages -- --namespace <slug> --file <reviewed.json>`. Use groups `codesPages` and `codes`. Publish the page before importing code rows. `--apply` writes only within authorized development work.
6. Verify copy buttons, redemption text, status, canonical URL, comments, search, sitemap, feed and cache events. Keep changing code names and counts out of prose. Do not publish production.

Standalone codes live at `/<game>/codes`. Franchise codes use a child directory at `/<franchise>/codes` and child pages below it.
