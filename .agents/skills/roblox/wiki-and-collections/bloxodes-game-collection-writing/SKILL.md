---
name: bloxodes-game-collection-writing
description: Write one Bloxodes game-specific collection final.json after collection research, data approval, and image approval. Use for durable in-game collections backed by local datasets and wiki_collection_pages, metadata, intro_md, description_md, description_json, faq_json, wiki_md, and final.json output.
---

# Bloxodes Game Collection Writing

A collection page lets players compare everything in one in-game system: pets, units, rods, recipes. The cards carry the data. Your copy explains the system around them: what matters, what to pick first and what people get wrong. Write it like a player who's already figured the system out and is happy to save you the trial and error.

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Write final.json directly using the Write tool.**

Use this after `brief.md`, data readiness and image readiness are approved, for one durable item or system collection in one Roblox game. Find the game and collection suggestions and workspace from the task context, or use the default workspace below. Keep any supplied workspace override. Return the stage artifacts when you're done.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Game collections" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources and merge duplicates. When sources disagree on a value, use the better-supported one or a range, as the data skill's "Conflicting sources" rule says. Leave a value empty or null only when no reliable source gives one. Record missing rows, conflicting claims and follow-ups in the brief so the page can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile page.

The brief owns the page type. `database` copy can focus on browsing and comparing the roster. `collectible` copy explains the route, unlocks, order or completion rules that help a player finish. Don't add a new final JSON shape or a page-specific table: `collection.pageType` stays in `runtime-manifest.json`, and the shared renderer picks the presentation.

## Workflow

1. Read the approved `brief.md`.
2. Confirm `Data readiness` says the dataset uses the v2 wrapped shape `{ meta, items[].item, items[].system }`, public game fields are separate from system fields, grouping metadata is ready when sections exist, and section labels, card/table field order, the field presentation map, highlight/chip/detail/plain fields, field consistency and renderer/config support are all ready.
3. Confirm `Image readiness` is approved, or that missing images were clearly accepted.
4. When updating an existing page, keep its copy, headings and structure unless the brief shows a passage is wrong or outdated. Change only those passages.
5. Create or update:

   ```text
   tmp/content-workspace/<game-slug>/collections/<collection-slug>/
     brief.md
     final.json
   ```

6. Write `final.json`.
7. Parse the JSON before returning.

## How the copy should read

- **Explain the game system, not the page.** Never describe what the page is, how to use it, or "the cards below." Talk about the items and the choices players make.
- **Lead with the useful bit.** Every field opens on the real thing: what these items do, the choice that matters, the mistake to avoid.
- **Personality goes in the intro, description and wiki blurb.** Card values, table cells and short facts stay plain and exact.
- **Use the dataset's values and the brief's recommended ranges.** Never leave a pick, price or stat out of the body because sources disagreed. A caveat goes in once, next to the advice, only when the difference changes what the player should do.
- **Never narrate the research.** Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.
- **Never write item counts in prose.** Don't say how many items the collection or a section has, and avoid phrases like "all X items," "over X" or "the full list of X." Counts change every time data improves, so the copy goes stale. This applies to `intro_md`, `description_md`, `description_json`, `faq_json` and `wiki_md`. The only count allowed is the `{count}` token in `title` and `seo_title`, which the seed/verify workflow fills from the live dataset.

## Field by field

### `intro_md`

One small paragraph that drops straight into the item system and gives the reader their bearings. It shouldn't repeat anything said elsewhere on the page. A strong intro names what every item does in the game, then the one choice that actually matters when picking. See "Game collections" in `.agents/skills/bloxodes-voice/references/examples.md` for the move, and write your own words.

### Cards (from the dataset)

Cards are the default view. They should feel complete, consistent and quick to scan:

- The item name.
- One useful description line or short paragraph.
- Easy-to-scan key-value facts.
- A collection-specific field presentation contract. Don't rely on renderer word matching or value guessing.
- At least one supported highlight-style field when the collection has a natural status, strength, availability, best-use or recommendation value.
- Chip fields for prices, time, rarity, tier, chance, levels, costs, damage, BPS and other short numbers.
- Plain fields for comparable text like source, shop, main use, role or route name.
- Detail fields for longer sentence facts like how to get it, behavior, weaknesses, route notes or strategy.
- No hard limit on fields, but include only fields that help players compare or understand real differences.

Card rules:

- Card details come from the dataset. Don't invent fields in `final.json`. Make sure the dataset already has what the page needs.
- Cards and list view show the same public details. Don't plan details for only one view.
- Keep field names consistent across rows. Missing supported values stay empty or null so the renderer shows `-`.
- Don't merge labels into values. The value is `Available`, not `Availability: Available`.
- Detail fields are complete sentences. Arrays are only for real lists.
- If a field key renders as a chip, highlight, detail or plain value on one card, it renders that way on every card. Style belongs to the field key, not to individual values.

