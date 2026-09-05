# Game Wiki and Collection Pipeline

Status: Active
Last verified: 2026-09-05
Evidence: database-only web/mobile/tool loaders, removed repository collection/quiz archives, immutable collection runtime tables, zero-local-media-reference audits in managed development and production, exhaustive R2 audits, live route/image checks, route tests, exact production row/pointer counts, 209-route production crawl, and Tailscale-reachable GTA preview checks

## Scope

Game wiki hubs and their game-specific collections are one editorial/data unit:

- `/wiki/<game-slug>` is backed by `wiki_pages`.
- `/wiki/<game-slug>/<collection-slug>` is backed by `wiki_collection_pages`, its `published_dataset_id`, `wiki_collection_datasets`, and `wiki_collection_items`.
- Roblox collection rows use `page_type` (`database` by default, or `checklist` for finite player-completed goals). Both types keep the same v2 dataset and URL; the shared checklist renderer adds search/filter/reset and account/local progress only when the page type is `checklist`.
- Roblox checklist progress uses the existing `user_checklist_progress` table with the `wiki-collection:<code>` namespace and `/api/wiki/collections/progress`. Global `/checklists` progress remains on its original slug contract.
- GTA follows the same hub/collection pattern under its own platform namespace: `/gta/wiki/<game-slug>` uses `gta_games` plus `gta_wiki_pages`, while `/gta/wiki/<game-slug>/<collection-slug>` uses `gta_wiki_collection_pages`, its `published_dataset_id`, `gta_wiki_collection_datasets`, and `gta_wiki_collection_items`. Managed development and production contain the 16 released hubs from Grand Theft Auto through Grand Theft Auto Online. Production serves 32 distinct R2 hub assets, including an enforced-square title thumbnail for every hub. GTA VI rows are retained as unpublished source data until release.
- GTA collection page rows use `page_type` (`database` by default, or `checklist` for progress-oriented location collections). Checklist progress is account-scoped in `user_gta_collection_progress` and exposed by `/api/gta/collections/progress`, with the browser retaining local progress for signed-out visitors.
- The Roblox and GTA checklist pages share the same client renderer and manifest decision (`collection.pageType`), while their server routes, content tables, and progress endpoints stay platform-specific.
- The verified production database contains 846 published collection pages with valid dataset pointers and 54,613 rows in their active immutable revisions: 673 Roblox pages with 47,084 items and 173 GTA pages with 7,529 items. Roblox contains 654 database pages and 19 checklist pages; GTA contains 80 database pages and 93 checklist pages. There are zero drafts or missing published-dataset pointers in either page family. The 19 approved Roblox checklist conversions retain their expected 1,134 tracked items.

These collections describe one game's durable systems and items—pets, weapons, crops, locations, NPCs, recipes, mutations, progression systems, and similar player-facing sets. They are not part of the global `/catalog` ingestion pipeline.

## Source and Data Ownership

- Supabase is the only runtime source for collection page copy, display metadata, immutable dataset revisions, item rows, and media keys. Web, mobile, tools, sitemaps, and related-content loaders do not read collection JSON from the repository.
- Repository game-collection and quiz datasets have been removed. Existing collection work starts by exporting the published database revision to `tmp/content-workspace/<game-slug>/collections/<collection-slug>/`; new work creates the same ignored workspace contract. Each collection workspace owns `dataset.json`, `media/`, `final.json`, and `runtime-manifest.json` until an immutable database/R2 revision is published.
- `wiki_pages` owns hub copy, controls, tips, metadata, and game identity.
- `wiki_collection_pages` owns collection page copy, route identity, display configuration, and publication state.
- Collection codes use `<game-slug>-<collection-slug>`; `wiki_slug` must use the editorial game slug, never a stats/universe slug.
- Roblox APIs may verify universe identity, metadata, and thumbnails. Collection item rows come from source research rather than assuming Roblox exposes a complete item endpoint.
- GTA uses the same v2 workspace dataset shape and shared collection renderer, but it does not require a `roblox_universes` row or registered Roblox collection config. Its ignored authoring workspace lives under `tmp/content-workspace/gta/<game-slug>/` and immutable media keys use `gta/<game-slug>/<collection-slug>/...` in the shared wiki R2 bucket.
- Managed development currently has 173 published GTA collections across 16 hubs, including 80 database pages and 93 checklist pages. GTA 5 contains 26 published collections, including 11 checklist collections: Letter Scraps, Spaceship Parts, Submarine Pieces, Nuclear Waste, Epsilon Tracts, Peyote Plants, Monkey Mosaics, Hidden Packages, Stunt Jumps, Under the Bridge, and Knife Flights.

