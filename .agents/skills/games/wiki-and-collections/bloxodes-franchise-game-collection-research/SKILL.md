---
name: bloxodes-franchise-game-collection-research
description: Research one approved non-Roblox franchise collection before data or writing. Use for scope, complete roster proof, fields, sections, images, page type, and risks; write brief.md only.
---

# Bloxodes franchise game collection research

You research one approved collection for one non-Roblox game title and write `brief.md`. Done means the roster, scope, fields, sections, images and page type are proven well enough for the data step to start, and the writer has plain material to work from.

You only write `brief.md`. Don't write `dataset.json` or `final.json`, and don't change application or database code.

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

Use the same resolved franchise context as the suggestions step:

- franchise name and namespace
- exact game slug and collection slug
- hub and collection route patterns
- game, wiki and collection tables/views
- authoring workspace root
- official-source hierarchy
- mode, expansion, online-service, edition, platform and release-generation boundaries
- data checker, image checker, runtime sync and final verifier commands

Never substitute a Roblox universe ID, Roblox API, root `/wiki` route, another franchise's tables or an unapproved mode. If a required context value is unresolved, record the blocker and stop.

## Output

```text
<workspace-root>/<game-slug>/collections/<collection-slug>/brief.md
```

## Research steps

1. Read the repository root and closest `AGENTS.md` files, `DESIGN.md`, the owning wiki/collections pipeline docs, and the approved roadmap or request.
2. Resolve the exact title, editorial game slug, title kind, parent title, collection slug, official URL, release state and requested mode/content boundary.
3. Check managed development and production for an existing collection row and any exact route conflict.
4. Learn how the collection works in the game before you decide fields or sections.
5. Build the complete roster from one strong source. Cross-check it with at least one independent source. For large or disputed collections, add a third source or primary in-game evidence.
6. Track differences by mode, expansion, edition, platform, release generation, title update and live-service state. Never combine them silently.
7. Pick the fields players need to compare, unlock, find or finish entries. Choose fields for this collection; don't copy another title's field set.
8. Plan stable sections that help players. If a clearer game-native grouping exists, use it instead of mirroring a source table.
9. Plan one exact image per item when images help identification. Record the source, access/licensing caveats and expected gaps.
10. Check search intent and strong competitor coverage to confirm the collection answers real player questions. Don't copy competitor wording.
11. Classify the page as `database` or `collectible`. Use `collectible` for finite player-completed goals and `database` for reference rosters. This is a renderer choice on the existing collection row, not a new table or route family.

## Source rules

- Prefer the official source groups declared by the franchise context for identity, platform, edition, unlock and mechanic claims.
- Use dedicated game/franchise wikis and databases for complete rosters and location details, then resolve conflicts.
- Search snippets are leads, not final evidence.
- A missing official row-level database isn't a blocker when several reliable references support the data.
- Record soft facts separately. Don't turn community estimates, handling opinions, inferred rankings or uncertain values into hard stats.
- Keep separate modes and release boundaries out of one roster unless the brief explicitly defines the distinction.

## Write the brief for the writer

The writer turns your brief into public copy, so give them good raw material. Read `bloxodes-voice` (`.agents/skills/bloxodes-voice/SKILL.md`) once so you know what the page needs to sound like.

- **Facts in player language.** "Unlocks after the second heist" beats "gated behind mission progression state." No research jargon in anything the writer will reuse.
- **The reader's real question.** Name what a player searching for this collection wants to know: which one is fastest, where each one is, what's missable.
- **Hooks worth using.** Note one or two sharp, true observations the intro could open on, like a cheap item that outperforms pricier ones or a collectible most players miss.
- **Private notes stay private.** Put source names, disagreements, confidence and soft facts in the evidence and rejected-source sections, clearly marked. The writer uses them to check claims, never to narrate them.
- **Say uncertainty once, plainly.** If a value is shaky, write the best number and one short reason it might be off, or mark it as one to leave out.

## Brief shape

Keep these labels exactly. Other skills read them.

```text
Evidence checked:
- Existing Bloxodes coverage:
- Exact route and database overlap:
- Official primary sources:
- Support/manual/news sources:
- Primary roster source:
- Independent roster cross-check:
- Additional field sources:
- Competitor/search-intent sources:
- Image source candidates:

Collection decision:
- Franchise:
- Namespace:
- Game slug:
- Collection slug:
- Title kind and parent title:
- Campaign / online / expansion / mode scope:
- Edition/platform/release-generation scope:
- Why this belongs in the collection renderer:
- Proceed / block:

Sources to use:
- URL, fields supported, mode/edition scope:

Sources rejected or limited:
- URL, reason:

Data plan:
- Expected roster and count:
- Inclusion rules:
- Exclusion rules:
- Useful public fields:
- Soft or disputed fields:
- Grouping:
- Stable sort:
- Known gaps or conflicts:

Page layout plan:
- Page type: database or collectible:
- Section field:
- Section order and labels:
- Card title field:
- Card description field:
- Card and table fields:
- Field presentation kinds:
- Hidden/source-only fields:
- Image need and image field:
- Section note needs:
- Pagination expectation:
- Renderer changes needed, yes/no:
- Collectible route/progress rationale: required only for collectible

Writer notes:
- Reader's main question:
- Hooks worth using:
- Plain facts for the intro and FAQs:

Research approval:
- Roster source-backed, yes/no:
- Fields source-backed, yes/no:
- Images feasible, yes/no:
- Ready for data, yes/no:
- Remaining risks:
```

Stop when the roster, scope or important fields can't be verified. Don't shrink the scope just to make incomplete research look finished, unless the parent approves that narrower collection.
