---
name: bloxodes-article-research
description: Research one approved Bloxodes article idea and create brief.md before writing. Use for article evidence checks, source coverage, production overlap, related page-type overlap, title promise, outline, player texture, facts to use, facts to avoid, and open gaps. Do not write final.json.
---

# Bloxodes Article Research

Research one approved article idea. Stop at `brief.md`. Do not write the article. Do not create `final.json`.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
```

## Start with Bloxodes itself

Check production first so we do not rewrite something we already have.

If the idea is about a game:

1. Find the `roblox_universes` row (try name and slug variations). Save `universe_id` for the writer.
2. List published `articles` for that `universe_id`. Do not rely only on a loose title search.
3. Note those same-game pages as internal link candidates (with slugs). The writer needs at least two real ones.
4. Confirm nothing already covers this exact topic.

Also note related page types when they exist: codes, wiki, collections, checklists, events, quizzes.

## Dig into the topic

Get a real feel for what the player is trying to do. If it is a game piece, learn enough of the loop that the brief can explain *why* the mechanic matters, not only the numbers.

Confirm facts. Do not guess.

For small Roblox topics, run more than one kind of search before you say sources are thin:

- exact: `"Game Name" "Mechanic"`
- broad: `Game Name Mechanic Roblox guide`
- pieces from the lead source plus the game name
- common spelling and slang variants

Look in more than one place when the first results are empty, blocked, or all copies of one post:

- web results and the lead page’s own links
- trusted guide sites and wikis (Beebom, Pro Game Guides, Fandom, TechWiser, IGN, Game Rant, Eurogamer, and similar)
- YouTube or transcripts when players document the steps there
- official or community surfaces when you can reach them (Roblox page, group, Discord, Trello, patch notes)
- Bloxodes data and related pages

If a tool blocks you or only returns junk, say that under search limitations. Do not call the whole web empty unless you actually checked the fallbacks.

Keep going past the first page of results. Follow useful internal links. Then decide what a stuck player actually needs tonight, and what they can skip.

## What the brief must give the writer

A good brief is a care package, not a pile of links.

**Mechanic facts** — unlocks, requirements, steps, rewards, limits, disagreements between sources.

**Player texture** — how it feels to be stuck, what people get wrong, what words they use, what order of work helps. Numbers alone make manuals. Texture makes guides.

Gather texture while you research:

- common wrong assumptions (2–4 when you can)
- stuck-player scenes a reader will recognize (2–3)
- player-facing words from search, comments, or Discord-style talk
- decisions that are not a new chart: what to do first, what not to grind, what to do next session
- UI feel notes only when known (where the menu lives, when the button is ready)
- honest gaps when later stages are poorly documented

Do not invent lore, fake quotes, or stage tables to look complete. If texture is thin, say so and still leave safe recognition beats that follow from confirmed facts.

## Sources

For gameplay how-tos, aim for two independent sources on exact mechanic numbers.

One-source facts can still ship when:

1. the user’s lead is clearly the idea source
2. you checked broader surfaces and wrote that down
3. you mark the risk
4. you do not pad with extra guesses

When sources disagree, name the split and pick the safer set.

Keep these buckets separate:

- sources found
- sources used for exact facts
- sources checked but not usable
- search limitations

## Outline

Keep the outline simple enough to read as a story.

- Prefer two clear H2s for a normal how-to. Use more only when the topic needs it (listicles can go longer).
- Headings should sound like plain sentences and give the info away.
- Under each heading, write one or two lines on what belongs there.
- Suggest a table or list only when it helps.
- Skip empty “What is it?” sections when the intro can cover that in a few sentences.
- Under each main section, note one texture beat to land so the writer does not ship pure definitions.

Title style: short full sentence in human language. Put the game name in the title and slug for game pieces. “Roblox” is fine when it helps search or clarity.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes coverage:
- Game universe_id (if game-specific):
- Internal link candidates (existing same-game/related pages with slugs, 2+):
- Source/competitor coverage:
- Sources found:
- Sources used for exact facts:
- Sources checked but not usable:
- Search limitations:
- Related page-type overlap:
- Useful uncovered angle:

Player texture:
- Common wrong assumptions:
- Stuck-player scenes:
- Player-facing words:
- Decision-level depth (order, tradeoffs, what not to waste time on):
- UI / feel notes (only if known):
- Texture gaps:

Article plan:
- Working title:
- Suggested slug:
- Title promise:
- Reader need:
- Facts to use:
- Facts to avoid:
- FAQ opportunities:
- Open gaps or risks:

Outline:
- list the outline here (each H2 notes one texture beat)

```

If the research is weak, say what is missing. Do not pretend the article is ready.

## Good briefs feel like this

- You can see what was checked.
- Links are real and useful.
- Overlap with existing Bloxodes pages is honest.
- `universe_id` and 2+ internal link candidates are present for game pieces.
- It is clear why this is an article, not another page type.
- The outline answers the title.
- Facts to use and facts to avoid are split.
- Player texture is filled enough that a writer can sound human without inventing.
- Gaps are easy for the parent to spot.
