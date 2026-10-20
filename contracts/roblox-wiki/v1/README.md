# Roblox wiki bundle v1

The code repo owns this contract. Content Factory produces a folder, then invokes the released code repo's publisher. Adding a game or collection requires no source registration or code PR.

`schema.ts` exports the Zod schemas and their JSON Schema equivalents: `bundleJsonSchema`, `hubFinalJsonSchema`, `runtimeManifestJsonSchema` and `collectionFinalJsonSchema`. Dataset v2 also passes `audit-game-collection-datasets-v2.ts`; hub controls pass `wiki-controls.ts`. These checks and the runtime publishers remain in this repo.

```text
game-bundle/
  bundle.json
  wiki/
    final.json
    cover.png                 # optional downloaded official 768x432 thumbnail
  collections/
    pets/
      runtime-manifest.json
      dataset.json
      final.json
      media/
        pet.png
```

`bundle.json`:

```json
{
  "contract": "roblox-wiki@1",
  "game": {
    "slug": "example-game",
    "name": "Example Game",
    "universeId": 12345,
    "universeNames": ["Example Game"],
    "sortOrder": 76000
  },
  "hub": { "finalJson": "wiki/final.json", "coverImage": "wiki/cover.png" },
  "collections": [
    {
      "manifest": "collections/pets/runtime-manifest.json"
    }
  ]
}
```

Include a hub, collections, or both. Omitted collections remain registered. The service-only registry RPC merges registrations atomically and preserves concurrent additions. `game.sortOrder` is optional; new games append to the registry and existing games keep their order.

A missing target `roblox_universes` row produces a dry-run note, `will import universe <id> on apply`. Apply imports that exact universe from Roblox through the stats enrichment API mapper and verifies its ID, root place, name and stats slug before writing pages. It preserves a row inserted concurrently by the stats pipeline or another publisher. Choose the editorial slug independently. A new slug cannot equal the stats slug or end in the universe ID. Existing editorial identities remain valid. The game name and aliases belong in `bundle.game`, never a TypeScript module.

`runtime-manifest.json` keeps the existing workspace format. Paths are relative to its collection folder:

```json
{
  "schemaVersion": 1,
  "game": { "slug": "example-game", "name": "Example Game", "universeId": 12345 },
  "collection": { "slug": "pets", "label": "Pets", "pageType": "database" },
  "dataset": "dataset.json",
  "finalJson": "final.json",
  "mediaRoot": "media",
  "sourceUrls": ["https://example.com/game/pets"],
  "missingImages": [{ "slug": "unpictured-pet", "reason": "No exact item image exists in the reviewed sources." }]
}
```

Keep each collection's `missingImages` decisions in its own manifest so parallel builders can work without editing `bundle.json`. The bundle collection entry still accepts the same optional array. Each decision requires an item slug and a non-empty reason. Omit the array when every item has an image. The publisher merges both arrays for that collection. A slug listed in both must have the same reason after trimming whitespace; conflicting reasons fail. Duplicate slugs within either array fail. Every imageless item needs one merged decision. Decisions for absent items or items that now have an image are stale and fail. `--only <collection-slug>` uses that collection's manifest and bundle-entry decisions; decisions in unselected manifests are not validated.

Use `database` or `collectible` for `pageType`. Changing an existing renderer requires a separate reviewed migration. Every final's identity must match the manifest and bundle. Finals are the existing hub/collection payloads. Collection copy supports `{count}` tokens. Titles use `All {count} <Collection> in <Game>`; a literal count must match the dataset. `display_name` must match the manifest label. `collection.sortOrder` is optional. Omission keeps an existing registration's order. New collections append after the game's current last order, in the bundle's `collections` array order, with spacing of 10. An empty game starts at its game sort order plus 10. New games use the next registry game order, with spacing of 1000. Explicit orders remain supported. With `--only`, only the selected collections receive orders or registry changes. `wiki_sort_order` in a final is optional; when supplied, it must match the resolved order, including an automatically assigned order. Publication requires `is_published: true` or omission. Leave hub `cover_image` null and collection `how_it_works_md` empty. A collection `thumb_url` must be null or an exact planned R2 item URL; null selects the first item image.

Datasets use `{ "meta": { "schemaVersion": 2, ... }, "items": [...] }`. Item rows use `{ "item": { "name": "...", ... }, "system": { "slug": "...", "section": "...", "sortOrder": 10, "image": "pet.png" } }`. Image paths are relative to `mediaRoot`. Keep all bundle inputs and symlink targets inside their owning folder. The publisher rejects duplicate or invalid item slugs rather than repairing them. Keep display fields, section order and useful item fields in the v2 metadata, as required by the existing dataset audit.

