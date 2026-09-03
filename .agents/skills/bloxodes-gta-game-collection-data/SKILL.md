---
name: bloxodes-gta-game-collection-data
description: Prepare or update one source-backed Bloxodes GTA collection dataset after brief approval. Use for complete v2 rows, comparison fields, sections, image planning, GTA runtime manifest creation, audits, and data-readiness notes. Do not gather images, write final.json, or publish production.
---

# Bloxodes GTA game collection data

Own one approved GTA collection. Do not spawn other workers. Use this after the parent approves `brief.md`.

## Workspace and reference

Work under:

```text
tmp/content-workspace/gta/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  runtime-manifest.json
```

Read `tmp/content-workspace/gta/gta-5/collections/weapons/` as the working format example. Its fields are not a template for unrelated collections.

Do not use `data/`, `apps/web/public/`, `GAME_COLLECTIONS`, `register:game-collection`, Roblox APIs, a Roblox universe ID, or the Roblox export command.

## Dataset contract

1. Read the approved brief and every source needed for the roster and public fields.
2. Build the complete approved roster. Compare item count, names, stable slugs, and exclusions against the source plan.
3. Use the v2 wrapped shape:

```json
{
  "meta": {},
  "items": [
    {
      "item": {},
      "system": {
        "slug": "",
        "section": "",
        "sortOrder": 0,
        "image": null
      }
    }
  ]
}
```

4. Put player-facing facts only in `items[].item`. Put only `slug`, `section`, `sortOrder`, and `image` in `items[].system`.
5. Never expose source URLs, verification notes, raw text, image status, debug fields, scrape keys, or internal IDs as public item fields.
6. Every row needs `items[].item.name`, a stable system slug, a section, and deterministic sort order.
7. Keep the same public field keys across rows. Use `null` or an empty value for an unverified field instead of deleting the key or guessing.
8. Write descriptions in original language without changing source-backed facts.
9. Keep Story Mode, Online, edition, platform, and update availability in explicit fields when they affect the roster or values.
10. Do not invent normalized performance scores. Use game-displayed or source-defined metrics and explain their scale in page copy later.

## Display metadata

Add:

- `meta.schemaVersion: 2`
- `meta.itemFields`
- `meta.columns`
- `meta.display.groupLabel`
- `meta.display.sectionOrder`
- `meta.display.tableFields`
- `meta.display.cardFields`
- `meta.display.badgeField` when useful
- `meta.display.subtitleFields`
- `meta.display.descriptionField`
- `meta.display.cardDescriptionField`
- `meta.display.fieldPresentation`

Every display field must exist in `meta.itemFields` and the item rows.

Use `normal` for ordinary comparable text, `chip` for short numbers or labels, `highlight` for a source-backed status or availability field, and `detail` for complete sentence facts. Presentation belongs to the field key and stays consistent across all rows.

Use a game-native section when one exists. Otherwise use `Items` for every row and `meta.display.sectionOrder: ["Items"]`. Do not create fake sections to control page size. The renderer handles pagination.

## Runtime manifest

Create:

```json
{
  "schemaVersion": 1,
  "game": { "slug": "<game-slug>", "name": "<Game name>" },
  "collection": {
    "slug": "<collection-slug>",
    "label": "<Collection label>",
    "sortOrder": 100
  },
  "route": "/gta/wiki/<game-slug>/<collection-slug>",
  "dataset": "dataset.json",
  "mediaRoot": "media",
  "sourceUrls": []
}
```

Use code `<game-slug>-<collection-slug>` in later page copy. Add all material data and image sources to `sourceUrls`. Do not add search result URLs.

## Checks

Run:

```bash
npm run audit:game-collection-datasets:v2 -- \
  --game <game-slug> \
  --collection <collection-slug> \
  --file <workspace>/dataset.json

npm run check:game-collection-data -- \
  --game <game-slug> \
  --collection <collection-slug> \
  --file <workspace>/dataset.json

npm run sync:gta-collection-runtime -- \
  --manifest <workspace>/runtime-manifest.json
```

The last command is a dry plan. Do not add `--apply`, `--upload-media`, `--publish`, or `--allow-prod` in the data step.

## Data readiness note

Append to `brief.md`:

```text
Data readiness:
- Dataset path:
- Runtime manifest path:
- Dataset shape and schema version:
- Dataset count:
- Source roster count:
- Inclusion and exclusion match:
- Public fields:
- System fields only slug/section/sortOrder/image:
- Section labels, counts, and order:
- Card fields and table fields:
- Field presentation map:
- Description coverage:
- Field consistency:
- Edition/mode fields:
- Image needed and planned image field:
- Hidden/source/debug fields absent:
- Missing or disputed rows:
- Audit command and result:
- Checker command and result:
- GTA sync dry-plan command and result:
- Ready for images, yes/no:
```

If the roster, audit, checker, or dry plan fails, fix the data or stop with the exact blocker. Do not hand incomplete data to the image or writing step.
