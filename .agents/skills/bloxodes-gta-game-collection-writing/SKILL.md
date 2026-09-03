---
name: bloxodes-gta-game-collection-writing
description: Write final.json for one Bloxodes GTA collection after approved research, data, and images. Use for metadata, collection explanations, FAQs, wiki hub copy, and GTA page identity. Do not change dataset facts or publish production.
---

# Bloxodes GTA game collection writing

Own the writing pass for one approved GTA collection. Do not spawn other workers. Start only after the brief records approved data and image readiness.

Follow the approved page type in `brief.md`. `database` copy should support browsing and comparison. `checklist` copy should support route planning, completion order, access requirements, or other player goals. Keep the same `final.json` shape and existing GTA collection row; `collection.pageType` belongs in `runtime-manifest.json`.

## Workspace

Read `brief.md` and `dataset.json`, then create or update:

```text
tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/final.json
```

When updating an existing collection, preserve accurate copy and structure. Change only passages affected by the approved facts or requested editorial work. Parse the JSON before returning.

## Voice

Write like a GTA player explaining the system to another player.

- Use simple English, short paragraphs, concrete game nouns, and direct sentences.
- Address the player as `you` when useful.
- Light, dry humor is fine when it sits on top of a real fact. Do not stack jokes or write around the answer.
- Do not use em dashes, hype, generic welcome copy, or stock AI phrases.
- Keep card facts, table values, controls, codes, mission names, platform sequences, and location directions plain.
- Do not mention sources, research, datasets, workflow, databases, SEO, cards, pages, or how the site works in public copy.
- Never add GTA-specific visual instructions, hero treatments, or eyebrow text.

## Non-negotiable content rules

- Write to the Story Mode or GTA Online scope approved in the brief. Never blend their prices, ranks, inventories, unlocks, statistics, or update behavior.
- Preserve edition and platform differences. Do not call later-release content universal.
- Do not invent statistics, rankings, handling claims, exact locations, unlock conditions, rewards, or mission dependencies.
- Do not state the collection or section item count in prose. Counts become stale. The only allowed count is `{count}` in `title` and `seo_title`.
- Do not promise completeness in prose. The verifier and dataset own the roster.
- Do not repeat dataset rows as paragraphs. Explain the rules, choices, progression, route, or mistakes that the rows alone cannot answer.

## Field jobs

### `display_name`

Use the short reusable label shown on the wiki hub, such as `Vehicles`, `Story Missions`, or `Letter Scraps`. Do not add the game name, count, colon, or SEO phrase.

### `title` and `seo_title`

Use `All {count} <Collection> in <Game>` when that reads naturally. Add `Story Mode` when it prevents confusion with GTA Online. Keep `{count}` unchanged so the GTA sync resolves it from the dataset.

### `meta_description`

Say what a player can compare, find, unlock, or finish. Name the mode when ambiguity is possible. Avoid `latest`, `updated`, `complete`, and other freshness claims.

### `intro_md`

Write one short paragraph that starts with the in-game system. Explain why the entries matter without describing the site or repeating the title.

### `description_md`

Answer the remaining player questions. Use the fewest headings needed.

- Explain unlocks, progression, tradeoffs, route choices, platform differences, edition limits, and common mistakes when relevant.
- Use two or three sentence paragraphs.
- Use bullets for steps or short comparisons.
- Use a small table only when several options share the same comparison fields.
- Do not repeat the intro, card descriptions, `how_it_works_md`, section notes, or FAQ answers.
- For location collections, explain access requirements and route logic without rewriting every location row.
- For missions, heists, or choices, avoid spoilers in metadata and intro. Put necessary spoilers behind clear headings in body copy.

### `how_it_works_md`

Explain field scales, platform code formats, map directions, availability labels, or other non-obvious row conventions. Keep it short. Leave it empty when the dataset needs no explanation.

### `description_json`

Add a short section note only when it provides context beyond the label and cards. Keys must exactly match `items[].system.section` and `meta.display.sectionOrder`. An empty object is valid.

### `faq_json`

Answer useful questions not already resolved above. Every row uses `{ "q": "", "a": "" }`. Never use `question` and `answer` keys.

### `wiki_md`

Write two to four sentences for the GTA game wiki hub. Explain what the system is, how a player reaches or uses it, and why it matters. Do not mention the collection, page, list, sources, or item count.

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

- `wiki_slug` is the editorial GTA game slug.
- `collection_slug` is the approved collection slug.
- `code` is `<game-slug>-<collection-slug>`.
- Do not include `universe_id` or any Roblox identifier.
- `wiki_sort_order` should match the manifest unless the parent approved another hub order.

## Final self-check

- Data and image gates are approved.
- JSON parses.
- Identity matches the manifest and route.
- `{count}` remains in titles and no prose count appears.
- FAQ keys are `q` and `a`.
- Section note keys match the dataset exactly.
- Public copy contains no source, workflow, page, database, or renderer language.
- Story Mode, Online, edition, and platform claims match the brief.
- The copy reads as Bloxodes, not a Rockstar press release or a generic game guide.

Return the final path, parse result, and any approved fact that could not be expressed without overstating the evidence.
