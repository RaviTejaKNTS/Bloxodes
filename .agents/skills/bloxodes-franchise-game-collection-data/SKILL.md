---
name: bloxodes-franchise-game-collection-data
description: Prepare one approved non-Roblox franchise collection dataset in an ignored workspace. Use for v2 rows, fields, sections, images planning, runtime manifests, audits, and data readiness; do not write final.json or publish production.
---

# Bloxodes franchise game collection data

Own one approved collection. Do not spawn other workers. Use this after the parent approves brief.md. This skill is designed for a non-Roblox franchise namespace and must receive the target context.

## Context and workspace

The context must provide:

- franchise name, namespace, game slug, collection slug, and route
- collection workspace root
- target collection tables/views
- collection code pattern
- data audit and checker commands
- runtime sync dry-plan command
- any title/collection registry command

Work under:

~~~text
<workspace-root>/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  runtime-manifest.json
~~~

Read the approved brief. For an existing collection, export the published runtime revision with the target franchise's export command before editing. Do not use Roblox APIs, Roblox universe IDs, a Roblox collection registry, or another franchise's workspace unless the context explicitly maps them.

## Dataset contract

1. Read every source needed for the approved roster and public fields.
2. Build the complete approved roster. Compare item count, names, stable slugs, and exclusions against the source plan.
3. Use the v2 wrapped shape:

~~~json
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
~~~

4. Put player-facing facts only in items[].item. Put only slug, section, sortOrder, and image in items[].system.
5. Never expose source URLs, verification notes, raw text, image status, debug fields, scrape keys, or internal IDs as public item fields.
6. Every row needs items[].item.name, a stable system slug, a section, and deterministic sort order.
7. Keep the same public field keys across rows. Use null or an empty value for an unverified field instead of deleting the key or guessing.
8. Keep mode, expansion, edition, platform, release generation, and live-service availability explicit when they affect rows or values.
9. Do not invent normalized performance scores. Use game-displayed or source-defined metrics and explain their scale in page copy later.

## Display metadata

Add:

- meta.schemaVersion: 2
- meta.itemFields
- meta.columns
- meta.display.groupLabel
- meta.display.sectionOrder
- meta.display.tableFields
- meta.display.cardFields
- meta.display.badgeField when useful
- meta.display.subtitleFields
- meta.display.descriptionField
- meta.display.cardDescriptionField
- meta.display.fieldPresentation

Every display field must exist in meta.itemFields and the item rows.

Use normal for ordinary comparable text, chip for short numbers or labels, highlight for a source-backed status or availability field, and detail for complete sentence facts. Presentation belongs to the field key and stays consistent across rows.

Use game-native sections when they exist. Otherwise use Items for every row and sectionOrder ["Items"]. Do not create fake sections to control page size. The renderer handles pagination.

## Runtime manifest

Create:

~~~json
{
  "schemaVersion": 1,
  "game": { "slug": "<game-slug>", "name": "<Game name>" },
  "collection": {
    "slug": "<collection-slug>",
    "label": "<Collection label>",
    "sortOrder": 100,
    "pageType": "database"
  },
  "route": "<collection-route>",
  "dataset": "dataset.json",
  "mediaRoot": "media",
  "sourceUrls": []
}
~~~

Use the context's collection code pattern. Add all material data and image sources to sourceUrls, not search-result URLs. Set pageType to collectible for a finite player-completed goal and database for a reference roster. The same collection table and v2 dataset support both types.

If the target implementation requires a registry, use the context-provided command and only after its dry run is reviewed. Do not assume the Roblox GAME_COLLECTIONS registry.

## Checks

Substitute the context-provided commands; never run literal angle-bracket placeholders:

~~~bash
<dataset-audit-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
<data-checker-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
<runtime-sync-dry-plan-command> --manifest <workspace>/runtime-manifest.json
~~~

Do not apply, upload media, publish, use production credentials, or pass an allow-production flag in the data step.

## Data readiness note

Append to brief.md:

~~~text
Data readiness:
- Dataset file:
- Page type and manifest declaration:
- Item count:
- Source item count:
- Dataset shape: v2 wrapped { meta, items[].item, items[].system } yes/no
- Public item fields:
- System fields: slug, section, sortOrder, image only yes/no
- Metadata: schemaVersion, itemFields, columns, display.groupLabel, display.sectionOrder, display.tableFields, display.cardFields, display.fieldPresentation
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
- Image field: items[].system.image
- Hidden/source/dev fields absent from public item data: yes/no
- Sort order: items[].system.sortOrder
- description_json section keys:
- Renderer/config support:
- Missing items:
- Audit command and result:
- Checker command and result:
- Runtime sync dry-plan command and result:
- Ready for images, yes/no:
~~~

If the roster, audit, checker, or dry plan fails, fix the data or stop with the exact blocker. Do not hand incomplete data to the image or writing step.
