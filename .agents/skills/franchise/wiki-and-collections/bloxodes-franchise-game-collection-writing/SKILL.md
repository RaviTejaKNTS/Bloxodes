---
name: bloxodes-franchise-game-collection-writing
description: Write one non-Roblox franchise collection final.json after approved research, data and images. Same page, fields and rules as the Roblox collection writing skill, with franchise identity, scope and storage. Use for titles, metadata, intro_md, description_md, description_json, faq_json and wiki_md; don't alter dataset facts or publish production.
---

# Bloxodes Franchise Game Collection Writing

A collection page lets players compare everything in one in-game system: characters, vehicles, weapons, missions, collectibles. The cards carry the data. Your copy explains the system around them: what matters, what to pick first and what people get wrong. Write it like a player who's already figured the system out and is happy to save you the trial and error.

This is the same job, the same page and the same rules as `bloxodes-game-collection-writing` for Roblox. The only differences are listed under "Franchise differences" below. If you find yourself writing something the Roblox page wouldn't have, stop and check.

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Write final.json directly.**

Use this after `brief.md`, data readiness and image readiness are approved, for one collection in one non-Roblox game. Find the namespace, game slug, collection slug and workspace from the task context. Return the stage artifacts when you're done.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Game collections" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- Page standards: `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images, layout).
- The approved `brief.md`.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources and merge duplicates. When sources disagree on a value, use the better-supported one or a range, as the data skill's "Conflicting sources" rule says. Leave a value empty or null only when no reliable source gives one. Record missing rows, conflicting claims and follow-ups in the brief so the page can improve later.

An incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile page.

The brief owns the page type. `database` copy can focus on browsing and comparing the roster. `collectible` copy explains the route, unlocks, order or completion rules that help a player finish. Don't add a new final JSON shape or a page-specific table: `collection.pageType` stays in `runtime-manifest.json`, and the shared renderer picks the presentation.

## Workflow

1. Read the approved `brief.md`.
2. Confirm `Data readiness` says the dataset uses the v2 wrapped shape `{ meta, items[].item, items[].system }`, public game fields are separate from system fields, grouping metadata is ready when sections exist, and section labels, card/table field order, the field presentation map, highlight/chip/detail/plain fields, field consistency and renderer support are all ready.
3. Confirm `Image readiness` is approved. Every item that has an image in the game needs one; text-only rows are allowed only when the brief records that no clean image exists.
4. When updating an existing page, keep its copy, headings and structure unless the brief shows a passage is wrong, outdated or below page standards. Change only those passages.
5. Create or update `<workspace-root>/<game-slug>/collections/<collection-slug>/final.json`.
6. Parse the JSON before returning.

## How the copy should read

- **Explain the game system, not the page.** Never describe what the page is, how to use it, how to read a field, what a label or code means on the card, or "the cards below." Players already know how to read a list. Talk about the items and the choices players make.
- **Lead with the useful bit.** Every field opens on the real thing: what these items do, the choice that matters, the mistake to avoid.
- **Personality goes in the intro, description and wiki blurb.** Card values, table cells, controls, mission names, platform sequences and directions stay plain and exact.
- **Use the dataset's values and the brief's recommended ranges.** Never leave a pick, price or stat out of the body because sources disagreed. A caveat goes in once, next to the advice, only when the difference changes what the player should do.
- **Never narrate the research.** Follow the public copy rules in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.
- **Never write item counts in prose.** Don't say how many items the collection or a section has, and avoid "all X items," "over X" or "the full list of X." The only count allowed is the `{count}` token in `title` and `seo_title`, which publication fills from the live dataset.

## Field by field

### `intro_md`

One small paragraph that drops straight into the item system and gives the reader their bearings. It shouldn't repeat anything said elsewhere on the page. A strong intro names what every item does in the game, then the one choice that actually matters when picking.

### Cards (from the dataset)

Cards are the default view. They should feel complete, consistent and quick to scan:

- The item name and its image.
- One useful description line or short paragraph.
- Easy-to-scan key-value facts.
- A collection-specific field presentation contract. Don't rely on renderer word matching or value guessing.
- At least one supported highlight-style field when the collection has a natural status, strength, availability, best-use or recommendation value.
- Chip fields for prices, time, rarity, tier, levels, costs, stats and other short numbers.
- Plain fields for comparable text like source, shop, role, mode or route name.
- Detail fields for longer sentence facts like how to get it, behavior, weaknesses, route notes or strategy.
- Include only fields that help players compare or understand real differences.

Card rules:

