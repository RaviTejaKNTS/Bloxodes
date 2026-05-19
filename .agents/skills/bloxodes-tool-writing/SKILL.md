---
name: bloxodes-tool-writing
description: Write or rewrite Bloxodes tool page content for the tools table. Use for /tools pages, tool metadata, intro_md, how_it_works_md, description_json, faq_json, CTA fields, tool SEO, calculator explanations, formula assumptions, input/result copy, and Roblox tool pages that need clear final-shaped Supabase output.
---

# Bloxodes Tool Writing

## Start Here

Read:

- `agents/content/writing-core.md`
- `agents/content/research-policy.md`
- `agents/content/page-types/tools.md`
- `agents/content/final-edit.md`

If these files have not been read in the current task, read them before writing.

## What This Skill Is For

Use this when the page is centered on an interactive tool: a calculator, optimizer, converter, extractor, planner, checker, or helper tied to Roblox or a specific game.

The copy should make the tool result easier to trust and understand. It should not compete with the tool UI or bury the interactive experience under prose.

Use these inputs:

- `research-notes.md`
- current `tools` schema or row
- target route behavior
- tool client behavior if formulas, inputs, or result labels matter
- related game or `universe_id` when relevant
- current rates, formulas, item values, or dataset rows when the tool depends on changing data
- user questions and edge cases around the calculation, optimizer, extractor, converter, or planner

## Output Shape

Return valid JSON shaped for `tools`:

```json
{
  "code": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "intro_md": "",
  "how_it_works_md": "",
  "description_json": {},
  "faq_json": [],
  "cta_label": null,
  "cta_url": null,
  "thumb_url": null,
  "universe_id": null
}
```

Only include fields being written.

## Workflow

Inspect the row, route, and tool client behavior before writing. If formulas, rates, item values, or datasets affect the result, verify them before making claims.

Research the use case in plain language. What is the user trying to calculate, compare, optimize, extract, or plan? What inputs matter? What does the output mean? Where can the result be wrong, stale, or approximate?

Write directly in final JSON using the core Bloxodes voice. Keep the research internal and explain the useful result directly.

Run the final edit gate before returning output.

## Writing Guidance

The intro should quickly say what the tool helps the user calculate, compare, optimize, extract, or plan.

`how_it_works_md` should explain inputs, outputs, assumptions, and limits in plain English. Give enough context before formulas or caveats so the user understands what the result means.

Do not claim exact accuracy when the result depends on changing data, player-entered estimates, hidden formulas, or incomplete datasets. Say what the tool can safely estimate and where the user should treat the result as guidance.

Keep each paragraph focused on one input, output, assumption, or edge case. FAQs should answer real tool-use questions, not generic page questions.

Keep the interactive tool as the main experience.

## Finish

Save or return only `final.json` shaped fields. Do not return preliminary copy for later cleanup, and do not create `brief.md` or `review.md`.