## Roblox wiki landing page

Local implementation checked 2026-09-05; production publication is separate. `/wiki` is a Roblox gaming reference hub with a Roblox fact panel, topic navigation, platform activity, a searchable game directory, published item collections, and reference tables for experiences, genres, controls, servers, progression, avatars, purchases, and creators. The overview uses the existing Bloxodes game cards, collection CTA, and interactive stats chart components. The landing page starts with a short index introduction and searchable cards; collections and player activity follow the cards and pagination so game discovery stays near the top on desktop and mobile.

`apps/web/src/lib/wiki-index.ts` loads published wikis, optional overview data, collection artwork from published revisions, and scheduled virtual events. `wiki-index-options.ts` owns bounded query normalization, name/genre filtering, and stable sorting by editorial update, name, or fresh player count. The directory retains 20 cards per page and direct Journey card siblings within `#article-body`.

The full overview appears only on unfiltered page one. Search and filter requests (`q`, `genre`, `sort`) use server-rendered GET navigation, preserve normalized query through pagination, and set `noindex, follow`. `/wiki/page/<number>` has a self-referencing canonical and social URL; `/wiki/page/1` permanently redirects to `/wiki` while retaining meaningful filters. CollectionPage/ItemList structured data describes the visible games on each page. The main sitemap includes `/wiki`, while the wiki sitemap lists every published game and collection independently of pagination.

Wiki publication revalidates paginated index paths. The index carries `wiki-index`, `stats`, and `events` Cloudflare tags so content, activity, and event purges cover it. The activity module describes tracked-game concurrent observations, never daily active users; its aggregate player headline is hidden when `getStatsPlatformPage().totalsComplete` is false. The shared platform chart endpoint owns chart range and resolution requests.

## Workflow

1. Research and approve the wiki hub or collection opportunity, production overlap, game identity, sources, scope, and route.
2. For an existing collection, export its published database revision with `npm run export:game-collection-workspace`; for a new collection, create the same ignored workspace and runtime manifest. Gather the complete source-backed dataset and useful player fields there.
3. Audit the v2 dataset and approve its rows/sections before collecting and wiring images.
4. Write the wiki or collection `final.json` only after the required research/data/image gates pass.
5. Synchronize the approved page and immutable dataset revision from its explicit runtime manifest into managed development, publish its dataset pointer there, then run `verify-wiki-final` or `verify-game-collection-finals` against the managed-development web preview.
6. Review hub-to-collection navigation, item counts, cards/tables, images, metadata, structured data, search, sitemap, and revalidation behavior.
7. Promote through a controlled idempotent seed/upsert or forward-only migration, then verify production.

For GTA authoring, use `verify:gta-wiki-final`, `sync:gta-collection-runtime`, and `verify:gta-collection-final`. The verifiers remain managed-development-only. Reviewed production promotion uses `sync:gta-wiki-runtime`, `sync:gta-wiki-media`, and `sync:gta-collection-runtime`; each command is dry-run-first and requires `--apply --allow-prod` against the recognized production target.

### Homelab preview handoff

When the agent is running on `teja-homelab`, bind the managed-development preview to `0.0.0.0` and share routes beneath `http://teja-homelab.tail13b5bd.ts.net:3000`; use `http://100.86.117.125:3000` if MagicDNS is unavailable. Never hand off `localhost` or `127.0.0.1` when the reviewer is on another tailnet device. Keep `https://bloxodes.com/...` as the canonical URL and keep production credentials and publication out of preview QA. The exact command and large-page webpack recovery procedure live in `dev-docs/infrastructure/homelab.md`.

Use `.agents/skills/bloxodes-gta-wiki-*/SKILL.md` for GTA hub work and `.agents/skills/bloxodes-gta-game-collection-*/SKILL.md` for GTA collection discovery, research, data, images, writing, managed-development verification, and later refreshes. The Roblox wiki and collection skills are not interchangeable with these because they assume Roblox universe identity, tables, routes, and publication commands.

