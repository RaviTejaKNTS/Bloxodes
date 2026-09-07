---
name: bloxodes-gta-wiki-workflow-runner
description: Run one approved Bloxodes GTA wiki hub through research, parent review, writing, managed-development verification, and browser review. Use for new or updated GTA wiki hubs. Never publish production.
---

# Bloxodes GTA wiki workflow runner compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-wiki-workflow-runner/SKILL.md completely with this fixed context:

- Franchise and namespace: Grand Theft Auto / gta
- Allowlist and workspace: one GTA title at a time under tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/
- Route: /gta/wiki/<game-slug>
- Tables/views: gta_games, gta_wiki_pages, and their GTA views
- Official-source policy: Rockstar first, then dedicated GTA wikis and databases, established guides, and limited community evidence
- Mode boundary: Story Mode and GTA Online remain separate; announced titles use confirmed facts only
- Managed development: npm run dev:managed
- Final verifier: npm run verify:gta-wiki-final -- --base-url http://localhost:<port> --game <game-slug> --workspace tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>
- Browser checks: GTA-only sidebar and search scope, normal Bloxodes layout, collection CTA, metadata, canonical, structured data, desktop and mobile overflow and images
- Published hub media check: confirm both game.json image roles are present, source-backed, distinct, and served from Bloxodes-hosted wiki media; confirm cover artwork is used for cards/social metadata and hero artwork is used for the square title thumbnail. GTA VI is intentionally unpublished until the game is released.

Preserve the prior parent gates, one-worker-per-hub rule, research approval before writing, and stop-before-production boundary. Never use Roblox tables, APIs, or /wiki routes. Application or schema changes are outside this compatibility wrapper unless a separate request explicitly authorizes them.
