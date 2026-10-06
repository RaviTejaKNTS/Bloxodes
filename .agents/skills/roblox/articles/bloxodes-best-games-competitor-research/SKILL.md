---
name: bloxodes-best-games-competitor-research
description: Map competing Roblox best-games articles into a broad, source-backed candidate inventory before editorial selection. Use when preparing a curated Roblox recommendation page and the research must identify every game used by relevant competing lists, current search coverage, source gaps, and possible newer or less-obvious candidates without treating competitor frequency as a ranking signal.
---

# Best Games Competitor Research

Use this as the competitor-mapping stage before broad discovery and selection. The goal is coverage: identify the games relevant competitors are recommending, understand how the query is being covered, and expose candidates that the ordinary popularity-first search may miss. This stage does not decide inclusion, order, or article copy.

## Inputs and workspace

Read the approved article idea, target query, audience, geography or language constraints, and any supplied competitor URLs. Work under:

`tmp/content-workspace/<topic>/articles/<article-slug>/research/`

Write `competitor.md`. Record the research date and keep source URLs beside extracted claims. Do not use competitor appearance count as a vote for final rank.

## Gather the competitor set

Search the exact query and focused variants such as:

- `best <topic> Roblox games <current year>`
- `new <topic> Roblox games <current year>`
- `underrated <topic> Roblox games`
- `unique <topic> Roblox games`
- `<topic> Roblox games with friends`, `solo`, and important subgenres

Use several result pages and domains rather than one publisher. Prefer relevant editorial list pages, current updates, official Roblox spotlights, and specialist coverage. Include supplied competitor pages even when they are not currently high in search results. Aim for a broad source set and continue until new queries mostly return the same pages; do not stop after finding a fixed number of articles.

If a configured SearXNG endpoint is available, use its JSON search with Bing and DuckDuckGo (for example, `/search?q=<encoded-query>&format=json&engines=bing,duckduckgo`). Store the endpoint outside committed content and record the engine, result position, query, and timestamp. If SearXNG is unavailable, use the approved web-search or repository search integrations. Never invent an endpoint or claim that a result position is universal; search rankings are snapshots.

## Extract every candidate

For each useful competitor article, capture:

- page title, URL, publisher, published or updated date when visible, checked date, and source quality notes;
- every named game in the list, not only the first few entries;
- the displayed order or section position when available;
- the article's short reason, gameplay description, or category for that game;
- whether the article presents the game as current, new, classic, underrated, co-op, solo, or a specific subgenre.

Normalize obvious spelling and punctuation differences, but do not merge uncertain identities. Keep a separate unresolved-name note until the official Roblox experience page confirms the match.

## Required output

Write `competitor.md` with these sections:

1. **Search coverage:** queries, engines, dates, and the source-selection approach.
2. **Source inventory:** one row per competitor page with URL, publisher, date, query that found it, and coverage notes.
3. **Candidate inventory:** one row per normalized game with competitor appearances, source positions, source URLs, source descriptions, apparent category, and unresolved identity notes.
4. **Coverage gaps and disagreements:** games appearing in only one source, newer candidates, repeated generic picks, and meaningful differences between publishers.
5. **Handoff:** candidates and source leads for broad discovery to verify independently.

Competitor frequency is descriptive only. A game mentioned by ten articles is not automatically better than a game mentioned by one. Do not remove a candidate because it is obscure, and do not add one to the final article without later checking its identity, current availability, gameplay loop, quality, and fit for the target reader.

## Completion standard

The handoff is ready when the relevant competing lists have been mapped, all named games are represented or explicitly marked unresolved, search coverage includes current/new/unique variants, source dates and URLs are recorded, and the next discovery stage can combine the competitor inventory with independent Roblox and gameplay research.
