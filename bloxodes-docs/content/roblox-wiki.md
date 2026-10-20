# Roblox wiki and collections

Last verified: 2026-10-19

Each Roblox game gets a wiki hub at `/wiki/<game-slug>` and item collections at `/wiki/<game-slug>/<collection-slug>` (pets, weapons, mutations, zones and so on). New games are added every night by a T3 schedule.

## Nightly run (MacBook Pro, 02:30 IST)

The T3 schedule "Bloxodes nightly Roblox wiki":

1. Picks the highest-ranked game in the live top 100 with no hub and no [Roblox Wiki Queue](../automation/notion-queues.md) row, and claims it.
2. Runs `bloxodes-game-collection-suggestions`, then `bloxodes-game-collection-workflow-runner` for the collections worth making.
3. Runs `bloxodes-wiki-workflow-runner` for the hub.
4. Routes each stage by `bloxodes-model-routing`.
5. Publishes with `bloxodes-release-e2e`, including the code PR that registers the game's collections (`apps/web/src/lib/game-collections/games/<slug>.ts` and its entry in `index.ts`). Any other code change waits in a PR for the owner.
6. Sets the queue row to `Done` (or `Waiting for approval` / `Blocked`) with a Run report.

Manual runs use the same skills.

## Workflow

1. **Suggest and research:** confirm game identity, sources, scope, route and no overlap with production.
2. **Workspace:** export an existing collection with `npm run export:game-collection-workspace`, or create a new one. Each collection lives in ignored `tmp/content-workspace/<game-slug>/collections/<collection-slug>/` with `dataset.json`, `media/`, `final.json` and `runtime-manifest.json`.
3. **Data:** build the full, source-backed dataset with useful player fields. Approve rows and sections before images.
4. **Images:** collect and wire images, then review them.
5. **Write:** write the hub or collection `final.json` with the writing skill and `bloxodes-voice`.
6. **QA and publish:** GitHub stages the exact content in managed development, checks it on desktop and mobile, then publishes with the `roblox-wiki` and `roblox-collection` publishers. See [release](../operations/release.md). To check a hub and its collections in development before publishing, use selected Roblox QA ([release](../operations/release.md#managed-development-content-qa)); don't build a new QA job.

Commands behind the publishers: `sync:game-wiki-runtime` (hub) and `sync:game-collection-runtime` (immutable collection revision). Don't run checks or validators locally.

## Data

| Table | Holds |
| --- | --- |
| `roblox_universes` | Game identity. |
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
- **Hub images:** `/wiki` cards and social previews use the first official 768x432 universe thumbnail. The square art next to the title uses the official 512x512 icon.
- **Public copy:** no research notes, provenance or workflow language. `imageCreditUrl` and `walkthroughUrl` are intended public fields.

Item media is served from R2 bucket `bloxodes-wiki` at `media.bloxodes.com/wiki/<key>`.

## The `/wiki` index

`/wiki` is the Roblox wiki hub: a searchable game directory (20 cards a page), collections and platform activity. Code lives in `apps/web/src/lib/wiki-index.ts` and `wiki-index-options.ts`. Filtered views are `noindex, follow`. `/wiki/page/1` redirects to `/wiki`.

## Known issues

- The old homelab wiki controller is gone, but `wiki_generation_queue` and its receipt helpers (`wiki-publication-receipt.ts`, `wiki-publication-state.mjs`, `wiki-publication-binding.mjs`) are still used by CI publication code. Remove them only together with those callers.
