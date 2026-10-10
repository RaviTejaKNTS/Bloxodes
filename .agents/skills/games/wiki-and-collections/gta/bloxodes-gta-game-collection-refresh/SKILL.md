---
name: bloxodes-gta-game-collection-refresh
description: Maintain an existing Bloxodes GTA collection by checking verified roster, field, edition, and image changes, then updating only confirmed deltas. Use for existing /gta/wiki collections, not discovery or new pages. Stop unchanged when no real delta exists and never publish production.
---

# Bloxodes GTA game collection refresh compatibility entrypoint

**In T3 Code** (you have the `delegate_task` tool and the owner runs this here), follow the "Franchise collection refresh" stage table in `.agents/skills/bloxodes-model-routing/SKILL.md`: Luna builds the evidence and data and reviews the writing, Haiku 5.5 reviews Luna's work and writes. Outside T3 Code, the flow below applies.

This is the GTA entry point for collection refreshes. Read and follow `.agents/skills/bloxodes-franchise-game-collection-refresh/SKILL.md` completely, using the GTA context below.

## GTA context

- **Franchise and namespace:** Grand Theft Auto / `gta`
- **Existing collection table:** `game_collection_pages`
- **Route:** `/gta/wiki/<game-slug>/<collection-slug>`
- **Workspace:** `tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/`
- **Pipeline docs:** `dev-docs/pipelines/wiki-collections.md`
- **Supporting skills:** the GTA data and GTA image compatibility entry points (`bloxodes-gta-game-collection-data`, `bloxodes-gta-game-collection-images`)
- **Scope:** existing collections with a published dataset pointer only. Never discover, suggest or create.
- **Boundaries:** never change Story Mode, Online, edition or platform scope during a refresh.
- **Runtime:** GTA `pageType`, immutable GTA dataset revisions, the GTA progress adapter and the managed-development verifier

## GTA rules

- Use the franchise skill's quick-check outcomes: Unchanged, Data update, Page-type update, Image update, Copy follow-up and Blocked.
- Stop unchanged without edits, and act only on source-backed deltas.
- Keep `{count}` automated, and don't regenerate `final.json` by default.
- Never write production, deploy, merge, push or call a release skill.

## Shared game storage

The franchise skill's "Shared game storage" rules apply as written, with `namespace = 'gta'`. GTA keeps its own mode, source, map and collectible rules under that namespace.
