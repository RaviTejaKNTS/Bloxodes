---
name: bloxodes-gta-game-collection-writing
description: Write final.json for one Bloxodes GTA collection after approved research, data, and images. Use for metadata, collection explanations, FAQs, wiki hub copy, and GTA page identity. Do not change dataset facts or publish production.
---

# Bloxodes GTA game collection writing compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-writing/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/final.json
- Route: /gta/wiki/<game-slug>/<collection-slug>
- Identity fields: wiki_slug is the editorial GTA game slug; collection_slug is the approved collection slug; code is <game-slug>-<collection-slug>
- Page type: database supports browsing and comparison; collectible supports route planning and completion; pageType remains in runtime-manifest.json
- Scope: Story Mode, GTA Online, edition, platform, and release-generation claims stay separate
- Title token: All {count} <Collection> in <Game>, adding Story Mode when needed; never state counts in prose
- Publisher and voice: explain the GTA system plainly, with light factual humor and no Rockstar press-release tone

Preserve the prior field contract, including display_name, intro_md, description_md, how_it_works_md, description_json, faq_json with q/a keys, wiki_md, wiki_sort_order, and is_published. Do not change dataset facts, include universe_id, mention sources, workflow, or site mechanics in public copy, or publish production.
