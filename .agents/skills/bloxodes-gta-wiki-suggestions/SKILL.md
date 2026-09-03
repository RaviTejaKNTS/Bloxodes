---
name: bloxodes-gta-wiki-suggestions
description: Suggest a Bloxodes GTA wiki hub for one Grand Theft Auto game. Use when deciding whether a GTA title has enough stable, source-backed information for a GTA wiki route. Do not write the page or suggest collection pages.
---

# Bloxodes GTA wiki suggestions

Decide whether Bloxodes should create a wiki hub for one Grand Theft Auto game. This skill covers the hub only. Use `bloxodes-gta-game-collection-suggestions` for item and system collections.

## Start

1. Resolve the exact title, editorial slug, official Rockstar URL, developer, publisher, release status, release dates, and platforms.
2. Check `gta_games`, `gta_wiki_pages`, and `/gta/wiki/<game-slug>` in managed development and production. Do not recommend a duplicate.
3. Keep games separate. Do not mix GTA V, GTA Online, GTA VI, remasters, expansions, or platform editions unless the proposed page defines that scope clearly.

## Source check

Search broadly enough to understand the normal player loop, progression, protagonists or player role, main systems, control availability, and likely durable collections.

Prefer sources in this order when the claim allows it:

1. Rockstar game pages, support pages, manuals, newswire posts, and official videos.
2. Stable game databases and dedicated GTA wikis with page-level citations.
3. Established guide sites that distinguish game mode, platform, and edition.
4. Community material only for gaps that stronger sources cannot fill. Record the weaker evidence.

Do not use search snippets as final proof when the underlying page can be opened. Cross-check facts that vary by edition, platform, game mode, or release.

## Output

Start with:

```text
Evidence checked:
- Existing Bloxodes GTA game/wiki:
- Official Rockstar sources:
- Rockstar support/manual sources:
- GTA Wiki or dedicated game wiki:
- GTA database sites:
- Guide sites:
- Keyword searches:
- Edition/platform conflicts:
```

Then return one decision:

- `[create]` for a stable game hub with enough source-backed gameplay information.
- `[we already have a page]` when the exact GTA hub exists.
- `[skip]` when the topic is better handled as an article, collection, or different GTA game scope.
- `[source discovery incomplete]` when a required source class was not checked.

Keep the decision short. Name any unresolved edition or game-mode boundary that the research skill must settle.
