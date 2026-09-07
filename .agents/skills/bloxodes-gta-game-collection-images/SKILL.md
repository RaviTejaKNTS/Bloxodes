---
name: bloxodes-gta-game-collection-images
description: Gather, save, map, and verify exact item images for one approved Bloxodes GTA collection after data approval. Use for image source checks, media files, images.json, dataset wiring, coverage notes, and image readiness. Do not write final.json or publish production.
---

# Bloxodes GTA game collection images compatibility entrypoint

Read and follow .agents/skills/bloxodes-franchise-game-collection-images/SKILL.md completely with this GTA context:

- Franchise and namespace: Grand Theft Auto / gta
- Workspace: tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
- Media prefix: gta/<game-slug>/<collection-slug>/
- Preferred sources: official Rockstar media, manuals, guides, stable GTA Wiki or database images, and exact traceable in-game captures
- Route scope: keep Story Mode, GTA Online, edition, platform, model, and location images separate
- Image helper: npm run collect:collection-images
- Image checker: npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json --require-images

Preserve the old exact-match image rules, nonzero target, source/caveat record, media wiring, collectible location/route image preference, visual spot checks, and parent-approved gaps. Do not write final.json, use logos, screenshots, generic art, fan art, or AI substitutes, or publish production.
