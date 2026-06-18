---
name: bloxodes-tool-writing
description: Write one Bloxodes tool final.json after brief approval. Use for /tools pages backed by the tools table, metadata, intro_md, how_it_works_md, description_json, faq_json, CTA fields, formula assumptions, input/result copy, and tool final.json.
---

# Bloxodes Tool Writing

Use this after `bloxodes-tool-research` and parent approval. Do not create a tool page if the input, output, or formula is weak.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<game-or-topic-slug>/tools/<tool-code>/
  brief.md
  final.json
```

3. Write `final.json`.
4. Parse JSON before returning.

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
