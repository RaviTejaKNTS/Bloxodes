---
name: bloxodes-game-collection-data
description: Prepare source-backed data for one approved Bloxodes game collection in an ignored content workspace after brief approval. Use for dataset rows, item counts, useful card fields, section grouping, missing item checks, image field planning, and route assumptions before the image pass and collection writing. Do not write final.json.
---

# Bloxodes Game Collection Data

You're building the dataset for one approved game collection: the rows, fields and sections players will compare on the page. You're done when `dataset.json` passes the audit and checker, `runtime-manifest.json` declares the page type, and `brief.md` has a filled-in `Data readiness` section.

> **You are a subagent. Do NOT spawn sub-agents or call other agents. Write and edit all files directly using the Write and Edit tools.**

Use the game and collection names to find their suggestions and workspace in the inherited task context, or use the default workspace below. Keep any supplied workspace override. This skill owns its stage. Return the stage artifacts when you're done.

## Useful coverage

Build the most accurate, up-to-date collection the sources support. Combine rows across sources and merge duplicates. When sources disagree on a value, use the better-supported one or a range, as the data skill's "Conflicting sources" rule says. Leave a value empty or null only when no reliable source gives one. Record missing rows, conflicting claims and follow-ups in the brief so the collection can improve later.

A source saying 97 items while listing 98, an incomplete roster, no official confirmation or uncertain update coverage aren't reasons to block on their own. Don't invent facts or claim complete live coverage. Block only when there truly isn't enough supported material for a worthwhile player-facing page.

## Where things live

- Work after `brief.md` is approved, in `tmp/content-workspace/<game-slug>/collections/<collection-slug>/`.
- Repository collection datasets are retired. The parent verifier publishes the workspace as an immutable database revision before preview.
- Every collection workspace must contain `runtime-manifest.json`. Never move the dataset into `data/`.
- Don't gather images here. Plan the image field and leave collection to `bloxodes-game-collection-images`.

## Steps

1. Read the approved `brief.md`.
2. Inspect or create `dataset.json` next to `brief.md`. For an existing collection, first export its current database revision:

   ```bash
   npm run export:game-collection-workspace -- --game <game-slug> --collection <collection-slug> --output-root tmp/content-workspace/<game-slug>/collections
   ```

3. Check that item rows match the source-backed scope.
4. Add useful fields players can compare. Leave raw source clutter out.
5. Build the dataset in the v2 shape (see "Dataset shape" below).
6. Add short `cardSummary` text when cards need a plain-English explanation beyond the raw fields.
7. Write descriptions in your own words. Never copy from sources. Make sure each one is accurate and matches the source information.
8. Keep sourced stats and facts exact. Don't reword them just to sound nicer.
9. Decide whether the collection should have images. Images go in `items[].system.image`, never in a public item field.
10. Confirm `apps/web/src/lib/game-collections/index.ts` can render the collection, card fields, grouping, item count and planned image field.
11. Confirm section labels are stable and useful enough for the shared renderer's section dropdown. Don't split, rename or reorder sections just for page size. The renderer handles pagination.
12. If the collection is missing from `apps/web/src/lib/game-collections/index.ts`, register it with a dry run first:

    ```bash
    npm run register:game-collection -- --game <game-slug> --collection <collection-slug> --dry-run
    ```

    If the dry run looks right and the game group already exists, run it again without `--dry-run`.

13. Audit and check the dataset:

    ```bash
    npm run audit:game-collection-datasets:v2 -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
    npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
    ```

    Don't use `--require-images` here. The image skill owns that check.

14. Carry the approved page type into `runtime-manifest.json` as `collection.pageType`:
    - `"collectible"` only for finite, player-completed goals.
    - `"database"` for reference rosters.

    The page type changes the renderer and progress behavior, not the dataset table or the v2 row shape. Existing manifests may omit it and default to `database`, but new or refreshed work should state it explicitly.

    The full manifest shape that `sync:game-collection-runtime` reads. Paths are relative to the collection workspace:

    ```json
    {
      "schemaVersion": 1,
      "game": { "slug": "<game-slug>", "name": "<Game Name>", "universeId": 1234567890 },
      "collection": { "slug": "<collection-slug>", "label": "<Display Label>", "sortOrder": 0, "pageType": "database" },
      "dataset": "dataset.json",
      "finalJson": "final.json",
      "mediaRoot": "media",
      "sourceUrls": ["https://..."]
    }
    ```

    `collection.slug` is the slug, never the label (`factories`, not `Factories`). `universeId` must be a positive integer, and `sourceUrls` needs at least one entry. Media paths in the dataset are relative to `mediaRoot`, so don't repeat a `media/` prefix in them.

15. Update `brief.md` with data status and the checker's gaps (see "Data Approval Notes").

## Dataset shape

Use the v2 wrapped shape. Never create a bare array dataset.

