# Game Wiki and Collection Pipeline

Status: Active
Last verified: 2026-09-07
Evidence: database-only web/mobile/tool loaders, removed repository collection/quiz archives, immutable collection runtime tables, zero-local-media-reference audits in managed development and production, exhaustive 36,068-key R2 byte/readability audit, live route/image checks, route tests, production row counts, Tailscale-reachable GTA preview checks, and managed-development Red Dead cover/hero R2 and route verification

## Scope

Red Dead navigation includes a separate “Game wikis” group in the desktop sidebar and mobile menu, matching the GTA sidebar layout. `redDeadWikiNavLinks` in `site-navigation.ts` owns the five published hub links in newest-first order. Collection routes highlight their parent hub; the group is hidden outside `/red-dead`. Add newly published hubs to this list when releasing them.

Production verified on 2026-09-07 at web SHA `bf7ea6ad71a9d6646f83077ceb373d2912ccf997`: five Red Dead hubs and six collections (271 items) are live with ten hosted hub images, sitemap/search coverage, and 100% Completion excluded. Production migrations `20260920000023` and `20260920000024` are applied. The 19 Roblox and 93 GTA legacy wiki checklist rows now use `collectible`; Red Dead has two collectible and four database collections. Saved-progress rows and storage keys were preserved. Standalone checklist pages are unchanged.

Wiki collection types are `database` (reference rosters) and `collectible` (sets with found/progress tracking). Migration `20260920000024_rename_wiki_checklist_type_to_collectible.sql` converts all legacy wiki `checklist` rows across Roblox, GTA, and Red Dead, including drafts, without changing publication state, URLs, item IDs, datasets, or progress storage. Managed development is migrated; production application is pending. Readers, progress APIs, and manifest imports accept legacy `checklist` values during rollout, but new writes use `collectible`. Standalone `/checklists` pages and their type remain unchanged. Internal checkbox component filenames and saved-progress keys intentionally retain their existing names.

Red Dead's Cigarette Cards and Dinosaur Bones use `collectible` with progress tracking. The cross-category `100-percent` completion tracker alone remains unpublished, with its dataset retained for a future standalone checklist page. Its retained wiki row also received the discriminator rename; this does not approve it for wiki publication.

Game wiki hubs and their game-specific collections are one editorial/data unit:

- `/wiki/<game-slug>` is backed by `wiki_pages`.
- `/wiki/<game-slug>/<collection-slug>` is backed by `wiki_collection_pages`, its `published_dataset_id`, `wiki_collection_datasets`, and `wiki_collection_items`.
- Roblox collection rows use `page_type` (`database` by default, or `collectible` for finite player-completed goals). Both types keep the same v2 dataset and URL; the shared collectible renderer adds search/filter/reset and account/local progress only when the page type is `collectible`.
- Roblox checklist progress uses the existing `user_checklist_progress` table with the `wiki-collection:<code>` namespace and `/api/wiki/collections/progress`. Global `/checklists` progress remains on its original slug contract.
- GTA follows the same hub/collection pattern under its own platform namespace: `/gta/wiki/<game-slug>` uses `gta_games` plus `gta_wiki_pages`, while `/gta/wiki/<game-slug>/<collection-slug>` uses `gta_wiki_collection_pages`, its `published_dataset_id`, `gta_wiki_collection_datasets`, and `gta_wiki_collection_items`. The current public set contains 16 released hubs from Grand Theft Auto through Grand Theft Auto Online; GTA VI rows are retained as unpublished source data until release.
- GTA collection page rows use `page_type` (`database` by default, or `collectible` for progress-oriented location collections). Checklist progress is account-scoped in `user_gta_collection_progress` and exposed by `/api/gta/collections/progress`, with the browser retaining local progress for signed-out visitors.
- The Roblox and GTA collectible pages share the same client renderer and manifest decision (`collection.pageType`), while their server routes, content tables, and progress endpoints stay platform-specific.
- Red Dead follows the same hub/collection contract under the `/red-dead` namespace: `red_dead_games`, `red_dead_wiki_pages`, `red_dead_wiki_collection_pages`, `red_dead_wiki_collection_datasets`, and `red_dead_wiki_collection_items` keep all franchise titles in one platform-owned table family. Collection rows use the same `page_type` values (`database` and `collectible`), and `user_red_dead_collection_progress` provides server-backed collectible progress with signed-out local state. The forward-only schema in `20260920000023_create_red_dead_content_platform.sql` is applied to managed development; the public routes, readers, progress API, search mapping, sitemap, and revalidation consumers are implemented, with production publication still gated separately.
- The verified production database contains 663 published collection pages with valid dataset pointers and 46,732 published item rows.

