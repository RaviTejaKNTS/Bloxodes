---
name: bloxodes-franchise-game-collection-suggestions
description: Suggest durable wiki collection pages for one non-Roblox game title in a configured franchise namespace. Use before collection research; do not write pages or datasets.
---

# Bloxodes franchise game collection suggestions

You find the collections worth building for one non-Roblox game title and decide what belongs in the collection system. Done means a short evidence summary plus one clear decision per candidate collection.

This skill doesn't research a final roster, write a brief, prepare data or write a page.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## Required context

Resolve these before you decide anything:

- Franchise name and namespace.
- Exact game/title slug, title kind, parent title, official URL, release state and requested mode or content scope.
- Collection route pattern, for example `<route-prefix>/wiki/<game-slug>/<collection-slug>`.
- Game, wiki and collection tables/views, plus the managed-development and production environments.
- Official-source groups and the allowed source hierarchy for this franchise.
- The target collection verifier, data checker, image helper and runtime sync command, if they'll be needed later.

Don't guess a route, table, source policy or mode boundary. If a required value is missing, return `[source discovery incomplete]` and name it.

## Start

1. Resolve the exact game, editorial slug, title kind, release status, official URL and campaign/online/expansion/mode boundary.
2. Check the configured collection table in managed development and production for the exact game and collection slug. Never recommend an existing or conflicting route.
3. Check the title hub and approved roadmap so your ideas fit navigation and don't repeat a planned collection under another name.
4. Keep collections separate by title, mode, edition, platform, release generation and live-service state.

## Source discovery

- Search broadly and open the useful pages. Check the official source groups the context declares, a dedicated franchise or game wiki/database, and established guide sites. Record any configured source group that had no relevant result.
- Use competitor coverage to learn what players want and ask, not as proof by itself. Confirm each proposed collection with stronger sources.
- Search for likely player nouns: vehicles, weapons, characters, missions, locations, items, recipes, maps, quests, bosses, collectibles, achievements and other game-native systems.
- Search snippets are leads, not final evidence. Don't copy competitor wording.

## What counts

Recommend stable player-facing databases where each row has useful comparison or lookup fields: reference rosters, systems, fixed missions, characters, vehicles, weapons, locations, maps, recipes, classes, bosses, achievements or collectible families.

Pick the page type:

- `collectible` for finite player-completed goals: collectibles, locations, quests, badges, route steps, mission objectives and other completion tasks.
- `database` for reference rosters players browse and compare.
- Both types use the same collection table and runtime manifest.

Skip:

- temporary rotations, bonuses, shops, events, reward tracks or update-only states, unless the context explicitly defines a durable live-service collection
- news, tier lists, rankings, walkthrough prose, opinion pieces, calculators or trackers
- collections that silently combine modes, editions, platforms, titles or release generations
- broad pages with no useful row-level fields
- padded trivia collections

Size isn't the test. A small collection can qualify when it's central to the game, source-backed, useful and has real search demand.

Prefer separate routes for location-heavy collectible families. Several smaller, clear player goals beat one giant generic collectibles page.

## Name collections the way players search

The collection label and slug become the page's title and URL, so use the words a player would actually type. (The examples below are made up. Learn the move, not the facts.)

- Use the game's own noun: "Relay Towers", "Stunt Jumps", "Ember Shards". Not "Collectible Items" or "Objects".
- Match real search phrasing. If players search "all stunt jump locations", the label is "Stunt Jumps", not "Aerial Challenge Points".
- Give each idea its own angle. If your reasons all read "a useful reference for players," you haven't found the angle yet. Say what the player gets: "every relay tower locks after the finale, so players want the full map before they get there."

## Output

Start with:

```text
Evidence checked:
- Existing Bloxodes coverage:
- Official primary sources:
- Support/manual/news sources:
- Dedicated game/franchise wiki or database:
- Configured guide sources:
- Other sources:
- Keyword searches:
- Game/mode/edition/platform boundary:
```

If a required source group wasn't checked, return `[source discovery incomplete]` and name the gap.

Then return only collection decisions:

- `[create]` with a short reason, collection slug, mode/content scope, page type, useful fields and source proof.
- `[we already have a page]` with the existing route.
- `[skip]` with the concrete reason.
- `[source discovery incomplete]` when the evidence doesn't support a decision.

Don't write a hub, brief, dataset, images, final JSON or a future-page promise here.
