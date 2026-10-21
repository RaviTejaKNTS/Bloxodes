# Game wiki bundle v1

Content Factory produces one folder for one non-Roblox game in one namespace. Run `content:publish` from the device's normal Bloxodes main checkout. The command selects `game-wiki@1` from `bundle.json`. New games and collections in registry-backed namespaces need no code registration, PR or GitHub publication run.

`schema.ts` exports Zod schemas and JSON Schema equivalents: `bundleSchema`/`bundleJsonSchema`, `gameSchema`/`gameJsonSchema`, `hubFinalSchema`/`hubFinalJsonSchema`, `runtimeManifestSchema`/`runtimeManifestJsonSchema`, and `collectionFinalSchema`/`collectionFinalJsonSchema`. Dataset v2 also passes the existing dataset audit. Controls pass `wiki-controls.ts`. The publisher checks public copy, target identity, route ownership and image readiness before writing.

```text
game-bundle/
  bundle.json
  game.json
  wiki/
    final.json
    cover.webp                     # optional local artwork
    hero.webp                      # optional local artwork
  collections/
    weapons/
      runtime-manifest.json
      dataset.json
      final.json
      notes.md                     # authoring notes; not read or published
      images.json                  # optional provenance; not read or published
      media/
        iron-sword.webp
```

Include a hub, collections, or both. `game.json` is required in every run. Hub-only selection does not read collection manifests. Collection selection reads other available manifests only to discover their slugs, so unselected datasets, finals and media may remain unfinished. Selected pages publish in bundle order, with the hub first. Omitted pages remain untouched. Keep files and symlink targets inside their owning bundle, collection or media folder.

## Bundle identity

```json
{
  "contract": "game-wiki@1",
  "namespace": "example-series",
  "game": {
    "slug": "example-sequel",
    "name": "Example Sequel",
    "kind": "game",
    "parent": "example-series"
  },
  "hub": { "finalJson": "wiki/final.json" },
  "collections": [
    { "manifest": "collections/weapons/runtime-manifest.json" }
  ]
}
```

`contract`, `namespace` and `game` are required. `game` has required `slug`, `name`, `kind` and optional `parent`. A root uses `slug === namespace`, `kind: "game"` or `"franchise"`, and no `parent`. A child uses `kind: "game"` and `parent` equal to the namespace. Publish the franchise root before its children. Root kinds and parent relationships are permanent.

`hub` is optional and has exactly `finalJson: "wiki/final.json"`. `collections` is an optional ordered array. Each entry has `manifest: "collections/<collection-slug>/runtime-manifest.json"` and optional `missingImages: [{"slug":"item-slug","reason":"Why no exact image exists."}]`.

Slugs use lowercase letters, numbers and single hyphens. Roblox identifiers are rejected throughout selected JSON inputs, including nested dataset fields. The bundle, manifest and final schemas reject unknown fields.

## Game identity and artwork

`game.json` keeps the existing franchise writer shape. Its game name is `title`, which must equal `bundle.game.name`.

Required fields:

- `slug`: equals `bundle.game.slug`.
- `title`: game or franchise name.
- `status`: `announced`, `upcoming` or `released`.
- `cover_image`: local file path relative to the bundle, or a hosted Bloxodes wiki image URL. The image must be 16:9, within a ratio tolerance of 0.01.
- `hero_image`: another local file path or hosted URL. The image must be square and have different bytes from the cover.

Optional fields:

- `kind`: `game` or `franchise`; when supplied, it must match the bundle.
- `parent_slug`: namespace root slug; when supplied and non-null, it must match `bundle.game.parent`.
- `namespace`: must match the bundle when supplied.
- `short_title`, `installment`, `developer`, `publisher`, `description_md`: strings or null.
- `content_kind`: `game`, `expansion` or `online`.
- `official_url`: HTTPS URL, empty string or null.
- `release_dates_json`: object with the existing release information.
- `platforms_json`: array with the existing platform information.
- `is_published`: `true`; omission also publishes.
- `id`, `parent_id`: source-export UUID hints, ignored for writes. `parent_id` may be null. Resolve the actual parent using the bundle's natural key.