These collections describe one game's durable systems and items—pets, weapons, crops, locations, NPCs, recipes, mutations, progression systems, and similar player-facing sets. They are not part of the global `/catalog` ingestion pipeline.

## Source and Data Ownership

- Supabase is the only runtime source for collection page copy, display metadata, immutable dataset revisions, item rows, and media keys. Web, mobile, tools, sitemaps, and related-content loaders do not read collection JSON from the repository.
- Repository game-collection and quiz datasets have been removed. Existing collection work starts by exporting the published database revision to `tmp/content-workspace/<game-slug>/collections/<collection-slug>/`; new work creates the same ignored workspace contract. Each collection workspace owns `dataset.json`, `media/`, `final.json`, and `runtime-manifest.json` until an immutable database/R2 revision is published.
- `wiki_pages` owns hub copy, controls, tips, metadata, and game identity.
- `wiki_collection_pages` owns collection page copy, route identity, display configuration, and publication state.
- Collection codes use `<game-slug>-<collection-slug>`; `wiki_slug` must use the editorial game slug, never a stats/universe slug.
- Roblox APIs may verify universe identity, metadata, and thumbnails. Collection item rows come from source research rather than assuming Roblox exposes a complete item endpoint.
- GTA uses the same v2 workspace dataset shape and shared collection renderer, but it does not require a `roblox_universes` row or registered Roblox collection config. Its ignored authoring workspace lives under `tmp/content-workspace/gta/<game-slug>/` and immutable media keys use `gta/<game-slug>/<collection-slug>/...` in the shared wiki R2 bucket.
- Red Dead uses the same v2 workspace shape without Roblox identity requirements. The schema models `content_kind` (`game`, `expansion`, or `online`) plus an optional `parent_game_id` so Story Mode, Undead Nightmare, and Red Dead Online can remain distinct scopes; authoring work belongs under `tmp/content-workspace/red-dead/<game-slug>/` with `red-dead/<game-slug>/<collection-slug>/...` media keys. As of 2026-09-04, managed development has five published Red Dead hubs and seven first-release collection revisions: six text-only databases/checklists and one media-backed Roles database.
- Managed development currently has 26 published GTA 5 collection pages, including 11 checklist collections: Letter Scraps, Spaceship Parts, Submarine Pieces, Nuclear Waste, Epsilon Tracts, Peyote Plants, Monkey Mosaics, Hidden Packages, Stunt Jumps, Under the Bridge, and Knife Flights; production remains intentionally unchanged until an explicit release.

## Roblox wiki landing page

Local implementation checked 2026-09-05; production publication is separate. `/wiki` is a Roblox gaming reference hub with a Roblox fact panel, six topic navigation groups, platform activity, a searchable game directory, published item collections, and reference tables for experiences/places, genres, controls, servers, progression, avatars, purchases, and creators. Platform explanations link to their sources. The overview uses the existing Bloxodes card, collection CTA, and interactive stats chart components. The landing page starts with a short index-style introduction and the searchable card directory; item collections and player activity follow the cards and pagination. The Roblox facts and topic navigation sit beside the reference introduction further down, keeping game discovery near the top on desktop and mobile. Index copy and metadata live in `apps/web/src/app/(site)/wiki/index-content.tsx`; composition lives in `index-page-data.tsx`, separate from per-game `wiki_pages` records.

`apps/web/src/lib/wiki-index.ts` loads published wikis, optional overview data, collection artwork from published database revisions, and non-ended/non-cancelled virtual events for covered games. The wiki view provides genre and timestamped player observations. `wiki-index-options.ts` owns bounded query normalization, combined name/genre filtering, and stable sorting by editorial update, name, or fresh player count. The directory retains 20 existing cards per page and direct Journey card siblings within `#article-body`. Overview data can fail independently of the directory; unavailable events are distinguished from an empty schedule.

