---
name: bloxodes-gta-wiki-research
description: Research one approved Bloxodes GTA wiki hub before writing. Use for exact game identity, release and platform facts, Story Mode or Online scope, core loop, verified controls, related GTA collections, source proof, and risks. Do not write final.json.
---

# Bloxodes GTA wiki research

Research one approved GTA game hub. Do not write `final.json`.

## Output

Write:

```text
tmp/content-workspace/gta/<game-slug>/wiki/<game-slug>/brief.md
```

## Required checks

1. Read the root and closest `AGENTS.md` files, `DESIGN.md`, `dev-docs/pipelines/wiki-collections.md`, and the existing GTA verifier before changing the workspace.
2. Resolve the exact title, slug, installment, developer, publisher, official URL, release status, release dates, and supported platforms.
3. Check `gta_games`, `gta_wiki_pages`, and the exact managed-development and production route for an existing or conflicting page.
4. Define whether the hub covers Story Mode, GTA Online, both with clear separation, or an announced game with only verified pre-release facts.
5. Research the normal player loop, progression, protagonists or player role, major systems, and the questions a new or returning player needs answered.
6. Verify controls from official manuals, Rockstar support, in-game documentation, or multiple reliable platform-specific sources. Use an empty controls array when exact bindings are not verified. Never infer controls from another GTA title or platform.
7. Inventory only related Bloxodes GTA pages that already exist or are approved. Do not promise future collection pages in public copy.
8. Record every version-sensitive claim. Original, Enhanced, Expanded & Enhanced, PC, and console releases may differ.

## Source rules

- Prefer Rockstar sources for identity, release, platform, and official feature claims.
- Use dedicated GTA wikis and databases for durable gameplay detail, then cross-check disputed facts.
- Treat GTA Online as a separate content scope. Never move Online inventories, ranks, prices, or weekly systems into Story Mode copy.
- For an unreleased game, use only facts Rockstar has announced. Do not turn trailers, leaks, rumors, or fan inference into fact.
- List useful and rejected sources. Explain why a source was rejected when it mixed games, modes, or editions.

## Brief shape

```text
Evidence checked:
- Game identity:
- Existing Bloxodes GTA coverage:
- Official Rockstar sources:
- Dedicated wiki/database sources:
- Guide sources:
- Controls proof:
- Related approved pages:

Scope:
- Game slug:
- Release status:
- Story Mode / Online boundary:
- Edition and platform boundary:

Wiki plan:
- Title:
- Core loop:
- Progression and main systems:
- Tips to include:
- Controls to include or omit:
- Facts to use:
- Facts to avoid:
- Related links:
- Open gaps or risks:
```

Stop when identity, scope, controls, or source proof is too weak. State the exact missing evidence instead of writing around it.
