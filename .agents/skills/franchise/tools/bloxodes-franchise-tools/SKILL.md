---
name: bloxodes-franchise-tools
description: Prepare and verify tool pages backed by registered calculators for non-Roblox games and franchises.
---

# Bloxodes Franchise Tools

A tool page helps a player make one decision: sell or keep, which upgrade next, how long until the next rebirth. Your copy starts from that decision, explains what to enter and what the result means, and is honest about where the math gets fuzzy.

Use this after [tool research](references/research.md) and parent approval. Don't create a tool page if the input, output or formula is weak.

**Before you start:** read `bloxodes-docs/content/franchise.md` (identity, routes, tables and the rules every franchise page follows) and `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images and layout). The page has the same sections, sidebar, image slots, FAQ and related links as a Roblox tool page. Tool pages are the one page type that explains how to use the page: what to enter and what the result means. Set the tool's own `thumb_url`; publishing fails without a real image.

For a full run, follow [the workflow](references/workflow.md). Minecraft keeps its existing calculator engines, rules and specialist publisher. New shared tools use a registered calculator; the generic publisher currently accepts only `resource-cost`. Its `rules_json` needs finite non-negative numeric `unitCost` and non-empty `resourceLabel`. It multiplies whole-number quantity by unit cost. Other tools need a reviewed calculator implementation and publisher support first. Never put executable code in rows.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Tool pages" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<namespace>/<game-slug>/tools/<tool-slug>/
     brief.md
     final.json
   ```

3. Write `final.json` using the `tools` group for `publish:game-pages`.
4. Check the JSON shape before returning. Parsing, validation and input-result checks run on GitHub, never locally.

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

- `namespace`, `game_id` and `slug`: the approved namespace, registry owner UUID and stable tool slug. The database derives `code` from `slug`; omit `code` from the payload.
- `title`: names the game and tool by the job it does, in search wording, about 50 to 65 characters ("Garden Rush Crop Value Calculator").
- `seo_title`: readable in search and close to the visible title.
- `meta_description`: what result the tool gives and why it helps, about 140 to 160 characters.
- `intro_md`: when to use the tool and the decision it helps with.
- `how_it_works_md`: inputs, outputs, formulas, assumptions and limits in plain language.
- `description_json`: deeper notes for edge cases, examples or reading the result.
- `faq_json`: real questions players have after using the tool. Every entry is `{ "q": "...", "a": "..." }`.
- `thumb_url`: a required credited official key-art, store-art or real gameplay image for cards and social previews. Never pad portrait art. Missing images block publication; check `og:image` in QA.
- `tool_key` and `rules_json`: the registered calculator and verified rules. Record formula sources, edition/platform/mode scope and limits in the brief.
- `description_md`: additional game advice only when it adds useful context.
- `is_published` and `published_at`: reviewed publication state and date.

## Output shape

The `tools` group uses the existing database fields. Don't copy unsupported Roblox fields into it.

```json
{
  "tools": [{
    "namespace": "<namespace>",
    "game_id": "<game-uuid>",
    "slug": "<tool-slug>",
    "title": "",
    "seo_title": "",
    "meta_description": "",
    "intro_md": "",
    "how_it_works_md": "",
    "description_md": "",
    "description_json": {},
    "faq_json": [{ "q": "", "a": "" }],
    "thumb_url": "<credited-image-url>",
    "tool_key": "resource-cost",
    "rules_json": { "unitCost": 0, "resourceLabel": "<verified-resource-name>" },
    "is_published": false
  }]
}
```

Use `GameToolPageLayout` for the title, copy, columns and calculator body. It uses the same `DedicatedToolPage` shell as Roblox and Minecraft tools. Supply a registered client calculator as its body; the layout doesn't dictate the calculation. If the shared schema lacks a field from the Roblox template, report the implementation gap rather than dropping the visible section.
