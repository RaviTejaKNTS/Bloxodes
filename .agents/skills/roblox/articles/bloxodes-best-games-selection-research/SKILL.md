---
name: bloxodes-best-games-selection-research
description: Decide which Roblox games belong in an opinionated best-games article and establish their editorial order after competitor and broad discovery research. Use after the candidate pool is intentionally broad, before per-game deep research or writing.
---

# Best Games Selection Research

You turn a broad candidate pool into an ordered list of games we'd actually recommend, with clear reasons. Done means a `selection.md` with a defensible order, exclusions explained and card identities ready, without pretending popularity decides the result.

This is stage two, after competitor and discovery research and before per-game research.

## Inputs and output

Read `research/competitor.md` when available, `research/discovery.md`, the article brief, the target search intent, and any site-level stats or linking constraints. Write `research/selection.md` in the same article workspace. Don't write the article yet.

## Decide who's in

Set the page-specific bar before ranking. A game clears it with:

- genuine fit for the query
- a good player experience
- a satisfying, understandable gameplay loop
- a clear reason the target reader would enjoy it
- reliable game identity and current availability
- enough verified detail to support useful prose

Also weigh whether it works for the stated audience, how much friction it has, whether it's still playable and maintained, whether its content needs a clear warning, and what it adds that other candidates don't.

**No fixed count.** Keep the candidate set and the approved list open-ended. There's no hardcoded ten-game limit, and a long list is fine because the Articles route can paginate it. Include every candidate that clears the quality, loop, query-fit and current-availability bar.

**Exclude only** games that:

- are no longer active or playable
- have an official universe identity you can't resolve
- don't fit the query
- are clearly weaker or redundant
- can't be researched well enough to recommend accurately

Record each exclusion with a short reason. Never cut a game just because it's obscure, mid-popularity, new or mentioned by fewer competitors.

## Order the recommendations

Rank by the article's real promise and reader value:

1. Quality first.
2. Then the strength of the gameplay loop.
3. How well it satisfies the search intent.
4. How clear the recommendation is.
5. Useful variety across the reading order.

- The first game should be the strongest opening pick. A less famous game can lead when it's better.
- Keep familiar anchors and distinctive discoveries together when both earn a place.
- Competitor appearance count, visits and live players are context only. They never decide order.
- Don't apply a genericity or popularity penalty. Make deliberate inclusion and ordering decisions instead.

## Give the writer a reason, not a label

Each game's "reason for inclusion" is what the writer builds the section around, so make it a sharp, plain-language player reason (see `.agents/skills/bloxodes-voice/SKILL.md`). "Every round is a 90-second scramble to rebuild the bridge before the flood" helps. "Great co-op experience" doesn't. Keep confidence notes and caveats in their own columns.

## Required output

Include:

- a short selection thesis and the inclusion and exclusion rules
- a deliberate ranking rationale: how you weighed quality, gameplay loop, query satisfaction, current availability and reader value
- an ordered table with rank, exact title, universe ID, reason for inclusion, reader fit, caveat or warning, and source-backed confidence
- excluded candidates and why they didn't make it
- a retained-but-lower-priority or pagination note when the pool has more valid recommendations
- any pagination decision and why
- the exact card identity payload needed later: stable `id`, `universeId`, title, Roblox URL, stats URL when available, and square icon URL
- a thumbnail target for every selected game, so the later image pass can verify one useful landscape image per section. Record the official game page as the source. A search-result image isn't proof.

Don't invent gameplay details that belong in stage three. Don't use a fixed count, competitor frequency or raw popularity as the selection rule. The list can be large. Pagination is a presentation decision made after the approved candidates are known.
