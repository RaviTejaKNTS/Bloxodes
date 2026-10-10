---
name: bloxodes-tool-writing
description: Write one Bloxodes tool final.json after brief approval. Use for /tools pages backed by the tools table, metadata, intro_md, how_it_works_md, description_json, faq_json, CTA fields, formula assumptions, input/result copy, and tool final.json.
---

# Bloxodes Tool Writing

A tool page helps a player make one decision: sell or keep, which upgrade next, how long until the next rebirth. Your copy starts from that decision, explains what to enter and what the result means, and is honest about where the math gets fuzzy.

Use this after `bloxodes-tool-research` and parent approval. Don't create a tool page if the input, output or formula is weak.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Tool pages" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/
     brief.md
     final.json
   ```

3. Write `final.json`.
4. Parse the JSON before returning.

## How the copy should read

- **Start with the player's problem.** What they're trying to decide, what they enter, what they get and how to use it in the game. Name the real inputs and the result in this game's terms.
- **Formulas in plain language.** Say how the number is built and what can throw it off. Use a quick worked example when it helps.
- **Honest about limits.** Don't promise exactness when results depend on changing game data or the player's assumptions. Say it once, where it matters.
- **Labels and inputs stay plain.** Personality lives in the intro and explanations, not in input labels or result units.
- **Avoid "this page."** Say "the calculator" or "the tool" only when it helps the player understand the action. Never narrate how the page was made. Follow Public Copy in root `AGENTS.md`.

## Writing rules

- Explain what the result means and how to use it.
- Keep the intro short and useful.
- Put formulas, assumptions and limits in plain language.
- FAQs answer real questions people have after using the tool.

## Field jobs

- `code`: the stable tool route code.
- `title`: names the tool by the job it does, in search wording ("Garden Rush Crop Value Calculator").
- `seo_title`: readable in search and close to the visible title.
- `meta_description`: what result the tool gives and why it helps.
- `intro_md`: when to use the tool and the decision it helps with.
- `how_it_works_md`: inputs, outputs, formulas, assumptions and limits in plain language.
- `description_json`: deeper notes for edge cases, examples or reading the result.
- `faq_json`: real questions players have after using the tool. Every entry is `{ "q": "...", "a": "..." }`.
- `cta_label` and `cta_url`: only when there's a clear next action.
- `thumb_url`: an approved image when the page needs one.
- `universe_id`: only when the tool belongs to one Roblox game.

## Output shape

```json
{
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [{ "q": "", "a": "" }],
  "cta_label": null,
  "cta_url": null,
  "thumb_url": null,
  "universe_id": null,
  "is_published": true
}
```
