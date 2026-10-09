---
name: bloxodes-best-games-competitor-research
description: Map competing Roblox best-games articles into a broad, source-backed candidate inventory before editorial selection. Use when preparing a curated Roblox recommendation page and the research must identify every game used by relevant competing lists, current search coverage, source gaps, and possible newer or less-obvious candidates without treating competitor frequency as a ranking signal.
---

# Best Games Competitor Research

You map what competing "best Roblox games" lists recommend, so later stages start from a wide, honest candidate pool. Done means every game named on the relevant competitor lists is recorded (or marked unresolved) with its source, and the next stage has leads to verify.

This is the first stage, before broad discovery and selection. The goal is coverage: find the games competitors recommend, see how the query is being covered, and surface candidates a popularity-first search would miss. This stage doesn't decide inclusion, order or article copy.

## Inputs and workspace

Read the approved article idea, target query, audience, any geography or language limits, and any supplied competitor URLs. Work in:

`tmp/content-workspace/<topic>/articles/<article-slug>/research/`

Write `competitor.md`. Record the research date and keep source URLs next to the claims you pulled from them.

Competitor appearance count is never a vote for final rank.

## Gather the competitor set

Search the exact query and focused variants such as:

- `best <topic> Roblox games <current year>`
- `new <topic> Roblox games <current year>`
- `underrated <topic> Roblox games`
- `unique <topic> Roblox games`
- `<topic> Roblox games with friends`, `solo`, and important subgenres

How to search:

- Use several result pages and domains, not one publisher.
- Prefer relevant editorial list pages, current updates, official Roblox spotlights and specialist coverage.
- Include supplied competitor pages even if they aren't ranking high right now.
- Aim for a broad source set. Keep going until new queries mostly return the same pages. Don't stop after a fixed number of articles.

**SearXNG.** If a configured SearXNG endpoint is available, use its JSON search with Bing and DuckDuckGo, for example `/search?q=<encoded-query>&format=json&engines=bing,duckduckgo`.

- Store the endpoint outside committed content.
- Record the engine, result position, query and timestamp.
- If SearXNG isn't available, use the approved web-search or repository search integrations.
- Never invent an endpoint or claim a result position is universal. Search rankings are snapshots.

## Extract every candidate

For each useful competitor article, capture:

- page title, URL, publisher, published or updated date when visible, the date you checked it, and source quality notes
- every named game on the list, not just the first few
- the displayed order or section position when available
- the article's short reason, gameplay description or category for that game
- whether it presents the game as current, new, classic, underrated, co-op, solo or a specific subgenre

Normalize obvious spelling and punctuation differences, but don't merge identities you aren't sure about. Keep a separate unresolved-name note until the official Roblox experience page confirms the match.

## Keep notes useful for later writing

Later stages turn this research into recommendation prose that should sound like a player talking to a friend (see `.agents/skills/bloxodes-voice/SKILL.md`). Help them start clean:

- Record each competitor's reason as a plain statement of what the player does ("you fix the generator while something hunts you"), not their marketing adjectives.
- Keep source labels and "who said what" in the source columns, not in the game descriptions.

## Required output

Write `competitor.md` with these sections:

1. **Search coverage:** queries, engines, dates and how you chose sources.
2. **Source inventory:** one row per competitor page with URL, publisher, date, the query that found it and coverage notes.
3. **Candidate inventory:** one row per normalized game with competitor appearances, source positions, source URLs, source descriptions, apparent category and unresolved identity notes.
4. **Coverage gaps and disagreements:** games in only one source, newer candidates, repeated generic picks and meaningful differences between publishers.
5. **Handoff:** candidates and source leads for broad discovery to verify independently.

Competitor frequency only describes coverage.

- A game on ten lists isn't automatically better than a game on one.
- Don't remove a candidate because it's obscure.
- Don't add one to the final article without later checking its identity, current availability, gameplay loop, quality and fit for the target reader.

## Done when

- The relevant competing lists are mapped.
- Every named game is represented or explicitly marked unresolved.
- Search coverage includes current, new and unique variants.
- Source dates and URLs are recorded.
- The discovery stage can combine this inventory with independent Roblox and gameplay research.
