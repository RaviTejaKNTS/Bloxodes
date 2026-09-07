---
name: bloxodes-franchise-game-collection-research
description: Research one approved non-Roblox franchise collection before data or writing. Use for scope, complete roster proof, fields, sections, images, page type, and risks; write brief.md only.
---

# Bloxodes franchise game collection research

Research one approved collection for one non-Roblox game title. Do not write dataset.json or final.json and do not change application or database code.

## Context contract

Use the same resolved franchise context as the suggestions step:

- franchise name and namespace
- exact game slug and collection slug
- hub and collection route patterns
- game, wiki, and collection tables/views
- authoring workspace root
- official-source hierarchy
- mode, expansion, online-service, edition, platform, and release-generation boundaries
- data checker, image checker, runtime sync, and final verifier commands

Never substitute a Roblox universe ID, Roblox API, root /wiki route, another franchise's tables, or an unapproved mode. If a required context value is unresolved, record the blocker and stop.

## Output

Write:

~~~text
<workspace-root>/<game-slug>/collections/<collection-slug>/brief.md
~~~

## Required research

1. Read the repository root and closest AGENTS.md files, DESIGN.md, the owning wiki/collections pipeline documentation, and the approved roadmap or request.
2. Resolve the exact title, editorial game slug, title kind, parent title, collection slug, official URL, release state, and requested mode/content boundary.
3. Check managed development and production for an existing collection row and exact route conflict.
4. Research how the collection works in the game before deciding fields or sections.
5. Establish the complete roster from one strong source. Cross-check it with at least one independent source. For large or disputed collections, use a third source or primary in-game evidence.
6. Track differences by mode, expansion, edition, platform, release generation, title update, and live-service state. Never silently combine them.
7. Identify fields players need to compare, unlock, find, or finish entries. Choose collection-specific fields instead of copying a field set from another title.
8. Plan stable sections that help players. Do not mirror a source table when a clearer game-native grouping exists.
9. Plan one exact image per item when images help identification. Record source, access/licensing caveats, and expected gaps.
10. Check search intent and strong competitor coverage to confirm the collection answers real player questions. Do not copy competitor wording.
11. Classify the page as database or collectible. Use collectible for finite player-completed goals; use database for reference rosters. This is a renderer choice on the existing collection row, not a new table or route family.

## Source rules

- Prefer the official source groups declared by the franchise context for identity, platform, edition, unlock, and mechanic claims.
- Use dedicated game/franchise wikis and databases for complete rosters and location details, then resolve conflicts.
- Search snippets are leads, not final evidence.
- A missing official row-level database is not a blocker when multiple reliable references support the data.
- Record soft facts separately. Do not turn community estimates, handling opinions, inferred rankings, or uncertain values into hard statistics.
- Keep separate modes and release boundaries out of one roster unless the brief explicitly defines the distinction.

## Brief shape

~~~text
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

Research approval:
- Roster source-backed, yes/no:
- Fields source-backed, yes/no:
- Images feasible, yes/no:
- Ready for data, yes/no:
- Remaining risks:
~~~

Stop when the roster, scope, or important fields cannot be verified. Do not reduce scope just to make incomplete research look finished unless the parent approves that narrower collection.
