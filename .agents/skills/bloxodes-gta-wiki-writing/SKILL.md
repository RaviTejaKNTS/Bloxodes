---
name: bloxodes-gta-wiki-writing
description: Write game.json and final.json for one approved Bloxodes GTA wiki hub after research approval. Use for GTA game metadata, hub copy, tips, verified controls, and managed-development authoring output. Do not publish production content.
---

# Bloxodes GTA wiki writing

Use this only after `bloxodes-gta-wiki-research` has produced an approved `brief.md`.

## Workspace

Create or update:

```text
tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/
  brief.md
  game.json
  final.json
```

Read the approved brief and an existing GTA hub workspace before writing. Parse both JSON files before returning.

## Voice

Write like a player who knows the game and can explain it without performing for the reader.

- Use plain English, short paragraphs, concrete game nouns, and direct sentences.
- Talk to the player as `you` when it helps.
- A light dry line is fine when it carries a real fact. Do not force jokes.
- Do not use em dashes, hype, generic welcome copy, or phrases such as `ultimate`, `everything you need`, `delve`, `game-changer`, `Additionally`, or `It is important to note`.
- Do not mention sources, research, database rows, SEO, workflows, or what the page plans to cover.
- Do not add eyebrow text or request GTA-specific visual treatment. The route uses the existing Bloxodes design.

## Writing rules

- Start `description_md` with what the player does and how the game progresses.
- Keep the game mode explicit. Story Mode and GTA Online facts cannot blur together.
- Preserve edition and platform boundaries from the brief.
- For an announced or upcoming title, write a restrained hub with verified facts only. Do not speculate to make it feel fuller.
- Keep `tips_md` to three or four useful tips. An upcoming game may use an empty string when no real gameplay tips are verifiable.
- Fill `controls_json` only with verified bindings. Use `[]` when none are approved.
- A non-empty control row uses `{ "action": "", "desktop": "", "mobile": "", "tablet": "", "console": "" }` and includes only device keys supported by evidence. Do not use generic `controls`, `keys`, `value`, or `description` fields.
- Link collections through runtime data and the hub renderer. Do not hard-code future collection promises into `description_md`.
- Use `cover_image: null` in `final.json` unless the approved brief documents a reviewed exception. Game artwork belongs in `game.json`.

## game.json

```json
{
  "slug": "",
  "title": "",
  "short_title": "",
  "installment": "",
  "developer": "",
  "publisher": "Rockstar Games",
  "description_md": "",
  "cover_image": null,
  "hero_image": null,
  "official_url": "",
  "release_dates_json": {},
  "platforms_json": [],
  "status": "released",
  "is_published": true
}
```

`status` must be `announced`, `upcoming`, or `released`. Keep unknown dates and platforms out instead of guessing.

## final.json

```json
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
```

- `game_slug` and `slug` both use the approved editorial game slug.
- `title` follows `<Short Game Name> Wiki`.
- `seo_title` stays close to the title and names the real scope.
- `meta_description` says what a player can understand or check without making completeness or freshness claims.
- `description_md` uses one or two short, link-free paragraphs about the game loop and scope.

Return the workspace path, JSON parse result, and any fact omitted because the evidence was not strong enough.