```json
{ "meta": {...}, "items": [{ "item": {...}, "system": {...} }] }
```

**Public vs system data**

- Player-facing facts go only in `items[].item`.
- `items[].system` holds only `slug`, `section`, `sortOrder` and `image`.
- Never put system, dev or source keys in `items[].item`: no `collectionSection`, `sortOrder`, `image`, `slug`, `sourcePage`, `sourceUrl`, `sourceImageUrl`, `verificationNote`, `imageStatus`, `rawText`, `fields` or similar workflow or debug fields.

**Sections**

- When a real multi-section grouping exists, put the rendered section label in `items[].system.section`, the numeric order in `items[].system.sortOrder`, and list every section label in `meta.display.sectionOrder`.
- If there's no real multi-section field, set every `items[].system.section` to `Items` and `meta.display.sectionOrder` to `["Items"]`. Don't invent fake sections.
- Never create public `collectionSection`, `section` or `sortOrder` item fields. System metadata owns grouping and ordering.

**Meta**

- Add `meta.schemaVersion: 2`, `meta.itemFields`, `meta.columns` and `meta.display`, so the generic renderer has an explicit display contract and doesn't infer dev fields.
- In `meta.display`, set `groupLabel`, `sectionOrder`, `tableFields`, `cardFields`, `badgeField`, `subtitleFields`, `descriptionField`, `cardDescriptionField` and `fieldPresentation` where useful.
- Every display field must exist in both `meta.itemFields` and `items[].item`.

## Conflicting sources

Sources often disagree on a price, drop rate, stat or location. Don't drop the value because of that. An empty card field helps nobody.

1. Check whether it's a real conflict. One source skipping a detail, a copied page or an older version isn't a contradiction.
2. Pick the better-supported value: the newer one after an update, the developer's or the game's own wording, or the one independent sources agree on.
3. If you can't pick one, use a range for numbers (`400 to 600 Coins`) or the value most independent sources give.
4. Record every competing value with its source and your choice in `brief.md`, so the collection can improve later.
5. Leave the field empty or null only when no reliable source gives a value at all.

## How public values should read

Item values are what players scan on cards and in the table, so they follow the "plain" slot in `.agents/skills/bloxodes-voice/SKILL.md`: short, exact and easy to compare. No jokes in a value someone needs one precise answer from.

- **Plain and exact.** "Hatches from the Golden Egg," not "This pet can be obtained by players through hatching the Golden Egg."
- **No research wording in public values.** Never write "reportedly," "unconfirmed," "according to the wiki," "community-documented" or similar in `description`, `cardSummary` or detail fields.
- **Uncertainty stays private.** Fill shaky values with the best-supported value or range (see "Conflicting sources" below) and note the doubt in `brief.md`. Never put a source or verification note in a public field.
- **Keep labels out of values.** Use `"type": "Standard boost"`, not `"type": "Type: Standard boost"`.
- **One sentence stays one sentence.** No semicolon pseudo-lists in prose. Use arrays only when the source really gives separate list items.

## Catalog presentation contract

The shared game collection renderer treats cards as the main view and the list/table as the complete scanning view. Prepare rows so both views show the same useful information cleanly.

**Every row**

- Give each item a clear `items[].item.name`, one useful description field (`cardSummary`, `description` or `summary`) and the same public comparison fields as the other rows.
- If a value isn't source-backed for one item, leave it empty or null so the renderer shows `-`. Don't remove the field from that row.
- Include every important player-facing detail in dataset fields. Don't drop useful details because cards are compact. The renderer decides how to show long values.

**Field presentation**

Set the presentation per collection, not per value. Give every card and table field one `kind`:

| Kind | Use it for |
| --- | --- |
| `plain` | Normal comparable text: source, shop, main use, role, route names. |
| `chip` | Prices, rarity, tier, levels, duration, cooldown, chance, cost, BPS, damage and other important short numbers. If a key is a chip on one card, it's a chip on every card. |
| `highlight` | Source-backed status, availability, strength, best use or recommendation. Don't invent a highlight just to fill the layout. |
| `detail` | Full-sentence values: obtainment notes, behavior, weakness, effect notes, route notes, strategy notes. Concise enough to scan on cards and complete in the table. |

- Don't rely on the renderer guessing from words. A value containing "Robux," "rare," "available," "cost," "event" or "source" won't change styling by itself.
- If some items have images and some don't, still wire the ones you have. The renderer keeps card shapes consistent with placeholders.
- When the collection is registered, add the machine-readable map under `meta.display.fieldPresentation`, for example:

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

Use `normal` in config for plain fields. Calling it `plain` in notes is fine if that's clearer for humans.

## Data Approval Notes

Add this section to `brief.md`:

```text
Data readiness:
- Dataset file:
- Page type and manifest declaration:
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

Fix invalid dataset structure before handoff. Missing source rows or values go in the brief. They don't stop you from handing a useful dataset to the image step.
