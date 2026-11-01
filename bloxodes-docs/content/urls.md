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

Each namespace has a URL style in `games.url_style`. New games use `page_type`; games published before the switch keep `namespace` until a reviewed migration moves them. A child game always has its root's style.

**Page-type style** (the Roblox pattern):

| Page | URL |
| --- | --- |
| Franchise hub (root, `kind=franchise`) | `/games/<namespace>` |
| Game wiki (single game or franchise child) | `/wiki/<game-slug>` |
| Collection | `/wiki/<game-slug>/<collection-slug>` |
| Map | `/maps/<slug>` |
| Checklist, quiz | `/checklists/<slug>`, `/quizzes/<slug>` |
| Codes | `/codes/<game-slug>` |
| Tool, catalog | `/tools/<namespace>-<slug>`, `/catalog/<namespace>-<slug>` (no prefix added when the slug already starts with the namespace; the stored slug doesn't change) |

Franchise roots can't own collections. The page-type routes look up `site_routes` and render the game page only when no Roblox page owns the URL; Roblox pages render exactly as before. Index pages (`/wiki`, `/codes`, `/quizzes`, `/checklists`, `/tools`, `/catalog`, `/maps`) list published page-type game pages in an "Other games" section.

**Namespace style** (games not moved yet). Three route systems serve them:

| Games | Route code | URLs |
| --- | --- | --- |
| GTA, Red Dead | Hand-written folders `(site)/gta`, `(site)/red-dead` | `/gta/wiki/<game>/<collection>`, `/gta/maps/<slug>`, `/gta/checklists/<slug>` |
| Minecraft | Hand-written folder `(site)/minecraft` | `/minecraft/<java|bedrock>/wiki/<collection>`, `/minecraft/tools/<tool>` |
| Every other game | Registry route `(site)/[slug]/[[...segments]]` | `/<namespace>/wiki`, `/<namespace>/wiki/<game>/<collection>`, `/<namespace>/<maps|quizzes|catalog|checklists|tools>/<slug>` |

Each `game_*` row stores its URL in `canonical_path`. `expected_game_page_path(game_id, page_type, slug)` computes the right path for the game's style, and database guards refuse any other path. Namespace, game and slug ownership never change.

### Moving a namespace

Only a reviewed migration moves a namespace, by calling `move_game_namespace_to_page_type_urls(namespace)`. It switches every game in the namespace to `page_type` and rewrites each page's `canonical_path`; the `site_routes` triggers turn every old URL into a redirect to the new one. It also adds redirects for the namespace root, `/<namespace>/wiki` and the old directory listings, and old collection `/page/<n>` URLs keep their page number. It refuses unknown namespaces and namespaces without a root wiki.

GTA, Red Dead and Minecraft keep their specialized pages after a move: the page-type routes hand each page to the same renderer the old route uses (GTA map engines and collectible collections, GTA checklists with their `gta:<slug>` progress keys, Red Dead collections, Minecraft edition pages and calculators). Curated nav, home links, search, sitemaps and the feed follow `url_style`, so nothing changes until a namespace moves.

Minecraft's legacy child game (`minecraft`, wiki `/minecraft/wiki/legacy-minecraft`, 25 collections at `/minecraft/wiki/<slug>`) duplicates the Java and Bedrock editions. Moving Minecraft archives it: the game is unpublished, its rows, datasets and progress stay, and its old URLs redirect to the edition page (achievements to Bedrock, the rest to Java, or Bedrock when only Bedrock has it). The move refuses to run if Minecraft's data doesn't have exactly that shape. `minecraftLegacyRedirect` resolves `?edition=` links through the route table, so they take one hop after the move.

`rewrite_moved_game_links(namespace)` then rewrites internal links to the old URLs in stored page text. It takes only row locks, so it runs in a later schema release than the move: the schema runner applies all pending migrations in one transaction.

A move must ship after the web code that serves the new URLs is live, never in the same release.

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

- The Minecraft root wiki and its `achievements` collection still store the legacy paths `/minecraft/wiki` and `/minecraft/wiki/achievements` in `canonical_path`. So `site_routes` lists them as live, and the two Minecraft redirect rows lose to them (logged in `site_route_conflicts`). `minecraftLegacyRedirect` still serves those redirects, so it must keep running ahead of any route table lookup until Minecraft moves.
- `peak` and `risk-of-rain` are on page-type URLs. Every other game published before 2026-11-02 is still on namespace-style URLs; they move namespace by namespace, and GTA, Red Dead and Minecraft move last, with their renderers. Don't add route code for a single namespace.
