# Roblox wiki and collections

Last verified: 2026-10-20

Each Roblox game gets a wiki hub at `/wiki/<game-slug>` and item collections at `/wiki/<game-slug>/<collection-slug>` (pets, weapons, mutations, zones and so on). New games are added every night by a T3 schedule.

Roblox wiki content is moving to the [Bloxodes Content Factory](#content-factory), a separate content-only repo. The nightly schedule still runs from this repo until it moves.

## Nightly run (MacBook Pro, 02:30 IST)

The T3 schedule "Bloxodes nightly Roblox wiki":

1. Picks the highest-ranked game in the live top 100 with no hub and no [Roblox Wiki Queue](../automation/notion-queues.md) row, and claims it.
2. Runs `bloxodes-game-collection-suggestions`, then `bloxodes-game-collection-workflow-runner` for the collections worth making.
3. Runs `bloxodes-wiki-workflow-runner` for the hub.
4. Routes each stage by `bloxodes-model-routing`.
5. Publishes the hub and collections as one `roblox-wiki@1` bundle with `npm run content:publish` (see [publishing](#publishing)). New games and collections register themselves in the database, so no code PR is needed. A run that also needs a code change opens that PR separately for the owner.
6. Sets the queue row to `Done` (or `Waiting for approval` / `Blocked`) with a Run report.

Manual runs use the same skills.

## Workflow

1. **Suggest and research:** confirm game identity, sources, scope, route and no overlap with production.
2. **Workspace:** export an existing collection with `npm run export:game-collection-workspace`, or create a new one. Each collection lives in ignored `tmp/content-workspace/<game-slug>/collections/<collection-slug>/` with `dataset.json`, `media/`, `final.json` and `runtime-manifest.json`.
3. **Data:** build the full, source-backed dataset with useful player fields. Approve rows and sections before images.
4. **Images:** collect and wire images, then review them.
5. **Write:** write the hub or collection `final.json` with the writing skill and `bloxodes-voice`.
6. **Publish:** put the approved hub and collections in a `roblox-wiki@1` bundle and publish it with `content:publish`, managed development first, then production. See [publishing](#publishing).

## Publishing

The code repo owns one versioned publish command and its contract, `contracts/roblox-wiki/v1/` (`schema.ts` and a README with the folder layout). Whatever passes it is what the live site can render.

| Command | Does |
| --- | --- |
| `npm run content:publish -- <abs-bundle> [--only hub\|<collection-slug>]` | Dry run against managed development: schema, identity, slugs, dataset audit, copy checks, titles, image readiness. No writes. |
| `... --target managed-dev --apply` | Writes the selected pages to managed development. |
| `... --target production --apply --allow-prod` | Writes to production, then reads back, revalidates and checks every live URL. |
| `npm run content:status -- --game <slug> [--target production]` | Hub and collection state, item counts, URLs. |
| `npm run content:candidates -- --target production` | Top-100 games with no hub, highest rank first. Doesn't claim the queue row. |
| `npm run content:deployed-sha` | The live deployed SHA. |

- **Production guard:** the checkout must be on `origin/production` (or behind it) with no changed tracked files, and nothing between it and the live deployed SHA may touch publish code: `apps/web/`, `contracts/`, the content, shared, collection and universe scripts, migrations, or the package files. Docs-only differences are fine. Production must have no pending migrations. The command never moves the checkout; it refuses and says why.
- **What an apply does:** imports the universe row if the target lacks it (the dry run previews it from the Roblox API and checks the editorial slug against its stats slug), uploads item images and the official hub cover to R2, writes the hub and an immutable revision per collection, merges the game into `roblox_wiki_registry`, reads everything back. Production also snapshots an overwritten hub to `tmp/publish-snapshots/`, revalidates and fetches each live URL.
- **Not one transaction.** A late failure can leave some pages published. Rerun the same bundle; revision hashes make it safe.
- The dry run is a scoped exception to "no checks locally". Builds, test suites and browser QA still run on GitHub.
- The older path still works: `sync:game-wiki-runtime` and `sync:game-collection-runtime` behind the GitHub `roblox-wiki` and `roblox-collection` publishers, with selected Roblox QA ([release](../operations/release.md#managed-development-content-qa)).

## Content Factory

`/srv/data/projects/bloxodes-content-factory` on the homelab (T3 project "Bloxodes Content Factory") holds only skills and docs for Roblox wiki hubs and collections. No site code.

- **Roles:** the main agent is Codex `gpt-6.1-sol`. One Luna builder per page does research, data, images and a draft (`roblox-wiki-builder`). One Haiku 5.5 content manager per page rewrites the copy and cleans labels and SEO (`roblox-content-manager`). Only the main agent pushes.
- **Content:** `content/roblox/<game-slug>/` holds the bundle. Everything except media is committed there, so git history is the edit history.
- **Publishing:** `bin/publisher` runs `content:publish`, `content:status` and `content:candidates` from the device's main Bloxodes checkout (`/srv/data/projects/Bloxodes` on the homelab, `~/projects/Bloxodes` on the Macs), which T3 auto-pulls. It never moves that checkout.
- **Repo and devices:** `github.com/RaviTejaKNTS/bloxodes-content-factory` (private, sync only). Checked out next to Bloxodes on each device.
- **Contract changes:** when this repo ships `roblox-wiki@2`, update the Content Factory docs and skills in the same change, or the factory's pushes will be rejected.

## Data

| Table | Holds |
| --- | --- |
| `roblox_universes` | Game identity. |
| `roblox_wiki_registry` | One row per wiki game: editorial slug, name, universe ID, name aliases, order, and the ordered collections (slug, label, sort order, page type). Service-only. Replaces the old per-game TypeScript files. |
| `wiki_pages` | Hub copy, controls, tips, metadata. |
| `wiki_collection_pages` | Collection copy, route, display settings, `page_type`, publication, `published_dataset_id`. |
| `wiki_collection_datasets`, `wiki_collection_items` | Immutable revisions and their item rows, with R2 media keys. |

- Supabase is the only runtime source. No collection JSON lives in the repo.
- Collection codes are `<game-slug>-<collection-slug>`. `wiki_slug` is the editorial slug, never the stats slug.
- `page_type` picks the renderer: `database` (sortable table) or `collectible` (checkable list with saved progress).
- Item facts come from research. Roblox APIs only confirm identity, metadata and thumbnails.
- Production had 120 published hubs and 776 published collections on 2026-10-19.

## Content rules

- **Collection openings:** start with an intro about the items, then the collection. Put mechanics, stat meanings and trade-offs in `description_md`. Leave the old `how_it_works_md` empty; the renderers ignore it. `scripts/content/roblox-collection-copy.ts` enforces this.
- **Images:** use exact item images. Item names baked into a source image are fine. Never swap in unrelated crops, edited art or generic game thumbnails. Text-only rows are allowed only when no clean image exists, and the decision is recorded in the dataset.
- **Hub images:** `/wiki` cards and social previews use the first official 768x432 universe thumbnail. Hubs published with `content:publish` store a copy in R2 as `wiki_pages.cover_image`; older hubs keep reading it from Roblox until republished. The square art next to the title uses the official 512x512 icon.
- **Field labels:** cards and the list use `meta.display.fieldLabels` from the dataset first, then the code's generic field labels.
- **Public copy:** no research notes, provenance or workflow language. `imageCreditUrl` and `walkthroughUrl` are intended public fields.

Item media is served from R2 bucket `bloxodes-wiki` at `media.bloxodes.com/wiki/<key>`.

## The `/wiki` index

`/wiki` is the Roblox wiki hub: a searchable game directory (20 cards a page), collections and platform activity. Code lives in `apps/web/src/lib/wiki-index.ts` and `wiki-index-options.ts`. Filtered views are `noindex, follow`. `/wiki/page/1` redirects to `/wiki`.

## Known issues

- The old homelab wiki controller is gone, but `wiki_generation_queue` and its receipt helpers (`wiki-publication-receipt.ts`, `wiki-publication-state.mjs`, `wiki-publication-binding.mjs`) are still used by CI publication code. Remove them only together with those callers.
