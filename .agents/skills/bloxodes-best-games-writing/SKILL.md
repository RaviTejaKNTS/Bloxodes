---
name: bloxodes-best-games-writing
description: Write a complete Bloxodes Articles-page best-games recommendation from approved discovery, selection, and per-game research. Use after all three research stages are complete and the reusable Roblox game-card block is available.
---

# Best Games Article Writing

Use this as the final stage for opinionated Roblox recommendation pages. It writes one coherent Articles-page piece, not a template preview or a catalog page.

## Inputs and output

Read the article brief plus `research/discovery.md`, `research/selection.md`, and `research/game-research.md` or the per-game research files. Write `final.json` in the article workspace using the existing Articles import shape: `title`, `slug`, `meta_description`, `content_md`, `tags`, `sources`, `faq_json`, and publication fields as appropriate.

## Required article shape

Set the final count from the approved selection and use it everywhere it matters: the article `title`, H1/title rendered by the route, and the opening metadata should say `<N> Best ...`. Never hardcode ten or another default count.

Start with a short, direct introduction with a little editorial personality. Give the reader a concrete reason to continue and name the range of experiences the list actually contains. Avoid empty openings such as “here are the best games,” generic warnings about Roblox, or lines about not knowing what kind of horror the reader likes.

Then repeat this pattern for every selected game, in approved order:

```md
## 1. Game Name

Useful, specific recommendation prose about what the game feels like to play, what the player does, its strengths, caveats, and why it belongs here.

![Game Name Roblox gameplay thumbnail](https://media.bloxodes.com/...webp)

A second paragraph can sharpen the recommendation, mention a real caveat, or explain who should choose it. Use comparisons only when they genuinely clarify a choice; never force a callback to the previous game.

```roblox-game-card
schema: 1
id: game-slug
universeId: 123456
name: Game Name
image: https://...
robloxUrl: https://www.roblox.com/games/...
statsUrl: /stats/games/...
```
```

The image belongs inside the game section, usually after the first paragraph and before the second paragraph or card. It should be a useful landscape thumbnail from the exact official game page, hosted through the article-image workflow. Keep the square icon in the clean horizontal card as the final action surface.

The card is a clean horizontal link surface. Keep descriptive content in the prose, not inside the card. Do not add “best for” labels, verdict badges, player-stat panels, ranking methodology, filler introductions, or a redundant “our picks” heading. A short, warm closing note or a small FAQ is optional and should add real search value.

## Article pagination

Long recommendation lists may span multiple article pages. Pagination is a presentation choice, not a limit on discovery or selection: never remove a good game just to fit one page. Keep every game section complete and place a validated page-break block between sections when the approved selection is large enough to benefit from continuation pages.

Use this block on its own line between complete sections:

```article-page-break
schema: 1
id: article-slug-page-2
```

Use a unique lowercase hyphenated `id` for each break. Do not put a break inside a game section, between a section's image and card, immediately before the closing copy, or at the start or end of the article. Aim for roughly ten game sections per page while allowing the final page to be shorter or longer when that keeps the article flowing. Keep the introduction on page 1, and keep the closing guidance and FAQ on the final page.

## Voice and accuracy

Write like an experienced Roblox player giving clear recommendations: specific, conversational, decisive, and willing to mention friction. Use first-person editorial phrasing where it helps the recommendation, but never invent a personal session, result, or feeling that was not verified. Let the voice have taste without pretending to have played a session that the research did not establish.

Prefer concrete verbs and details over labels. Explain what the player actually does, what creates tension, and what makes the game worth opening. Vary paragraph openings and rhythm. Do not repeat the same “This is for players who...” or “Compared with the previous game...” formula across sections. Avoid database-entry language, keyword stuffing, inflated claims, and filler transitions.

The introduction and closing should feel authored. The introduction can set a mood or make a sharp editorial promise; the closing should help the reader choose where to start without restating the whole article.

Use every selected game. Do not truncate to ten or another hardcoded count. If selection research calls for pagination, preserve the approved split and do not silently drop games.

## Final checks

Validate that every game has one numbered `##` section followed by one valid `roblox-game-card` block, every section has one matching verified landscape image inserted in its prose, every block has a verified square image and stable universe ID, links are safe HTTP(S) or site-relative paths, the order matches selection research, and the copy does not claim unsupported facts. Keep source URLs in `sources` metadata or research notes rather than cluttering the recommendation flow.

When pagination is used, validate that every `article-page-break` has `schema: 1`, a unique lowercase hyphenated `id`, and appears only between complete game sections. Confirm page 1 contains the introduction, the final page contains the closing copy and FAQ, and the article renders the expected number of continuation pages.
