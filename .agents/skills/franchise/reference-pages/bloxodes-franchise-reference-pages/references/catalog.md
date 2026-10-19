# Franchise Catalog Research

You're researching one approved namespace-scoped catalog page so the writer can start from solid, player-ready facts. You hand back a `brief.md`. You don't write `final.json`.

## Output

```text
tmp/content-workspace/<namespace>/<game-slug>/catalogs/<catalog-code>/brief.md
```

## Research steps

1. Resolve namespace, game UUID, kind, parent and edition/platform/mode scope. Check production for existing catalog coverage. Search by slug, title, route, source URL and synonyms.
2. Look at the current row, local dataset, item examples, images and rendered route behavior when they're available.
3. Verify data and source quality, item count, useful fields and image support.
4. Decide what the page needs to explain beyond the reference rows. Keep game-specific item collections on the collection workflow when cards, item images or completion tracking fit them better.
5. Find the closest successful Bloxodes page in the same search family. Record its exact browser-title pattern, H1 pattern, metadata structure and heading outline. Copy the pattern, not its unrelated wording.
6. Decide whether item counts and freshness values are stable enough for metadata. Don't lead the H1 with a value that can change after a refresh.

## Writing the brief for the writer

The writer copies the tone of what you hand them, so make the brief easy to turn into good copy. Read `.agents/skills/bloxodes-voice/SKILL.md` first.

- **Write facts in plain player language.** "Each item shows its price and where it drops," not "dataset exposes price and source fields."
- **Name the reader's real question** in `Reader need`. What did they search for, and what do they want to do next?
- **Point out hooks worth using:** a surprising true fact, a common mistake, the thing most players get wrong.
- **Keep sources, doubts and data notes private.** Put them under `Evidence checked` or `Open gaps or risks`, not in `Facts to use`. If a fact is shaky, say so once in plain words so the writer can add one short caveat or leave it out.
- **No research jargon in reader-facing parts.** Words like dataset, rows, source coverage and provenance stay in the evidence section.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Source/data coverage:
- Item count:
- Useful fields:
- Required cover/thumbnail source, credit and image support:
- Edition/platform/mode/release-generation and spoiler scope:

Catalog plan:
- Title:
- SEO title:
- Slug:
- Reader need:
- Comparable page and pattern:
- Heading plan:
- Facts to use:
- Facts to avoid:
- Hooks worth using:
- Open gaps or risks:
```

# Franchise Catalog Writing

Catalog pages cover a durable reference set that players need to compare or look up. Your copy gets them to the answer fast, explains anything that trips them up, and sounds like a player who has done it a hundred times.

Use this after the research above and parent approval. For one game's item collection with cards, item images or progress, use `bloxodes-franchise-game-collection-writing` instead.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Catalog pages" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<namespace>/<game-slug>/catalogs/<catalog-code>/
     brief.md
     final.json
   ```

3. Write the `catalog` group in `final.json`, with page fields and `catalog_data` together. The runtime reads `game_catalog_pages`, not workspace files.
4. Check the output contract before returning. JSON parsing and validation run on GitHub, never locally.

## How the copy should read

- **Explain what the items are and what players can do with them.** Say where the items show up, then the in-game action that uses one when that matters.
- **Short intro, practical body.** `description_md` covers practical help, caveats and how to use or compare the items.
- **Talk about the items, not the website.** No `use this catalog`, `this page` or `the dataset`. Never narrate how the page was made. Follow Public Copy in root `AGENTS.md`.
- **No raw output.** No raw HTML, raw arrays, nested objects or unexplained `Yes`/`No` values.
- **FAQs answer real player questions.**

## SEO and headings

- `title` is one keyword-first H1: a natural, stable phrase that names the collection. Don't pair exact synonyms like `codes` and `IDs` when they mean the same value. Use the clearest term once. Never lead the H1 with an item count, month, year or freshness claim.
- Keep `seo_title` close to the H1. When a verified count or short synonym really helps search intent, put it after the main phrase in brackets, like `<Game> Crafting Recipes [Verified Count]`. Skip the count if the source workflow doesn't maintain it.
- `meta_description` says what the reader can find, compare or understand in the game. Include a verified count only when the same refresh workflow maintains it.
- H2s describe the section fully on their own. Clear questions or tasks work well, like `Where to Find <Game> Crafting Materials` or `Which Recipes Unlock Better Tools`. Avoid fragments like `Choosing a font`, `Overview`, `Details` and a generic `How it works`.
- Use a topic-specific FAQ heading in the renderer, like `<Game> Crafting Recipes FAQ`, instead of a bare `FAQ` when the route supports a custom title.
- Don't add a visible `Browse all...` line, count line, eyebrow, badge or label just to create a heading level or repeat the H1. If repeated item names need headings and there's no useful parent heading, render item names as H2s. Use H3s only under a genuinely useful visible H2.
- Keep the H1, browser title, Open Graph title, breadcrumb name, WebPage name and ItemList name sourced consistently so they don't drift.

## Field jobs

- `namespace`, `game_id` and `slug`: the approved namespace, exact registry UUID and stable catalog slug.
- `title`: the natural keyword-first H1, with no changing counts or dates.
- `seo_title`: follows the approved comparison-page pattern. A verified count or short synonym in brackets only when it improves search clarity and can be maintained.
- `meta_description`: what the reader can find, compare or understand, with a reason to click, about 140 to 160 characters.
- `intro_md`: what the reference covers and why it matters in the game.
- `description_md`: answers the main question in depth without repeating every row. Use descriptive SEO headings, full sentences, comparison context and useful internal links. No instructions about filters or table controls.
- `sources_json`: credited sources with `title` and HTTPS `url`.
- `catalog_data`: named columns and complete supported rows, using the contract in `payloads.md`.
- `is_published` and `published_at`: reviewed visibility and date.

The shared catalog contract has no `how_it_works_md`, `description_json`, `faq_json` or `wiki_md` fields. Don't copy those Roblox fields into the payload. Keep any required FAQ and related links in supported Markdown when the renderer can show them in the matching layout; otherwise report the implementation gap. A cover/thumbnail is still required. Missing image storage or social rendering blocks publication.

## Output shape

```json
{
  "catalog": [{
    "namespace": "<namespace>",
    "game_id": "<game-uuid>",
    "slug": "<catalog-slug>",
    "title": "",
    "seo_title": "",
    "meta_description": "",
    "intro_md": "",
    "description_md": "",
    "sources_json": [],
    "catalog_data": {
      "columns": [{ "key": "name", "label": "Name" }],
      "items": [{ "id": "<stable-row-id>", "name": "<verified-item-name>" }]
    },
    "is_published": false
  }]
}
```

Only include fields the target row uses. `GameCatalog` is the current default table body; exact Roblox layout parity may need a reviewed renderer change. A special interactive catalog needs registered code while continuing to read its data from `game_catalog_pages`. Never put executable content in rows.

