# Roblox Hub Gap Tracker

Created: 2026-08-18
Purpose: track the surfaces Bloxodes is still missing to be a complete Roblox hub, and build them one at a time.
Scope rule: only items that were NOT already planned elsewhere. Social/X/Discord, browser extension, mobile apps, limiteds trading calculator, `/stats/genres`, chart overlays, error articles, remaining wiki collections, crosshair/flag/spray-paint IDs, watchlist/report/request loops, email/push capture, paid creator analytics, admin app, and best-roblox-games are tracked in their own docs and are excluded here.

Evidence used on 2026-08-18: production sitemaps (`bloxodes.com/sitemaps/*.xml`), `apps/web/src/app/(site)` routes, `apps/web/src/lib/*`, and every plan in `docs/`, `docs/need-to-implement/`, `Writing plans/`, and `dev-docs/`.

Status key: `[ ]` not started · `[~]` in progress · `[r]` in review · `[x]` live in production · `[-]` dropped (say why)

Progress: **0/17 complete** (1 dropped)

Working rules:
- Pick one item, move it to `[~]`, and log the branch/worktree, workspace folder, and owner in the item's Notes line.
- Before starting an item, recheck production coverage (sitemaps or prod DB) because this list is a point-in-time snapshot.
- Every new page family must ship with metadata, JSON-LD, pagination, sitemap and feed coverage, `/api/revalidate` wiring, and its `dev-docs/` owner update.
- Do not add trading values, tier ranks, or update logs from memory. Every row needs a source and a refresh cadence.
- Update the progress count at the top whenever a status changes.

---

## Snapshot of what already exists (for reference)

Codes 2,285 · Wiki 510 (60 games, 427 declared collections) · Articles 505 (guides, tech fixes, 13 tier-list articles, 2 monthly reports) · Stats 1,001 game pages plus genre/subgenre indexes, items, creators index, platform, reports · Catalog 59 (music/decal/mesh/font IDs, color codes, dictionary, errors, promo codes, free items, avatar marketplace by category, admin commands) · Tools 13 · Checklists 14 · Quizzes 13 · Events 22 · Puzzles 14 (non-Roblox) · Roblox OAuth login, comments, freeform feedback, global search.

---

## Tier 1: high impact, unplanned

- [ ] **1. In-game trading value lists**
  What: per-game `values` pages plus a per-game "is this trade fair" calculator for economies with active trading (Adopt Me, Murder Mystery 2, Pet Simulator 99, Blox Fruits, Grow a Garden, Steal a Brainrot, Jailbreak, Bloxburg candidates).
  Why: the largest Roblox search category Bloxodes does not touch. Distinct from the planned limiteds/RAP calculator.
  Existing pieces: item rows already exist in `apps/web/src/lib/game-collections/games/*` and `data/<Game>/`. `docs/game-dataset-roadmap.md` only says "values, if reliable sources exist".
  Needs: value fields on collection rows (or a `game_item_values` table), source and last-verified per row, change history, demand/rarity fields, refresh cadence, per-game calculator route, page contract, sitemap/feed/revalidate.
  Suggested first game: Murder Mystery 2 (small item set, stable community value sources), then Adopt Me.
  Notes:

- [ ] **2. Localization (hreflang, first languages)**
  What: localized versions of programmatic families first (codes, stats, music/decal IDs, events), then wikis and articles.
  Why: zero i18n in `apps/web/src`; Roblox's audience is majority non-US (Brazil, Philippines, Indonesia, Mexico, Turkey, Vietnam, Thailand, Europe).
  Needs: locale routing decision (subfolder `/es/`, `/pt-br/`), hreflang and canonical rules, translated UI strings, translation source of truth for editorial copy, sitemap per locale, Cloudflare/cache tag rules, indexing plan.
  Suggested first languages: Spanish (es), Brazilian Portuguese (pt-BR). Start with `/codes` and `/stats`.
  Notes:

- [-] **3. Per-game updates and official links** (dropped 2026-08-18)
  What: a per-game "Updates" surface: changelog / patch notes, next update countdown, and an official links directory (Discord, Trello, X, YouTube, group, game link, private server price, platforms).
  Why: "X update log", "X next update", "X trello link", "X discord link" have no page today.
  Existing pieces: `social_links` and `updated_at_api` from the Roblox API, `roblox_virtual_events`, `code_pages.discord_link`. An `updated_at_api` diff table is planned only as a stats chart overlay (`docs/stats/chart-feature-followup-plan.md`).
  Needs: decide route (`/wiki/<game>/updates` or `/updates/<game>`), update-event storage with source, official links model with verification, countdown data source (developer-announced), page contract, sitemap/feed/revalidate.
  Notes: Dropped. Verified against Roblox APIs on 2026-08-18: Roblox exposes update timestamps, name tags, and event countdowns but no patch notes; place version history needs owner auth; descriptions rarely carry changelogs; Discord/X are not crawlable. Not enough content for a page family. Update notes go through the article pipeline as article ideas instead.