PNG, JPEG, WebP, AVIF and GIF artwork is accepted. Local images must decode fully within the shared image byte and pixel limits. Hosted images must be under `https://media.bloxodes.com/wiki/<namespace>/<game-slug>/`; Minecraft uses `<namespace>/minecraft/`. They must pass the existing hosted-image verifier, with no redirects. Covers and heroes upload through this command to R2 bucket `bloxodes-wiki`, using `<namespace>/<game-slug>/hub-cover-<16-character-hash>.<ext>` and `hub-hero-<hash>.<ext>`. Minecraft retains its shared `minecraft/minecraft/` prefix. The database stores hosted URLs, never local paths or third-party image URLs.

In a collection-only run, the publisher reads `game.json` for identity and copy checks but keeps stored game fields. The owning game, hub and franchise root must already be published with valid artwork. A hub selected in the same bundle can create the owning game and hub before the collections are applied.

## Hub final

`wiki/final.json` has these required fields:

- `game_slug`, `slug`: both equal `bundle.game.slug`.
- `title`, `seo_title`, `meta_description`, `description_md`: non-empty strings.
- `tips_md`: string. Released games require non-empty tips; franchise roots and unreleased games may leave it empty.
- `controls_json`: array of verified control objects. Each object needs `action` and at least one device-specific control such as `desktop`, `mobile` or `console`. Use `[]` when no controls are verified.

