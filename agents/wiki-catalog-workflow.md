# Wiki And Catalog Page Workflow

Use this whenever a local game dataset should become public wiki and catalog pages. The expected path is local first, production only after preview and data quality checks are clean.

## Trigger

Follow this workflow when adding pages for a game dataset under `data/<Game>/`, especially for repeated Roblox game wiki/catalog work such as Adopt Me, Blox Fruits, Brookhaven RP, Sailor Piece, Steal a Brainrot, The Forge, Grow a Garden, or future games.

## Data Inputs

- Local JSON datasets live under `data/<Game>/`.
- Matching images should live under `apps/web/public/<Game>/`.
- Dataset collectors should live under `scripts/catalog/collect-<game>-data.ts`.
- Long-lived datasets must be documented in `data/AGENTS.md` and `agents/data/agents.md`.
- Collector scripts must be documented in `agents/scripts/agents.md`.
- Catalog page rows for gathered game datasets can be generated with `npm run seed:game-catalog-pages -- --dry-run`, then written locally with `npm run seed:game-catalog-pages`.
- Wiki page rows for gathered game datasets can be generated with `npm run seed:game-wiki-pages -- --dry-run`, then written locally with `npm run seed:game-wiki-pages`.

## DB Targets

- `wiki_pages`: one game-level hub at `/wiki/[slug]`.
- `catalog_pages`: one page per collection at `/catalog/[code]`.
- `roblox_universes`: provides universe metadata, icon, thumbnails, stats, and the shared `universe_id`.

Important fields:

- `wiki_pages.slug`: game slug, for example `adopt-me`.
- `wiki_pages.title`, `seo_title`, `meta_description`, `tips_md`, `cover_image`, `controls_json`.
- `catalog_pages.code`: collection code, for example `adopt-me-pets` or `blox-fruits-fruits`.
- `catalog_pages.title`, `seo_title`, `meta_description`, `intro_md`, `how_it_works_md`, `faq_json`, `thumb_url`.
- `catalog_pages.universe_id`: links catalog pages into the wiki hub.
- `catalog_pages.wiki_md`: short copy rendered on the game wiki hub.
- `catalog_pages.wiki_sort_order`: ordering on the game wiki hub.
- Wiki catalog CTA image strips are derived from representative item images in `data/<Game>/<collection>.json` by matching `catalog_pages.code`.

## Naming Pattern

- Game wiki slug: lowercase kebab-case, e.g. `blox-fruits`.
- Catalog code: `<game-slug>-<collection-slug>`, e.g. `blox-fruits-swords`.
- Catalog title: `All <Collection> in <Game>`.
- Route should be predictable and SEO-readable: `/catalog/blox-fruits-swords`.

## Local-First Process

1. Confirm the dataset is complete enough:
   - JSON parses.
   - Item counts look plausible.
   - Referenced local images exist.
   - No unreferenced generated images remain.
   - Missing images are understood and intentional.
2. Confirm or seed the local `roblox_universes` row for the game.
3. Upsert the game hub into local `wiki_pages`.
4. Upsert collection shells into local `catalog_pages`.
   - Rerun both seed scripts after adding or fixing a game in `roblox_universes` so `wiki_pages.universe_id` and `catalog_pages.universe_id` are linked. The wiki page automatically lists catalog blocks through this shared `universe_id`.
5. Start as drafts when content/layout is new:
   - Use `is_published = false` until local preview is clean.
   - Publish locally only after routes render correctly.
6. Build or update the catalog route renderer:
   - Prefer a reusable dataset catalog renderer for these game datasets.
   - Add per-game route code only when the dataset needs custom behavior.
7. Preview locally:
   - `/wiki/<game-slug>`
   - `/catalog/<game-slug>-<collection-slug>`
   - `/catalog`
   - `/sitemaps/wiki.xml`
   - `/sitemaps/catalog.xml`
8. Verify:
   - Metadata and canonical URLs.
   - JSON-LD if applicable.
   - Wiki hub lists the catalog blocks in the intended order.
   - Catalog pages render real dataset rows/cards, not just shell copy.
   - Images work on desktop and mobile.
   - Search/revalidation hooks are covered by existing triggers.

## Writing Style Guide

Use this style for every wiki page, catalog page, and catalog table explanation.

The goal is simple: write complete, useful information in simple English with a clean story-like flow. Every sentence must help the player understand the game, the dataset, or the decision they came to make. If a sentence does not add value, remove it.

### Voice

