---
name: bloxodes-wiki-writing
description: Write or update Bloxodes Roblox game wiki hub content backed by wiki_pages. Use for /wiki/<game-slug> page copy, metadata, tips_md, controls_json, related-page context, and source-aware game hub writing.
---

# Bloxodes Wiki Writing

Read `agents/content-writing/agents.md` first.

Wiki hubs explain one Roblox game clearly. They should help a new or returning player understand what the game is, what they do in a normal session, and which related Bloxodes pages matter.

## Workflow

1. Resolve the exact Roblox game: universe ID, root place ID, creator, official URL, and preferred editorial slug.
2. Check production for existing wiki, codes, catalogs, events, tools, articles, checklists, and quizzes for the same universe.
3. Inspect the linked `roblox_universes` row and related local datasets.
4. Create workspace:

```text
tmp/content-workspace/<game-slug>/wiki/<game-slug>/
  research-notes.md
  final.json
```

5. Write `research-notes.md` with game identity, production coverage, useful related pages, controls sources, and gaps.
6. Write `final.json` for `wiki_pages`.
7. Parse JSON and verify route assumptions before import.

## Local Dataset Work

Use this when a local game dataset is becoming a public wiki page.

- Confirm local JSON parses before writing around it.
- Check that useful related catalog datasets exist and have clear collection names.
- Preview locally before production when importing a new wiki page.
- Verify title, metadata, related catalog links, images, sitemap coverage, and revalidation behavior before publishing.
- Promote production content only through the normal controlled seed, upsert, or migration path.

## Writing Rules

- Start with what the player does in the game.
- Keep `tips_md` to 3-4 useful gameplay tips.
- Fill `controls_json` only with verified controls. If controls cannot be verified, say so in research notes.
- Do not rewrite catalog blurbs inside a wiki task. Use catalog skills for catalog copy.
- Do not pad with generic Roblox controls or generic beginner advice.

## Field Jobs

- `universe_id`: Link the wiki to the exact Roblox universe.
- `slug`: Use the editorial game slug.
- `title`: Use the simple hub pattern `<Game> Wiki`.
- `seo_title`: Keep it close to the title and readable in search.
- `meta_description`: Say what the hub helps players check or understand.
- `tips_md`: Write 3-4 concrete gameplay tips that help a new or returning player.
- `controls_json`: Write only verified game controls. Record gaps in research notes.
- `cover_image`: Use a suitable game image when available.
- `game_description_md`: When included in the workflow, explain the normal game loop and core systems for the visible wiki summary.

## Output Shape

```json
{
  "universe_id": 0,
  "slug": "",
  "title": "",
  "seo_title": "",
  "meta_description": "",
  "tips_md": "",
  "controls_json": [],
  "cover_image": null,
  "is_published": true
}
```
