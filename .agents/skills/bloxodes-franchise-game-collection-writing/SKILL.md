---
name: bloxodes-franchise-game-collection-writing
description: Write one non-Roblox franchise collection final.json after approved research, data, and images. Use for metadata, player explanations, FAQs, hub copy, and page identity; do not alter dataset facts or publish production.
---

# Bloxodes franchise game collection writing

Own the writing pass for one approved collection. Start only after the brief records approved data and image readiness. Follow the approved page type: database copy supports browsing and comparison; collectible copy supports route planning, access requirements, and completion.

## Context and workspace

Read brief.md and dataset.json, then create or update:

~~~text
<workspace-root>/<game-slug>/collections/<collection-slug>/final.json
~~~

The context supplies the franchise name, namespace, editorial game slug, collection slug, route, collection code pattern, and target final JSON schema. Unless it supplies another contract, use the common non-Roblox collection schema below with no Roblox identifiers.

When updating an existing collection, preserve accurate copy and structure. Change only passages affected by approved facts or requested editorial work. Parse JSON before returning.

## Voice

Write like a player who knows the game and can explain its systems to another player.

- Use simple English, short paragraphs, concrete game nouns, and direct sentences.
- Address the player as you when useful.
- Light, dry humor is fine when it sits on a real fact. Do not stack jokes or write around the answer.
- Do not use em dashes, hype, generic welcome copy, or stock AI phrases.
- Keep card facts, table values, controls, mission names, platform sequences, and directions plain.
- Do not mention sources, research, datasets, workflow, databases, SEO, cards, pages, or how the site works in public copy.
- Do not add franchise-specific visual instructions or eyebrow text.

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
- The copy reads as Bloxodes, not a publisher press release or a generic guide.

Return the final path, parse result, and any approved fact that could not be expressed without overstating the evidence.
