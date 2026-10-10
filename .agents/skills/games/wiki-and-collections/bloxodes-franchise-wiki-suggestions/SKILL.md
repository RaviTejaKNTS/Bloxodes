---
name: bloxodes-franchise-wiki-suggestions
description: Suggest a Bloxodes wiki hub for one non-Roblox game title inside a configured franchise namespace. Use before hub research or writing; do not use for Roblox titles or collection discovery.
---

# Bloxodes franchise wiki suggestions

You decide whether Bloxodes should build a wiki hub for one non-Roblox video game title. Done means a short evidence summary and one clear decision.

This is a discovery call for the hub only. Don't write page files or suggest collection pages.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## Required franchise context

Resolve these from the request, the closest repository instructions and the target platform's existing implementation before you decide:

- Franchise name and namespace, for example a human name and a URL/table prefix.
- Exact title, editorial game slug, title kind, parent title when relevant, and official URL.
- Hub route pattern, such as `<route-prefix>/wiki/<game-slug>`.
- Game identity table, wiki table or view, and the managed-development and production environments to check.
- Official-source policy: publisher/developer, support/manual, news or other primary source groups for this franchise.
- Mode, expansion, online-service, edition and platform boundaries.

The namespace, route, tables and commands are context values, not assumptions. If you can't resolve a required value, return `[source discovery incomplete]` and name the missing value.

## Start

1. Resolve the exact title, title kind, editorial slug, official URL, developer, publisher, release status, release dates and supported platforms.
2. Check the configured game and wiki tables plus the exact managed-development and production route. Never recommend a duplicate, or a title whose scope is already covered under a different name.
3. Check related Bloxodes page families only to spot overlap or a better page type. Don't turn an article, collection, tool or online-service page into a hub without evidence.
4. Define the mode, expansion, edition and platform scope the hub would actually cover.

## Source check

Search broadly enough to understand the normal player loop, progression, player role, major systems, controls, and the lasting questions a new or returning player needs answered.

Prefer sources in this order when the claim allows it:

1. The configured official publisher/developer pages, support pages, manuals, news posts, patch notes and official videos.
2. A stable franchise or game-specific wiki/database with page-level detail.
3. Established guide sites that separate title, mode, edition, platform and release generation.
4. Community material, only for gaps stronger sources can't fill. Record the weaker evidence and don't promote it to a hard fact without corroboration.

Open the useful pages. Search snippets are leads, not final proof. Cross-check facts that vary by title, mode, edition, platform, release generation or live-service state.

## What counts

Recommend a hub only when the title has enough stable, source-backed gameplay information to help players beyond a short article. A released, announced, expansion or online title can qualify when its scope is explicit and the facts support a useful hub.

Skip a title when public information is too thin, mostly temporary, only news or speculation, or better served by an existing hub, collection or article. Belonging to the franchise isn't a reason on its own.

## Name it the way players search

If you recommend a hub, propose the title and scope in the words players actually type: the game's real name and common short form ("GTA 5", "Minecraft Bedrock"), not an internal label. Say in one plain line what a player would come to the hub for, like "new players asking what to do first and which missions unlock what." Skip stock reasons such as "a comprehensive resource for fans."

## Output

Start with:

```text
Evidence checked:
- Existing Bloxodes title/wiki:
- Official publisher/developer sources:
- Support/manual/news sources:
- Game-specific wiki/database:
- Guide sites:
- Other sources:
- Keyword searches:
- Mode/expansion/edition/platform conflicts:
```

Then return one decision:

- `[create]` for a stable title hub with enough source-backed gameplay information.
- `[we already have a page]` when the exact title and scope are already covered.
- `[skip]` when the topic belongs elsewhere or the evidence is too weak.
- `[source discovery incomplete]` when a required source group or context value wasn't checked.

Keep the decision short. Name any unresolved scope or evidence issue the research skill must settle. Don't write a brief, dataset, page copy or final JSON here.