### `description_json`

Optional section notes that sit above each card group. Use one only when it adds context the cards don't. One small paragraph, never a repeat of card copy.

- Keys must exactly match the rendered section labels from `items[].system.section` and `meta.display.sectionOrder`. If the sections are `Basic`, `Rare` and `Exclusive`, those are your keys.
- Don't write a note for every section by default. An empty `description_json` is fine when the labels say enough.
- A good note gives one fact that changes how a player reads that group: where those items come from, or a rule that applies only to them.

### `description_md`

The main body. It covers what a player needs to use or finish this collection: strategy, progression, the key choices and trade-offs, common mistakes and any rules the cards don't make obvious. Cover what's genuinely useful for this collection, then stop. The goal is a page that feels complete, not one that fills a template.

- Let the content decide the structure. Use as few sections as the brief's player questions need, but answer all of them. Don't force a section count or reuse the same shape on every page.
- Be complete. Cover what a player needs to choose well: best early, mid and late picks with the real numbers behind them and the best-value options (when the collection has a progression or price), how the system unlocks or progresses, and the common mistakes. Match what the top-ranking guides for this collection cover. Three thin sections of "check the cost before you buy" is not a finished body.
- Give answers, not chores. Instead of "check the route before you save up," say which items need Research, a case or an event, and what the cheapest good option is.
- Short paragraphs of about 2 or 3 sentences. Break up anything that turns into a wall.
- Bullets for steps, tips, quick comparisons and short lists.
- A Markdown table when you're comparing a few options on the same dimensions (like which item to pick for which situation). Only when it reads cleaner than prose.
- A few clear, search-friendly headings that say what each section answers, using the game name where it reads naturally ("Which Garden Rush Pets to Hatch First"). A short body may need none. No vague, cute or sentence-like headings and no needless subsections.
- Don't repeat the cards, intro, how-it-works note or section notes. Only add what the rest of the page doesn't say.
- No filler. If a section would only pad the page, cut it.
- Stay concrete and specific to this game system, in plain English anyone can follow.
- The no-count rule applies here too.

### `wiki_md`

The blurb that sits next to this collection's link on the game's wiki hub. Most blurbs are too generic ("this collection lists all the items") and tell the reader nothing. Make this one useful.

- Explain what this thing is in the game and how it works for a player, like you're explaining it to someone who just started.
- Be specific: what the items do, how you get them, where they fit, or the choice a player makes between them. Use real in-game terms.
- Short, simple sentences. No jargon, no hype like "ultimate" or "complete."
- 2 to 4 sentences: enough to help someone decide to open the page, not a full guide.
- No item counts, and never mention the page, the list or "this collection." Talk about the game system.

A good shape: what it is in the game, then how it works or how you get it, then why it matters. End on a practical takeaway a new player can act on.

## Field jobs

- `display_name`: the short reusable collection name for UI labels and wiki hub headings, like `Units`, `Food Items`, `NPCs` or `UGC Items`. No counts, game names, colons or SEO phrasing. This is the canonical label, so scripts never infer it from `collection_slug` or `title`.
- `title`: the collection title pattern with the count token: `All {count} <Collection> in <Game>`. Add one short reader-focused angle only when it makes the title clearer. Never replace `{count}` with a number yourself.
- `seo_title`: close to the title, natural for search, with the same `{count}` token when the title has a count.
- `meta_description`: what the reader can compare or learn, plus a reason to click, in roughly 140 to 160 characters. Name the game, the items and the comparison players care about.
- `intro_md`: what this collection is in the game and why players compare it.
- `description_md`: the main body described above. Flexible structure, no fluff, no repeats.
- `how_it_works_md`: explain page fields only when they need context. Keep it short.
- `description_json`: section notes only when they add context. Keys match rendered section labels.
- `faq_json`: useful follow-up questions not already answered. Every entry uses `q` and `a`: `{ "q": "...", "a": "..." }`. Never `question`/`answer`, because the renderer reads `q`/`a` and wrong keys render a blank FAQ.
- `wiki_md`: the hub blurb described above. Specific, 2 to 4 sentences, no count.

## Output shape

```json
{
  "universe_id": 0,
  "wiki_slug": "",
  "collection_slug": "",
  "code": "",
  "display_name": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "description_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [{ "q": "", "a": "" }],
  "wiki_md": "",
  "is_published": true
}
```

- `code` is `<game-slug>-<collection-slug>`.
- `wiki_slug` is `<game-slug>` and `collection_slug` is `<collection-slug>`.
- Never use `roblox_universes.slug` for editorial slugs.

Before returning, run the voice guide's "Before you hand it in" check across every prose field.
