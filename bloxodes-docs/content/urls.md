# URLs

Last verified: 2026-11-01

How public URLs are built, the slug rules every new page follows, and where redirects live.

## Roblox pages

Roblox URLs put the page type first.

| Page | URL | Slug comes from |
| --- | --- | --- |
| Codes | `/codes/<slug>` | `code_pages.slug` |
| Wiki hub | `/wiki/<slug>` | `wiki_pages.slug` |
| Collection | `/wiki/<wiki-slug>/<collection-slug>` | `wiki_collection_pages.wiki_slug`, `collection_slug` |
| Quiz | `/quizzes/<code>` | `quiz_pages.code` |
| Checklist | `/checklists/<slug>` | `checklist_pages.slug` |
| Tool | `/tools/<code>` | `tools.code` |
| Event | `/events/<slug>` | `events_pages.slug` |
| Article | `/articles/<slug>` | `articles.slug` |
| Catalog | `/catalog/<code>` and its hand-built sections | `catalog_pages.code` |
| Stats | `/stats/games/<stats-slug>`, `/stats/items/<asset-id>` | `roblox_universes.slug`, asset ID |

Lists that paginate use `<url>/page/<n>`. Pagination pages are `noindex`.

## Other games

Every non-Roblox game uses page-type URLs, the Roblox pattern:

| Page | URL |
| --- | --- |
| Franchise hub (root, `kind=franchise`) | `/games/<namespace>` |
| Game wiki (single game or franchise child) | `/wiki/<game-slug>` |
| Collection | `/wiki/<game-slug>/<collection-slug>` |
| Map | `/maps/<slug>` |
| Checklist, quiz | `/checklists/<slug>`, `/quizzes/<slug>` |
| Codes | `/codes/<game-slug>` |
| Tool, catalog | `/tools/<namespace>-<slug>`, `/catalog/<namespace>-<slug>` (no prefix added when the slug already starts with the namespace; the stored slug doesn't change) |

Franchise roots can't own collections. Minecraft's editions are the games `minecraft-java` and `minecraft-bedrock`.

Each `game_*` row stores its URL in `canonical_path`. `expected_game_page_path(game_id, page_type, slug)` computes it and database guards refuse any other path. Namespace, game and slug ownership never change.

The page-type routes run the Roblox reader first; only when no Roblox page owns the URL do they look up `site_routes` and render the game page (`lib/page-type-game-route.ts`, `components/games/GameRoutePage.tsx`). GTA map engines, GTA and Red Dead collections, GTA checklists (progress keys `gta:<slug>`), Minecraft edition collections and Minecraft calculators keep their own renderers in `components/games/specialized/`. Index pages (`/wiki`, `/codes`, `/quizzes`, `/checklists`, `/tools`, `/catalog`, `/maps`) list published game pages in an "Other games" section.

`games.url_style` records each namespace's style. New games get `page_type`; a child takes its root's style. Every namespace is `page_type`. `move_game_namespace_to_page_type_urls` and `rewrite_moved_game_links` exist for any root that isn't; a move must ship after the web code that serves its URLs is live, and the link rewrite in a later schema release (the runner applies a release's migrations in one transaction).

Minecraft's legacy child game (`minecraft`, wiki `/minecraft/wiki/legacy-minecraft`, 25 collections) is archived: unpublished, with its rows, datasets and progress kept. Its old URLs redirect to the edition pages (achievements to Bedrock, the rest to Java, or Bedrock when only Bedrock has it).

## Slug rules

Every new page follows these:

- An editorial slug is permanent once published. Don't rename it.
- Use the game's full name: `gta-5`, not `5`.
- Tool, quiz and checklist slugs start with the game name, such as `grow-a-garden-crop-value-calculator`.
- Never copy `roblox_universes.slug` (a stats slug) into an editorial slug.
- Pick slugs that don't already exist for the same page type on either side, Roblox or other games. Both sides will share one set of URLs (see Known issues).

## Redirects

