---
name: bloxodes-gta-game-collection-refresh
description: Maintain an existing Bloxodes GTA collection by checking verified roster, field, edition, and image changes, then updating only confirmed deltas. Use for existing /gta/wiki collections, not discovery or new pages. Stop unchanged when no real delta exists and never publish production.
---

# Bloxodes GTA game collection refresh compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-refresh/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Existing collection table: gta_wiki_collection_pages
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Pipeline docs: dev-docs/pipelines/wiki-collections.md
- Supporting skills: the GTA data and GTA image compatibility entrypoints
- Scope: existing collections with a published dataset pointer only; never discover, suggest, or create
- Boundaries: never change Story Mode, Online, edition, or platform scope during refresh
- Runtime: GTA pageType, immutable GTA dataset revisions, GTA progress adapter, and managed-development verifier

Preserve the prior quick-check outcomes Unchanged, Data update, Page-type update, Image update, Copy follow-up, and Blocked. Stop unchanged without edits, use source-backed deltas only, keep {count} automated, do not regenerate final.json by default, and never write production, deploy, merge, push, or call a release skill.
