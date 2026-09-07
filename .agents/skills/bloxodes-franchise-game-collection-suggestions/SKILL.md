---
name: bloxodes-franchise-game-collection-suggestions
description: Suggest durable wiki collection pages for one non-Roblox game title in a configured franchise namespace. Use before collection research; do not write pages or datasets.
---

# Bloxodes franchise game collection suggestions

Find useful, durable collections for one non-Roblox game title. This skill decides what belongs in the collection system. It does not research a final roster, write a brief, prepare data, or write a page.

## Required context

Resolve these values before deciding:

- Franchise name and namespace.
- Exact game/title slug, title kind, parent title, official URL, release state, and requested mode or content scope.
- Collection route pattern, for example <route-prefix>/wiki/<game-slug>/<collection-slug>.
- Game, wiki, and collection tables/views plus managed-development and production environments.
- Official-source groups and allowed source hierarchy for this franchise.
- The target collection verifier, data checker, image helper, and runtime sync command, if they will be needed later.

Do not guess a route, table, source policy, or mode boundary. If a required value is missing, return [source discovery incomplete] and name it.

## Start

1. Resolve the exact game, editorial slug, title kind, release status, official URL, and campaign/online/expansion/mode boundary.
2. Check the configured collection table in managed development and production for the exact game and collection slug. Do not recommend an existing or conflicting route.
3. Check the title hub and approved roadmap so suggestions fit navigation and do not repeat a planned collection under another name.
4. Keep collections separate by title, mode, edition, platform, release generation, and live-service state.

## Source discovery

Search broadly and open useful pages. Check the official source groups declared by the context, a dedicated franchise or game wiki/database, and established guide sites. Record when a configured source group has no relevant result.

Use competitor coverage to understand player demand and likely questions, not as proof by itself. Confirm a proposed collection with stronger sources. Search for likely player nouns such as vehicles, weapons, characters, missions, locations, items, recipes, maps, quests, bosses, collectibles, achievements, or other game-native systems.

Search snippets are leads, not final evidence. Do not copy competitor wording.

## What counts

Recommend stable player-facing databases such as reference rosters, systems, fixed missions, characters, vehicles, weapons, locations, maps, recipes, classes, bosses, achievements, or collectible families when each row has useful comparison or lookup fields.

Recommend page type collectible for finite player-completed goals such as collectibles, locations, quests, badges, route steps, mission objectives, or other completion tasks. Recommend page type database for reference rosters players browse and compare. Both types use the same collection table and runtime manifest.

Skip:

- temporary rotations, bonuses, shops, events, reward tracks, or update-only states unless the context explicitly defines a durable live-service collection
- news, tier lists, rankings, walkthrough prose, opinion pieces, calculators, or trackers
- collections that silently combine modes, editions, platforms, titles, or release generations
- broad pages with no useful row-level fields
- padded trivia collections

A small collection can qualify when it is central to the game, source-backed, useful, and has real search demand. Do not use item count alone as a gate.

Prefer separate routes for location-heavy collectible families. Do not create a giant generic collectibles page when smaller player goals are clearer.

## Output

Start with:

~~~text
Evidence checked:
- Existing Bloxodes coverage:
- Official primary sources:
- Support/manual/news sources:
- Dedicated game/franchise wiki or database:
- Configured guide sources:
- Other sources:
- Keyword searches:
- Game/mode/edition/platform boundary:
~~~

If a required source group was not checked, return [source discovery incomplete] and name the gap.

Then return only collection decisions:

- [create] with a short reason, collection slug, mode/content scope, page type, useful fields, and source proof.
- [we already have a page] with the existing route.
- [skip] with the concrete reason.
- [source discovery incomplete] when evidence does not support a decision.

Do not write a hub, brief, dataset, images, final JSON, or future-page promise here.