Optional fields are `cover_image` (null or the game's cover path/URL), `is_published` (true), `namespace`, `canonical_path`, `id` and `game_id`. Artwork belongs in `game.json`; leave the hub cover null to use it. Explicit namespace and canonical path must match the target. UUID hints are ignored.

## Collection manifest

```json
{
  "schemaVersion": 1,
  "namespace": "example-series",
  "game": { "slug": "example-sequel", "name": "Example Sequel" },
  "collection": { "slug": "weapons", "label": "Weapons", "pageType": "database", "sortOrder": 100 },
  "route": "/example-series/wiki/example-sequel/weapons",
  "dataset": "dataset.json",
  "finalJson": "final.json",
  "mediaRoot": "media",
  "sourceUrls": ["https://example.com/weapons"],
  "missingImages": [{ "slug": "unpictured-weapon", "reason": "No exact image exists in the reviewed sources." }]
}
```

Required fields are `schemaVersion: 1`, `game` (slug/name), `collection` (slug/label/pageType), `dataset: "dataset.json"`, `finalJson: "final.json"`, `mediaRoot: "media"`, and a non-empty `sourceUrls` array of HTTPS URLs. Optional fields are `namespace`, `route`, `collection.sortOrder` (integer) and `missingImages`. Explicit namespace, route and game identity must match the bundle and target wiki. `pageType` is `database` or `collectible`. Minecraft only supports its existing edition identities and `database` collections.

`sortOrder` uses the existing collection order when omitted, or appends in increments of 10 for new collections. A final's explicit `wiki_sort_order` remains supported; if the manifest also sets `sortOrder`, both must agree.

Missing-image decisions merge between this manifest and its bundle entry. Every imageless item needs a reason. Duplicate decisions, conflicting reasons, absent item slugs and decisions for items that now have images fail. At least one exact item image is required for every collection, as in the existing franchise publisher. `notes.md` and `images.json` may preserve research and provenance in today's authoring formats; they cannot override these decisions or alter publication.

## Dataset

`dataset.json` retains the existing v2 wrapped shape:

```json
{
  "meta": {
    "schemaVersion": 2,
    "gameSlug": "example-sequel",
    "collection": "weapons",
    "itemFields": ["name", "damage", "price", "obtainment"],
    "columns": ["name", "damage", "price", "obtainment"],
    "display": {
      "groupLabel": "Weapon type",
      "sectionOrder": ["Swords"],
      "tableFields": ["damage", "price", "obtainment"],
      "cardFields": ["damage", "price", "obtainment"]
    }
  },
  "items": [
    {
      "item": { "name": "Iron Sword", "damage": 12, "price": 50, "obtainment": "Forge" },
      "system": { "slug": "iron-sword", "section": "Swords", "sortOrder": 10, "image": "iron-sword.webp" }
    }
  ]
}
```

Use real gameplay fields and the full existing dataset display contract, including field labels, presentation and section order where useful. The dataset audit still applies. Public item data belongs in `item`; system data belongs only in `system.slug`, `section`, `sortOrder`, `image`. Slugs must already be valid and unique; the new publisher never repairs them. `system.image` is relative to `mediaRoot`, with the existing optional `media/` prefix accepted. Null or absent images require a `missingImages` decision. Item images retain the existing normalization and immutable franchise R2 keys; Minecraft retains full-content-hash keys. No dataset or image file is added to the code repo.

## Collection final

Required fields in `collections/<slug>/final.json`:

- `wiki_slug`, `collection_slug`, `code`: game slug, collection slug and `<game-slug>-<collection-slug>`.
- `display_name`: exactly the manifest's collection label.
- `title`: `All {count} <Collection> in <Game>`, optionally followed by a useful angle. A literal count must match the dataset.
- `seo_title`, `meta_description`, `intro_md`, `description_md`, `wiki_md`: non-empty strings.
- `description_json`: section-note object with string values. Keys must match dataset sections; `{}` is valid.
- `faq_json`: array of `{ "q": "Question", "a": "Answer" }`; `[]` is valid.

Optional fields are `how_it_works_md` (empty string or null), `wiki_sort_order` (integer), `thumb_url` (null or an exact planned item image URL), `schema_ld_json` (object or null), `is_published` (true), `namespace`, `canonical_path`, `id`, `game_id`, and `wiki_page_id`. Null or absent `thumb_url` uses the first item image. Publication expands `{count}` tokens in copy. Namespace and route must match the target; UUID hints are ignored. Existing page types and route ownership cannot change.

## Commands and target guards

```sh
npm run content:publish -- /abs/example-sequel-bundle
npm run content:publish -- /abs/example-sequel-bundle --only hub --only weapons
npm run content:publish -- /abs/example-sequel-bundle --target managed-dev --apply
npm run content:publish -- /abs/example-sequel-bundle --target production
npm run content:publish -- /abs/example-sequel-bundle --only weapons --target production --apply --allow-prod
npm run content:status -- --namespace example-series --game example-sequel --target managed-dev
```

`--bundle /abs/folder` also works. Repeat `--only hub|<collection-slug>` to select pages. Default target is `managed-dev`; default operation is a dry run. A dry run checks selected inputs, target ownership, copy, image bytes and R2 configuration without writing database rows or media. It does not call a rollback-write RPC. Production apply needs both `--apply` and `--allow-prod`. `--allow-prod` alone or against development fails.

For namespaces such as GTA where a franchise and a child game share a slug, status defaults to the root when `--game` equals the namespace. Add `--kind game` to inspect the child, or `--kind franchise` to select the franchise explicitly. `--kind` is only valid with status and `--namespace`.

Status prints the selected target, whether the hub and stored collections exist and are published, effective visibility, collection item counts and production canonical URLs. Development rows are labelled as staged status. It uses database natural keys, not source-export UUIDs.

Production dry runs and applies use the same `assertLocalContentPublication` guard as Roblox. It checks tracked changes, production ancestry, deployed-code compatibility and the migration ledger, and repeats immediately before writes. Its publication-relevant path list is unchanged. Environment profiles, production revalidation credentials and R2 credentials are the existing ones; no new secret names are required.

New namespace roots and child games use the shared registry route. Reserved namespaces fail. Namespaces shadowed by dedicated routes need reviewed route code and are refused, except the existing GTA, Red Dead and Minecraft routes. GTA and Red Dead root collections are refused because those routes only support child-game collections. Minecraft keeps `/minecraft/java/wiki` and `/minecraft/bedrock/wiki`.

Each target resolves its own game, parent, hub and collection rows by natural key. Existing rows update in place, preserving page UUIDs and progress. Development and production IDs need not match. Apply uploads and verifies media, writes the hub, publishes immutable collection revisions and reads back fields and every item. Database triggers enqueue `game_content`; production also revalidates the exact paths and checks live URLs, titles and images. Existing production hub/game rows are snapshotted under `tmp/publish-snapshots/` before replacement.

The selected pages are preflighted together, but publication across multiple pages is not one transaction. A late failure can leave pages published. Inspect the report and rerun the same bundle; revision hashes allow reuse. A live URL failure happens after writes and does not roll publication back. The existing GitHub `publish-content.yml` publisher paths retain their CI guards and behavior.
