---
name: bloxodes-game-collection-data
description: Prepare source-backed data for one approved Bloxodes game collection in an ignored content workspace after brief approval. Use for dataset rows, item counts, useful card fields, section grouping, missing item checks, image field planning, and route assumptions before the image pass and collection writing. Do not write final.json.
---

# Bloxodes Game Collection Data

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Write and edit all files directly using the Write and Edit tools.**

Use this after `brief.md` is approved. Prepare one game collection under `tmp/content-workspace/<game-slug>/collections/<collection-slug>/`. Repository collection datasets are retired; the parent verifier publishes the workspace as an immutable database revision before preview. Do not gather images here; plan the image field and leave image collection for `bloxodes-game-collection-images`.

## Work

1. Read the approved `brief.md`.
2. Inspect or create `dataset.json` beside `brief.md` in the collection workspace. For an existing collection, first export its current database revision with `npm run export:game-collection-workspace -- --game <game-slug> --collection <collection-slug> --output-root tmp/content-workspace/<game-slug>/collections`.
3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Do not add raw source clutter.
5. Use the v2 wrapped dataset shape `{ "meta": {...}, "items": [{ "item": {...}, "system": {...} }] }`. Do not create bare array datasets.
6. Keep public game data and Bloxodes system data separate. Put player-facing facts only inside `items[].item`. Put only `slug`, `section`, `sortOrder`, and `image` inside `items[].system`.
7. Never put system/dev/source keys inside `items[].item`: no `collectionSection`, `sortOrder`, `image`, `slug`, `sourcePage`, `sourceUrl`, `sourceImageUrl`, `verificationNote`, `imageStatus`, `rawText`, `fields`, or similar workflow/debug fields.
8. When a real multi-section grouping exists, store the rendered section label in `items[].system.section`, store the numeric order in `items[].system.sortOrder`, and list all section labels in `meta.display.sectionOrder`.
9. If no real multi-section field exists, set every `items[].system.section` to `Items` and set `meta.display.sectionOrder` to `["Items"]`. Do not invent fake sections.
10. Add `meta.schemaVersion: 2`, `meta.itemFields`, `meta.columns`, and `meta.display` so the generic renderer has an explicit display contract and does not infer dev fields.
11. In `meta.display`, set `groupLabel`, `sectionOrder`, `tableFields`, `cardFields`, `badgeField`, `subtitleFields`, `descriptionField`, `cardDescriptionField`, and `fieldPresentation` where useful. Every display field must exist in `meta.itemFields` and `items[].item`.
12. Add short `cardSummary` text when cards need a plain-English explanation beyond raw fields.
13. When adding descriptions, always use your own words. Do not directly copy from the sources. Make sure the description is accurate and matches the source information.
14. Do not rewrite sourced stats or facts just to sound nicer. Keep factual values accurate.
15. Decide whether the collection should have images. Images belong in `items[].system.image`, not in a public item field.
16. Confirm `apps/web/src/lib/game-collections/index.ts` can render the collection, card fields, grouping, item count, and planned image field.
17. Confirm section labels are stable and useful enough for the shared renderer's section dropdown. Do not split, rename, or reorder sections only for page-size reasons; pagination is handled by the renderer.
18. If the collection is missing from `apps/web/src/lib/game-collections/index.ts`, run:

```bash
npm run register:game-collection -- --game <game-slug> --collection <collection-slug> --dry-run
```

If the dry run looks right and the game group already exists, run it again without `--dry-run`.

19. Audit and check the dataset:

```bash
npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
```

Every collection workspace must also contain `runtime-manifest.json`; never move the dataset into `data/`. Do not use `--require-images` here; the image skill owns that check.

20. Update `brief.md` with data status and gaps from the checker.

## Catalog Presentation Contract

The shared game collection renderer now treats cards as the primary view and list/table as the complete scanning view. Prepare dataset rows so both views can show the same useful information cleanly.

- Every item should have a clear `items[].item.name`, one useful description field such as `cardSummary`, `description`, or `summary`, and the same public comparison fields across rows. If a value is not source-backed for one item, leave it empty/null so the renderer can show `-`; do not remove the field from that row.
- Dataset system metadata owns rendered grouping and ordering. Use `items[].system.section`, `items[].system.sortOrder`, and `meta.display.sectionOrder`. Do not create public `collectionSection`, `section`, or `sortOrder` item fields.
- Include all important player-facing details in dataset fields. Do not hide useful details only because cards are compact; the renderer decides how to present long values.
- Keep labels out of values. Use `"type": "Standard boost"`, not `"type": "Type: Standard boost"`.
- Define the field presentation contract by collection, not by value text. For every card/table field, decide the `kind`: `plain`, `chip`, `highlight`, or `detail`.
- Use `plain` for normal comparable text such as source, shop, main use, role, or route names.
- Use `chip` for prices, rarity, tier, levels, duration, cooldown, chance, cost, BPS, damage, or other important short numbers. If one key is a chip on one card, that same key must be a chip on every card.
- Use `highlight` for source-backed status, availability, strength, best-use, or recommendation fields. Do not invent a highlight just to satisfy layout.
- Use `detail` for complete sentence values such as obtainment notes, behavior, weakness, effect notes, route notes, or strategy notes. Keep these concise enough to scan in cards and complete in table view.
- Do not depend on renderer word guessing. A value containing words like Robux, rare, available, cost, event, or source must not be expected to change styling by itself.
- Avoid semicolon pseudo-lists in prose. If the value is one sentence, write it as one sentence. Use arrays only when the source really provides separate list items.
- If the collection has some item images but not all, still wire the available images. The renderer will keep card shape consistent with placeholders for missing images.
- When the collection is registered, add the machine-readable `fieldPresentation` map under `meta.display.fieldPresentation`, for example:

```json
{
  "display": {
    "fieldPresentation": {
    "availability": { "kind": "highlight", "label": "Status" },
    "source": "normal",
    "price": "chip",
    "obtainment": "detail"
    }
  }
}
```

Use `normal` in config for plain fields; describe it as `plain` in notes if that is clearer for humans.

## Data Approval Notes

Add this section to `brief.md`:

```text
Data readiness:
- Dataset file:
- Item count:
- Source item count:
- Dataset shape: v2 wrapped `{ meta, items[].item, items[].system }` yes/no
- Public item fields:
- System fields: `slug`, `section`, `sortOrder`, `image` only yes/no
- Metadata: `schemaVersion`, `itemFields`, `columns`, `display.groupLabel`, `display.sectionOrder`, `display.tableFields`, `display.cardFields`, `display.fieldPresentation`
- Section source:
- Section counts:
- Section order:
- Card fields:
- Card/table field order:
- Card summary coverage:
- Field presentation:
- Highlight fields:
- Chip fields:
- Detail fields:
- Field consistency:
- Image needed: yes/no
- Image field: `items[].system.image`
- Hidden/source/dev fields absent from public item data: yes/no
- Sort order: `items[].system.sortOrder`
- description_json section keys:
- Renderer/config support:
- Missing items:
- Audit command:
- Audit result:
- Checker command:
- Checker result:
- Ready for images: yes/no
```

If data is not ready, stop and say exactly what is blocked. If data is ready, hand off to the image step before writing.
