---
name: bloxodes-tech-article-writing
description: Write one Bloxodes tech / platform / troubleshooting article final.json from an approved brief.md. Use for Roblox platform pieces: error-code fixes, "how to fix" / "won't open" / crash / lag / install guides, settings how-tos, and other non-gameplay Roblox tech articles approved for /articles. Adds scan-table, numbered-step, heading, depth, and link rules on top of bloxodes-article-writing.
---

# Bloxodes Tech Article Writing

Use this for one Roblox **tech / platform / troubleshooting** article after the brief is approved.

This skill sits on top of `bloxodes-article-writing`. Read that skill first and keep its voice, JSON shape, accuracy rules, and public-copy bans. Everything below only sharpens tech pieces.

A writing subagent runs this after parent brief approval. Research still comes from `bloxodes-article-research`. Batches still use `bloxodes-article-workflow-runner`.

## When to use it

Use this when the piece is about the Roblox platform itself, not one game’s gameplay:

- error codes and error popups
- won’t open, won’t install, crash, black screen, stuck loading, lag, high ping
- settings and account how-tos (voice chat, parental controls, performance)
- other ordered “fix or set this up” procedures

`universe_id` is usually `null`. Set it only when the piece truly belongs to one game.

## Tone for stressed readers

Help first. Stay calm and clear. Keep wit light or drop it. The reader is already annoyed.

Still write full sentences and a clean top-to-bottom story:

1. what is going wrong
2. why it might happen (brief)
3. fixes in easy-first order
4. what to try if nothing works
5. short FAQ if needed

## What this skill adds

**Depth without bloat**

Cover the useful causes, every realistic fix, and the “still broken” fallback. Do not leave a gap a good competitor covers. Keep blocks short. Depth means more useful points, not longer paragraphs.

**Quick-scan table when it helps**

If there are several ordered fixes, put a small table right after the intro (before the first H2). Two or three columns. One line per row. It is a map, not a second article. Skip it when there are only one or two steps.

**Numbered fix headings**

Use `### 1. Clear the Roblox cache`, `### 2. Reinstall Roblox`, and so on under one main H2. Match the scan table order. Under each heading: one short lead line, then numbered steps when the fix has ordered clicks. One action per step. No deep bullet trees. Easiest fixes first.

**Headings**

Plain and searchable. “How to fix it” beats teaser headings.

**Links**

Weave helpful internal links mid-sentence. At least two when real targets exist. More is fine when they earn their place. Good targets: error-code pillars, sibling fixes, related tools or wiki pages.

Link official destinations when the reader needs them: Roblox download, Support, status pages, GPU drivers, OS update pages. Prefer first-party sources. Never send people to sketchy “repair tools.”

**Accuracy extras**

- Never tell readers to play Roblox in a browser.
- Do not invent error codes, paths, or toggles.
- Keep it evergreen. No version numbers, dates, or “latest / updated 2026” claims.

## Output

Write `final.json` only, same shape as `bloxodes-article-writing`. Parse-check it. `universe_id` is usually null.

After writing, reread once as someone who just wants the app to open again. If a line feels clever but not useful, cut it.
