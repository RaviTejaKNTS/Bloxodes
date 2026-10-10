---
name: bloxodes-best-games-writing
description: Write a complete Bloxodes Articles-page best-games recommendation from approved discovery, selection, and per-game research. Use after all three research stages are complete and the reusable Roblox game-card block is available.
---

# Best Games Article Writing

This is the most opinionated thing we write. A best-games list should read like a friend with great taste walking you through their picks: what each game actually feels like to play, who'll love it, and the catch worth knowing before you hit Play. It's one flowing Articles-page piece, not a template preview or a catalog page.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions. Do only the assigned artifact or review. The runtime owns the next stages and approval records. Keep the editorial and page-type rules below.

## Read first

- The voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the "Best-games lists" section of its examples.
- [The article standard](../bloxodes-article-writing/references/editorial-standard.md) for US audience, evidence, time conventions and review.
- [One editorial revision before acceptance](../bloxodes-article-writing/references/editorial-review.md), using the same configured writer and approved research. Keep recommendation evidence and game-card contracts through revision. Don't rerun discovery to fix prose.

## Inputs and output

Read the article brief plus `research/discovery.md`, `research/selection.md`, and `research/game-research.md` or the per-game research files. Write `final.json` in the article workspace using the existing Articles import shape: `title`, `slug`, `meta_description`, `content_md`, `tags`, `sources`, `faq_json` and publication fields as needed.

## Required article shape

Set the final count from the approved selection and use it everywhere it matters: the article `title`, the H1/title the route renders and the opening metadata should all say `<N> Best ...`. Never hardcode ten or any other default.

Start with a short, direct intro with real personality. Give the reader a concrete reason to keep going and name the range of experiences the list actually covers. Skip empty openers like "here are the best games," generic warnings about Roblox, or lines about not knowing what kind of horror the reader likes.

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

The card is a clean horizontal link surface. Keep descriptive content in the prose, not inside the card. Do not add “best for” labels, verdict badges, player-stat panels, ranking methodology, filler introductions, or a redundant “our picks” heading. A short, warm closing note is optional. FAQs are optional and belong only in faq_json, which renders visibly after the body; never duplicate them in Markdown. Keep only source-backed follow-up answers absent from the body, with no count quota.

## Article pagination

Long recommendation lists may span multiple article pages. Pagination is a presentation choice, not a limit on discovery or selection: never remove a good game just to fit one page. Keep every game section complete and place a validated page-break block between sections when the approved selection is large enough to benefit from continuation pages.

Use this block on its own line between complete sections:

```article-page-break
schema: 1
id: article-slug-page-2
```

Use a unique lowercase hyphenated `id` for each break. Do not put a break inside a game section, between a section's image and card, immediately before the closing copy, or at the start or end of the article. Aim for roughly ten game sections per page while allowing the final page to be shorter or longer when that keeps the article flowing. Keep the introduction on page 1, and keep the closing guidance and FAQ on the final page.

## Voice and accuracy

- **Sound like an experienced Roblox player making recommendations:** specific, conversational, decisive and honest about friction.
- **Open each game on what it feels like to play.** What you actually do, what creates the tension or the fun, and what makes it worth opening. Concrete verbs and details beat labels.
- **Vary everything.** Paragraph openings, rhythm and the angle for each game. Never repeat "This is for players who..." or "Compared with the previous game..." across sections.
- **Opinions are welcome, invented experiences aren't.** First-person editorial phrasing ("I'd start here if...") is fine where it helps a recommendation. Never claim a play session, result or feeling that research didn't establish.
- **No database-entry language,** keyword stuffing, inflated claims or filler transitions.
- **Never say where a fact came from or how the article was made.** Follow Public Copy in root `AGENTS.md`.
- **The intro and closing should feel authored.** The intro can set a mood or make a sharp promise. The closing helps the reader choose where to start without recapping the whole article.

Use every selected game. Never truncate to ten or another hardcoded count. If selection research calls for pagination, keep the approved split and don't silently drop games.

## Final checks

Validate that every game has one numbered `##` section followed by one valid `roblox-game-card` block, every section has one matching verified landscape image inserted in its prose, every block has a verified square image and stable universe ID, links are safe HTTP(S) or site-relative paths, the order matches selection research, and the copy does not claim unsupported facts. Keep source URLs in `sources` metadata or research notes rather than cluttering the recommendation flow.

When pagination is used, validate that every `article-page-break` has `schema: 1`, a unique lowercase hyphenated `id`, and appears only between complete game sections. Confirm page 1 contains the introduction, the final page contains the closing copy and FAQ, and the article renders the expected number of continuation pages.