The full overview appears only on unfiltered page one. Search and filter requests (`q`, `genre`, `sort`) use server-rendered GET navigation, preserve their normalized query through pagination, and set noindex/follow. `/wiki/page/<number>` has a self-referencing canonical and social URL; unfiltered continuation pages follow the environment's indexing policy. `/wiki/page/1` redirects permanently to `/wiki` while retaining meaningful filters; malformed and out-of-range pages return not-found. CollectionPage/ItemList structured data describes the visible games on each page. The main sitemap already includes `/wiki`, and the wiki sitemap still lists every published game and collection independently of pagination. RSS ownership is unchanged.

Wiki publication revalidates the paginated index paths. The index carries `wiki-index`, `stats`, and `events` Cloudflare tags so content, activity, and event purges cover it. Stats/event revalidation also includes `/wiki`. The activity module describes tracked-game concurrent observations, never daily active users; its aggregate player headline is hidden when `getStatsPlatformPage().totalsComplete` is false. The shared platform chart endpoint owns chart range/resolution requests.

## Workflow

1. Research and approve the wiki hub or collection opportunity, production overlap, game identity, sources, scope, and route.
2. For an existing collection, export its published database revision with `npm run export:game-collection-workspace`; for a new collection, create the same ignored workspace and runtime manifest. Gather the complete source-backed dataset and useful player fields there.
3. Audit the v2 dataset and approve its rows/sections before collecting and wiring images.
4. Write the wiki or collection `final.json` only after the required research/data/image gates pass.
5. Synchronize the approved page and immutable dataset revision from its explicit runtime manifest into managed development, publish its dataset pointer there, then run `verify-wiki-final` or `verify-game-collection-finals` against the managed-development web preview.
6. Review hub-to-collection navigation, item counts, cards/tables, images, metadata, structured data, search, sitemap, and revalidation behavior.
7. Promote through a controlled idempotent seed/upsert or forward-only migration, then verify production.

For GTA, use `verify:gta-wiki-final`, `sync:gta-collection-runtime`, and `verify:gta-collection-final`. These commands default to managed development; GTA production promotion is deliberately outside the initial vertical slice.

For any supported non-Roblox franchise, use `sync:franchise-collection-runtime`, `verify:franchise-wiki-final`, and `verify:franchise-collection-final` with an explicit `--namespace`; these commands default to managed development. GTA compatibility commands remain available, and Red Dead production promotion is deliberately outside this workflow.

### Homelab preview handoff

When the agent is running on `teja-homelab`, a local Next preview must be reachable from the reviewer's other Tailscale device. Bind the managed-development preview to `0.0.0.0` and share routes beneath `http://teja-homelab.tail13b5bd.ts.net:3000`; use `http://100.86.117.125:3000` if MagicDNS is unavailable. Never hand off `localhost:3000` or `127.0.0.1:3000` for remote review. Keep `https://bloxodes.com/...` as the canonical URL and keep production credentials and publication out of preview QA. The homelab command and the large-page webpack/Turbopack recovery procedure live in `dev-docs/infrastructure/homelab.md`.

Use `.agents/skills/bloxodes-gta-wiki-*/SKILL.md` for GTA hub work and `.agents/skills/bloxodes-gta-game-collection-*/SKILL.md` for GTA collection discovery, research, data, images, writing, managed-development verification, and later refreshes. The Roblox wiki and collection skills are not interchangeable with these because they assume Roblox universe identity, tables, routes, and publication commands.

Use the matching wiki and game-collection workflow skills. For existing datasets, `bloxodes-game-collection-refresh` is the maintenance path for one collection, one game, or the registered collection set.

## Scheduled Top-100 Automation

- The homelab daily runner reads the exact production top 100 from `/api/stats/games`, excludes production wiki coverage and every durable queue result, and enqueues the highest-ranked remaining universe in managed development.
- One restricted Codex process runs collection suggestions, parent approval, each approved collection workflow, and the wiki workflow. It must produce a verified hub and at least one source-complete collection; otherwise the queue row is recorded as blocked rather than padded with guessed data.
- All authoring artifacts stay under ignored `tmp/wiki-automation/<queue-id>/`. Runtime publication uses explicit manifests with `sync-game-collection-runtime.ts` and `sync-game-wiki-runtime.ts`; no collection dataset or quiz payload is registered in code.
- The scheduled service uploads shared R2 media and publishes only to managed development, then records `managed_dev_ready`. Production release remains a separate reviewed operation.
- The wiki and article agents share one host lock. The daily wiki timer is persistent, and readiness retries transient managed-development, R2, and public API failures before failing the unit.
- A dirty operator checkout is diagnostic, not a failure condition: scheduled wiki work is database/media-only, and the restricted systemd unit cannot write tracked source.