Use the matching wiki and game-collection workflow skills. For existing datasets, `bloxodes-game-collection-refresh` is the maintenance path for one collection, one game, or the registered collection set.

## Scheduled Top-100 Automation

- The homelab daily runner reads the exact production top 100 from `/api/stats/games`, excludes production wiki coverage and every durable queue result, and enqueues the highest-ranked remaining universe in managed development.
- One restricted Codex process runs collection suggestions, parent approval, each approved collection workflow, and the wiki workflow. It must produce a verified hub and at least one source-complete collection; otherwise the queue row is recorded as blocked rather than padded with guessed data.
- All authoring artifacts stay under ignored `tmp/wiki-automation/<queue-id>/`. Runtime publication uses explicit manifests with `sync-game-collection-runtime.ts` and `sync-game-wiki-runtime.ts`; no collection dataset or quiz payload is registered in code.
- The scheduled service uploads shared R2 media and publishes only to managed development, then records `managed_dev_ready`. Production release remains a separate reviewed operation.
- The wiki and article agents share one host lock. The daily wiki timer is persistent, and readiness retries transient managed-development, R2, and public API failures before failing the unit.

## Images and Renderer Readiness

Collection image manifests are authoring inputs. Runtime item media is stored by immutable R2 object key in `wiki_collection_items` and served through the wiki-media worker. A collection is not ready merely because its copy exists: every item count, media key, section, sort order, useful field, badge/subtitle/description mapping, pagination state, and responsive renderer must be checked.

Wiki hub images have separate roles. For Roblox, `/wiki` cards and social previews use the first official 768x432 universe thumbnail, while the square artwork beside a wiki title uses the current official 512x512 universe icon. GTA uses the same UI contract through `gta_games.cover_image` for cards/social previews and `gta_games.hero_image` for separate square title artwork. `sync:gta-wiki-media` source-checks, optimizes, uploads, and verifies the reviewed GTA assets in the shared `bloxodes-wiki` R2 bucket; its thumbnail pipeline center-crops to a bounded square and rejects non-square output before upload. It stores only `https://media.bloxodes.com/wiki/...` URLs, so runtime does not depend on direct Wikia/Rockstar hotlinks. Universe linking fetches missing official media immediately, rotating enrichment replaces the active fields and primary rows with Roblox's current media while retaining prior URLs as history, and `sync-game-wiki-runtime.ts` refuses publication unless both roles exist. Wiki finals must leave `cover_image` null; a reviewed exception requires the explicit `--allow-cover-override` flag.

The legacy public game-image migration completed on 2026-09-02. Managed development and production now have zero local image paths in published articles, wiki covers, or collection thumbnails. The final pass replaced 386 collection thumbnails and the remaining 29 older thumbnails with exact published item R2 objects, moved affected article image/source references, repaired the two missing Fisch rod-skin images, and restored three exact wiki covers from Git history into immutable R2 keys. The complete managed-development set contains 36,068 unique R2 keys; production's 36,065-key set is a strict subset, and every key passed live `HEAD` plus expected-byte validation.

The 57 legacy game directories were removed from `apps/web/public/` on 2026-09-02 after the database/R2 readback and live-object checks passed. That removed 34,369 files (3,176,044 KiB, about 3.03 GiB); the public tree is now about 6.4 MiB and retains only the protected `article-covers`, `articles`, `browser-extension`, and `images` directories plus root site assets. Brand assets, report images, article media, and browser-extension assets remain in the repository.

Readable source-provided item names or labels baked into an otherwise valid row image are acceptable. Do not reject an exact item image solely because the source includes the item name; provenance and reuse concerns should be recorded separately in the collection brief.

Text-only rows are acceptable only when clean row-level media is unavailable and the decision is recorded in the owning dataset/documentation. Do not substitute unrelated crops, edited art, or generic game thumbnails for missing item images.

The verified GTA production set has 7,508 image-backed active rows. Its only text-only exception is the 21 non-physical effect rows in `gta-5-cheats`; those commands do not have exact item media, so the page keeps them text-only instead of using generic gameplay art.

## Deployment Boundary

- Collection row, display, and media changes publish through a new immutable database revision, pointer update, and revalidation. They do not require the web container to read repository data or public collection assets.
- `wiki_pages` and `wiki_collection_pages` copy publish through controlled database writes plus revalidation.
- A wiki hub and its collections should be reviewed together when navigation, identity, collection registration, or shared game data changes.
