---
name: bloxodes-franchise-wiki-writing
description: Write one non-Roblox franchise or game wiki hub from an approved brief. Same hub, fields and rules as the Roblox wiki writing skill, with franchise identity, scope and required cover and thumbnail artwork. Use for game.json and final.json; don't publish production.
---

# Bloxodes Franchise Wiki Writing

A wiki hub is the front door to one game, or to a whole franchise. A new player should finish the description knowing what they actually do in the game, and the tips should feel like advice from someone who's already made the early mistakes.

This is the same job, the same page and the same rules as `bloxodes-wiki-writing` for Roblox. The only differences are listed under "Franchise differences" below.

Use this after `bloxodes-franchise-wiki-research` and parent approval. Write one hub per run.

## Read first

- The voice guide: `.agents/skills/bloxodes-voice/SKILL.md`, plus the "Wiki hubs" section of `.agents/skills/bloxodes-voice/references/examples.md`.
- Page standards: `bloxodes-docs/content/page-standards.md` (titles, headings, depth, images, layout).
- The approved `brief.md`.

## Workflow

1. Read the approved brief.
2. Create or update:

   ```text
   <workspace-root>/<game-slug>/wiki/<game-slug>/
     brief.md
     game.json
     final.json
   ```

3. Write `game.json` (identity and artwork) and `final.json` (hub copy).
4. Parse both JSON files before returning.

## How the hub should read

- **Start with what the player does.** The first sentence of `description_md` puts the reader in the game: what you do, what you're working toward, what makes this game its own thing. Not "X is a game where..."
- **Explain the core loop like a friend would.** Earn this, spend it on that, unlock the next thing. Use the game's real names for places, currencies, modes and systems, and explain any odd term in a few words right where it shows up.
- **Tips are the fun part.** Each one is a specific move with a reason: what to do first, what to skip, what trips people up. "Learn the drift" is a chore list. "Hold the drift through the whole S-bend on Moo Moo Meadows, because the purple boost you build there carries you past the item boxes first" is a tip.
- **Use the brief's numbers.** When the brief gives a recommended value or range for something sources disagree on, use it.
- **Talk about the game, never the page.** Don't describe what the wiki covers, and don't narrate how it was made. Follow the public copy rules in root `AGENTS.md`.

## Rules

- `tips_md` has 3 or 4 useful gameplay tips. Each one names something real (a mode, item, unlock, place or technique) and gives the reason. If the brief doesn't have enough specifics, send it back for research instead of writing vague tips. Any heading inside it follows page standards.
- `description_md` stays short but never vague. Name the game's actual systems, modes and goals.
- Fill `controls_json` only with verified controls. If you can't verify them, use `[]` and list the gap in `brief.md`. Never infer controls from supported-platform lists.
- No generic beginner advice ("explore the map," "have fun with friends").

## Fields

### `final.json`

- `game_slug` and `slug`: the approved editorial slug.
- `title`: `<Short Game Name> Wiki`. For a franchise root, `<Franchise> Wiki`.
- `seo_title`: close to the title and readable in search, 50 to 65 characters, naming what a player finds there (`ARC Raiders Wiki: Raids, Workshop Gear, Skill Tree and Feats`).
- `meta_description`: what a player can figure out here, with a reason to click, roughly 140 to 160 characters. Lead with the game, never "Learn how" or "Learn everything." No completeness or freshness claims.
- `description_md`: 1 or 2 short, link-free paragraphs about what the player does and how the core loop works.
- `tips_md`: 3 or 4 concrete tips. Leave empty only for an announced or unreleased game with no real gameplay to advise on.
- `controls_json`: `[]` or verified rows using the target renderer's control keys.
- `cover_image`: `null`. Hub artwork lives in `game.json`.

### `game.json`

- `slug`, `title`, `short_title`, `installment`, `developer`, `publisher`, `official_url`, `release_dates_json`, `platforms_json`: verified facts only. Leave unknowns empty.
- `status`: `announced`, `upcoming` or `released`.
- `description_md`: one short line for cards and the franchise directory.
- `cover_image` **(required)**: a landscape 16:9 image for cards and social previews. Official key art, store art or a real gameplay screenshot. Never pad portrait box art into a wide frame.
- `hero_image` **(required)**: a separate square-friendly image for the thumbnail beside the title. Never reuse the cover URL.

Both images are served from Bloxodes media (`https://media.bloxodes.com/wiki/...`), never hotlinked. Stage them with `npm run sync:franchise-wiki-media -- --namespace <slug>` (GTA uses `sync:gta-wiki-media`, Minecraft `sync:minecraft-wiki-media`). A hub without both images isn't ready: don't hand it in, send it back to the image stage.

## Franchise differences

These are the only places this skill differs from the Roblox one.

- **Identity:** no `universe_id` or any Roblox identifier. The hub belongs to a namespace and a `games` row. `games.kind` is `franchise` or `game`, and a child game sets `parent_id`. Routes are `/<namespace>/wiki` for a root and `/<namespace>/wiki/<game-slug>` for a child. See `bloxodes-docs/content/franchise.md`.
- **Artwork:** Roblox hubs get images from the universe automatically. Franchise hubs, roots included, must supply `cover_image` and `hero_image` in `game.json`.
- **Scope:** keep campaign, online service, expansion, mode, edition, platform and release-generation boundaries from the brief. Don't blend inventories, progression, prices or ranks from separate scopes.
- **Unreleased games:** write only restrained, verified facts. Tips can be empty.
- **Collection links:** approved collections link through runtime data and the hub renderer. Don't promise future collections in `description_md`.
- **Publication:** `publish:game-pages -- --namespace <slug> --file <reviewed.json>` (identity before wiki, then collections), through the `game-pages` and `franchise-wiki` publishers.

## Output shape

`final.json`:

```json
{
  "game_slug": "",
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

`game.json`:

```json
{
  "slug": "",
  "title": "",
  "short_title": "",
  "installment": "",
  "developer": "",
  "publisher": "",
  "description_md": "",
  "cover_image": "https://media.bloxodes.com/wiki/...",
  "hero_image": "https://media.bloxodes.com/wiki/...",
  "official_url": "",
  "release_dates_json": {},
  "platforms_json": [],
  "status": "released",
  "is_published": true
}
```

## Before you return

- Both JSON files parse.
- `cover_image` and `hero_image` are set, different, landscape and square respectively, and hosted on `media.bloxodes.com`.
- Title, SEO title and any headings meet `bloxodes-docs/content/page-standards.md`.
- Scope claims match the brief.
- The voice guide's "Before you hand it in" check passes on the description and tips.

Return the workspace path, the parse results and any fact you left out because the evidence wasn't strong enough.
