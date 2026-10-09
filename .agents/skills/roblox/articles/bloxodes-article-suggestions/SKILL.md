---
name: bloxodes-article-suggestions
description: Suggest focused Bloxodes article ideas for one Roblox game, platform topic, or source lead. Use when the user asks for article ideas, news/article angles, or a list of possible /articles pages before writing.
---

# Bloxodes Article Suggestions

You suggest article topics for one game, platform topic or source lead. Done means a short, checked list of ideas players would actually search for, each with a clear angle and sources. This skill is read-only: don't start writing any article, and only move on once the user approves.

## Start

1. Pin down the topic, or the exact Roblox game when there is one.
2. Check existing Bloxodes articles and related pages. Don't suggest anything we already cover.
3. Don't suggest articles that collide with our other page types: wiki, catalog, codes page, tool, full-game checklist, quiz or events page.
4. When you have a game, check the production `articles` rows for that game's universe ID. Use the GET-only inventory command, never a direct production query:

   ```bash
   npm run articles:inventory:production -- --family article --universe-id <id> --json
   ```

## Check the sources

1. Get a quick understanding of the topic or game.
2. Then look at what competitors have already written: Beebom, Pro Game Guides, game-specific wikis, TechWiser, IGN, Eurogamer, Game Rant and other sites.
3. Dig properly. Don't settle for what the first search indexed. Run varied fan-out queries, plus site-specific queries for each website, to understand the topic or game in depth.

## Editorial fit

Use [the article standard](../bloxodes-article-writing/references/editorial-standard.md) and [the Beebom Roblox study](../bloxodes-article-writing/references/beebom-style-study.md) to judge what the reader wants and how deep the article needs to go.

- Name the player's problem and the follow-up questions the article should answer. Competitor headings alone aren't a research brief.
- Proposed titles name the exact game or topic and the answer it promises, in natural search language. No vague or clever labels.

### Titles that sound like search, not a template

Write each title the way a player would type the question, with the game name in it. Follow the title rules in `.agents/skills/bloxodes-voice/SKILL.md`.

| Templated | Better |
| --- | --- |
| Ember Isles Ember Compass Guide: Everything You Need to Know | How to Get the Ember Compass in Ember Isles |
| The Ultimate Garden Rush Pet Guide | Best Pets in Garden Rush, Ranked by Sell Bonus |

- Skip "Everything You Need to Know," "Ultimate Guide," "Complete Guide" and similar filler.
- Vary the angles across your list. Five ideas that all read "How to X in Game" look like a form. Mix how-tos, rankings, comparisons and "is it worth it" picks where the topic supports them.

## What makes a good idea

- It answers one clear reader question.
- It's evergreen. Prefer it over event-specific, timely or soon-outdated topics.
- It doesn't overlap our page types like codes, events, wiki or game collections.
- It doesn't have to copy competitors. Suggest helpful topics nobody has covered yet, as long as they're accurate to the game or topic.

Along with solid guides and listicles, get creative:

- specific tier lists
- recommendations
- a small checklist for finishing one process
- how to get, catch, perform or reach a specific thing in the game
- a clear opinion, when it's accurate and helpful

Aim for the ideas players need most: unique, helpful and good enough for Bloxodes standards.

## Output

Start with what you checked and how the research went, with links and depth:

```
Evidence checked:
- Existing Bloxodes coverage:
- Competitor/source coverage:
- Related page-type overlap:
- Useful uncovered angles:
```

Then list the suggestions, each tagged:

- `[create]` a focused article with clear reader value and source support
- `[already covered]` an existing Bloxodes page covers it
- `[skip]` weak, duplicate, too broad or better as another page type
- `[research incomplete]` you aren't confident enough yet, so the user can continue the research

Every `[create]` idea includes a specific, readable title, the angle, why players care and the sources to use.
