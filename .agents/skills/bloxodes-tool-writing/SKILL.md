---
name: bloxodes-tool-writing
description: Write or rewrite Bloxodes tool page content backed by the tools table. Use for /tools pages, metadata, intro_md, how_it_works_md, description_json, faq_json, CTA fields, formula assumptions, input/result copy, and tool final.json.
---

# Bloxodes Tool Writing

Read `agents/content-writing/agents.md` first.

Use this when the page has a real tool job: calculator, planner, converter, checker, tracker, or optimizer. Do not create a tool page if the input, output, or formula is weak.

## Workflow

1. Check production for an existing tool or related page that already solves the job.
2. Confirm the player task, inputs, outputs, formula or data source, and limitations.
3. Create workspace:

```text
tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/
  research-notes.md
  final.json
```

4. Write `research-notes.md` with the tool job, sources, formula assumptions, edge cases, related pages, and gaps.
5. Write `final.json`.
6. Parse JSON and verify fields match the tools table and route behavior.

## Writing Rules

- Explain what the tool result means and how players should use it.
- Keep the intro short and useful.
- Put formulas, assumptions, and limits in plain language.
- Do not overpromise exactness when the result depends on changing game data or user assumptions.
- FAQs should answer real tool-use questions.

## Field Jobs

- `code`: Use the stable tool route code.
- `title`: Name the tool by the job it performs.
- `seo_title`: Keep it readable for search and close to the visible title.
- `meta_description`: Say what result the tool gives.
- `intro_md`: Explain when to use the tool and what decision it helps with.
- `how_it_works_md`: Explain inputs, outputs, formulas, assumptions, and limits in plain language.
- `description_json`: Add deeper notes for edge cases, examples, or result interpretation.
- `faq_json`: Answer real questions users have after using the tool.
- `cta_label` and `cta_url`: Use only when there is a clear next action.
- `thumb_url`: Use an approved image when the page needs one.
- `universe_id`: Set only when the tool belongs to one Roblox game.

## Output Shape

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
  "universe_id": null,
  "is_published": true
}
```
