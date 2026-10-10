---
name: bloxodes-gta-wiki-workflow-runner
description: Run one approved Bloxodes GTA wiki hub through research, parent review, writing, managed-development verification, and browser review. In T3 Code each stage goes to its assigned model (Luna for research and editorial review; Haiku 5.5 for research review and writing). Use for new or updated GTA wiki hubs. Never publish production.
---

# Bloxodes GTA wiki workflow runner compatibility entrypoint

This is the GTA entry point for running a hub. Read and follow `.agents/skills/bloxodes-franchise-wiki-workflow-runner/SKILL.md` completely, using this fixed context.

**In T3 Code** (you have the `delegate_task` tool and the owner runs GTA hubs here), follow the "Franchise wiki hubs" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md` instead of the franchise runner's worker handoffs, using the GTA context below. Luna researches and does the editorial review. Haiku 5.5 reviews the research and writes. Outside T3 Code, the flow below applies.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Allowlist and workspace:** one GTA title at a time under `tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/`
- **Route:** `/gta/wiki/<game-slug>`
- **Tables/views:** `games`, `game_wiki_pages`, and their GTA views
- **Official-source policy:** Rockstar first, then dedicated GTA wikis and databases, established guides, and limited community evidence
- **Mode boundary:** Story Mode and GTA Online stay separate. Announced titles use confirmed facts only.
- **Final verifier:** `npm run verify:gta-wiki-final` (args `--game <game-slug> --workspace tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>`). The route verifier for this page type. Never run it locally; use the GitHub QA job below.
- **GitHub QA:** `Managed content QA` with a selected batch or bundle using operation kind `franchise-wiki` and namespace `gta`
- **Browser checks:** GTA-only sidebar and search scope, normal Bloxodes layout, collection CTA, metadata, canonical, structured data, desktop and mobile overflow, and images

## Published hub media check

- Confirm both `game.json` image roles are present, source-backed, distinct and served from Bloxodes-hosted wiki media.
- Confirm cover artwork is used for cards/social metadata and hero artwork is used for the square title thumbnail.
- GTA VI (`gta-6`) uses status `upcoming` and only Rockstar-confirmed pre-launch facts until it releases.
- Sync its hub media with `sync:gta-wiki-media -- --manifest <reviewed.json>`.

## GTA rules

- Keep the franchise runner's parent gates, one-worker-per-hub rule, research approval before writing, and stop-before-production boundary.
- The writer uses the GTA writing skill (`.agents/skills/bloxodes-gta-wiki-writing/SKILL.md`) plus `bloxodes-voice`. Review the copy against `bloxodes-voice` as the franchise runner's "Parent checks" describe.
- Never use Roblox tables, APIs or `/wiki` routes.
- Application or schema changes are outside this wrapper unless a separate request explicitly authorizes them.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
