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

## Writing Rules

- write in a simple language that anyone can undestand and follow through. 
- Write for Roblox players like a Roblox player who gathered the wiki for everyone to check.
- Do not write about sources, dataset, or what this page is about.
- Do not write about your actions. Always focus on the game and players.

- Start with what the player does in the game.
- Keep `tips_md` to 3-4 useful gameplay tips.
- Fill `controls_json` only with verified controls. If controls cannot be verified, leave it empty and make sure the gap is listed in `brief.md`.
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
- `controls_json`: Write only verified game controls. Keep unverified controls out of public copy.
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
