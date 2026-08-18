---
name: bloxodes-best-games-selection-research
description: Decide which Roblox games belong in an opinionated best-games article and establish their editorial order after competitor and broad discovery research. Use after the candidate pool is intentionally broad, before per-game deep research or writing.
---

# Best Games Selection Research

Use this as stage two. It turns a broad candidate inventory into a defensible, ordered recommendation set without pretending that popularity alone decides the result.

## Inputs and output

Read `research/competitor.md` when available, `research/discovery.md`, the article brief, the target search intent, and any site-level stats or linking constraints. Write `research/selection.md` in the same article workspace. Do not write the article yet.

## Decide inclusion

Define the page-specific bar before ranking: genuine fit for the query, quality of the player experience, a satisfying and understandable gameplay loop, a clear reason the target reader would enjoy it, reliable game identity, current availability, and enough verified detail to support useful prose. Consider whether the game works for the stated audience, how much friction it has, whether it is still playable and maintained, whether its content needs a clear warning, and what it adds that the other candidates do not.

Keep the candidate set and approved list open-ended. There is no hardcoded ten-game limit, and a long list is acceptable because the Articles route can paginate it. Include every candidate that clears the quality, loop, query-fit, and current-availability bar. Exclude only games that are no longer active or playable, whose official universe identity cannot be resolved, that fail the query, are materially weaker or redundant, or cannot be researched accurately enough to recommend. Record each exclusion with a concise reason. Do not exclude a game merely because it is obscure, mid-popularity, new, or mentioned by fewer competitors.

## Order the recommendations

Rank by the article’s actual promise and reader value: quality first, then the strength of the gameplay loop, how well the experience satisfies the search intent, clarity of recommendation, and useful variety across the reading order. The first game should be the strongest opening recommendation, but a less famous game may lead when it is better. Keep familiar anchors and distinctive discoveries together when both earn a place. Competitor appearance count, visits, and live players are context only; they must not determine order. Do not use a genericity or popularity penalty—make deliberate inclusion and ordering decisions instead.

## Required output

Include:

- a short selection thesis and the inclusion/exclusion rules;
- a deliberate ranking rationale describing how quality, gameplay loop, query satisfaction, current availability, and reader value were weighed;
- an ordered table with rank, exact title, universe ID, reason for inclusion, reader fit, caveat or warning, and source-backed confidence;
- excluded candidates and why they did not make the cut;
- a retained-but-lower-priority or pagination note when the broad pool contains additional valid recommendations;
- any pagination decision and the reason for it;
- the exact card identity payload needed later: stable `id`, `universeId`, title, Roblox URL, stats URL when available, and square icon URL.
- a thumbnail target for every selected game so the later image pass can verify one useful landscape image per section; record the official game page as the source rather than treating a search-result image as proof.

Do not invent gameplay details that belong in stage three. Do not use a fixed count, competitor frequency, or raw popularity as the selection rule. The list may be large; pagination is a presentation decision after the approved candidates are known.
