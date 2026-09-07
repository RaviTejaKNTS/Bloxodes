---
name: bloxodes-tech-article-writing
description: >-
  Write one Bloxodes tech / platform / troubleshooting article final.json from an approved brief.md. Use for Roblox platform pieces: error-code fixes, "how to fix" / "won't open" / crash / lag / install guides, settings how-tos, and other non-gameplay Roblox tech articles approved for /articles. Adds scan-table, numbered-step, heading, depth, and link rules on top of bloxodes-article-writing.
---

# Bloxodes Tech Article Writing

## Code-controlled execution

When assigned a code-controlled stage, follow [stage ownership](../bloxodes-article-workflow-runner/references/code-controlled-stages.md). It overrides interactive parent/subagent, upload/import, and standalone self-review instructions for that invocation. Complete only the assigned artifact or review; the runtime owns subsequent stages and approval records. Preserve the editorial and page-type contracts below.

Use this for one Roblox **tech / platform / troubleshooting** article only, after `brief.md` is approved.

This is a thin add-on. It does not replace `bloxodes-article-writing`; it sits on top of it.

- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.

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

**Depth profile: complete and easy to follow**
- Go deeper than a normal article: cover causes, every realistic fix or step, and the fallback when nothing works. Do not leave a gap a competitor covers.
- Give each fix enough room to explain when it applies, the exact action, the result to check, and the next option if it fails. Keep paragraphs comfortable without a sentence-count ceiling. Remove padding, not useful explanation.
- The whole piece should read as one clean story: problem → relevant cause → fixes/steps → useful fallback. FAQs are optional; the scan table may summarize facts explained in the fixes.

**Quick-scan table at the top (when it helps)**
- When the article has several ordered fixes, steps, or options, add a compact scan table right after the intro, before the first `##` section.
- Keep it to 2-3 columns and one line per row (e.g. `#` | `Fix` | `What it does`). It is a map of the page, not a second copy of the content.
- Skip the table when there are only one or two steps, or when there is nothing ordered to summarize. Do not force it.

**Numbered headings and numbered steps**
- Number the fix/step `###` headings (`### 1. Clear the Roblox cache`, `### 2. Run as administrator`) so the order is obvious and matches the scan table.
- Under each heading, explain when the fix helps, then give the procedure as a **numbered list** when it has ordered steps. Use one action per step with the exact path or click, and explain how to check the result afterward.
- Keep the `bloxodes-article-writing` troubleshooting rule: each fix gets its own `###` under one `##`; no deep bullet-in-bullet hierarchies; order easiest-first.

**Headings**
- Use concise action labels or natural reader questions that identify the actual error, setting, or fix. Do not force sentence-like headings.
- Lead with the words a player would actually search or scan for.

**Links: internal**
- Add verified internal links where they support a fix, explanation, or next action. Prefer suitable existing words; there is no minimum count.
- Good targets: the error-codes pillar page, sibling fix articles, and any related wiki / tool / catalog / checklist page on the site.
- Omit unpublished targets and keep any missing-link note in the brief, never in public copy.

**Links: external official sources**
- Link to the official source when it helps the reader act: Roblox download (`roblox.com/download`), Roblox Support (`roblox.com/support`), the Roblox status/help pages, or the relevant vendor page (GPU driver download, Windows update, etc.).
- Prefer first-party/official destinations. Do not link to sketchy "repair tool" downloads or low-trust mirrors.

**Accuracy reminders specific to tech**
- Never tell a reader to play Roblox in a web browser: the in-browser player is discontinued; `roblox.com` only launches the installed app.
- Do not invent error codes, menu paths, or toggles. If a path is uncertain, keep the wording generic.
- Keep it evergreen: no version numbers, dates, "latest/current/2025", or "updated" freshness claims.

**Media for troubleshooting**
- Follow the base writing skill's perfect-match video and hosted-image rules.
- Use a video only when it demonstrates the same error or procedure. Place it after the short intro or near the matching fix.
- Use a clean hosted screenshot when a settings path or UI control is difficult to find from prose alone.
- Use the mandatory image pass to target at least the highest-value error screen, setting, control, or result. When the scan table and numbered fixes already make the procedure clear, choose the lightest useful image target. Omit body images only when every planned target is explicitly accepted missing after reliable exact-match searches.

## Output

Apply the base skill's draft, parent feedback, and one-revision procedure before final verification. Keep its local review note outside public JSON. Write `final.json` in the same shape and to the same field rules as `bloxodes-article-writing`. Parse-check the JSON. `universe_id` is usually `null` for platform pieces. Then verify with `npm run verify:article-finals` like any other article final.
