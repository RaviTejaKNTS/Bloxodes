---
name: bloxodes-franchise-game-collection-writing
description: Write one non-Roblox franchise collection final.json after approved research, data, and images. Use for metadata, player explanations, FAQs, hub copy, and page identity; do not alter dataset facts or publish production.
---

# Bloxodes franchise game collection writing

You own the writing pass for one approved collection in a non-Roblox game. The dataset carries the facts. Your copy explains the system around them so a player knows what matters and what to do next. Start only after the brief records approved data and image readiness. Follow the approved page type: database copy supports browsing and comparison; collectible copy supports route planning, access requirements, and completion.

## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.

## Context and workspace

Read brief.md and dataset.json, then create or update:

~~~text
<workspace-root>/<game-slug>/collections/<collection-slug>/final.json
~~~

The context supplies the franchise name, namespace, editorial game slug, collection slug, route, collection code pattern, and target final JSON schema. Unless it supplies another contract, use the common non-Roblox collection schema below with no Roblox identifiers.

When updating an existing collection, preserve accurate copy and structure. Change only passages affected by approved facts or requested editorial work. Parse JSON before returning.

## Voice

Follow the voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Game collections" section of `.agents/skills/bloxodes-voice/references/examples.md`. Write like a player who has already figured this system out and is happy to save you the trial and error.

- Lead every prose field with the useful bit: what these things do, the choice that matters, the mistake to avoid.
- Personality goes in `intro_md`, `description_md` and `wiki_md`. Card facts, table values, controls, mission names, platform sequences and directions stay plain.
- Never mention databases, SEO, cards, pages or how the site works. Never say where a fact came from or how the page was made. Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.
- No franchise-specific visual instructions or eyebrow text.

## Non-negotiable content rules

- Write to the campaign, online-service, expansion, mode, edition, and platform scope approved in the brief. Never blend separate scopes.
- Preserve release-generation and platform differences. Do not call later-release content universal.
- Do not invent statistics, rankings, handling claims, exact locations, unlock conditions, rewards, or dependencies.
- Do not state the collection or section item count in prose. Counts become stale. The only allowed count is {count} in title and seo_title.
- Do not promise completeness in prose. The verifier and dataset own the roster.
- Do not repeat dataset rows as paragraphs. Explain rules, choices, progression, route, or mistakes the rows alone cannot answer.

## Field jobs

### display_name

Use the short reusable label shown in UI and hub headings, such as Vehicles, Story Missions, Characters, or Letter Scraps. Do not add the game name, count, colon, or SEO phrase.

### title and seo_title

Use All {count} <Collection> in <Game> when it reads naturally. Add the mode or edition when it prevents confusion. Keep {count} unchanged so the target sync resolves it from the dataset.

### meta_description

Say what a player can compare, find, unlock, or finish. Avoid latest, updated, complete, and other freshness claims.

### intro_md

Write one short paragraph that starts with the in-game system. Explain why the entries matter without describing the site or repeating the title.

### description_md

Answer the remaining player questions with the fewest useful headings:

- Be complete: use the dataset's real numbers to cover what players need to choose well, at least as well as the top-ranking guides. That means early, mid and late choices and best-value options when the collection has a progression or price, plus unlocks and common mistakes. A location or route collection covers access and route logic instead. Give answers, not "check the X" chores.

- Explain unlocks, progression, tradeoffs, route choices, platform differences, edition limits, and common mistakes when relevant.
- Use short paragraphs, bullets for steps or comparisons, and a small table only when it clarifies several shared options.
- Do not repeat the intro, card descriptions, how_it_works_md, section notes, or FAQ answers.
- For location collections, explain access requirements and route logic without rewriting every row.
- For missions or choices, keep spoilers out of metadata and intro and label necessary spoilers clearly.

### how_it_works_md

Explain field scales, platform codes, map directions, availability labels, or other non-obvious row conventions. Keep it short or leave it empty.

### description_json

Add section notes only when they give context beyond the label and cards. Keys must exactly match items[].system.section and meta.display.sectionOrder. An empty object is valid.

### faq_json

Answer useful questions not already resolved above. Every row must use q and a keys:

~~~json
[{ "q": "", "a": "" }]
~~~

Do not use question and answer keys.

### wiki_md

Write two to four sentences for the game wiki hub. Explain what the system is, how a player reaches or uses it, and why it matters. Do not mention the collection, page, list, sources, or item count.

## Output shape

~~~json
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
~~~

- wiki_slug is the editorial game slug.
- collection_slug is the approved collection slug.
- code follows the context's collection code pattern, normally <game-slug>-<collection-slug>.
- Do not include universe_id or any Roblox identifier.

## Final self-check

- Data and image gates are approved.
- JSON parses.
- Identity matches the manifest and route.
- {count} remains in titles and no prose count appears.
- FAQ keys are q and a.
- Section-note keys match the dataset exactly.
- Public copy contains no source, workflow, page, database, or renderer language.
- Mode, expansion, edition, platform, and release claims match the brief.
- The copy passes the voice guide's "Before you hand it in" check: it sounds like a player explaining the game, not a publisher press release or a generic guide.

Return the final path, parse result, and any approved fact that could not be expressed without overstating the evidence.
