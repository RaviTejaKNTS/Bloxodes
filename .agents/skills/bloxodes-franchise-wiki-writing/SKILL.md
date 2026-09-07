---
name: bloxodes-franchise-wiki-writing
description: Write one non-Roblox franchise game wiki hub from an approved brief. Use for game metadata, hub copy, tips, verified controls, and final JSON; do not publish production.
---

# Bloxodes franchise wiki writing

Use this after bloxodes-franchise-wiki-research has produced an approved brief. Write one title hub only. Do not publish production, change the dataset, or add future-page promises.

## Context and workspace

Read the approved brief and an existing hub workspace from the same franchise when available. The parent must provide or resolve:

- franchise name and namespace
- game slug, hub route, and target game/wiki schema
- authoring workspace root
- publisher/source and mode/edition boundaries

Create or update:

~~~text
<workspace-root>/<game-slug>/wiki/<game-slug>/
  brief.md
  game.json
  final.json
~~~

Use the target franchise schema supplied by the context. Unless the target implementation says otherwise, use the common non-Roblox hub contract below, with no Roblox identifiers.

## Voice

Write like a player who knows the game and can explain it without performing for the reader.

- Use plain English, short paragraphs, concrete game nouns, and direct sentences.
- Talk to the player as you when it helps.
- A light dry line is fine when it carries a real fact. Do not force jokes.
- Do not use em dashes, hype, generic welcome copy, or stock AI phrases.
- Do not mention sources, research, database rows, SEO, workflows, or what the page plans to cover.
- Do not add franchise-specific visual instructions or eyebrow text. Use the existing Bloxodes design.

## Writing rules

- Start description_md with what the player does and how the title progresses.
- Keep the campaign, online service, expansion, and other scopes explicit. Do not blend inventories, progression, prices, ranks, or updates from separate scopes.
- Preserve platform, edition, and release-generation boundaries from the brief.
- For an announced or upcoming title, write only restrained, verified facts. Leave tips_md empty when real gameplay tips cannot be supported.
- Fill controls_json only with verified bindings. Use [] when none are approved.
- Use the control keys accepted by the target renderer. Do not invent a control schema or infer bindings from supported-platform flags.
- Link approved collections through runtime data and the hub renderer. Do not hard-code future collection promises into description_md.
- Keep artwork fields null unless the brief documents a reviewed exception. Game artwork belongs in the target game metadata file.

## game.json

Unless the target schema supplies another contract:

~~~json
{
  "slug": "",
  "title": "",
  "short_title": "",
  "installment": "",
  "developer": "",
  "publisher": "",
  "description_md": "",
  "cover_image": null,
  "hero_image": null,
  "official_url": "",
  "release_dates_json": {},
  "platforms_json": [],
  "status": "released",
  "is_published": true
}
~~~

Use only announced, upcoming, or released for status. Keep unknown dates, platforms, and fields empty or absent as the target schema requires. Do not use Roblox identifiers.

## final.json

Unless the target schema supplies another contract:

~~~json
{
  "game_slug": "",
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "description_md": "",
  "tips_md": "",
  "controls_json": [],
  "cover_image": null,
  "is_published": true
}
~~~

- game_slug and slug use the approved editorial title slug.
- title follows <Short Game Name> Wiki.
- seo_title stays close to the title and names the real scope.
- meta_description says what a player can understand or check without claiming completeness or freshness.
- description_md uses one or two short, link-free paragraphs about the title's loop and scope.

Parse both JSON files before returning. Return the workspace path, parse results, and any fact omitted because the evidence was not strong enough.
