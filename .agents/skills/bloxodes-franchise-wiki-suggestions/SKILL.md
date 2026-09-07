---
name: bloxodes-franchise-wiki-suggestions
description: Suggest a Bloxodes wiki hub for one non-Roblox game title inside a configured franchise namespace. Use before hub research or writing; do not use for Roblox titles or collection discovery.
---

# Bloxodes franchise wiki suggestions

Decide whether Bloxodes should create a wiki hub for one non-Roblox video-game title. This is a discovery decision for the hub only. It does not write page files or suggest collection pages.

## Required franchise context

Resolve these values from the request, the closest repository instructions, and the target platform's existing implementation before deciding:

- Franchise name and namespace, for example a human name and a URL/table prefix.
- Exact title, editorial game slug, title kind, parent title when relevant, and official URL.
- Hub route pattern, such as <route-prefix>/wiki/<game-slug>.
- Game identity table, wiki table or view, and the managed-development and production environments to check.
- Official-source policy: publisher/developer, support/manual, news, or other primary source groups for this franchise.
- Mode, expansion, online-service, edition, and platform boundaries.

The namespace, route, tables, and commands are context values, not assumptions. If a required value cannot be resolved, return [source discovery incomplete] and name the missing value.

## Start

1. Resolve the exact title, title kind, editorial slug, official URL, developer, publisher, release status, release dates, and supported platforms.
2. Check the configured game and wiki tables plus the exact managed-development and production route. Do not recommend a duplicate or a title whose scope is already covered under a different name.
3. Check related Bloxodes page families only to identify overlap or a better page type. Do not turn an article, collection, tool, or online-service page into a hub without evidence.
4. Define the mode, expansion, edition, and platform scope that the hub would actually cover.

## Source check

Search broadly enough to understand the normal player loop, progression, player role, major systems, controls, and durable questions a new or returning player needs answered.

Prefer sources in this order when the claim allows it:

1. The configured official publisher/developer pages, support pages, manuals, news posts, patch notes, and official videos.
2. A stable franchise or game-specific wiki/database with page-level detail.
3. Established guide sites that distinguish title, mode, edition, platform, and release generation.
4. Community material only for gaps that stronger sources cannot fill. Record the weaker evidence and do not promote it to a hard fact without corroboration.

Open useful pages. Search snippets are leads, not final proof. Cross-check facts that vary by title, mode, edition, platform, release generation, or live-service state.

## What counts

Recommend a hub only when the title has enough stable, source-backed gameplay information to help players beyond a short article. A released, announced, expansion, or online title may qualify when its scope is explicit and the available facts support a useful hub.

Skip a title when public information is too thin, mostly temporary, only news or speculation, or better represented by an existing hub, collection, or article. Do not create a hub merely because the title belongs to the franchise.

## Output

Start with:

~~~text
Evidence checked:
- Existing Bloxodes title/wiki:
- Official publisher/developer sources:
- Support/manual/news sources:
- Game-specific wiki/database:
- Guide sites:
- Other sources:
- Keyword searches:
- Mode/expansion/edition/platform conflicts:
~~~

Then return one decision:

- [create] for a stable title hub with enough source-backed gameplay information.
- [we already have a page] when the exact title and scope are already covered.
- [skip] when the topic is better handled elsewhere or the evidence is too weak.
- [source discovery incomplete] when a required source group or context value was not checked.

Keep the decision short. Name unresolved scope or evidence issues that the research skill must settle. Do not write a brief, dataset, page copy, or final JSON here.
