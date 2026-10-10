---
name: bloxodes-wiki-writing
description: Write one Bloxodes Roblox game wiki hub final.json after brief approval. Use for /wiki/<game-slug> page copy, metadata, description_md, tips_md, controls_json, cover_image, and wiki_pages final.json output.
---

# Bloxodes Wiki Writing

A wiki hub is the front door to one Roblox game. A new player should finish the description knowing what they actually do in the game, and the tips should feel like advice from someone who's already made the early mistakes.

Use this after `bloxodes-wiki-research` and parent approval.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Wiki hubs" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   tmp/content-workspace/<game-slug>/wiki/<game-slug>/
     brief.md
     final.json
   ```

3. Write `final.json` for `wiki_pages`.
4. Parse the JSON before returning.

## How the hub should read

- **Start with what the player does.** The first sentence of `description_md` puts the reader in the game: what you do, what you're working toward, what makes this game its own thing. Not "X is a Roblox game where..."
- **Explain the core loop like a friend would.** Earn this, spend it on that, unlock the next thing. Use the game's real names for places, currencies and systems, and explain any odd term in a few words right where it shows up.
- **Tips are the fun part.** Each one is a specific move with a reason: what to buy first, what to skip, what trips people up. "Upgrade your rod" is a chore list. "Buy the Iron Rod before any boat upgrade, because a faster boat doesn't help when your line keeps snapping" is a tip.
- **Talk about the game, never the page.** Don't describe what the wiki covers, and don't narrate how it was made. Follow Public Copy in root `AGENTS.md`. Game terms like Research or Source Cargo are fine.

## Rules

- `tips_md` has 3 or 4 useful gameplay tips. Each one names something real (a building, item, price, place or unlock) and gives the reason. If the brief doesn't have enough specifics for that, send it back for research instead of writing vague tips.
- `description_md` stays short, but it's never vague. Name the game's actual systems, currencies and goals so a new player knows exactly what they'll be doing. Short sentences, full content: see "Short sentences, full pages" in the voice guide.
- Fill `controls_json` only with verified controls. If you can't verify them, use `[]` and make sure the gap is listed in `brief.md`.
- Never infer controls from Roblox supported-device flags. A device goes in `controls_json` only when you have its actual control.
- Don't rewrite catalog blurbs in a wiki task. Catalog copy belongs to the catalog skills.
- No generic Roblox controls or generic beginner advice ("explore the map," "have fun with friends").

## Fields

- `universe_id`: the exact Roblox universe for the game.
- `slug`: the editorial game slug. Never `roblox_universes.slug`.
- `title`: the simple hub pattern `<Game> Wiki`.
- `seo_title`: close to the title and readable in search.
- `meta_description`: what a player can figure out here, in one or two plain sentences with a reason to click. Aim for roughly 140 to 160 characters. Lead with the game and what the player gets, never "Learn how" or "Learn everything".
- `description_md`: 1 or 2 short, link-free paragraphs about what the player does and how the core loop works. No promises about what the wiki covers, no links, not a full guide.
- `tips_md`: 3 or 4 concrete tips for a new or returning player.
- `controls_json`: `[]` when nothing is verified. Otherwise an array of rows like `{ "action": "Jump", "desktop": "Space" }`, using only verified device keys: `desktop`, `mobile`, `tablet`, `console` and `vr`. Never generic `controls`, `keys`, `value` or `description` fields.
- `cover_image`: `null` for normal hubs. The runtime uses the official universe icon for the square title art and the first official landscape thumbnail for `/wiki` cards and social previews. `sync-game-wiki-runtime.ts` rejects non-null values unless a user-requested, reviewed exception is published with `--allow-cover-override`.

## Output shape

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

Before returning, run the voice guide's "Before you hand it in" check on the description and tips.
