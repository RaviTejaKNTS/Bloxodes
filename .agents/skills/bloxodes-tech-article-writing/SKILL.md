---
name: bloxodes-tech-article-writing
description: Write one Bloxodes tech / platform / troubleshooting article final.json from an approved brief.md. Use for Roblox platform pieces — error-code fixes, "how to fix" / "won't open" / crash / lag / install guides, settings how-tos, and other non-gameplay Roblox tech articles approved for /articles. Adds scan-table, numbered-step, heading, depth, and link rules on top of bloxodes-article-writing.
---

# Bloxodes Tech Article Writing

Use this for one Roblox **tech / platform / troubleshooting** article only, after `brief.md` is approved.

This is a thin add-on. It does not replace `bloxodes-article-writing` — it sits on top of it.

**First, apply every rule in `bloxodes-article-writing`** (voice, length, readability, structure, accuracy, public-copy bans, the `final.json` field jobs, and the output shape). Everything below only adds or sharpens rules for tech articles. Where this skill is more specific, it wins.

Research and brief approval still come from `bloxodes-article-research`. Batches still run through `bloxodes-article-workflow-runner` (the parent should hand tech articles to this writing skill instead of `bloxodes-article-writing`).

## When this skill applies

Use it when the article is about the Roblox platform itself, not a single game's gameplay:

- Error-code fixes ("Roblox Error 277 Fix") and named-error popups ("An Unexpected Error Occurred and Roblox Needs to Quit").
- "Won't open / won't install / keeps crashing / black screen / stuck loading / high ping" fix guides.
- Platform how-tos and settings walkthroughs (voice chat, parental controls, account settings, performance).
- Any procedure with ordered steps where the reader is troubleshooting or configuring something.

These are almost always platform-level, so `universe_id` is usually `null`. Set it only if the piece is genuinely tied to one Roblox game.

## What this skill adds

**Depth profile — detailed, yet small and easy to consume**
- Go deeper than a normal article: cover causes, every realistic fix or step, and the fallback when nothing works. Do not leave a gap a competitor covers.
- Keep it small at the same time. Depth comes from covering more distinct points, never from longer paragraphs or padding. Short blocks, lots of white space.
- The whole piece should read as one clean story: problem → why it happens (brief) → fixes/steps in order → what to do if it still fails → FAQ. Each section hands off to the next; nothing is re-explained.

**Quick-scan table at the top (when it helps)**
- When the article has several ordered fixes, steps, or options, add a compact scan table right after the intro, before the first `##` section.
- Keep it to 2-3 columns and one line per row (e.g. `#` | `Fix` | `What it does`). It is a map of the page, not a second copy of the content.
- Skip the table when there are only one or two steps, or when there is nothing ordered to summarize. Do not force it.

**Numbered headings and numbered steps**
- Number the fix/step `###` headings (`### 1. Clear the Roblox cache`, `### 2. Run as administrator`) so the order is obvious and matches the scan table.
- Under each heading: one short lead sentence on what it does, then the actual procedure as a **numbered list** when it has ordered steps. One action per step, with the exact path or click.
- Keep the `bloxodes-article-writing` troubleshooting rule: each fix gets its own `###` under one `##`; no deep bullet-in-bullet hierarchies; order easiest-first.

**Headings**
- Headings must be SEO-friendly and read like a short sentence that reveals the info ("How to fix it", "If Roblox still crashes"), not clickbait teasers.
- Lead with the words a player would actually search or scan for.

**Links — internal**
- Add a good number of internal links to other Bloxodes pages, woven naturally mid-sentence (never "click here" call-outs).
- Target a **minimum of 2**, and **6+ is fine when they fit naturally**. Quality over quota — only link where it genuinely helps the reader, never to pad the count.
- Good targets: the error-codes pillar page, sibling fix articles, and any related wiki / tool / catalog / checklist page on the site.
- If a planned target page does not exist yet, leave a clearly-marked placeholder (e.g. an HTML comment) for the parent to wire later. Never invent a live URL for a page that is not published.

**Links — external official sources**
- Link to the official source when it helps the reader act: Roblox download (`roblox.com/download`), Roblox Support (`roblox.com/support`), the Roblox status/help pages, or the relevant vendor page (GPU driver download, Windows update, etc.).
- Prefer first-party/official destinations. Do not link to sketchy "repair tool" downloads or low-trust mirrors.

**Accuracy reminders specific to tech**
- Never tell a reader to play Roblox in a web browser — the in-browser player is discontinued; `roblox.com` only launches the installed app.
- Do not invent error codes, menu paths, or toggles. If a path is uncertain, keep the wording generic.
- Keep it evergreen: no version numbers, dates, "latest/current/2025", or "updated" freshness claims.

## Output

Write `final.json` only, in the same shape and to the same field rules as `bloxodes-article-writing`. Parse-check the JSON. `universe_id` is usually `null` for platform pieces. Then verify with `npm run verify:article-finals` like any other article final.