All redirects come from the [route table](#route-table). `apps/web/src/proxy.ts`, called by `apps/web/middleware.ts`, matches each request against an in-memory copy of it (`apps/web/src/lib/site-route-snapshot.ts`, matching rules in `site-route-resolver.ts`). There's no database read per request.

- Only `old` rows redirect. Each uses its row's status code (301 or 308) and an absolute `Location`; Next.js 16.2 throws on a relative one from middleware.
- Root article and codes aliases decode, trim and lowercase the slug and keep the incoming query. The former `next.config.js` rules (pizza-place and `/ads.txt`) keep the incoming query in Next's serialization and run before the canonical-host redirect. Retired lists and free-items categories drop the incoming query and use their own.
- Paths are split into segments before decoding, so an encoded `/` never creates a new segment.
- `minecraftLegacyRedirect` (`apps/web/src/lib/minecraft-paths.ts`) still runs ahead of the table. It handles `?edition=` links and the Minecraft conflicts below.
- A codes page rename redirects its old `/codes/<slug>` once each server refreshes its copy (up to 5 minutes).
- Old namespace URLs of every non-Roblox game (`/gta/...`, `/<namespace>/wiki/...`) are page-linked `old` rows. An old collection URL also matches `/page/<n>` and keeps the number. `/gta/checklists/page/<n>` drops its tail and goes to `/games/gta`. GTA map tiles and artwork keep their `/gta/maps/...` asset URLs.
- `scripts/routes/fixtures/` holds a baseline of 1,138 responses captured from production before the switch. PR checks replay it against the new middleware, including the first request to a fresh server.

Some pages also redirect inside their own route, for example `/page/1` to the list's first page. Those stay with the page.

## Route table

`public.site_routes` maps every page URL to the page that owns it. Redirects are served from it (above). The shared game route also uses it to pick the page (see [franchise](franchise.md#routes)); every other route still finds its page with its own reader.

- **Live rows:** every page in the Roblox page tables, `puzzle_pages`, the eight `game_*` page tables, and a `hub` row for each namespace root in `games`, drafts included. `source` and `page_type` name the owning table; `page_id` is its row ID. A page has one live URL.
- **Old rows:** a redirect. With a `page_id`, it follows that page's current live URL, so a page that moves twice never builds a redirect chain. Without one, it uses `target_url`.
- **Gone rows:** a deleted page's last URL.
- **Prefix rows** match a path and everything below it. Exact beats prefix, and the longest prefix wins. `tail_mode` says whether the rest of the path is appended or dropped; `match_self = false` leaves the bare path alone (used for `/minecraft/wiki`).
- Imported redirects: the former `next.config.js` rules, 12 root article slugs, 360 old root codes slugs, retired lists, free-items category URLs, Minecraft paths, and `/codes/<old-slug>` rows from `code_pages.old_slugs`. Minecraft `?edition=` handling can't be a row and stays in `minecraftLegacyRedirect`.
- Exact `live` and `gone` rows block any broader prefix, so a page under a prefix rule never redirects.
- Triggers keep the table current. They run only when a URL column changes (`slug`, `code`, `canonical_path` and the like). A rename keeps the old URL as an old row; a delete marks it gone. A new page can't take another page's live URL; taking over an old or gone URL is logged in `site_route_conflicts`.
- Retired catalog pages get no live row, so their redirect wins. When a legacy `roblox-free-items` code and a canonical `free-roblox-items` code map to one URL, the canonical page owns it, the same as the reader.
- `resolve_site_route(path)` returns the matching row and its final target. `site_route_redirects` lists every redirect row.
- `npm run routes:report` prints counts, conflicts, missing owners, orphaned redirects and unmapped catalog codes. It's read-only and defaults to managed development; production needs `BLOXODES_ENV_PROFILE=production-preview` and `--allow-prod`. Each schema release saves the managed-development report with its receipt.

## Known issues

- `minecraftLegacyRedirect` still runs ahead of the route table for old `?edition=` links. It resolves the edition target through the table, so they take one hop.
- `apps/web/src/lib/game-route-names.ts` (the old reserved-namespace list) is still read by `scripts/games/publish-game-pages.ts` and `scripts/shared/game-wiki-bundle.ts`, though namespaces no longer become root URLs.