## Images and Renderer Readiness

Red Dead hub covers must use landscape source artwork or screenshots and fill the 16:9 card edge to edge. The media sync rejects cover sources below a 1.5 aspect ratio and uses a cover resize; padding portrait box art into a wide canvas does not satisfy this requirement. Square title artwork uses a separate source. Verify actual browser screenshots as well as image dimensions and database URLs.

Collection image manifests are authoring inputs. Runtime item media is stored by immutable R2 object key in `wiki_collection_items` and served through the wiki-media worker. A collection is not ready merely because its copy exists: every item count, media key, section, sort order, useful field, badge/subtitle/description mapping, pagination state, and responsive renderer must be checked.

Wiki hub images have separate roles. For Roblox, `/wiki` cards and social previews use the first official 768x432 universe thumbnail, while the square artwork beside a wiki title uses the current official 512x512 universe icon. GTA and supported non-Roblox franchises use the same UI contract through `<namespace>_games.cover_image` for wide cards/social previews and `<namespace>_games.hero_image` for separate square-friendly title artwork. `sync:gta-wiki-media` and `sync:franchise-wiki-media --namespace <namespace>` source-check, optimize, and upload reviewed assets to the shared `bloxodes-wiki` R2 bucket, then store only `https://media.bloxodes.com/wiki/...` URLs in managed development; runtime must not depend on direct source-site hotlinks. Universe linking fetches missing official media immediately, rotating enrichment replaces the active fields and primary rows with Roblox's current media while retaining prior URLs as history, and `sync-game-wiki-runtime.ts` refuses publication unless both roles exist. Wiki finals must leave `cover_image` null; a reviewed exception requires the explicit `--allow-cover-override` flag.

The legacy public game-image migration completed on 2026-09-02. Managed development and production now have zero local image paths in published articles, wiki covers, or collection thumbnails. The final pass replaced 386 collection thumbnails and the remaining 29 older thumbnails with exact published item R2 objects, moved affected article image/source references, repaired the two missing Fisch rod-skin images, and restored three exact wiki covers from Git history into immutable R2 keys. The complete managed-development set contains 36,068 unique R2 keys; production's 36,065-key set is a strict subset, and every key passed live `HEAD` plus expected-byte validation.

The 57 legacy game directories were removed from `apps/web/public/` on 2026-09-02 after the database/R2 readback and live-object checks passed. That removed 34,369 files (3,176,044 KiB, about 3.03 GiB); the public tree is now about 6.4 MiB and retains only the protected `article-covers`, `articles`, `browser-extension`, and `images` directories plus root site assets. Brand assets, report images, article media, and browser-extension assets remain in the repository.

Readable source-provided item names or labels baked into an otherwise valid row image are acceptable. Do not reject an exact item image solely because the source includes the item name; provenance and reuse concerns should be recorded separately in the collection brief.

Text-only rows are acceptable only when clean row-level media is unavailable and the decision is recorded in the owning dataset/documentation. Do not substitute unrelated crops, edited art, or generic game thumbnails for missing item images.

## Deployment Boundary

Collectible rename rollout: managed development records version `20260920000024`, aligned with the repository after explicit release approval. `publish:franchise-wiki-hubs` supports controlled production hub publication from reviewed authoring files with hosted media URLs; the lower-level franchise collection sync publishes only explicitly selected manifests. Exclude the deferred `100-percent` manifest from release allowlists. The production schema runner must strip transaction wrappers before its rollback-only plan; use the current production runner, not an older task-checkout copy.

- Collection row, display, and media changes publish through a new immutable database revision, pointer update, and revalidation. They do not require the web container to read repository data or public collection assets.
- `wiki_pages` and `wiki_collection_pages` copy publish through controlled database writes plus revalidation.
- A wiki hub and its collections should be reviewed together when navigation, identity, collection registration, or shared game data changes.
