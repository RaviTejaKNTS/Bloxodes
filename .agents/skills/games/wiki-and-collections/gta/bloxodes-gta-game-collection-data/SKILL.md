---
name: bloxodes-gta-game-collection-data
description: Prepare or update one source-backed Bloxodes GTA collection dataset after brief approval. Use for complete v2 rows, comparison fields, sections, image planning, GTA runtime manifest creation, audits, and data-readiness notes. Do not gather images, write final.json, or publish production.
---

# Bloxodes GTA game collection data compatibility entrypoint

This is the GTA entry point for collection data. Read and follow `.agents/skills/bloxodes-franchise-game-collection-data/SKILL.md` completely, using the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Workspace:** `tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/`
- **Reference format:** `tmp/content-workspace/gta/gta-5/collections/weapons/`
- **Route:** `/gta/wiki/<game-slug>/<collection-slug>`
- **Tables:** `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`
- **Runtime media prefix:** `gta/<game-slug>/<collection-slug>/`
- **Page type:** `database` or `collectible` in `runtime-manifest.json`, using the existing GTA collection row and v2 dataset for both
- **Code pattern:** `<game-slug>-<collection-slug>`
- **Audit:** `npm run audit:game-collection-datasets:v2`
- **Checker:** `npm run check:game-collection-data`
- **Runtime sync dry plan:** `npm run sync:gta-collection-runtime -- --manifest <workspace>/runtime-manifest.json`

## Card videos (database collections)

- Declare a public URL field in `itemFields`, `columns` and `cardFields` with `fieldPresentation` kind `video`.
- Verify each URL against the official uploader.
- HTTPS YouTube watch, `youtu.be` and embed URLs are supported.
- Keep `system.image` as the poster and fallback. Use `null` for missing videos.
- Table and detail declarations render validated watch links.

## GTA rules

- Keep the franchise skill's v2 contract, public/system field separation, display metadata, section, image-planning, `sourceUrls` and data-readiness rules.
- Public values stay short and exact, following the `bloxodes-voice` "plain" slot (`.agents/skills/bloxodes-voice/SKILL.md`). No "reportedly" or "unconfirmed" in a row. Doubts go in `brief.md`, and unverified values stay `null` or empty.
- Don't gather images, write `final.json`, use `data/` or `apps/web/public/`, use `GAME_COLLECTIONS` or `register:game-collection`, or call Roblox APIs.
- Never pass `--apply`, `--upload-media`, `--publish` or `--allow-prod`.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