Optional `meta.display.fieldLabels` sets the labels players see on web cards, lists, tables, highlights and collectible views, and in the mobile API. Keys must exist in `meta.itemFields`; each label must be non-empty plain text without HTML, Markdown or control characters. Field labels take precedence over `fieldPresentation[key].label`; existing presentation labels and `getFieldLabel(key)` remain the fallbacks. `groupLabel` still controls the section grouping label.

```json
{
  "meta": {
    "schemaVersion": 2,
    "itemFields": ["name", "price", "obtainment", "cardSummary"],
    "display": {
      "fieldLabels": { "price": "Hatch Cost", "obtainment": "How to Get It" }
    }
  }
}
```

This is a metadata fragment. Keep the dataset's required columns, display fields, section order and items.

All image uploads go to R2 bucket `bloxodes-wiki`. Item images retain `<universe-id>/<collection-slug>/<item-slug>-<hash>.<ext>`. Covers use `<universe-id>/hubs/cover-<hash>.<ext>` and serve at `https://media.bloxodes.com/wiki/`. If `hub.coverImage` is omitted, the publisher downloads the official Roblox thumbnail. A supplied cover must match the current official thumbnail bytes and be 768x432 under 1 MB. The square header retains the official Roblox icon. Missing official universe media is fetched and its metadata is stored on apply; no image uploads use Supabase Storage.

Run these commands from the released Bloxodes code checkout, pointing to a bundle in Content Factory:

```sh
npm run content:publish -- /abs/game-bundle
npm run content:publish -- /abs/game-bundle --only pets
npm run content:publish -- /abs/game-bundle --only hub --only pets --target managed-dev --apply
npm run content:publish -- /path/to/game-bundle --target managed-dev --apply
npm run content:publish -- /path/to/game-bundle --target production
npm run content:publish -- /path/to/game-bundle --target production --apply --allow-prod
npm run content:status -- --game example-game --target production
npm run content:candidates -- --target production
npm run --silent content:deployed-sha
```

`--bundle /abs/game-bundle` also works. Repeat `--only <page>` to select `hub` or collection slugs. The selected pages alone are validated and published. The publisher reads other available manifests only to discover their slugs; their datasets, finals and media can remain unfinished. A hub-only run does not read collection manifests. Unknown pages fail with the available values. Without `--only`, the whole bundle is selected. The default target is `managed-dev`; omission of `--apply` is a dry run. `--allow-prod` requires both `--target production` and `--apply`. `--help` shows usage. Unknown contract versions fail and name `roblox-wiki@1` as the supported version. The older `BLOXODES_ENV_PROFILE=production-preview npm run discover:wiki-candidates -- --next` exposes the same top-100 rank selection; its existing growth-based mode stays available.

The shared env loader selects `managed-dev` or `production-preview`; production adds the `vps` overlay for read-only Studio ledger access. Process variables retain precedence, and a target mismatch fails. `process-only` remains available for injected CI credentials. Required names are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` and the four `WIKI_R2_*` names. Production also needs `REVALIDATE_SECRET` and the existing `VPS_SUPABASE_STUDIO_*` credentials. No new secret names are introduced.

Production dry runs and applies fetch `origin/production` and require a clean checkout whose HEAD equals the healthy deployed SHA and is an ancestor of `origin/production`. Docs-only merges may put the production branch ahead of the deployment. `npm run --silent content:deployed-sha` prints only that 40-character deployed SHA and a newline. It calls the public `/api/health?scope=deploy` endpoint and needs no credentials. The `--silent` option suppresses npm's own script banner. The read-only schema release helper checks that the production migration ledger has no pending migrations. CI publishers retain their existing CI guard.

An apply uploads and verifies media, writes the hub and immutable collection revisions, reads back their fields and every item, then merges the registry entry. Production saves an existing hub row under `tmp/publish-snapshots/` before overwriting it, revalidates exact wiki URLs, fetches each URL, checks HTTP 200 and titles, decodes its images and prints the URLs. Managed-development URLs are labelled as production canonical URLs for staged rows.

The selected pages are preflighted together, but writes across multiple pages are not one transaction. If an apply fails after writing, inspect its report and rerun the identical bundle. Existing immutable revision hashes make retries safe. A live URL failure reports failure after publication; it does not roll back published rows. Keep production snapshots until the release is verified.