- [ ] **4. Parents and safety hub**
  What: a parent-facing section: parental controls, spending limits, chat and voice settings, age verification, maturity labels, and a per-game "for parents" block (age rating, voice chat, devices, private servers).
  Why: no parent-facing surface exists even though `apps/web/src/lib/age-rating.ts` and maturity/voice/device flags already exist in the data. Strengthens trust and E-E-A-T.
  Needs: hub route (for example `/parents`), 8 to 12 evergreen guides, per-game block on stats and wiki pages, source policy (Roblox official docs only), sitemap/feed/revalidate.
  Notes:

- [ ] **5. Web account dashboard**
  What: turn `/account` into a real dashboard: checklist and quiz progress, redeemed code progress, saved games/pages, copied ID history, comment history.
  Why: `apps/web/src/app/(secure)/account/page.tsx` shows avatar and sign out only, while `user_code_progress`, `user_checklist_progress`, and `user_quiz_progress` already exist. The planned watchlist loop has nowhere to live on the web.
  Needs: saved-items table and API with origin validation and rate limiting, dashboard page, privacy copy, account-deletion coverage for new tables.
  Notes:

## Tier 2: medium impact, unplanned

- [ ] **6. Avatar and outfit ideas catalog family**
  What: priced outfit combos by aesthetic and budget (for example "under 100 Robux"), plus per-game outfit codes beyond the current decal lists.
  Existing pieces: `roblox_catalog_items` and images. Berry Avenue and Bloxburg exist only as decal ID pages.
  Needs: outfit data model (item ID sets, total price, style tags), image composition or item grids, page contract, sitemap/feed/revalidate.
  Notes:

- [ ] **7. Roblox platform events tracker**
  What: official Roblox and brand events (The Hunt, RB Battles, brand collabs, seasonal), with a cross-game calendar view.
  Existing pieces: `/events` index with per-game countdowns from `roblox_virtual_events`.
  Needs: platform-event source policy, calendar view, evergreen pages per recurring event, sitemap/feed/revalidate.
  Notes:

- [ ] **8. Roblox status page ("is Roblox down")**
  What: a landing page showing current Roblox status, recent incidents, and platform CCU dips.
  Existing pieces: `/stats/roblox-platform`; status snapshots are planned only as stats data (`docs/stats/roblox-platform-stats-plan.md`), not as a page.
  Needs: official status source snapshotting, page contract, short cache TTL, sitemap.
  Notes:

- [ ] **9. Creator and studio profile pages**
  What: `/stats/creators/[slug]` with portfolio, combined CCU, history, group and verification info.
  Existing pieces: `/stats/creators` index and `stats_creator_current_index`.
  Needs: creator slug ownership, detail loader in `apps/web/src/lib/stats.ts`, page contract, sitemap.
  Notes:

- [ ] **10. Config-driven interactive tool engine**
  What: let `tools` rows declare a widget kind (calculator, converter, lookup) so new tools do not need a hand-built route.
  Why: the generic renderer in `apps/web/src/app/(site)/tools/[...slug]/page.tsx` outputs prose only, which is why there are 13 tools.
  Needs: tool kind registry, schema for inputs/formulas, client island, tests.
  Notes:

- [ ] **11. Demand-led platform utilities**
  What: username to user ID converter, asset ID to image/thumbnail viewer, marketplace fee (30%) and gamepass pricing calculator, regional Robux price and gift card bonus item reference.
  Why: proven demand; the 2026-07-31 review allows demand-led tools only.
  Needs: each tool goes through `bloxodes-tool-workflow-runner`; ideally built on item 10.
  Notes:

- [ ] **12. Structured tier list family**
  What: updatable tier list pages tied to collection datasets (units, towers, pets, fruits), optionally with community votes later.
  Existing pieces: 13 tier-list articles and the `tier-list` article block in `apps/web/src/lib/article-blocks.ts`.
  Needs: tier field on collection rows with source and date, page contract, decision on article vs collection route, sitemap/feed/revalidate.
  Notes:

- [ ] **13. Free creator resources**
  What: evergreen developer references (Enum and KeyCode lists, Material list, Studio shortcuts, common script errors, plugin and free-model directories).
  Why: the developer persona only has DevEx and Font/Mesh/Color IDs today. Optional; Roblox docs cover part of it.
  Notes:

## Tier 3: smaller gaps

- [ ] **14. Star codes and toy codes pages** (only promo codes exist under `/catalog/roblox-promo-codes`).
  Notes:
- [ ] **15. Interactive maps for open-world games** (long-term differentiator; heavy).
  Notes:
- [ ] **16. Comments on stats, quizzes, checklists** (entity types are limited to code, article, catalog, event, tool, wiki, wiki_collection).
  Notes:
- [ ] **17. Public read API and documented embeds** (embeddable widgets are planned; a documented public API is not).
  Notes:

## Deliberately not planned

- Indexed player or username lookup pages (minor-privacy risk).
- Scripts, exploits, leaks, datamines, "free Robux" content.
- Moving or deleting `/puzzles` (per the 2026-07-31 review; revisit later).

## Change log

- 2026-08-18: created from the hub gap analysis; 17 items, none started.
- 2026-08-18: item 3 dropped after source verification; updates covered as article ideas.
