---
name: bloxodes-article-writing
description: Write one Bloxodes article final.json from an approved brief.md. Use after bloxodes-article-research and parent approval for Roblox how-tos, focused guides, comparisons, news tests approved for /articles, content_md, faq_json, tags, sources, and article metadata.
---

# Bloxodes Article Writing

Write one article after the brief is approved. Research belongs in `bloxodes-article-research`. Batches belong in `bloxodes-article-workflow-runner`.

A writing subagent runs this skill. Do not call other subagents.

## Workspace

```text
tmp/content-workspace/<game-or-topic-slug>/articles/<article-slug>/
  brief.md
  final.json
```

## Before you write

Read the approved `brief.md`.

If the brief is weak, missing, or still has big open gaps, stop and send it back for research.

Use the brief’s player texture (stuck moments, mistakes, real player words). That is how the piece stays human. If texture is thin, stick to confirmed facts and stay honest. Do not invent drama.

## What good writing feels like

Write like a good gaming website guide, not a support ticket and not a hyped landing page.

Think of sites that talk to you as a player: calm, clear, a little warm, full sentences, easy top-to-bottom reading. The reader should feel like someone who already beat the wall is sitting next to them and explaining what actually helps.

### The story shape

Most how-to pieces should read as one clean story:

1. **The stuck moment** — what the player is feeling right now
2. **What is going on** — the simple truth behind it
3. **What to do** — steps or path, in order
4. **How to make it smoother** — habits, mistakes, next goal

Headings break that story into scanable chunks. They should not shatter it into disconnected fact cards.

### Full sentences and flow

- Write real sentences people can speak out loud.
- Prefer plain words a younger Roblox player gets on first read.
- Keep paragraphs short, usually 1–3 sentences, so the page can breathe.
- Let one idea finish before the next starts.
- Connect ideas with natural flow (“Once that is done…”, “That is why…”, “If you are stuck on the 35 count…”).
- Mix sentence length a little. A longer line is fine when it carries a thought. Then land a short one.
- Do not write like a telegram: claim. claim. claim.
- Do not write walls of text either.

### Voice

- Talk to the reader as **you**.
- Sound like a friend who plays the game.
- Stay calm and warm. A light bit of wit is welcome when it sits on a real fact.
- Never force jokes. Never stack puns. Never yell with hype words like *ultimate, insane, amazing, epic, must-have, game-changer* (unless that is the real in-game name).
- Use player words: level lock, hard wall, checklist, menu, grind. Avoid design-doc words: objective-based system, quest track, progression framework.
- Open on the real problem or answer. No “Welcome to…” and no slow mood setting.
- On error / crash / won’t-open pieces, drop the wit and help first.

### Steps, tables, and labels

Keep the functional bits plain. Numbered steps should be one clear action each. Tables stay for clean comparisons or checklists. Save the personality for the prose around them.

### How long should it be?

As long as the reader needs, and not one sentence more.

Cover everything useful. Explain things a new player would not already know. Do not pad. Do not repeat the same fact in three outfits. If a later-stage chart does not exist, go deeper on decisions and habits instead of inventing numbers.

## Examples (study these shapes)

These are style models. Copy the *feel*, not the topics.

**Good open (problem → truth):**

> If your Evomons keep earning EXP but the level number will not budge, you are not broken. You hit a hard level cap. Ascension is the checklist that raises that cap for your player level and your whole team.

Why it works: plain words, full sentences, names the fear, gives the answer right away.

**Good middle (recognition + fact):**

> Dumping every EXP fruit into one favorite feels smart until the first Ascension asks for a second mon at Level 25. Level two team members early, and catch while you clear islands so the 35-count is not a second grind at the end.

Why it works: a real mistake, a clear fix, no hype.

**Good soft caution (no research voice):**

> Later stages get harder, and public charts for every stage are thin. When a new Ascension pops up, trust the in-game menu more than your memory.

Why it works: honest without saying “sources” or “verified.”

**Bad (choppy manual):**

> Ascension is a multi-stage objective-based system. It raises caps. It unlocks at level 20. Complete the quests. Press Ascend.

Why it fails: true, but no flow, no face, no story.

**Bad (cringe hype):**

> This INSANE Ascension system is a total game-changer you must complete ASAP!!!

Why it fails: loud, empty, not helpful.

**Bad (research leak):**

> According to multiple public writeups, there is no verified Robux fee for stage one.

Why it fails: sounds like a brief, not a player.

**FAQ voice should match the body:**

> **Why do my Evomons still gain EXP but not levels?**  
> That is the cap doing its job. EXP can still fill while the level freezes. Finish the active Ascension and press Ascend, and levels can climb again.

## Structure

- Follow the brief outline when it serves the reader. Adjust if a cleaner story order is obvious.
- Use few headings. Two good H2s beat five thin ones for a simple how-to.
- Headings should sound like plain sentences and give the answer away.
- Each section should move the story forward, not restate the last one.
- One structured block per section (a list *or* a table, not both stacked for the same idea).
- Numbered lists for real step-by-step work.

## Fix / troubleshooting extras

- Group fixes under one H2 like “How to fix it”.
- Give each fix its own H3 with a clear action name.
- Easiest fixes first.
- Keep each fix flat: a short lead, then steps if needed. No deep bullet trees.
- Do not repeat the same fix in two sections.

## Accuracy

- Only write what you can stand behind. Do not invent menu paths, drops, or requirements.
- If a label is unsure, keep the wording soft instead of guessing.
- Roblox does not play in a web browser anymore. Never tell readers to “try the browser.”
- If you are not sure, leave it out.

## Game pages, links, and public-copy bans

- Game articles need the game name in the title and slug. “Roblox” is fine when it helps.
- Add at least two real internal links from the brief (or confirmed same-game pages). Weave them mid-sentence where they help.
- Never invent slugs.
- Do not mention research, sources, competitors, databases, or internal notes in the public copy.
- Do not say “this article,” “this guide,” or “this page.” Just talk about the game.
- No em dashes anywhere in the JSON fields. Use a comma, colon, parentheses, or two sentences.

## After the first draft

Read it top to bottom like a player who is stuck and impatient.

Ask:

- Does this make sense if I only skim headings?
- Does it still make sense if I read every line in order?
- Would a friend talk like this?
- Did I land at least one real player moment in each main section?
- Did I leak any research language?
- Did I answer the title fully?

Then revise once for flow and voice. Keep the facts. Fix the music.

## Write `final.json` only

```json
{
  "title": "",
  "slug": "",
  "meta_description": "",
  "content_md": "",
  "faq_json": [],
  "cover_image": null,
  "author_id": null,
  "universe_id": null,
  "tags": [],
  "sources": [],
  "is_published": true
}
```

Field notes:

- `title`: clear human search language. Include the game name when the piece is about one game.
- `slug`: short, stable, includes the game name for game pieces. Do not use `roblox_universes.slug`.
- `meta_description`: one specific outcome the reader gets.
- `content_md`: the full story in markdown.
- `faq_json`: 2–4 follow-ups that are not already answered in the body. Same warm voice. Use `[]` if FAQs would only repeat.
- `cover_image` / `author_id`: set when known, else null.
- `universe_id`: required when the piece belongs to one game with a universe row.
- `tags`: a few useful labels, not keyword stuffing.
- `sources`: real URLs that support the important facts.
- `is_published`: true when ready.

Do not include `seo_title`.

Parse-check the JSON before you return.
