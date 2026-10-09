---
name: bloxodes-franchise-wiki-research
description: Research one approved non-Roblox franchise game wiki hub before writing. Use for title identity, scope, source proof, core loop, controls, related pages, and risks; write brief.md only.
---

# Bloxodes franchise wiki research

You research one approved non-Roblox title hub and write `brief.md`. Done means identity, scope, the core loop, controls and related pages are proven well enough for a writer to build the hub without guessing.

You only write `brief.md`. Don't write `final.json` or change application or database code.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## Context

Use the same resolved context as the suggestions step:

- franchise name and namespace
- game slug and exact hub route
- game identity table, wiki table/view and overlap-check environments
- authoring workspace root, for example `tmp/content-workspace/<namespace>`
- official-source hierarchy
- mode, expansion, online-service, edition and platform boundaries
- verifier or preview command, when the parent workflow supplies one

Never substitute a Roblox universe ID, root-place ID, Roblox API, root `/wiki` route or another franchise's tables. If a context value is missing, record the gap and stop. Don't invent it.

## Output

```text
<workspace-root>/<game-slug>/wiki/<game-slug>/brief.md
```

The workspace is an authoring area. `final.json` isn't written in this skill.

## Research steps

1. Before changing the workspace, read the repository root and closest `AGENTS.md`, `DESIGN.md`, the owning wiki/collection pipeline docs and the target franchise verifier.
2. Resolve the exact title, editorial slug, title kind, parent title when relevant, developer, publisher, official URL, release status, release dates and supported platforms.
3. Check the configured game and wiki tables and the exact managed-development and production route for an existing or conflicting hub.
4. Define what the hub covers: a main campaign, an online service, an expansion, several modes with clear sections, or an announced title with only verified pre-release facts.
5. Research the normal player loop, progression, the player's role or protagonists, major systems, and the questions a new or returning player needs answered.
6. Verify controls from official manuals, support, in-game documentation, or several reliable platform-specific sources. If exact bindings aren't verified, use an empty controls array. Never infer controls from a different title, platform, edition or mode.
7. List only related Bloxodes pages that already exist or are explicitly approved. Public copy never promises future collections or features.
8. Record every version-sensitive claim and any fact that belongs to only one mode, expansion, platform, edition or release generation.

## Source rules

- Prefer the official-source groups the franchise context declares for identity, release, platform, mode and feature claims.
- Use dedicated game/franchise wikis and databases for durable gameplay detail, then cross-check disputed facts.
- Treat live-service values, rotating content, rumors, leaks, trailer inference and community estimates as version-sensitive or unverified, unless the context's source policy supports them.
- For an unreleased title, use only facts the publisher/developer has announced. Never turn speculation into fact.
- List useful sources and rejected or limited ones. Explain the rejection when a source mixes titles, modes, editions, platforms or release generations.

## Write the brief for the writer

The writer builds the hub from your brief, so hand them material that already sounds like the game, not like a research log. Read `bloxodes-voice` (`.agents/skills/bloxodes-voice/SKILL.md`) once so you know the target.

- **Facts in player language.** "You start broke in a beach town and work your way up through car jobs" beats "the progression loop is structured around early-game economic constraints."
- **The reader's real question.** A new player wants to know what you actually do and what to do first. A returning player wants what changed. Say which one this hub serves.
- **Hooks worth using.** Note one or two sharp, true things the opening could lead with, like a system that surprises people or a mistake almost everyone makes early.
- **Tips that are real tips.** Each one should be specific enough to change what a player does.
- **Go past the official page.** Use reputable guide sources for concrete names, prices and unlocks. Leave a fact out only when it's wrong, conflicting or unsupported.
- **Private notes stay private.** Source names, disagreements and confidence go in "Evidence checked", "Facts to avoid" and "Open gaps or risks". The writer uses them to check claims, never to narrate them.
- **Say uncertainty once, plainly.** If something matters but is shaky, give the best answer and one short reason it might be off. If it doesn't matter, list it under "Facts to avoid".

## Brief shape

Keep these labels exactly. Other skills read them.

```text
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
- Reader's main question:
- Hooks worth using:
- Core loop:
- Progression and main systems:
- Tips to include:
- Controls to include or omit:
- Facts to use:
- Facts to avoid:
- Related links:
- Open gaps or risks:
```

Stop when identity, scope, controls or source proof is too weak. Name the exact missing evidence instead of writing around it.
