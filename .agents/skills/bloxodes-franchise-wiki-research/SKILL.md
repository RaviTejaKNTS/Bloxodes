---
name: bloxodes-franchise-wiki-research
description: Research one approved non-Roblox franchise game wiki hub before writing. Use for title identity, scope, source proof, core loop, controls, related pages, and risks; write brief.md only.
---

# Bloxodes franchise wiki research

Research one approved non-Roblox title hub. Do not write final.json or change application/database code.

## Context contract

Use the same resolved context as the suggestions step:

- franchise name and namespace
- game slug and exact hub route
- game identity table, wiki table/view, and overlap-check environments
- authoring workspace root, for example tmp/content-workspace/<namespace>
- official-source hierarchy
- mode, expansion, online-service, edition, and platform boundaries
- verifier or preview command, when the parent workflow supplies one

Never substitute a Roblox universe ID, root-place ID, Roblox API, root /wiki route, or another franchise's tables. If a context value is missing, record the gap and stop rather than inventing it.

## Output

Write:

~~~text
<workspace-root>/<game-slug>/wiki/<game-slug>/brief.md
~~~

The workspace is an authoring area. Do not write final.json in this skill.

## Required checks

1. Read the repository root and closest AGENTS.md, DESIGN.md, the owning wiki/collection pipeline documentation, and the target franchise verifier before changing the workspace.
2. Resolve the exact title, editorial slug, title kind, parent title when relevant, developer, publisher, official URL, release status, release dates, and supported platforms.
3. Check the configured game and wiki tables and the exact managed-development and production route for an existing or conflicting hub.
4. Define whether the hub covers a main campaign, an online service, an expansion, multiple modes with clear sections, or an announced title with only verified pre-release facts.
5. Research the normal player loop, progression, player role or protagonists, major systems, and questions a new or returning player needs answered.
6. Verify controls from official manuals, support, in-game documentation, or multiple reliable platform-specific sources. Use an empty controls array when exact bindings are not verified. Never infer controls from a different title, platform, edition, or mode.
7. Inventory only related Bloxodes pages that already exist or are explicitly approved. Do not promise future collections or features in public copy.
8. Record every version-sensitive claim and any fact that belongs only to one mode, expansion, platform, edition, or release generation.

## Source rules

- Prefer the official-source groups declared by the franchise context for identity, release, platform, mode, and feature claims.
- Use dedicated game/franchise wikis and databases for durable gameplay detail, then cross-check disputed facts.
- Treat live-service values, rotating content, rumors, leaks, trailer inference, and community estimates as version-sensitive or unverified unless the context's source policy supports them.
- For an unreleased title, use only facts the publisher/developer has announced. Do not turn speculation into fact.
- List useful and rejected or limited sources. Explain rejection when a source mixes titles, modes, editions, platforms, or release generations.

## Brief shape

~~~text
Evidence checked:
- Game identity:
- Existing Bloxodes coverage:
- Official primary sources:
- Support/manual/news sources:
- Dedicated wiki/database sources:
- Guide sources:
- Controls proof:
- Related approved pages:

Scope:
- Franchise:
- Namespace:
- Game slug:
- Title kind and parent title:
- Release status:
- Campaign / online / expansion boundary:
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
~~~

Stop when identity, scope, controls, or source proof is too weak. State the exact missing evidence instead of writing around it.
