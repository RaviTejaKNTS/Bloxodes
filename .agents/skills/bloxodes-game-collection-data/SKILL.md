---
name: bloxodes-game-collection-data
description: Prepare source-backed data for one approved Bloxodes game collection after brief approval. Use for local dataset rows, item counts, useful card fields, section grouping, missing item checks, image field planning, and route assumptions before the image pass and collection writing. Do not write final.json.
---

# Bloxodes Game Collection Data

Use this after `brief.md` is approved. Prepare the local data for one game collection. Do not gather images here; plan the image field and leave image collection for `bloxodes-game-collection-images`.

## Work

1. Read the approved `brief.md`.
2. Inspect or create the local dataset under `data/<Game>/`.
3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Do not add raw source clutter.
5. Add a real section field, usually `collectionSection` unless another field is better. Every item should land in the right section.
6. Add short `cardSummary` text when cards need a plain-English explanation beyond raw fields.
7. When adding descriptions, always use your own words. Do not directly copy from the sources. Make sure the description is accurate and matches the source information.
8. Do not rewrite sourced stats or facts just to sound nicer. Keep factual values accurate.
9. Decide whether the collection should have images and which dataset field will hold image paths.
10. Confirm `apps/web/src/lib/game-collections/index.ts` can render the collection, card fields, grouping, item count, and planned image field.
11. Confirm section labels are stable and useful enough for the shared renderer's section dropdown. Do not split, rename, or reorder sections only for page-size reasons; pagination is handled by the renderer.
12. If the collection is missing from `apps/web/src/lib/game-collections/index.ts`, run:

```bash
npm run register:game-collection -- --game <game-slug> --collection <collection-slug> --dry-run
```

If the dry run looks right and the game group already exists, run it again without `--dry-run`.

13. Run the dataset readiness check:

```bash
npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug>
```

Use `--file <dataset.json>` if the collection is not registered yet. Do not use `--require-images` here; the image skill owns that check.

14. Update `brief.md` with data status and gaps from the checker.

## Catalog Presentation Contract

The shared game collection renderer now treats cards as the primary view and list/table as the complete scanning view. Prepare dataset rows so both views can show the same useful information cleanly.

- Every item should have a clear name, one useful description field such as `cardSummary`, `description`, or `summary`, and the same public comparison fields across rows. If a value is not source-backed for one item, leave it empty/null so the renderer can show `-`; do not remove the field from that row.
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
- When the collection is registered, add the machine-readable `fieldPresentation` map to the renderer config or dataset meta, for example:

```json
{
  "fieldPresentation": {
    "availability": { "kind": "highlight", "label": "Status" },
    "source": "normal",
    "price": "chip",
    "obtainment": "detail"
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
- Section field:
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
- Image field:
- Hidden/source fields:
- Sort order:
- description_json section keys:
- Renderer/config support:
- Missing items:
- Checker command:
- Checker result:
- Ready for images: yes/no
```

If data is not ready, stop and say exactly what is blocked. If data is ready, hand off to the image step before writing.
