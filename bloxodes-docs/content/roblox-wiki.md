# Roblox wiki and collections

Last verified: 2026-10-21

Each Roblox game gets a wiki hub at `/wiki/<game-slug>` and item collections at `/wiki/<game-slug>/<collection-slug>` (pets, weapons, mutations, zones and so on). New games are added every night by a T3 schedule.

Roblox wiki content is built in the [Bloxodes Content Factory](#content-factory), a separate content-only repo. The skills below still work here for manual runs.

## Nightly run (MacBook Pro, 02:30 IST)

The T3 schedule "Bloxodes nightly Roblox wiki (Content Factory)" runs in the factory's root checkout with its `roblox-wiki-main` skill. It picks the highest-ranked game in the live top 100 with no hub and no [Roblox Wiki Queue](../automation/notion-queues.md) row, builds the hub and collections, and publishes them as one `roblox-wiki@1` bundle with `content:publish` (see [publishing](#publishing)). New games and collections register themselves in the database, so no code PR is needed. A game too thin to publish is marked `Blocked` and the run tries the next one, up to 3.

## Workflow

1. **Suggest and research:** confirm game identity, sources, scope, route and no overlap with production.
2. **Workspace:** export an existing collection with `npm run export:game-collection-workspace`, or create a new one. Each collection lives in ignored `tmp/content-workspace/<game-slug>/collections/<collection-slug>/` with `dataset.json`, `media/`, `final.json` and `runtime-manifest.json`.
3. **Data:** build the full, source-backed dataset with useful player fields. Approve rows and sections before images.
4. **Images:** collect and wire images, then review them.
5. **Write:** write the hub or collection `final.json` with the writing skill and `bloxodes-voice`.
6. **Publish:** put the approved hub and collections in a `roblox-wiki@1` bundle and publish it with `content:publish`, managed development first, then production. See [publishing](#publishing).

## Publishing

The code repo owns one versioned publish command with two contracts: `contracts/roblox-wiki/v1/` for Roblox and `contracts/game-wiki/v1/` for franchise games ([franchise publishing](franchise.md#publishing)). Each has `schema.ts` and a README with the folder layout. The command picks the contract from `bundle.json`. Whatever passes it is what the live site can render.

| Command | Does |
| --- | --- |
| `npm run content:publish -- <abs-bundle> [--only hub\|<collection-slug>]` | Dry run against managed development: schema, identity, slugs, dataset audit, copy checks, titles, image readiness. No writes. |
| `... --target managed-dev --apply` | Writes the selected pages to managed development. |
| `... --target production --apply --allow-prod` | Writes to production, then reads back, revalidates and checks every live URL. |
| `npm run content:status -- --game <slug> [--target production]` | Hub and collection state, item counts, URLs. Franchise games add `--namespace <ns>` (and `--kind game` when the child shares the root's slug). |
| `npm run content:candidates -- --target production` | Top-100 games with no hub, highest rank first. Doesn't claim the queue row. |
| `npm run content:deployed-sha` | The live deployed SHA. |

- **Production guard:** the checkout must be on `origin/production` (ahead of or behind the live SHA is fine) with no changed tracked files, and nothing between it and the live deployed SHA may touch what ships in the web image: `apps/web/`, `data/`, `Dockerfile` or the package files (`PUBLICATION_RELEVANT_PATHS`, kept in step with the deploy's change classifier). Scripts, contracts and migrations run from the checkout itself, so merges that only change them don't block. Production must have no pending migrations. The command never moves the checkout; it refuses and says why.
- **What an apply does:** imports the universe row if the target lacks it (the dry run previews it from the Roblox API and checks the editorial slug against its stats slug), uploads item images and the official or explicitly hash-approved hub cover to R2, writes the hub and an immutable revision per collection, merges the game into `roblox_wiki_registry`, reads everything back. Production also snapshots an overwritten hub to `tmp/publish-snapshots/`, revalidates and fetches each live URL.
- **Official game media:** every Roblox bundle, including collection-only selections, fetches the exact universe's current official 512x512 icon and completed thumbnails requested at 768x432. Every image must fully decode before writes. Thumbnail dimensions must be exactly 768x432, except the first thumbnail may have other landscape dimensions after a selected hub's local 768x432 cover passes exact-hash approval and all cover checks. Invalid or missing approval never enables this exception. Icons and additional thumbnails retain their exact dimensions. Dry runs write nothing. Apply persists that media independently of hub selection. Unavailable or unreadable current media blocks publication; stored URLs are not a fallback.
- **Sidebar icons:** discovery sidebar wiki cards prefer the current universe icon from `wiki_pages_view`. The stats index is a periodic snapshot and supplies a fallback, so a media refresh needs no stats rebuild.
- **Not one transaction.** A late failure can leave some pages published. Rerun the same bundle; revision hashes make it safe.
- **Speed and retries:** image checks, uploads, R2 readback, collection readback, revalidation and live checks run 8 at a time (`scripts/shared/publish-network.mjs`). Database writes stay one at a time, hub first. Network blips and HTTP 429/5xx on reads, R2 calls and live checks retry up to 3 times; validation failures and other 4xx never retry. Long phases print progress (`images 400/3326`), and errors show their real cause with credentials and URL queries removed.
- The dry run is a scoped exception to "no checks locally". Builds, test suites and browser QA still run on GitHub.
- The older path still works: `sync:game-wiki-runtime` and `sync:game-collection-runtime` behind the GitHub `roblox-wiki` and `roblox-collection` publishers, with selected Roblox QA ([release](../operations/release.md#managed-development-content-qa)).

## Content Factory

`/srv/data/projects/bloxodes-content-factory` on the homelab (T3 project "Bloxodes Content Factory") holds only skills, docs and content for Roblox and franchise wiki hubs and collections. No site code.

- **Roles:** the main agent is Codex `gpt-6.1-sol` (`roblox-wiki-main`, `franchise-wiki-main`). One Luna builder per page does research, data, images and a draft (`roblox-wiki-builder`, `franchise-wiki-builder`). One Haiku 5.5 content manager per page rewrites the copy and cleans labels and SEO (`roblox-wiki-content-manager`, `franchise-wiki-content-manager`). `bloxodes-voice` is shared. Only the main agent pushes.
- **Content:** `content/roblox-wiki/<game-slug>/` and `content/franchise-wiki/<namespace>/<game-slug>/` hold the bundles. Everything except media is committed there, so git history is the edit history.
- **Publishing:** `bin/publisher` runs `content:publish`, `content:status` and `content:candidates` from the device's main Bloxodes checkout (`/srv/data/projects/Bloxodes` on the homelab, `~/projects/Bloxodes` on the Macs), which T3 auto-pulls. It never moves that checkout.
- **Repo and devices:** `github.com/RaviTejaKNTS/bloxodes-content-factory` (private, sync only). Checked out next to Bloxodes on each device.
- **Contract changes:** when this repo ships `roblox-wiki@2` or `game-wiki@2`, update the Content Factory docs and skills in the same change, or the factory's pushes will be rejected.

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
- **Hub images:** `/wiki` cards and social previews use the first official 768x432 universe thumbnail. Hubs published with `content:publish` store a copy in R2 as `wiki_pages.cover_image`; older hubs keep reading it from Roblox until republished. The square art next to the title uses the official 512x512 icon. An owner-approved edited cover is an explicit exception: set `hub.coverImage` and pass `--approved-hub-cover-sha256 <sha256>` with its exact reviewed hash on every dry run and apply. The edit must still decode to 768x432 in a supported format and be at most 1,000,000 bytes. Approval applies only to that invocation and hash; the original-byte rule stays the default. This flag requires a selected Roblox hub and local file, and is rejected for franchise bundles.
- **Field labels:** cards and the list use `meta.display.fieldLabels` from the dataset first, then the code's generic field labels.
- **Public copy:** no research notes, provenance, source or image credits, or workflow language. Leave `imageCreditUrl` unset. `walkthroughUrl` is an intended public field.

Item media is served from R2 bucket `bloxodes-wiki` at `media.bloxodes.com/wiki/<key>`.

## The `/wiki` index

`/wiki` is the Roblox wiki hub: a searchable game directory (20 cards a page), collections and platform activity. Code lives in `apps/web/src/lib/wiki-index.ts` and `wiki-index-options.ts`. Filtered views are `noindex, follow`. `/wiki/page/1` redirects to `/wiki`.

## Known issues

- The old homelab wiki controller is gone, but `wiki_generation_queue` and its receipt helpers (`wiki-publication-receipt.ts`, `wiki-publication-state.mjs`, `wiki-publication-binding.mjs`) are still used by CI publication code. Remove them only together with those callers.
