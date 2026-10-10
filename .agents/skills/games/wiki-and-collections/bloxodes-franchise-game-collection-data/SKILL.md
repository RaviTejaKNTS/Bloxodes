---
name: bloxodes-franchise-game-collection-data
description: Prepare one approved non-Roblox franchise collection dataset in an ignored workspace. Use for v2 rows, fields, sections, images planning, runtime manifests, audits, and data readiness; do not write final.json or publish production.
---

# Bloxodes franchise game collection data

You build the dataset for one approved collection in a non-Roblox franchise namespace. Done means a complete v2 `dataset.json`, a `runtime-manifest.json`, passing checks and a data readiness note in `brief.md`, all ready for the image pass.

- Start only after the parent approves `brief.md`.
- You own this one collection. Don't spawn other workers.
- The parent must hand you the target context. Don't guess it.

## Shared game storage

- **Tables:** managed development uses `games`, `game_wiki_pages`, `game_collection_pages`, `game_collection_datasets`, `game_collection_items`, `game_code_pages`, `game_codes` and `game_tool_pages`. Roblox stays separate.
- **Namespace:** scope every read and write by namespace. Use `gameDatabase(client, namespace)` for existing logical suffixes.
- **Kinds:** `games.kind` is only `franchise` or `game`. `parent_id` links a game to its franchise. Mode and edition labels describe content; they never add kinds.
- **Routes:** read the wiki row's `canonical_path` before planning collection links. A standalone game's wiki is `/<namespace>/wiki`. A franchise has its own wiki hub plus child game wikis. Keep Minecraft's edition URLs as they are.
- **Pages:** publish reviewed game, wiki, codes page and registered tool payloads with `publish:game-pages -- --namespace <slug> --file <reviewed.json>`. It's a dry run by default, and `--apply` writes only to development. Combined payloads need explicit IDs. Publish identity first, then the wiki, then collections.
- **Collections:** publish with `sync:shared-game-collection-runtime`, passing `--namespace` and the reviewed runtime manifest. Keep immutable dataset/media publication and pointer readback. Preserve drafts, revisions, sources, fields and media. Never edit published items.
- **Workspaces:** research stays in ignored workspaces.
- **Who owns what:** these general wiki and collection workflows cover standalone games and franchises. GTA specialists keep their mode, source, map and collectible rules under `namespace = 'gta'`.

## What the context gives you

- franchise name, namespace, game slug, collection slug and route
- collection workspace root
- target collection tables/views
- collection code pattern
- data audit and checker commands
- runtime sync dry-plan command
- any title/collection registry command

Work here:

```text
<workspace-root>/<game-slug>/collections/<collection-slug>/
  brief.md
  dataset.json
  runtime-manifest.json
```

Before you start:

- Read the approved brief.
- For an existing collection, export the published runtime revision with the target franchise's export command before you edit anything.
- Don't use Roblox APIs, Roblox universe IDs, a Roblox collection registry or another franchise's workspace unless the context explicitly maps them.

## Build the dataset

1. Read every source you need for the approved roster and public fields.
2. Build the complete approved roster. Compare item count, names, stable slugs and exclusions against the source plan.
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

4. Player-facing facts go only in `items[].item`. `items[].system` holds only `slug`, `section`, `sortOrder` and `image`.
5. Every row needs `items[].item.name`, a stable system slug, a section and a deterministic sort order.
6. Keep the same public field keys on every row. If no reliable source gives a value, use `null` or an empty value. Don't delete the key and don't guess. When sources disagree, follow "Conflicting sources" in `.agents/skills/bloxodes-game-collection-data/SKILL.md`: use the better-supported value or a range.
7. Make mode, expansion, edition, platform, release generation and live-service availability explicit whenever they affect rows or values.
8. Don't invent normalized performance scores. Use game-displayed or source-defined metrics. The page copy explains their scale later.

### Keep public values clean

Public item values are what players read on cards and tables, so they follow the "plain" slot in `bloxodes-voice` (`.agents/skills/bloxodes-voice/SKILL.md`): short, exact, no jokes.

- Write the value, not the research: `12 seconds`, not `reportedly around 12 seconds (unconfirmed)`.
- No research wording in public values: "reportedly", "unconfirmed", "according to", "sources say", "community-documented".
- Never expose source URLs, verification notes, raw text, image status, debug fields, scrape keys or internal IDs as public item fields.
- If a value is shaky, use the best-supported value or range and note the doubt and every competing value in `brief.md`. Leave it `null` or empty only when no reliable source gives one. The writer decides later whether the page needs a plain caveat.

## Display metadata

Add these to `meta`:

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

Every display field must exist in `meta.itemFields` and in the item rows.

Pick a presentation per field key and keep it the same on every row:

| Kind | Use it for |
| --- | --- |
| `normal` | ordinary comparable text |
| `chip` | short numbers or labels |
| `highlight` | a source-backed status or availability field |
| `detail` | complete-sentence facts |

Sections:

- Use game-native sections when they exist.
- Otherwise put every row in `Items` with `sectionOrder` `["Items"]`.
- Don't create fake sections to control page size. The renderer handles pagination.

## Runtime manifest

Create:

```json
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
```

- Use the context's collection code pattern.
- Put every material data and image source in `sourceUrls`. No search-result URLs.
- Set `pageType` to `collectible` for a finite player-completed goal and `database` for a reference roster. The same collection table and v2 dataset support both.
- If the target needs a registry, use the context-provided command, and only after its dry run is reviewed. Don't assume the Roblox `GAME_COLLECTIONS` registry.

## Checks

Swap in the context-provided commands. Never run the literal angle-bracket placeholders.

```bash
<dataset-audit-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
<data-checker-command> --game <game-slug> --collection <collection-slug> --file <workspace>/dataset.json
<runtime-sync-dry-plan-command> --manifest <workspace>/runtime-manifest.json
```

The data step never applies, uploads media, publishes, uses production credentials or passes an allow-production flag.

## Data readiness note

Append this to `brief.md`:

```text
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
```

If the roster, audit, checker or dry plan fails, fix the data or stop with the exact blocker. Never hand incomplete data to the image or writing step.