- Write like a Roblox player explaining the game to another player.
- Keep it friendly, grounded, factual, and slightly professional.
- Use US English.
- Keep sentences easy to read. Prefer short direct sentences over long stacked clauses.
- Be conversational, but do not become casual filler.
- Do not hype. Avoid marketing language.
- Do not use generic phrases like "this game is fun", "players will love", "helps you progress faster", or "check back often" unless a specific detail makes the line useful.
- Do not add emojis.
- Do not use em dashes.
- Do not mention sources, research, scraping, citations, or URLs in page copy.

### Information Rules

- Use only the dataset and verified source notes available for that game.
- If a stat or detail is missing, leave it blank or say it is not listed when that context helps. Do not guess.
- Cover every item in a catalog table or item list. A catalog page should be a one-stop reference for that collection.
- Keep game-specific details. Remove anything that would apply equally to every Roblox game.
- Prefer exact terms from the game when naming items, shops, currencies, rarities, worlds, bosses, requirements, and rewards.
- Explain what fields mean when they are not obvious, such as availability, source, hatch time, roll chance, mastery, or mutation multiplier.
- When a page includes limits, requirements, timers, rotations, drop chances, prices, or availability, make those details easy to find.
- If the dataset has known gaps, mention them cleanly instead of hiding them.

### Flow

- Start with direct context. Do not open with a generic question.
- The first paragraph should tell the reader what the page is for and why this dataset matters in that game.
- After the intro, give the useful answer quickly. For catalog pages, this usually means the item table/cards should appear early.
- Put a short context paragraph before tables, bullet lists, or numbered steps so the page does not feel like a dump.
- Sections should connect naturally. Each section should answer the next thing the player would wonder.
- Keep headings only when they move the topic forward.
- Use H2 for main sections and H3 only when needed.
- Use sentence-case headings. Capitalize proper nouns normally.
- Avoid generic headings like "Tips", "Why this matters", "Conclusion", "Outro", or "Final thoughts".
- Weave "is it worth it" or "why it matters" information into practical sections instead of making generic sections.
- End with a short useful takeaway only when the page needs one. Keep it real and helpful.

### Catalog Page Content

Each `catalog_pages` row should have useful copy, not just SEO filler.

- `title`: short and scannable, usually `All <Collection> in <Game>`.
- `seo_title`: close to the title unless a clearer search phrase is needed.
- `meta_description`: specific, under 160 characters, and mentions the game plus the collection.
- `intro_md`: explain what the collection controls in the game and what the page helps players compare.
- `how_it_works_md`: explain how to use the table/cards and what fields matter most.
- `description_json`: use only for extra detail that genuinely helps players understand the collection.
- `faq_json`: answer real questions a player would have. Avoid generic FAQ entries.
- `wiki_md`: short wiki-hub copy that explains the catalog's role in one compact paragraph.
- CTA images on wiki hubs come from representative item images in the matching local dataset; do not store per-page image arrays in Supabase.

Good catalog copy usually follows this shape:

1. What this collection is in the game.
2. Why players care about it.
3. What the table lets them compare.
4. Any important limitations, availability notes, or source gaps.

### Wiki Page Content

Each `wiki_pages` row is a game hub, not a full article dump.

- `title`: `<Game> Wiki`.
- `meta_description`: explain the hub in one specific sentence.
- `tips_md`: short practical bullets that are specific to the game.
- `controls_json`: fill only when controls are known and useful.
- `cover_image`: use a strong local or Roblox image when available.
- The wiki hub should connect the player to catalog pages, tools, codes, articles, checklists, events, and game metadata through existing related-data blocks.

Wiki copy should summarize how the game works at a high level and point players toward the catalog sections that solve specific needs.

### Tables And Cards

- Put the dataset itself near the top of the page after the intro.
- Table/card labels should be short and familiar: `Rarity`, `Price`, `Source`, `Availability`, `Level`, `Damage`, `XP`, etc.
- Do not expose raw internal keys when a clean label is possible.
- Group items by the field players naturally scan first, such as rarity, category, region, world, source, or type.
- Use badges for short category/status values.
- Use table/card descriptions for details that need a sentence.
- Keep empty values visually quiet. Prefer `Not listed` or blank over invented filler.
- If a dataset is huge, add simple navigation or filters before adding more prose.
- Include all items. Do not cherry-pick only popular items.

### Length

- Write as little as possible while still being complete.
- Simple pages can have a short intro, one how-to paragraph, and focused FAQ.
- Complex pages can go deeper, but every paragraph must answer a real reader question.
- Avoid repeating the same idea across intro, how-to, FAQ, and wiki copy.
- Do not write long paragraphs when a compact table, list, or grouped card view is clearer.

