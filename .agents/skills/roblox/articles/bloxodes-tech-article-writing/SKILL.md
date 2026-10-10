---
name: bloxodes-tech-article-writing
description: >-
  Write one Bloxodes tech / platform / troubleshooting article final.json from an approved brief.md. Use for Roblox platform pieces: error-code fixes, "how to fix" / "won't open" / crash / lag / install guides, settings how-tos, and other non-gameplay Roblox tech articles approved for /articles. Adds scan-table, numbered-step, heading, depth, and link rules on top of bloxodes-article-writing.
---

# Bloxodes Tech Article Writing

Someone reading a fix guide is annoyed and wants to get back into their game. Be the calm friend who knows exactly what's wrong: say what the error means, hand over the fixes in the order most likely to work, and skip the jokes.

## Code-controlled runs

If you were assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides the interactive parent/subagent, upload/import and standalone self-review instructions. Do only the assigned artifact or review. The runtime owns the next stages and approval records. Keep the editorial and page-type rules below.

## How this skill fits

This is a thin add-on for one Roblox **tech, platform or troubleshooting** article, used after `brief.md` is approved.

- **Apply every rule in `bloxodes-article-writing` first:** voice, structure, accuracy, public-copy bans, fields and output shape. That includes the voice guide (`.agents/skills/bloxodes-voice/SKILL.md`) and the "Troubleshooting articles" section of its examples. Where this skill is more specific, it wins.
- Research and brief approval come from `bloxodes-article-research`. Batches run through `bloxodes-article-workflow-runner`, which hands tech articles to this skill instead of the base writing skill.
- No em dashes in any field: title, metadata, body, FAQ or any JSON value.

## When it applies

Articles about the Roblox platform itself, not one game's gameplay:

- Error-code fixes ("Roblox Error 277 Fix") and named error popups ("An Unexpected Error Occurred and Roblox Needs to Quit").
- Won't open, won't install, keeps crashing, black screen, stuck loading and high ping guides.
- Platform how-tos and settings walkthroughs (voice chat, parental controls, account settings, performance).
- Any ordered procedure where the reader is troubleshooting or configuring something.

These are almost always platform-level, so `universe_id` is usually `null`. Set it only if the piece is truly tied to one Roblox game.

## Tone for stressed readers

- Open by saying what the error or problem means in one or two plain sentences, then point straight at the fixes. Name the likely cause in plain words, and say whether it's usually on the player's side or Roblox's.
- Calm and reassuring, never chirpy. Wit is off.
- Every fix says when it helps, what to do and what you should see after. Then "still stuck? try the next one."

## What this skill adds

### Depth: complete and easy to follow

- Go deeper than a normal article: causes, every realistic fix or step, and the fallback when nothing works. Don't leave a gap a competitor covers.
- Give each fix room to explain when it applies, the exact action, the result to check and what to do if it fails. No sentence limit. Cut padding, not explanation.
- The piece reads as one clean story: the problem, the likely cause, the fixes or steps, then a useful fallback. FAQs are optional. The scan table can summarize facts the fixes explain.

### Quick-scan table at the top (when it helps)

- With several ordered fixes, steps or options, add a compact scan table right after the intro, before the first `##`.
- 2 or 3 columns, one line per row (like `#` | `Fix` | `What it does`). It's a map of the page, not a second copy of it.
- Skip it for one or two steps, or when there's nothing ordered to summarize.

### Numbered headings and steps

- Number the fix `###` headings (`### 1. Clear the Roblox cache`, `### 2. Run as administrator`) so the order is obvious and matches the scan table.
- Under each, say when the fix helps, then give the procedure as a **numbered list** when it has ordered steps. One action per step, with the exact path or click, then how to check the result.
- Keep the base skill's troubleshooting rules: each fix gets its own `###` under one `##`, no deep bullet nesting, easiest first.

### Headings

- Short action labels or natural reader questions that name the actual error, setting or fix. Don't force sentence-like headings.
- Lead with the words a player would search or scan for.

### Internal links

- Add verified internal links where they support a fix, explanation or next step, on words already in the sentence. No minimum count.
- Good targets: the error-codes pillar page, sibling fix articles and related wiki, tool, catalog or checklist pages.
- Skip unpublished targets. Missing-link notes go in the brief, never in public copy.

### Official external links

- Link to the official source when it helps the reader act: Roblox download (`roblox.com/download`), Roblox Support (`roblox.com/support`), Roblox status or help pages, or the relevant vendor page (GPU drivers, Windows Update and so on).
- Prefer first-party destinations. Never link sketchy "repair tool" downloads or low-trust mirrors.

### Tech accuracy

- Never tell a reader to play Roblox in a web browser. The browser player is discontinued, and `roblox.com` only launches the installed app.
- Never invent error codes, menu paths or toggles. If a path a fix depends on is uncertain, send it back for research, like the base skill says. Keep wording general only for side details the fix doesn't need.
- Stay evergreen: no version numbers, dates, "latest/current/2025" or "updated" claims.

### Media for troubleshooting

- Follow the base skill's perfect-match video and hosted-image rules.
- Use a video only when it shows the same error or procedure. Place it after the short intro or next to the matching fix.
- Use a clean hosted screenshot when a settings path or control is hard to find from words alone.
- The required image pass should target at least the most useful error screen, setting, control or result. When the scan table and numbered fixes already make things clear, pick the lightest useful target. No body images only when every planned target is explicitly accepted missing after reliable exact-match searches.

## Output

Use the base skill's draft, parent feedback and one-revision procedure before final checks. Keep its local review note outside the public JSON. Write `final.json` in the same shape and with the same field rules as `bloxodes-article-writing`. Parse-check the JSON. `universe_id` is usually `null` for platform pieces. Then verify with `npm run verify:article-finals` like any other article final.