- Card details come from the dataset. Don't invent fields in `final.json`.
- Cards and list view show the same public details.
- Keep field names consistent across rows. Missing supported values stay empty or null so the renderer shows `-`.
- Don't merge labels into values. The value is `Available`, not `Availability: Available`.
- Detail fields are complete sentences. Arrays are only for real lists.
- A field key renders the same way on every card.

### `description_json`

Optional section notes above each card group. Use one only when it adds context the cards don't. One small paragraph, never a repeat of card copy.

- Keys must exactly match `items[].system.section` and `meta.display.sectionOrder`.
- An empty object is fine when the labels say enough.
- A good note gives one fact that changes how a player reads that group: where those items come from, or a rule that applies only to them.

### `description_md`

The main body. It covers what a player needs to use or finish this collection: strategy, progression, the key choices and trade-offs, common mistakes and any rules the cards don't make obvious. Cover what's genuinely useful, then stop.

- Let the content decide the structure, but answer every player question in the brief.
- Be complete. Cover the best early, mid and late picks with the real numbers behind them and the best-value options (when the collection has a progression or price), how the system unlocks or progresses, and the common mistakes. Match what the top-ranking guides cover. A location or route collection covers access and route logic instead.
- Give answers, not chores. Instead of "check the requirements first," say which ones need what, and what the easiest good option is.
- Short paragraphs of about 2 or 3 sentences. Bullets for steps, tips and quick comparisons. A Markdown table when comparing a few options on the same dimensions.
- Headings follow page standards: descriptive, search-friendly, with the game name where it reads naturally, so a reader skimming only the headings knows what each section covers ("How to Unlock Every Mario Kart World Character", not "Opening racers"). No vague or cute headings and no needless subsections.
- Don't repeat the cards, intro or section notes. No filler.

### `wiki_md`

The blurb next to this collection's link on the game's wiki hub.

- Explain what this thing is in the game and how it works for a player, like you're explaining it to someone who just started.
- Be specific: what the items do, how you get them, where they fit, or the choice a player makes between them.
- Short, simple sentences. No hype like "ultimate" or "complete."
- 2 to 4 sentences. No item counts, and never mention the page, the list or "this collection."

## Field jobs

- `display_name`: the short reusable label for UI and wiki hub headings, like `Characters`, `Vehicles`, `Story Missions`. No counts, game names, colons or SEO phrasing.
- `title`: `All {count} <Collection> in <Game>`, plus one short reader-focused angle when it makes the title clearer (`All {count} Characters in Mario Kart World and How to Unlock Them`). Add the mode or edition when it prevents confusion. Never replace `{count}` yourself. Aim for 50 to 65 characters once the count is filled.
- `seo_title`: close to the title, natural for search, with the same `{count}` token.
- `meta_description`: what the reader can compare, find, unlock or finish, plus a reason to click, in roughly 140 to 160 characters. No "latest" or "updated."
- `how_it_works_md`: leave empty. Mechanics, stat meanings and trade-offs go in `description_md`. Never explain field scales, labels, codes or how to read the collection.
- `faq_json`: useful follow-up questions not already answered. Every entry uses `q` and `a`. Never `question`/`answer`; the renderer reads `q`/`a`.

## Franchise differences

These are the only places this skill differs from the Roblox one.

- **Identity:** no `universe_id` or any Roblox identifier. The page belongs to a namespace (`gta`, `mario-kart`) and an editorial game slug from the `games` registry. Read the wiki row's `canonical_path` before planning links. Routes and tables are in `bloxodes-docs/content/franchise.md`.
- **Scope:** write to the campaign, online service, expansion, mode, edition and platform the brief approves. Never blend scopes, and don't call later-release content universal.
- **Spoilers:** keep story spoilers out of the title, meta description and intro. Label necessary spoilers clearly in the body.
- **Publication:** `sync:shared-game-collection-runtime -- --namespace <slug>` with the reviewed runtime manifest, through the `franchise-collection` publisher. Keep immutable dataset and media revisions; never edit published items.

## Output shape

```json
{
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
  "wiki_sort_order": 100,
  "is_published": true
}
```

- `wiki_slug` is the editorial game slug. `collection_slug` is the approved slug. `code` is normally `<game-slug>-<collection-slug>`.

## Before you return

- Data and image gates are approved, and every item with a game image has one.
- JSON parses. Identity matches the manifest and route.
- `{count}` stays in the titles; no prose count anywhere.
- `how_it_works_md` is empty, and nothing explains how to use the page.
- Headings and title meet `bloxodes-docs/content/page-standards.md`.
- FAQ keys are `q` and `a`. Section-note keys match the dataset.
- Mode, expansion, edition, platform and release claims match the brief.
- The voice guide's "Before you hand it in" check passes on every prose field.

Return the final path, the parse result and any approved fact you couldn't express without overstating the evidence.
