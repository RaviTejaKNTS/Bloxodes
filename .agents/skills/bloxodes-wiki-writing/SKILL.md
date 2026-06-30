---
name: bloxodes-wiki-writing
description: Write one Bloxodes Roblox game wiki hub final.json after brief approval. Use for /wiki/<game-slug> page copy, metadata, description_md, tips_md, controls_json, cover_image, and wiki_pages final.json output.
---

# Bloxodes Wiki Writing

Use this after `bloxodes-wiki-research` and parent approval. Wiki hubs explain one Roblox game clearly.

## Workflow

1. Read the approved `brief.md`.
2. Create or update:

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/
  brief.md
  final.json
```

3. Write `final.json` for `wiki_pages`.
4. Parse JSON before returning.

## Voice & Tone

Bloxodes house voice: write like a player who knows the game well, telling a friend how it works. Calm, warm, and a little playful, never formal, corporate, or hyped.

- Simple English first. Short sentences, everyday words a younger player gets instantly. Explain any game term in plain words right where it appears.
- Do not use em dashes. Replace any em dash with a colon, comma, parentheses, or two short sentences. This applies to every output field: title, metadata, body, FAQ, and all JSON values.
- Playful, not loud. Drop in a light, dry touch of wit (roughly one per short paragraph) and always wrap it around a real fact, like "protection that overstays its welcome." The fact leads; the wit rides along. Never force a joke, stack puns, or let a quip hide the info.
- Gamer-buddy warmth. Talk to the player as "you," use real in-game nouns, and sound like someone who actually plays, not a manual.
- Spark from rhythm, not adjectives. Energy comes from concrete detail, a strong first line, and varied sentence length, not from words like *ultimate, insane, amazing, epic, must-have, game-changer*. Ban those.
- Open on the real thing: the item, mechanic, or answer. No "In this game…", "This collection…", "Welcome to…", or mood-setting warm-ups.
- Read the room. Keep the wit lighter, or drop it, when the reader is stressed: error fixes, "won't open", crashes, anything troubleshooting. Help first.
- Keep functional slots clean. Steps, task items, table cells, quiz questions, and input labels stay plain and direct. Let the playful voice live in intros, descriptions, and blurbs.
- No filler or AI tics. Cut "Additionally", "Furthermore", "It's important to note", and "not just… but". Every sentence earns its place.

## Writing Rules

- Write for Roblox players like a Roblox player who gathered the wiki for everyone to check.
- Do not write about sources, dataset, or what this page is about.
- Do not write about your actions. Always focus on the game and players.

- Start with what the player does in the game.
- Keep `tips_md` to 3-4 useful gameplay tips.
- Fill `controls_json` only with verified controls. If controls cannot be verified, use `[]` and make sure the gap is listed in `brief.md`.
- Do not infer controls from Roblox supported-device flags. A device belongs in `controls_json` only when you have that device's actual control.
- Do not rewrite catalog blurbs inside a wiki task. Use catalog skills for catalog copy.
- Do not pad with generic Roblox controls or generic beginner advice.

## Field Jobs

- `universe_id`: Link the wiki to the exact Roblox universe.
- `slug`: Use the editorial game slug.
- `title`: Use the simple hub pattern `<Game> Wiki`.
- `seo_title`: Keep it close to the title and readable in search.
- `meta_description`: Say what the hub helps players check or understand.
- `description_md`: Write 1-2 short, link-free paragraphs focused only on what the player does in the game and how the core loop works. Do not promise what the wiki covers, do not add links, and do not turn this into a long guide.
- `tips_md`: Write 3-4 concrete gameplay tips that help a new or returning player.
- `controls_json`: Use `[]` when no controls are verified. Otherwise write an array of rows shaped like `{ "action": "Jump", "desktop": "Space" }`, using only verified device keys: `desktop`, `mobile`, `tablet`, `console`, and `vr`. Do not use generic `controls`, `keys`, `value`, or `description` fields.
- `cover_image`: Use a suitable game image when available.

## Output Shape

```json
{
  "universe_id": 0,
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "description_md": "",
  "tips_md": "",
  "controls_json": [],
  "cover_image": null,
  "is_published": true
}
```