### Research And Review Pass

Before writing:

1. Read the local dataset fields and item examples.
2. Check the source URLs stored in dataset `meta.sources`.
3. Identify what the player is trying to decide or understand.
4. List the 5-8 specific facts the page must cover.
5. Identify 3-5 reader questions the page should answer.

After writing:

1. Check every factual claim against the dataset or verified source notes.
2. Remove claims that are not supported.
3. Check that the intro, table context, how-to copy, wiki copy, and FAQ do not repeat each other.
4. Check that important item fields are explained somewhere on the page.
5. Check that no generic line survived.
6. Check that the page still reads naturally from top to bottom.

### Common Edits To Make

- Replace broad claims with specific game mechanics.
- Replace "helps you progress faster" with the actual effect, reward, source, or stat.
- Replace "rare items" with the actual rarity names or item examples.
- Replace "check the table below" with a line that explains what the reader should compare.
- Cut any sentence that only says the page is useful.
- Cut any sentence that repeats the title.
- Convert steps into numbered lists only when the player is doing a process.
- Convert item comparisons into tables or cards when scanning matters.

## Production Promotion

Only after local is clean:

1. Use a forward-only migration or a controlled seed/upsert script.
2. Keep production SQL idempotent with `on conflict` upserts.
3. Preserve existing published timestamps unless intentionally republishing.
4. Run production dry-runs before writing:
   - Use `NODE_ENV=production` so `scripts/shared/load-env.ts` reads `.env` instead of `.env.development.local`.
   - Confirm the target host is production, not `127.0.0.1:54321`.
   - Run `NODE_ENV=production npm run seed:game-catalog-pages -- --dry-run`.
   - Run `NODE_ENV=production npm run seed:game-wiki-pages -- --dry-run`.
   - Confirm expected row counts.
   - Confirm wiki rows show real `universe_id` values, not `not linked`.
5. Apply to production only after dry-runs are clean:
   - Run `NODE_ENV=production npm run seed:game-catalog-pages -- --allow-prod`.
   - Run `NODE_ENV=production npm run seed:game-wiki-pages -- --allow-prod`.
   - Do not use `--draft` for production publish unless the pages must stay hidden.
6. Verify production DB state after writing:
   - All expected `catalog_pages` rows exist.
   - All expected `wiki_pages` rows exist.
   - `is_published = true` for rows meant to go live.
   - No expected catalog or wiki rows have missing `universe_id`.
7. Verify production URLs and sitemap entries.
8. Trigger or confirm revalidation for `wiki` and `catalog` entities.

Production notes:

- Production Supabase can contain more than the default returned row count. Any script that looks up `roblox_universes` for matching must paginate with `.range(...)` or another explicit paging strategy.
- Keep seed payloads aligned with the current table schema. Do not carry old migration fields into upserts. In the current catalog schema, `cta_label`, `cta_url`, and `wiki_item_count` are not written to `catalog_pages`.
- If production writes fail with a schema-cache column error, stop and align the script or migration before retrying. Do not keep retrying the same payload.

## Quality Bar

- Do not publish empty catalog shells.
- Do not publish pages without useful `intro_md`, `how_it_works_md`, and `wiki_md`.
- Do not invent item stats that are absent from the dataset.
- Prefer blank/null fields over guessed values.
- Keep page copy practical: explain how players use the dataset, not marketing filler.
- Keep images local for dataset-backed collections unless the existing route intentionally uses remote images.
- When adding many similar games, improve the shared renderer/scripts instead of creating copy-pasted route families.
- Delete true one-off collector/import scripts once the data is stable, committed, and no longer needed.
- Keep reusable workflow scripts such as game catalog/wiki seeders because they are part of the repeated publishing process.

## Existing Reference Points

- `apps/web/src/lib/catalog.ts`: catalog page reads.
- `apps/web/src/lib/wiki.ts`: wiki page reads and related data.
- `apps/web/src/app/(site)/wiki/page-data.tsx`: wiki hub rendering and catalog blocks.
- `apps/web/src/app/(site)/catalog/[...slug]/page.tsx`: generic DB-backed catalog shell route.
- `supabase/migrations/20260901_create_wiki_pages.sql`: wiki schema and triggers.
- `supabase/migrations/20260904_add_catalog_wiki_copy.sql`: catalog wiki fields and The Forge seed pattern.
- `supabase/migrations/20260907_add_grow_a_garden_catalog_and_wiki_pages.sql`: full game catalog/wiki seed pattern.
