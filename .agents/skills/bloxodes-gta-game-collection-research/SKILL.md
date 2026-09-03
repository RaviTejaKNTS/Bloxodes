---
name: bloxodes-gta-game-collection-research
description: Research one approved Bloxodes GTA collection before data or writing. Use for GTA collection route overlap, scope, complete roster evidence, player-useful fields, sections, image sources, edition differences, and risks. Write brief.md only.
---

# Bloxodes GTA game collection research

Research one approved collection for one GTA game. Do not write `dataset.json` or `final.json`.

## Output

Write:

```text
tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/brief.md
```

## Required research

1. Read the root and closest `AGENTS.md` files, `dev-docs/pipelines/wiki-collections.md`, and the approved roadmap or request.
2. Resolve the exact game, editorial game slug, collection slug, official Rockstar URL, release state, and requested Story Mode or Online boundary.
3. Check managed development and production for an existing `gta_wiki_collection_pages` row and exact route conflict.
4. Research how the collection works in the game before deciding fields or sections.
5. Establish the complete roster from one strong source. Cross-check it with at least one independent source. For large or disputed collections, use a third source or primary game evidence.
6. Track differences by game mode, edition, platform, title update, and release generation. Never silently combine them.
7. Identify the fields players need to compare, unlock, find, or finish the entries. Pick collection-specific fields instead of copying Weapons fields.
8. Plan stable sections that help players. Do not mirror a source table when a clearer game-native grouping exists.
9. Plan one exact image per item when images help identification. Record source, licensing or access caveats, and expected gaps.
10. Check search intent and strong competitor coverage to make sure the collection answers the questions players actually ask. Do not copy competitor wording.
11. Classify the page as `database` or `checklist`. Use `checklist` for finite Story Mode or Online goals players complete, especially location-heavy collectibles. Use `database` for reference rosters players browse and compare. This is a renderer choice on the existing collection row, not a new GTA table.

## Source rules

- Prefer Rockstar sources for official identity, platform, edition, unlock, and mechanic claims.
- Use dedicated GTA wikis and databases for complete rosters and location details, then resolve conflicts.
- Search snippets are leads, not final evidence.
- A missing official row-level database is not a blocker when multiple reliable references support the data.
- Record soft facts separately. Do not turn community estimates, handling opinions, or inferred rankings into hard statistics.
- Do not use GTA Online values for Story Mode or vice versa.

## Brief shape

```text
Evidence checked:
- Existing Bloxodes GTA coverage:
- Exact route and database overlap:
- Official Rockstar sources:
- Primary roster source:
- Independent roster cross-check:
- Additional field sources:
- Competitor/search-intent sources:
- Image source candidates:

Collection decision:
- Game slug:
- Collection slug:
- Story Mode / Online scope:
- Edition/platform scope:
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
- Page type: `database` or `checklist`:
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
- Checklist route/progress rationale: (required only for `checklist`)

Research approval:
- Roster source-backed, yes/no:
- Fields source-backed, yes/no:
- Images feasible, yes/no:
- Ready for data, yes/no:
- Remaining risks:
```

Stop when the roster, scope, or important fields cannot be verified. State the exact blocker. Do not reduce scope just to make incomplete research look finished unless the parent approves that narrower collection.
