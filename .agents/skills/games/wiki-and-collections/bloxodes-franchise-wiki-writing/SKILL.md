---
name: bloxodes-franchise-wiki-writing
description: Write one non-Roblox franchise game wiki hub from an approved brief. Use for game metadata, hub copy, tips, verified controls, and final JSON; do not publish production.
---

# Bloxodes franchise wiki writing

Use this after `bloxodes-franchise-wiki-research` has produced an approved brief. Write one title hub only. Do not publish production, change the dataset, or add future-page promises.

## Shared game storage

Managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate. Scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.

`games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Other mode and edition labels describe content without adding kinds. Read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub and child game wikis. Preserve Minecraft's edition URLs.

Use `publish:game-pages -- --namespace <slug> --file <reviewed.json>` for reviewed game, wiki, codes page and registered tool payloads. It is dry run by default; `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity before wiki, then collections. Research stays in ignored workspaces.

Use `sync:shared-game-collection-runtime` with `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items. General wiki and collection workflows cover standalone games and franchises. GTA specialists retain mode, source, map and collectible rules under `namespace = 'gta'`.

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

Follow the voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Wiki hubs" section of its `references/examples.md`. A hub is the front door to the game, so a new player should finish the description knowing what they actually do in it, and the tips should sound like advice from someone who's already made the early mistakes.

- Open `description_md` on what the player does, not "X is a game where..."
- Real game nouns, short paragraphs, "you" when it helps.
- Never mention database rows, SEO or what the page plans to cover. Never say where a fact came from or how the page was made. Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.
- No franchise-specific visual instructions or eyebrow text. Use the existing Bloxodes design.

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
