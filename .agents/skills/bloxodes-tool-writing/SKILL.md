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

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful — never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Playful, not loud. Drop in a light, dry touch of wit — roughly one per short paragraph — and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays — not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length — not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing — the item, mechanic, or answer. No "In this game…", "This collection…", "Welcome to…", or mood-setting warm-ups.
- Read the room. Keep the wit lighter, or drop it, when the reader is stressed — error fixes, "won't open", crashes, anything troubleshooting. Help first.
- Keep functional slots clean. Steps, task items, table cells, quiz questions, and input labels stay plain and direct. Let the playful voice live in intros, descriptions, and blurbs.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

## Writing Rules

- Explain what the tool result means and how players should use it.
- Keep the intro short and useful.
- Put formulas, assumptions, and limits in plain language.
- Do not overpromise exactness when the result depends on changing game data or user assumptions.
- FAQs should answer real tool-use questions.
- Public copy must be player-facing, not provenance-facing. Do not write about sources, source-backed data, datasets, rows, tables, briefs, research, or `final.json` in `intro_md`, `how_it_works_md`, `description_json`, or `faq_json`.
- For game tools, center the game problem first: what the player is trying to decide, what they enter, what result they get, and how to use that result in the game.
- Avoid self-referential filler such as "this page" unless the user specifically asks for page documentation. Prefer "this calculator" or "the tool" only when it helps the player understand the action.

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
